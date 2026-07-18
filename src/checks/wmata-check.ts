// Offline asserting regression for the WMATA per-elevator build: the GTFS
// pathways chain models (scripts/wmata-pathways.mts → wmata-data/chains.json),
// the hand-curated tier (wmata-models.ts), the observed-name binding, the
// shared LocationDescription vocabulary, and the adapter's attribution
// crosswalk. Reads only committed JSON + code — no network, no keys.
// Run: npm run check:wmata

import { readFileSync } from "node:fs";
import { allElevators, elevatorRedundant, stationAccessible, type StationModel } from "../lib/accessibility.js";
import { WMATA_STATION_MODELS } from "../catalog/wmata-models.js";
import { parseWmataLocation } from "../adapters/wmata/location.js";
import { attributeWmataIncident, failSafeReasonNote } from "../adapters/wmata/index.js";

const chains = JSON.parse(readFileSync(new URL("../catalog/wmata-data/chains.json", import.meta.url), "utf8")) as { models: StationModel[] };
const excluded = JSON.parse(readFileSync(new URL("../catalog/wmata-data/chains-excluded.json", import.meta.url), "utf8")) as {
  stations: { station: string; reason: string }[];
};
const observed = JSON.parse(readFileSync(new URL("../catalog/wmata-data/observed-units.json", import.meta.url), "utf8")) as {
  units: { unitName: string; stationCode: string; location: string }[];
};

let failures = 0;
const ok = (cond: boolean, msg: string): void => {
  if (!cond) failures++;
  console.log(`    ${cond ? "PASS" : "FAIL"}  ${msg}`);
};

const generatedByStation = new Map<string, StationModel[]>();
for (const m of chains.models) {
  (generatedByStation.get(m.stationExternalId) ?? generatedByStation.set(m.stationExternalId, []).get(m.stationExternalId)!).push(m);
}
const excludedReason = new Map(excluded.stations.map((s) => [s.station, s.reason]));

console.log("\n  Tier separation (curated vs generated — a station lives in exactly one):");
for (const m of WMATA_STATION_MODELS) {
  ok(!generatedByStation.has(m.stationExternalId), `${m.stationExternalId}${m.chainLabel ?? ""}: curated station not in generated chains.json`);
}

console.log("\n  Exclusion regressions (the traps that motivated each gate must stay excluded):");
// GTFS undercounts live-verified 2026-07-13: Forest Glen's elevator BANK is one
// pathway; Mt Vernon Sq + Morgan Blvd each hide a second platform elevator.
ok(excludedReason.get("B09") === "observed-undercount", "B09 Forest Glen: observed-undercount (elevator bank drawn as one pathway)");
ok(excludedReason.get("E01") === "observed-undercount", "E01 Mt Vernon Sq: observed-undercount (two platform elevators vs one in GTFS)");
ok(excludedReason.get("G04") === "observed-undercount", "G04 Morgan Blvd: observed-undercount");
ok(excludedReason.get("A14") === "observed-unmappable", "A14 Rockville: observed-unmappable in generator (hand-curated instead)");
ok(excludedReason.get("B35") === "observed-unmappable", "B35 NoMa: observed-unmappable (bike-trail elevator outside the ladder)");
ok(excludedReason.get("A02") === "corrupt-levels", "A02 Farragut North: corrupt GTFS level_ids (point at A03)");
ok(excludedReason.get("A03") === "side-platforms", "A03 Dupont Circle: side platforms (per-direction elevators are NOT redundant)");
ok(excludedReason.get("C06") === "side-platforms", "C06 Arlington Cemetery: side platforms");
ok(excludedReason.get("D02") === "multi-level-shaft", "D02 Smithsonian: 3-level shaft");
ok(excludedReason.get("A01_C01") === "non-standard-levels", "A01_C01 Metro Center: non-standard levels (transfer)");

console.log("\n  Observed-name binding (every observed non-garage unit at a modeled station matches its model BY ID):");
let bindingChecked = 0;
for (const o of observed.units) {
  if (parseWmataLocation(o.location) === "garage") continue;
  const models = generatedByStation.get(o.stationCode);
  if (!models) continue; // excluded or curated station
  const found = models.some((m) => allElevators(m).some((e) => e.externalId === o.unitName));
  if (!found) ok(false, `${o.stationCode} ${o.unitName}: observed but NOT bound into the model (live outage would not match)`);
  else bindingChecked++;
}
ok(bindingChecked > 0, `${bindingChecked} observed units bound into generated models by real UnitName`);

console.log("\n  Redundancy spot-checks (validated against step-free platform reachability 2026-07-13):");
const modelOf = (st: string) => generatedByStation.get(st)?.[0];
{
  const e04 = modelOf("E04")!;
  ok(!elevatorRedundant(e04, "E04X02"), "E04 Columbia Heights: platform elevator E04X02 is sole access");
  ok(!elevatorRedundant(e04, "E04X01"), "E04 Columbia Heights: street elevator E04X01 is sole access");
}

console.log("\n  A08 Friendship Heights (split-mezzanine spot-check fix, 2026-07-17): CNF pairing of Jenifer St. (4-elevator street bank + 1 platform elevator) OR Western Ave. (1 street + 1 platform), no false 2x2:");
{
  ok(!generatedByStation.has("A08"), "A08: moved out of the auto-generated tier (split-mezzanine)");
  ok(excludedReason.get("A08") === "split-mezzanine", "A08: excluded with reason split-mezzanine");
  const a08 = WMATA_STATION_MODELS.filter((m) => m.stationExternalId === "A08");
  ok(a08.length === 1, "A08: curated as one CNF-encoded model (not two separate chains)");
  const m = a08[0]!;
  ok(new Set(allElevators(m).map((e) => e.externalId)).size === 7, "A08: 7 distinct elevators tracked (4 Jenifer St. + 1 Jenifer plat. + 1 Western Ave. + 1 Western plat.)");
  const JEN = ["WMATA-A08_JEN_ELE1", "WMATA-A08_JEN_ELE2", "WMATA-A08_JEN_ELE3", "WMATA-A08_JEN_ELE4"];
  const JEN_PLAT = "WMATA-A08_JEN_ELE5";
  const WES = "WMATA-A08_WES_ELE1";
  const WES_PLAT = "WMATA-A08_WES_ELE2";
  ok(stationAccessible(m, new Set()), "A08: all 7 up -> accessible");
  ok(stationAccessible(m, new Set([WES])), "A08: Western St. down alone -> still accessible (Jenifer route intact)");
  ok(stationAccessible(m, new Set([JEN_PLAT])), "A08: Jenifer plat. down alone -> still accessible (Western route intact)");
  ok(stationAccessible(m, new Set(JEN.slice(0, 3))), "A08: 3 of 4 Jenifer St. elevators down -> still accessible (bank absorbs it)");
  ok(!stationAccessible(m, new Set([...JEN, JEN_PLAT, WES])), "A08: whole Jenifer route + Western St. down -> inaccessible (Western plat. alone can't complete a route)");
  ok(!stationAccessible(m, new Set([JEN_PLAT, WES])), "A08: Jenifer plat. + Western St. down together -> inaccessible (opposite-ends double, the false-redundancy trap the fix targets)");
  ok(!stationAccessible(m, new Set([...JEN, WES])), "A08: all 5 street elevators down -> inaccessible (both routes severed at the street leg)");
  ok(!stationAccessible(m, new Set([...JEN, WES_PLAT])), "A08: all 4 Jenifer St. + Western plat. down -> inaccessible (Jenifer route has no street leg, Western route has no platform leg)");
}

console.log("\n  2026-07-17 auto-tier audit fixes (page-inventory undercounts, wmata-data/rider-tools-inventory.json):");
{
  // The five stations WMATA's own Rider Tools page inventory showed richer
  // than GTFS: N06/N11 real 2x2, N10 a 4-elevator bank, D01 a platform pair,
  // C13 a third standalone platform elevator (Bryce-resolved same day).
  for (const st of ["N06", "N10", "N11", "D01", "C13"]) {
    ok(!generatedByStation.has(st), `${st}: moved out of the auto-generated tier (page-inventory-undercount)`);
    ok(excludedReason.get(st) === "page-inventory-undercount", `${st}: excluded with reason page-inventory-undercount`);
  }
  const curated = (st: string) => WMATA_STATION_MODELS.find((m) => m.stationExternalId === st)!;
  const n06 = curated("N06");
  ok(new Set(allElevators(n06).map((e) => e.externalId)).size === 4, "N06 Wiehle-Reston East: 4 real page ids (2 pavilion + 2 platform)");
  ok(allElevators(n06).every((e) => elevatorRedundant(n06, e.externalId)), "N06: every elevator redundant (genuine 2x2, single pavilion/mezzanine)");
  ok(!stationAccessible(n06, new Set(["N06X01", "N06X02"])), "N06: both pavilion elevators down -> inaccessible (street leg severed)");
  ok(!stationAccessible(n06, new Set(["N06X03", "N06X04"])), "N06: both platform elevators down -> inaccessible (platform leg severed)");
  ok(stationAccessible(n06, new Set(["N06X01", "N06X03"])), "N06: one of each down -> still accessible (2x2 cross-combination is real here, one mezzanine)");
  const n11 = curated("N11");
  ok(new Set(allElevators(n11).map((e) => e.externalId)).size === 4, "N11 Loudoun Gateway: 4 real page ids (2 pavilion + 2 platform)");
  ok(allElevators(n11).every((e) => elevatorRedundant(n11, e.externalId)), "N11: every elevator redundant (genuine 2x2, single pavilion/mezzanine)");
  ok(!stationAccessible(n11, new Set(["N11X03", "N11X04"])), "N11: both pavilion elevators down -> inaccessible (street leg severed)");
  const n10 = curated("N10");
  ok(new Set(allElevators(n10).map((e) => e.externalId)).size === 4, "N10 Dulles Airport: 4-elevator platform bank (page-corrected from GTFS's 2)");
  ok(stationAccessible(n10, new Set(["N10X01", "N10X02", "N10X03"])), "N10: any 3 of 4 down -> still accessible (bank absorbs it)");
  ok(!stationAccessible(n10, new Set(["N10X01", "N10X02", "N10X03", "N10X04"])), "N10: all 4 down -> inaccessible");
  const d01 = curated("D01");
  ok(new Set(allElevators(d01).map((e) => e.externalId)).size === 3, "D01 Federal Triangle: 3 elevators (sole street + platform pair, D01X03 was missing)");
  ok(!elevatorRedundant(d01, "D01X01"), "D01: street elevator D01X01 stays sole access (its outage severs the station)");
  ok(elevatorRedundant(d01, "D01X02") && elevatorRedundant(d01, "D01X03"), "D01: platform pair D01X02/D01X03 mutually redundant");
  const c13 = curated("C13");
  ok(new Set(allElevators(c13).map((e) => e.externalId)).size === 3, "C13 King St-Old Town: 3 platform elevators (N-pair + standalone C13S01, mezzanine at street grade)");
  ok(c13.segments.length === 1, "C13: single 3-way OR segment (no street leg — mezzanine at street level)");
  ok(allElevators(c13).every((e) => elevatorRedundant(c13, e.externalId)), "C13: every elevator redundant (any one of three keeps the station step-free)");
  ok(stationAccessible(c13, new Set(["C13N01", "C13N02"])), "C13: whole N-pair down -> still accessible via standalone C13S01");
  ok(!stationAccessible(c13, new Set(["C13N01", "C13N02", "C13S01"])), "C13: all three down -> inaccessible");
}

console.log("\n  F06 Anacostia (step-free-detour-redundant, 2026-07-17 audit): separate at-grade mezzanines, redundant via a disclosed ~0.3 mi step-free walk:");
{
  ok(!generatedByStation.has("F06"), "F06: moved out of the auto-generated tier (step-free-detour-redundant)");
  ok(excludedReason.get("F06") === "step-free-detour-redundant", "F06: excluded with reason step-free-detour-redundant");
  const f06 = WMATA_STATION_MODELS.find((m) => m.stationExternalId === "F06")!;
  const ids = new Set(allElevators(f06).map((e) => e.externalId));
  ok(ids.has("F06S01") && ids.has("F06N01") && ids.size === 2, "F06: two real page ids (F06S01 Howard Rd + F06N01 Kiss & Ride)");
  ok(allElevators(f06).every((e) => elevatorRedundant(f06, e.externalId)), "F06: both elevators redundant (either keeps the station step-free via the disclosed walk)");
  ok(!stationAccessible(f06, new Set(["F06S01", "F06N01"])), "F06: both down -> inaccessible");
  ok(/0\.3 mile/.test(f06.note ?? "") && /step-free walk/.test(f06.note ?? ""), "F06: public note discloses the ~0.3 mi step-free walk (detour policy requires it)");
}

console.log("\n  Grade-separated stations (2026-07-17 audit): two opposite-side entrances are NOT redundant — curated per-entrance, no false street→mezzanine backup:");
{
  const GRADE_SEP = ["N01", "N02", "N03", "N04", "N07", "N08", "N12", "E09"];
  for (const st of GRADE_SEP) {
    ok(!generatedByStation.has(st), `${st}: moved out of the auto-generated tier (grade-separated-entrances)`);
    ok(excludedReason.get(st) === "grade-separated-entrances", `${st}: excluded with reason grade-separated-entrances`);
    const chains = WMATA_STATION_MODELS.filter((m) => m.stationExternalId === st);
    ok(chains.length === 2, `${st}: curated as two per-entrance chains`);
    // Every elevator at the station is sole-access — a single outage must sever
    // its chain (the whole point of the fix: no cross-entrance redundancy).
    const anyRedundant = chains.some((c) => allElevators(c).some((e) => elevatorRedundant(c, e.externalId)));
    ok(!anyRedundant, `${st}: no elevator is modeled redundant (single outage strands one side)`);
    // The mezzanine→platform elevator is shared: the same id appears in both chains.
    const platIds = chains.map((c) => c.segments.find((s) => s.id === "mezzanine-platform")!.elevators[0]!.externalId);
    ok(platIds[0] === platIds[1], `${st}: both entrances share one mezzanine→platform elevator`);
  }
}

console.log("\n  Rockville hand model (human-confirmed 2026-07-13 — the bridge pair must be conveyed):");
{
  const a14 = WMATA_STATION_MODELS.filter((m) => m.stationExternalId === "A14");
  ok(a14.length === 2, "A14 has a core chain and a pedestrian-bridge chain");
  const bridge = a14.find((m) => m.chainLabel?.includes("bridge"))!;
  const bridgeIds = allElevators(bridge).map((e) => e.externalId).sort();
  ok(bridgeIds.join(",") === "A14X01,A14X02", "bridge chain carries real UnitNames A14X01 + A14X02");
  ok(elevatorRedundant(bridge, "A14X01") && elevatorRedundant(bridge, "A14X02"), "bridge pair mutually redundant");
  const core = a14.find((m) => !m.chainLabel)!;
  const coreEls = allElevators(core);
  ok(coreEls.length === 1 && !elevatorRedundant(core, coreEls[0]!.externalId), "core chain: single mezzanine→platform elevator, sole access");
}

console.log("\n  Location vocabulary (live-observed strings, incl. every tricky variant):");
ok(parseWmataLocation("Elevator between street and mezzanine") === "street-mezz", '"street and mezzanine" → street-mezz');
ok(parseWmataLocation("Elevator between mezzanine and platform") === "mezz-plat", '"mezzanine and platform" → mezz-plat');
ok(parseWmataLocation("Elevator between street and platform to Shady Grove") === "street-plat", '"street and platform to X" → street-plat');
ok(parseWmataLocation("Elevator between mezzanine to grade/street") === "street-mezz", '"mezzanine to grade/street" → street-mezz');
ok(parseWmataLocation("Elevator - south entry pavilion") === "street-mezz", '"entry pavilion" (Silver Line) → street-mezz');
ok(parseWmataLocation("Garage #2 elevator") === "garage", '"Garage #2 elevator" → garage');
ok(parseWmataLocation("Garage") === "garage", 'bare "Garage" → garage');
ok(parseWmataLocation("Elevator between pedestrian bridge and mezzanine") === null, '"pedestrian bridge" → outside the ladder');
ok(parseWmataLocation("Elevator between bike trail and mezzanine") === null, '"bike trail" → outside the ladder');
ok(parseWmataLocation("Elevator between street, and upper platform") === null, '"upper platform" (split platform) → outside the ladder');
ok(parseWmataLocation("Elevator between street, mezzanine, and platform to New Carrollton/Largo Town Center") === "multi", "3-level shaft description → multi");

console.log("\n  Adapter attribution crosswalk (pure, against the committed models):");
{
  const e04 = generatedByStation.get("E04")!;
  const a = attributeWmataIncident("E04X02", "Elevator between mezzanine and platform", e04);
  ok(a.kind === "modeled" && a.segment === "mezzanine-platform" && !a.isRedundant && a.source === "pathways",
    "known unit E04X02 → modeled, mezzanine-platform, sole access, pathways");
  const c13 = WMATA_STATION_MODELS.filter((m) => m.stationExternalId === "C13");
  const b = attributeWmataIncident("C13N01", "Elevator between mezzanine and platform", c13);
  ok(b.kind === "modeled" && b.isRedundant && b.source === "curated", "known unit C13N01 → modeled, redundant, via curated tier (2026-07-17 audit fix)");
  const a14 = WMATA_STATION_MODELS.filter((m) => m.stationExternalId === "A14");
  const c = attributeWmataIncident("A14X01", "Elevator between pedestrian bridge and mezzanine", a14);
  ok(c.kind === "modeled" && c.segment === "bridge-mezzanine" && c.source === "curated", "A14X01 → modeled via curated tier, bridge segment");
  const d = attributeWmataIncident("E04X99", "Garage elevator", e04);
  ok(d.kind === "garage", "garage unit at a modeled station → garage (roster-only, no chain effect, no flag)");
  const e = attributeWmataIncident("E04X98", "Elevator between street and mezzanine", e04);
  ok(e.kind === "fallback-segment" && e.segment === "street-mezzanine", "NEW unit with parseable location → fallback to its segment (fail-safe +1 down)");
  const f = attributeWmataIncident("E04X97", "Elevator near the north kiosk", e04);
  ok(f.kind === "unmappable", "NEW unit with unparseable location → unmappable (fail-safe: chains read UNKNOWN)");
  const g = attributeWmataIncident("B09X04", "Elevator between mezzanine and platform", []);
  ok(g.kind === "unmodeled", "unit at an un-modeled station → unmodeled (plain discovered unit, no flag)");

  // The notification contract (Bryce, 2026-07-13): BOTH fail-safe kinds must
  // carry an actionable refresh-the-model note on the outage reason — it rides
  // the boards and the ntfy push. Every other kind stays clean.
  ok(/refresh the WMATA model/.test(failSafeReasonNote(e)), "fallback-segment reason note names the refresh loop (rides ntfy)");
  ok(/refresh the WMATA model/.test(failSafeReasonNote(f)), "unmappable reason note names the refresh loop (rides ntfy)");
  ok(failSafeReasonNote(a) === "" && failSafeReasonNote(d) === "" && failSafeReasonNote(g) === "",
    "modeled / garage / unmodeled attributions add no reason note");
}

console.log("\n  Model hygiene:");
ok(chains.models.every((m) => m.systemId === "wmata-dc"), "every generated model is wmata-dc");
ok(chains.models.every((m) => m.segments.length > 0 && m.segments.every((s) => s.elevators.length > 0)), "no empty segments");
{
  const ids = chains.models.flatMap((m) => allElevators(m).map((e) => e.externalId));
  ok(new Set(ids).size === ids.length, "no elevator id appears in two generated chains");
}

if (failures) {
  console.error(`\n  ${failures} CHECK(S) FAILED\n`);
  process.exit(1);
}
console.log("\n  all checks passed\n");
