import type { NormalizedRead } from "./types.js";
import { getAdapter, knownSystemIds } from "./adapters/registry.js";
import { getSystem } from "./catalog/systems.js";
import { getSupabase } from "./lib/supabase.js";
import { ingest } from "./ingest.js";

// Usage:
//   npm run poll -- <systemId> [--dry-run]
//   npm run poll:dry           (mta-nyct, no DB writes)
// With no Supabase env configured, always runs dry (fetch + normalize only).

function summarize(read: NormalizedRead): void {
  const redundantByExt = new Map(read.units.map((u) => [u.externalId, u.isRedundant]));
  const planned = read.outages.filter((o) => o.isPlanned).length;
  const unplanned = read.outages.length - planned;
  const adaMissing = read.units.filter((u) => u.isAda).length;
  const soleAccessDown = read.outages.filter(
    (o) => redundantByExt.get(o.unitExternalId) === false,
  ).length;
  const activeUnits = read.units.filter((u) => u.isActive).length;
  const pctDown = activeUnits ? ((read.outages.length / activeUnits) * 100).toFixed(1) : "0.0";

  console.log(`\n  ${read.systemId}  ·  fetched ${read.fetchedAt}`);
  console.log(`  ${"-".repeat(48)}`);
  console.log(`  elevators (inventory)      ${read.units.length}  (${activeUnits} active, ${adaMissing} ADA)`);
  console.log(`  currently out of service   ${read.outages.length}  (${pctDown}% of active)`);
  console.log(`     unplanned               ${unplanned}`);
  console.log(`     planned / maintenance   ${planned}`);
  console.log(`     sole step-free access   ${soleAccessDown}  <- lose accessibility`);
  console.log(`  upcoming (scheduled)       ${read.upcoming.length}`);

  const sample = read.outages.slice(0, 5);
  if (sample.length) {
    console.log(`\n  sample of current outages:`);
    for (const o of sample) {
      const tag = o.isPlanned ? "planned  " : "unplanned";
      console.log(`    [${tag}] ${o.unitExternalId.padEnd(8)} ${o.stationName} — ${o.reason ?? "?"}`);
    }
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
  summarize(read);

  const db = dryFlag ? null : getSupabase();
  if (!db) {
    console.log(`\n  ${dryFlag ? "--dry-run" : "no SUPABASE_* env"}: fetch + normalize only, nothing written.\n`);
    return;
  }

  const result = await ingest(db, system, read);
  console.log(
    `\n  archived → opened ${result.eventsOpened}, closed ${result.eventsClosed}, ${result.outagesOpen} currently open.`,
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
