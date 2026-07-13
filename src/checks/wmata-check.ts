// Offline asserting regression for the WMATA per-elevator build: the GTFS
// pathways chain models (scripts/wmata-pathways.mts → wmata-data/chains.json),
// the hand-curated tier (wmata-models.ts), the observed-name binding, the
// shared LocationDescription vocabulary, and the adapter's attribution
// crosswalk. Reads only committed JSON + code — no network, no keys.
// Run: npm run check:wmata

import { readFileSync } from "node:fs";
import { allElevators, elevatorRedundant, type StationModel } from "../lib/accessibility.js";
import { WMATA_STATION_MODELS } from "../catalog/wmata-models.js";
import { parseWmataLocation } from "../adapters/wmata/location.js";
import { attributeWmataIncident } from "../adapters/wmata/index.js";

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
  const c13 = modelOf("C13")!;
  ok(elevatorRedundant(c13, "C13N01") && elevatorRedundant(c13, "C13N02"), "C13 King St: bound pair C13N01/C13N02 mutually redundant (true island)");
  const e04 = modelOf("E04")!;
  ok(!elevatorRedundant(e04, "E04X02"), "E04 Columbia Heights: platform elevator E04X02 is sole access");
  ok(!elevatorRedundant(e04, "E04X01"), "E04 Columbia Heights: street elevator E04X01 is sole access");
  const a08 = modelOf("A08")!;
  ok(allElevators(a08).every((e) => elevatorRedundant(a08, e.externalId)), "A08 Friendship Heights: all four elevators redundant (2+2)");
  const e09 = modelOf("E09")!;
  const e09Street = e09.segments.find((s) => s.id === "street-mezzanine")!;
  const e09Plat = e09.segments.find((s) => s.id === "mezzanine-platform")!;
  ok(e09Street.elevators.length === 2 && e09Street.elevators.every((e) => elevatorRedundant(e09, e.externalId)), "E09 College Park: street pair redundant");
  ok(e09Plat.elevators.length === 1 && !elevatorRedundant(e09, e09Plat.elevators[0]!.externalId), "E09 College Park: platform elevator sole access");
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
  const c13 = generatedByStation.get("C13")!;
  const b = attributeWmataIncident("C13N01", "Elevator between mezzanine and platform", c13);
  ok(b.kind === "modeled" && b.isRedundant, "known unit C13N01 → modeled, redundant");
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
