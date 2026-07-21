import { readFileSync } from "node:fs";
import { allElevators, stationAccessible, type StationModel } from "../lib/accessibility.js";

// Offline asserting regression for the MTA multi-chain models
// (scripts/mta-chains.mjs -> src/catalog/mta-data/station-chains.json). Mirrors
// the generator's self-check but reads only the committed JSON, so it runs with
// no network in CI. Run: npm run check:mta
//
// The core invariant is UNIVERSAL and reusable by any system: for every
// elevator, the model-DERIVED redundancy (does its outage alone leave the
// station accessible, aggregated across every chain it belongs to) must match
// the feed's own DECLARED redundant flag — unless a human documented an
// exception. This is what proves the hand-authored + inferred segment structure
// actually reflects reality rather than a plausible guess.

interface Flags { redundant: boolean; ada: boolean }
const data = JSON.parse(
  readFileSync(new URL("../catalog/mta-data/station-chains.json", import.meta.url), "utf8"),
) as {
  models: StationModel[];
  elevatorFlags: Record<string, Flags>;
  redundancyExceptions: Record<string, string>;
  overrideStations: string[];
  overWarnAllowed: string[]; // "station|elevator" pairs where a conservative over-warn is allowed
  merges: Record<string, string>;
};
const overrideStations = new Set(data.overrideStations ?? []);
const overWarnAllowed = new Set(data.overWarnAllowed ?? []);

let failures = 0;
const ok = (cond: boolean, msg: string): void => {
  if (!cond) failures++;
  console.log(`    ${cond ? "PASS" : "FAIL"}  ${msg}`);
};

// Group chains by canonical station id.
const byStation = new Map<string, StationModel[]>();
for (const m of data.models) {
  const arr = byStation.get(m.stationExternalId) ?? [];
  arr.push(m);
  byStation.set(m.stationExternalId, arr);
}

console.log("\n  Redundancy consistency (derived vs MTA's declared flag, aggregated across chains):");
let redundancyChecked = 0;
let exceptionsUsed = 0;
for (const [station, chains] of byStation) {
  // An elevator is truly non-redundant if it is sole access in AT LEAST ONE of
  // its chains; redundant only if redundant in every chain it appears in.
  const derived = new Map<string, boolean>();
  for (const chain of chains) {
    for (const el of new Set(allElevators(chain).map((e) => e.externalId))) {
      const redundantHere = stationAccessible(chain, new Set([el]));
      derived.set(el, (derived.get(el) ?? true) && redundantHere);
    }
  }
  for (const [el, isRedundant] of derived) {
    const flag = data.elevatorFlags[el];
    if (!flag) { ok(false, `${station} ${el}: missing feed flag`); continue; }
    if (!flag.ada) ok(false, `${station} ${el}: non-ADA elevator present in a chain`);
    if (isRedundant === flag.redundant) { redundancyChecked++; continue; }
    // mismatch — allowed only if: (a) a documented human exception, or (b) an
    // auto-station conservative over-warn (derived SOLE where MTA=redundant — a
    // backup MTA declares but the generator couldn't place; safe direction).
    // An under-warn (derived redundant where MTA=sole) is NEVER allowed.
    if (el in data.redundancyExceptions) { exceptionsUsed++; continue; }
    const isOverride = overrideStations.has(station);
    const overWarn = isRedundant === false && flag.redundant === true;
    if (!isOverride && overWarn && overWarnAllowed.has(`${station}|${el}`)) { exceptionsUsed++; continue; }
    ok(false, `${station} ${el}: derived redundant=${isRedundant} but feed=${flag.redundant} with no documented exception`);
  }
}
ok(redundancyChecked > 0, `${redundancyChecked} elevators consistent with MTA's redundant flag (${exceptionsUsed} documented exceptions applied)`);

console.log("\n  Verified structural facts (locked from the human walk-through):");
const labelsFor = (station: string) => (byStation.get(station) ?? []).map((m) => m.chainLabel?.trim()).sort();
const hasChain = (station: string, label: string) => (byStation.get(station) ?? []).some((m) => m.chainLabel?.trim() === label);

ok(byStation.size >= 120, `full-coverage: 120+ MTA elevator complexes modeled (got ${byStation.size}; was 19 interchange-only before the universal generator)`);
ok(hasChain("604", "(4)") && hasChain("604", "(B/D)"), "161 St-Yankee Stadium splits into (4) + (B/D)");
ok(JSON.stringify(labelsFor("617")) === JSON.stringify(["(2/3)", "(4/5)", "(B/Q)", "(D/N/R)", "(LIRR)"]), "Atlantic Av = (2/3)+(4/5)+(B/Q)+(D/N/R)+(LIRR)");

// LIRR interchange chains (2026-07-06 walk-through): subway-side street
// access to the railroad, built only from subway-feed elevators — the
// railroad side lives in the mta-lirr system's own curated models.
ok(hasChain("164", "(LIRR)"), "Penn has a subway-side (LIRR) chain (EL34X ≡ LIRR's NYK-861)");
ok(hasChain("279", "(LIRR)") && hasChain("279", "(E/J/Z)"), "Sutphin Blvd-Archer Av models (E/J/Z) + (LIRR) — the fifth railroad interchange");
ok(hasChain("456", "(LIRR)") && hasChain("456", "(7)"), "61 St-Woodside models (7) + (LIRR); non-ADA EL418X/EL419X stay out of chains");

// Merges: Penn 164 covers 318, Fulton 628 covers 624.
const penn = (byStation.get("164") ?? [])[0];
const fulton = (byStation.get("628") ?? [])[0];
ok(!!penn?.coveredStationExternalIds?.includes("318"), "Penn (164) merges in the 7th Av complex (318)");
ok(!!fulton?.coveredStationExternalIds?.includes("624"), "Fulton St (628) merges in the WTC Cortlandt/Oculus complex (624)");
ok(hasChain("628", "(R/W)") && hasChain("628", "(E)"), "Fulton megacomplex includes (R/W) and (E) chains");

// EL727X (uptown R/W) and EL732 (2/3 platform) must be sole-access in Fulton.
const fultonChains = byStation.get("628") ?? [];
const soleAccess = (el: string) =>
  fultonChains.some((c) => allElevators(c).some((e) => e.externalId === el)) &&
  fultonChains.every((c) => !allElevators(c).some((e) => e.externalId === el) || !stationAccessible(c, new Set([el])));
ok(soleAccess("EL727X"), "Fulton EL727X (uptown R/W) is sole access");
ok(soleAccess("EL732"), "Fulton EL732 (2/3 platform) is sole access");

console.log(`\n  ${failures === 0 ? "all checks passed" : `${failures} check(s) FAILED`}\n`);
if (failures > 0) process.exitCode = 1;
