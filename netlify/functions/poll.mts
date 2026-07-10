import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { knownSystemIds } from "../../src/adapters/registry.js";
import { getSystem } from "../../src/catalog/systems.js";
import { getSupabase } from "../../src/lib/supabase.js";
import { pollSystem } from "../../src/pollSystem.js";
import { buildSiteData } from "../../src/site/build-site-data.js";

// Replaces .github/workflows/poll.yml's GitHub Actions cron — moved here
// because GitHub silently stops firing scheduled workflows for extended
// periods on lower-traffic/public repos (confirmed live: BART's Coliseum
// outage sat unarchived for 30+ minutes past its 10-minute schedule on
// 2026-07-09, with no error, just a gap in gh run list).
//
// REGULAR scheduled function, NOT a background one — learned the hard way
// (2026-07-09, first Netlify deploy): this file was originally named
// poll-background.mts, and the "-background" name suffix forces background
// invocation mode, which Netlify's scheduler silently never fires — the
// schedule registered in the deploy log ("Scheduling functions:
// poll-background") and the manifest, but 12+ minutes passed with zero
// scheduled invocations while a manual HTTP POST to the function returned
// 202 and ran fine. Scheduled functions only work as regular synchronous
// functions, which cap at 30s wall-clock — so the per-system polls run in
// PARALLEL (Promise.allSettled) instead of poll.yml's sequential steps:
// typical wall-clock becomes the slowest single feed (a few seconds), not
// the sum of all 8. A pathologically hung feed (each adapter fetch has its
// own up-to-30s timeout) can still blow the ceiling and lose that ONE
// cycle — acceptable: the next 5-min cycle retries, and ingest is
// idempotent. allSettled keeps one failing feed from stopping the others
// (mirrors poll.yml's per-step `if: ${{ !cancelled() }}`).
//
// After the polls, the site's data payloads are rebuilt (buildSiteData, the
// same core `npm run site:data` uses) and written to Netlify BLOBS — NOT a
// build hook. The static pages fetch /data.json and /systems/{id}.json,
// which netlify/functions/data.mts serves straight from these blobs, so
// fresh data reaches the live site every poll with ZERO rebuilds/deploys
// (a build-hook-per-poll design would have burned ~288 build-minutes/day
// at this 5-min cadence — ~9x the free tier — just to swap a 17 KB JSON
// file). Deploys now happen only on push.

export default async (req: Request): Promise<Response> => {
  let nextRun: string | undefined;
  try {
    nextRun = ((await req.json()) as { next_run?: string })?.next_run;
  } catch {
    // Manual invoke (curl/dashboard "Test function") sends no body.
  }
  console.log(`poll starting${nextRun ? ` (next scheduled run: ${nextRun})` : " (manual invoke)"}`);

  const db = getSupabase();
  if (!db) {
    console.error("No SUPABASE_* env configured on this Netlify site — nothing to do.");
    return new Response("no supabase env", { status: 500 });
  }

  // Hidden systems (SystemCatalogEntry.hidden — TMB today) are withheld from
  // the site AND not polled. The old GitHub workflow enforced this by simply
  // commenting out the system's step; the registry has no such filter, so it
  // must happen here (knownSystemIds() returns all 9 systems, hidden or not).
  const systemIds = knownSystemIds().filter((id) => getSystem(id)?.hidden !== true);
  const settled = await Promise.allSettled(
    systemIds.map(async (systemId) => {
      const { result, overrideWarnings } = await pollSystem(systemId, db);
      for (const w of overrideWarnings) console.warn(`[${systemId}] ${w}`);
      console.log(
        `[${systemId}] opened ${result?.eventsOpened ?? 0}, closed ${result?.eventsClosed ?? 0}, ` +
          `${result?.outagesOpen ?? 0} open, ${result?.flagsRaised ?? 0} flag(s).`,
      );
    }),
  );
  let succeeded = 0;
  let failed = 0;
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") succeeded++;
    else {
      failed++;
      console.error(`[${systemIds[i]}] poll failed:`, s.reason instanceof Error ? s.reason.message : s.reason);
    }
  });
  console.log(`poll done — ${succeeded} succeeded, ${failed} failed.`);

  // Refresh the site's data blobs even if some polls failed — buildSiteData
  // reads whatever is in the archive, so partial freshness still beats
  // serving stale data for every system.
  try {
    const { data, systemDetails } = await buildSiteData(db);
    const store = getStore("site-data");
    await store.setJSON("data.json", data);
    await Promise.all(systemDetails.map(({ id, detail }) => store.setJSON(`systems/${id}.json`, detail)));
    console.log(`site-data blobs refreshed (data.json + ${systemDetails.length} system pages).`);
  } catch (err) {
    console.error("Failed to refresh site-data blobs:", err instanceof Error ? err.message : err);
  }

  return new Response(`poll done — ${succeeded} succeeded, ${failed} failed`, { status: 200 });
};

export const config: Config = {
  schedule: "*/5 * * * *",
};
