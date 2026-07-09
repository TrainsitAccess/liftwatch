import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { knownSystemIds } from "../../src/adapters/registry.js";
import { getSupabase } from "../../src/lib/supabase.js";
import { pollSystem } from "../../src/pollSystem.js";
import { buildSiteData } from "../../src/site/build-site-data.js";

// Replaces .github/workflows/poll.yml's GitHub Actions cron — moved here
// because GitHub silently stops firing scheduled workflows for extended
// periods on lower-traffic/public repos (confirmed live: BART's Coliseum
// outage sat unarchived for 30+ minutes past its 10-minute schedule on
// 2026-07-09, with no error, just a gap in gh run list). Netlify's own
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
// own try/catch.
//
// After every system has been attempted, the site's data payloads are
// rebuilt (buildSiteData, the same core `npm run site:data` uses) and
// written to Netlify BLOBS — NOT a build hook. The static pages fetch
// /data.json and /systems/{id}.json, which netlify/functions/data.mts
// serves straight from these blobs, so fresh data reaches the live site
// every poll with ZERO rebuilds/deploys (a build-hook-per-poll design would
// have burned ~288 build-minutes/day at this 5-min cadence — ~9x the free
// tier — just to swap a 17 KB JSON file). Deploys now happen only on push.

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

  // Refresh the site's data blobs even if some polls failed — buildSiteData
  // reads whatever is in the archive, so partial freshness still beats
  // serving stale data for every system.
  try {
    const { data, systemDetails } = await buildSiteData(db);
    const store = getStore("site-data");
    await store.setJSON("data.json", data);
    for (const { id, detail } of systemDetails) {
      await store.setJSON(`systems/${id}.json`, detail);
    }
    console.log(`site-data blobs refreshed (data.json + ${systemDetails.length} system pages).`);
  } catch (err) {
    console.error("Failed to refresh site-data blobs:", err instanceof Error ? err.message : err);
  }
};

export const config: Config = {
  schedule: "*/5 * * * *",
};
