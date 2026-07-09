import type { Config } from "@netlify/functions";
import { knownSystemIds } from "../../src/adapters/registry.js";
import { getSupabase } from "../../src/lib/supabase.js";
import { pollSystem } from "../../src/pollSystem.js";

// Replaces .github/workflows/poll.yml's "*/10 * * * *" GitHub Actions cron —
// moved here because GitHub silently stops firing scheduled workflows for
// extended periods on lower-traffic/public repos (confirmed live: BART's
// Coliseum outage sat unarchived for 30+ minutes past its 10-minute schedule
// on 2026-07-09, with no error, just a gap in gh run list). Netlify's own
// scheduled functions carry the same "best effort" caveat in principle, but
// are materially more reliable in practice for this account (see the
// Lighter Than Air Notification project's `flight-watch.mts`, the reference
// this file's shape is copied from).
//
// BACKGROUND function (not a regular scheduled function) deliberately:
// regular Netlify functions cap at 30s wall-clock, and polling 8 external
// feeds sequentially — each with its own up-to-30s fetch timeout — risks
// blowing that on a single slow feed. Background functions get up to 15
// minutes, trivially safe for this workload.
//
// One feed failing must not stop the others (mirrors poll.yml's
// `if: ${{ !cancelled() }}` on every step) — each system is wrapped in its
// own try/catch. After every system has been attempted, a Netlify Build Hook
// is pinged so the public site rebuilds (regenerating site/data.json via
// `npm run site:data`) with whatever just landed in the archive.

export default async (req: Request): Promise<void> => {
  let nextRun: string | undefined;
  try {
    nextRun = ((await req.json()) as { next_run?: string })?.next_run;
  } catch {
    // Manual invoke (Netlify CLI/dashboard "Test function") sends no body.
  }
  console.log(`poll-background starting${nextRun ? ` (next scheduled run: ${nextRun})` : " (manual invoke)"}`);

  const db = getSupabase();
  if (!db) {
    console.error("No SUPABASE_* env configured on this Netlify site — nothing to do.");
    return;
  }

  let succeeded = 0;
  let failed = 0;
  for (const systemId of knownSystemIds()) {
    try {
      const { result, overrideWarnings } = await pollSystem(systemId, db);
      for (const w of overrideWarnings) console.warn(`[${systemId}] ${w}`);
      console.log(
        `[${systemId}] opened ${result?.eventsOpened ?? 0}, closed ${result?.eventsClosed ?? 0}, ` +
          `${result?.outagesOpen ?? 0} open, ${result?.flagsRaised ?? 0} flag(s).`,
      );
      succeeded++;
    } catch (err) {
      failed++;
      console.error(`[${systemId}] poll failed:`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`poll-background done — ${succeeded} succeeded, ${failed} failed.`);

  const hookUrl = Netlify.env.get("NETLIFY_BUILD_HOOK_URL");
  if (!hookUrl) {
    console.warn("NETLIFY_BUILD_HOOK_URL not set — skipping site rebuild trigger.");
    return;
  }
  try {
    const res = await fetch(hookUrl, { method: "POST" });
    console.log(`Build hook triggered: HTTP ${res.status}`);
  } catch (err) {
    console.error("Failed to trigger build hook:", err instanceof Error ? err.message : err);
  }
};

export const config: Config = {
  schedule: "*/10 * * * *",
};
