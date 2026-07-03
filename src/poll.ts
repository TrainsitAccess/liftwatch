import type { NormalizedRead } from "./types.js";
import { getAdapter, knownSystemIds } from "./adapters/registry.js";
import { getSystem } from "./catalog/systems.js";
import { overridesFor, type RedundancyOverride } from "./catalog/redundancy-overrides.js";
import { getSupabase } from "./lib/supabase.js";
import { ingest } from "./ingest.js";

// Usage:
//   npm run poll -- <systemId> [--dry-run]
//   npm run poll:dry           (mta-nyct, no DB writes)
// With no Supabase env configured, always runs dry (fetch + normalize only).

function summarize(
  read: NormalizedRead,
  overrides: Map<string, RedundancyOverride>,
  baseline: "assumed" | "confirmed-none",
): void {
  // Effective redundancy = adapter signal, overridden by any curated entry.
  const effRedundant = (ext: string): boolean | undefined =>
    overrides.has(ext) ? overrides.get(ext)!.isRedundant : read.units.find((u) => u.externalId === ext)?.isRedundant;
  const planned = read.outages.filter((o) => o.isPlanned).length;
  const unplanned = read.outages.length - planned;
  const adaMissing = read.units.filter((u) => u.isAda).length;
  const soleAccessDown = read.outages.filter((o) => effRedundant(o.unitExternalId) === false).length;
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

  if (overrides.size) {
    const knownExt = new Set(read.units.map((u) => u.externalId));
    console.log(`\n  curated redundancy (${overrides.size}):`);
    for (const [ext, o] of overrides) {
      const state = !knownExt.has(ext)
        ? "⚠ UNKNOWN UNIT — check the id"
        : o.isRedundant
          ? "redundant  "
          : "sole access";
      console.log(`    ${ext.padEnd(8)} ${state}  — ${o.note.slice(0, 60)}…`);
    }
    if (baseline === "confirmed-none") {
      const others = read.units.length - overrides.size;
      console.log(`    + ${others} other stations confirmed non-redundant (baseline)`);
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
  summarize(read, overridesFor(systemId), system.redundancyBaseline ?? "assumed");

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
