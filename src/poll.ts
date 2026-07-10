import "dotenv/config"; // load .env before anything reads process.env
import type { NormalizedOutage, NormalizedRead } from "./types.js";
import { knownSystemIds } from "./adapters/registry.js";
import { getSystem } from "./catalog/systems.js";
import { stationModelsFor } from "./catalog/station-models.js";
import { allElevators, chainDisplayName, findElevator, stationAccessibilityState } from "./lib/accessibility.js";
import { getSupabase } from "./lib/supabase.js";
import { pollSystem } from "./pollSystem.js";

// Usage:
//   npm run poll -- <systemId> [--dry-run]
//   npm run poll:dry           (mta-nyct, no DB writes)
// With no Supabase env configured, always runs dry (fetch + normalize only).

function summarize(
  read: NormalizedRead,
  baseline: "assumed" | "confirmed-none",
  inventoryComplete: boolean,
): void {
  const models = stationModelsFor(read.systemId);
  const redundantByExt = new Map(read.units.map((u) => [u.externalId, u.isRedundant]));
  const activeUnits = read.units.filter((u) => u.isActive).length;
  const adaCount = read.units.filter((u) => u.isAda).length;
  const planned = read.outages.filter((o) => o.isPlanned).length;
  const unplanned = read.outages.length - planned;
  const soleAccessDown = read.outages.filter((o) => redundantByExt.get(o.unitExternalId) === false).length;
  const pctDown = activeUnits ? ((read.outages.length / activeUnits) * 100).toFixed(1) : "0.0";

  console.log(`\n  ${read.systemId}  ·  fetched ${read.fetchedAt}`);
  console.log(`  ${"-".repeat(48)}`);
  if (inventoryComplete) {
    console.log(`  elevators (inventory)      ${read.units.length}  (${activeUnits} active, ${adaCount} ADA)`);
    console.log(`  currently out of service   ${read.outages.length}  (${pctDown}% of active)`);
  } else {
    console.log(`  elevators (discovered)     ${read.units.length}  — feed lists broken units only, no denominator`);
    console.log(`  currently out of service   ${read.outages.length}  (% of fleet: n/a)`);
  }
  console.log(`     unplanned               ${unplanned}`);
  console.log(`     planned / maintenance   ${planned}`);
  console.log(`     sole step-free access   ${soleAccessDown}  <- confirmed non-redundant`);
  console.log(`  upcoming (scheduled)       ${read.upcoming.length}`);

  const sample = read.outages.slice(0, 5);
  if (sample.length) {
    console.log(`\n  sample of current outages:`);
    for (const o of sample) {
      const tag = o.isPlanned ? "planned  " : "unplanned";
      console.log(`    [${tag}] ${o.unitExternalId.padEnd(15)} ${o.stationName}`);
    }
  }

  // Group outages by station, then show attribution + accessibility for the
  // curated (per-elevator) stations that are currently affected.
  const byStation = new Map<string, NormalizedOutage[]>();
  for (const o of read.outages) {
    const key = o.stationExternalId ?? o.unitExternalId;
    const arr = byStation.get(key);
    if (arr) arr.push(o);
    else byStation.set(key, [o]);
  }
  // A station can have multiple independent chains sharing its abbr (see
  // StationModel.chainLabel) — each is scored separately, and outages get
  // filtered to just the ids that chain actually knows about first. Passing
  // a chain a downId that belongs only to a SIBLING chain would otherwise
  // misreport it as "at_risk" (stationAccessibilityState treats any unknown
  // id conservatively), even though that outage is irrelevant to this chain.
  const modeled = [...byStation].filter(([abbr]) => models.has(abbr));
  if (modeled.length) {
    console.log(`\n  accessibility — curated stations affected:`);
    for (const [abbr, outs] of modeled) {
      for (const model of models.get(abbr)!) {
        const modelIds = new Set(allElevators(model).map((e) => e.externalId));
        const relevantOuts = outs.filter((o) => modelIds.has(o.unitExternalId));
        if (relevantOuts.length === 0) continue;
        const downIds = new Set(relevantOuts.map((o) => o.unitExternalId));
        const state = stationAccessibilityState(model, downIds);
        const badge = state === "accessible" ? "ACCESSIBLE  " : state === "inaccessible" ? "INACCESSIBLE" : "AT RISK     ";
        console.log(`    ${badge}  ${chainDisplayName(relevantOuts[0]!.stationName, model)}`);
        for (const o of relevantOuts) {
          // `attributed` is a BART-style flag (was this station-level advisory
          // text successfully matched to one elevator?) — it's meaningless for
          // a system like MTA that already reports the exact elevator id
          // natively, with no guessing involved. Check the id directly instead
          // of relying on a flag only some adapters set.
          const known = findElevator(model, o.unitExternalId);
          const what = known
            ? `${known.label}${o.segmentId ? `  [${o.segmentId}]` : ""}`
            : o.segmentId
              ? `elevator within ${o.segmentId} — ambiguous (conservative)`
              : "unspecified elevator — could not attribute (conservative)";
          console.log(`        - ${what}`);
        }
      }
    }
  }

  if (models.size) {
    const totalChains = [...models.values()].reduce((n, arr) => n + arr.length, 0);
    const chainNote = totalChains > models.size ? ` (${totalChains} chains)` : "";
    console.log(`\n  ${models.size} stations modeled per-elevator${chainNote} · redundancy baseline: ${baseline}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryFlag = args.includes("--dry-run");
  const systemId = args.find((a) => !a.startsWith("--")) ?? knownSystemIds()[0];

  if (!systemId) throw new Error("No system specified and no adapters registered.");
  const system = getSystem(systemId);
  if (!system) throw new Error(`System "${systemId}" is not in the catalog.`);

  console.log(`\nLiftWatch poll — ${system.name} (${system.id})`);

  const db = dryFlag ? null : getSupabase();
  const { read, overrideWarnings, result } = await pollSystem(systemId, db);
  summarize(read, system.redundancyBaseline ?? "assumed", system.inventoryComplete !== false);

  for (const w of overrideWarnings) console.warn(`  ⚠ ${w}`);

  if (!result) {
    console.log(`\n  ${dryFlag ? "--dry-run" : "no SUPABASE_* env"}: fetch + normalize only, nothing written.\n`);
    return;
  }

  console.log(
    `\n  archived → opened ${result.eventsOpened}, closed ${result.eventsClosed}, ${result.outagesOpen} currently open, ${result.upcomingStored} upcoming stored.`,
  );
  if (result.offlineOpened || result.offlineClosed) {
    console.log(
      `  offline tracking → ${result.offlineOpened} unit(s) went dark (status unknown), ${result.offlineClosed} back in the feed.`,
    );
  }
  if (result.accessOpened || result.accessClosed) {
    console.log(
      `  access issues → ${result.accessOpened} non-elevator facility outage(s) opened, ${result.accessClosed} resolved.`,
    );
  }
  if (result.flagsRaised) {
    console.log(`  ⚠ ${result.flagsRaised} redundancy flag(s) raised for review.`);
  }
  console.log("");
}

main().catch((err) => {
  console.error("\npoll failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
