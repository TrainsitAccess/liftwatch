// Cross-check our modeled MTA subway elevators against the data.ny.gov
// ground-truth inventory (src/catalog/mta-data/ny-elevator-inventory.json,
// refreshed by `npm run mta:ny-inventory`). Offline; run in the check suite.
//
// Asserts, for every elevator our MTA chain generator processed (the flags in
// station-chains.json — i.e. every elevator that could enter a modeled chain):
//   1. it EXISTS in the NY inventory (a modeled elevator MTA doesn't list is a
//      red flag — stale id or wrong station);
//   2. its ADA-compliance matches (we never chain a non-ADA elevator);
//   3. the redundancy BOOLEAN from our nyct_ene feed matches data.ny.gov's —
//      MTA's two independent published sources should agree. Our hand-authored
//      REDUNDANCY_EXCEPTIONS deliberately override BOTH feeds (human-verified
//      segment-level backup that the per-unit boolean doesn't capture, e.g.
//      14 St-6 Av EL609/EL610 — see scripts/mta-ny-inventory.mts), so they are
//      allowed to differ and are reported, not failed.

import { readFileSync } from "node:fs";

const chains = JSON.parse(readFileSync("src/catalog/mta-data/station-chains.json", "utf8"));
const inv = JSON.parse(readFileSync("src/catalog/mta-data/ny-elevator-inventory.json", "utf8"));

const ny = new Map<string, any>();
for (const r of inv.elevators) ny.set(r.equipment_code, r);

const flags: Record<string, { redundant: boolean; ada: boolean }> = chains.elevatorFlags;
const exceptions: Record<string, string> = chains.redundancyExceptions;

let pass = 0;
const fails: string[] = [];
const exceptionsSeen: string[] = [];

for (const [code, f] of Object.entries(flags)) {
  const r = ny.get(code);
  if (!r) { fails.push(`MISSING: ${code} is modeled but absent from the data.ny.gov inventory`); continue; }
  // ADA
  const nyAda = r.ada_compliant === "YES";
  if (f.ada !== nyAda) fails.push(`ADA: ${code} feed ada=${f.ada} vs data.ny.gov=${r.ada_compliant}`);
  // Redundancy boolean (exceptions allowed to differ)
  const nyRed = r.redundant_elevator === "+";
  if (f.redundant !== nyRed) {
    if (code in exceptions) exceptionsSeen.push(`${code}: feed/model override (${exceptions[code].split(":")[0]}) — data.ny.gov redundant=${r.redundant_elevator}`);
    else fails.push(`REDUNDANCY: ${code} nyct_ene=${f.redundant} vs data.ny.gov=${r.redundant_elevator} (no documented exception)`);
  }
  pass++;
}

console.log(`check:mta-ny — ${Object.keys(flags).length} modeled elevators cross-checked vs data.ny.gov (${inv.elevatorCount} in inventory)`);
console.log(`  ${pass - fails.length} clean · ${exceptionsSeen.length} documented overrides · ${fails.length} failures`);
if (exceptionsSeen.length) console.log("  documented overrides (expected):\n    " + exceptionsSeen.join("\n    "));
if (fails.length) { console.log("  FAILURES:\n    " + fails.join("\n    ")); process.exit(1); }
console.log("  all modeled MTA elevators confirmed present in the MTA inventory, ADA + redundancy consistent.");
