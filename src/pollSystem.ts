import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdapter } from "./adapters/registry.js";
import { getSystem } from "./catalog/systems.js";
import { overridesFor } from "./catalog/redundancy-overrides.js";
import { attributionOverridesFor } from "./catalog/attribution-overrides.js";
import { ingest, type IngestResult } from "./ingest.js";
import { pushNotification } from "./lib/notify.js";
import type { NormalizedRead } from "./types.js";

// The archiving-relevant core of a poll, shared between the CLI (src/poll.ts,
// which adds arg parsing + a console summary) and the Netlify scheduled
// function (netlify/functions/poll.mts, which runs this over every system
// in parallel on a timer instead of GitHub Actions cron). Kept dependency-
// light and free of console formatting so it's cheap to call in a loop.

export interface PollSystemResult {
  systemId: string;
  read: NormalizedRead;
  overrideWarnings: string[]; // stale/typo'd manual override ids — never thrown, just surfaced
  result: IngestResult | null; // null when dryRun or no db configured
}

export async function pollSystem(
  systemId: string,
  db: SupabaseClient | null,
): Promise<PollSystemResult> {
  const system = getSystem(systemId);
  if (!system) throw new Error(`System "${systemId}" is not in the catalog.`);

  const read = await getAdapter(systemId).fetch();

  const overrideWarnings: string[] = [];
  const knownExt = new Set(read.units.map((u) => u.externalId));
  for (const ext of overridesFor(systemId).keys()) {
    if (!knownExt.has(ext)) {
      overrideWarnings.push(`manual redundancy override "${ext}" matches no live unit — check the id`);
    }
  }

  // Attribution overrides (src/catalog/attribution-overrides.ts) are a
  // correction for a SPECIFIC ongoing outage, not a standing guess — once the
  // ambiguous advisory stops being reported, the override goes quiet and
  // should be pruned (see the file's header) before it can silently
  // mis-attribute a future, unrelated outage at the same station.
  const reportedExt = new Set(read.outages.map((o) => o.unitExternalId));
  for (const [fromExt, override] of attributionOverridesFor(systemId)) {
    if (!reportedExt.has(fromExt)) {
      overrideWarnings.push(
        `attribution override "${fromExt}" -> "${override.toUnitExternalId}" is no longer being reported — ` +
          `the outage it was confirmed for may have resolved. Review and remove it from attribution-overrides.ts ` +
          `if so (leaving it could mis-attribute a future, unrelated outage).`,
      );
    }
  }

  if (!db) return { systemId, read, overrideWarnings, result: null };

  const result = await ingest(db, system, read);

  // UNIVERSAL "unidentified outage" flag: when a poll opens an outage we
  // couldn't confidently place onto a known elevator, ping a human (ntfy).
  // Only NEWLY-opened flagged outages notify, so a standing one doesn't
  // re-alert every 5 minutes. Best-effort — a failed push never fails the poll.
  if (result.newlyFlagged.length) {
    const lines = result.newlyFlagged.map((f) => `• ${f.stationName} (${f.unitExternalId}): ${f.reason}`).join("\n");
    await pushNotification(
      `LiftWatch: ${result.newlyFlagged.length} unidentified elevator outage(s) — ${systemId}`,
      `An outage couldn't be confidently placed onto a known elevator and needs review:\n\n${lines}`,
      { priority: "high", tags: "elevator,warning" },
    );
  }

  return { systemId, read, overrideWarnings, result };
}
