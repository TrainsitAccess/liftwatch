import "dotenv/config"; // load .env before anything reads process.env
import type { NormalizedOutage, NormalizedRead } from "./types.js";
import { getAdapter, knownSystemIds } from "./adapters/registry.js";
import { getSystem } from "./catalog/systems.js";
import { overridesFor } from "./catalog/redundancy-overrides.js";
import { stationModelsFor } from "./catalog/station-models.js";
import { findElevator, stationAccessibilityState } from "./lib/accessibility.js";
import { getSupabase } from "./lib/supabase.js";
import { ingest } from "./ingest.js";

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
  const modeled = [...byStation].filter(([abbr]) => models.has(abbr));
  if (modeled.length) {
    console.log(`\n  accessibility — curated stations affected:`);
    for (const [abbr, outs] of modeled) {
      const model = models.get(abbr)!;
      const downIds = new Set(outs.map((o) => o.unitExternalId));
      const state = stationAccessibilityState(model, downIds);
      const badge = state === "accessible" ? "ACCESSIBLE  " : state === "inaccessible" ? "INACCESSIBLE" : "AT RISK     ";
      console.log(`    ${badge}  ${outs[0]!.stationName}`);
      for (const o of outs) {
        const what = o.attributed
          ? `${findElevator(model, o.unitExternalId)?.label ?? o.unitExternalId}${o.segmentId ? `  [${o.segmentId}]` : ""}`
          : o.segmentId
            ? `elevator within ${o.segmentId} — ambiguous (conservative)`
            : "unspecified elevator — could not attribute (conservative)";
        console.log(`        - ${what}`);
      }
    }
  }

  if (models.size) {
    console.log(`\n  ${models.size} stations modeled per-elevator · redundancy baseline: ${baseline}`);
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

  const read = await getAdapter(systemId).fetch();
  summarize(read, system.redundancyBaseline ?? "assumed", system.inventoryComplete !== false);

  // Validate manual overrides against live units — catches typo'd ids.
  const knownExt = new Set(read.units.map((u) => u.externalId));
  for (const ext of overridesFor(systemId).keys()) {
    if (!knownExt.has(ext)) {
      console.warn(`  ⚠ manual redundancy override "${ext}" matches no live unit — check the id`);
    }
  }

  const db = dryFlag ? null : getSupabase();
  if (!db) {
    console.log(`\n  ${dryFlag ? "--dry-run" : "no SUPABASE_* env"}: fetch + normalize only, nothing written.\n`);
    return;
  }

  const result = await ingest(db, system, read);
  console.log(
    `\n  archived → opened ${result.eventsOpened}, closed ${result.eventsClosed}, ${result.outagesOpen} currently open, ${result.upcomingStored} upcoming stored.`,
  );
  if (result.flagsRaised) {
    console.log(`  ⚠ ${result.flagsRaised} redundancy flag(s) raised for review.`);
  }
  console.log("");
}

main().catch((err) => {
  console.error("\npoll failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
