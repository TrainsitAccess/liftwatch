import { STATION_MODELS } from "../catalog/station-models.js";
import {
  attributeOutage,
  downSegments,
  findElevator,
  isSingleFaultTolerant,
  stationAccessible,
  type StationModel,
} from "../lib/accessibility.js";

// Demonstrates the chain-aware model on the curated BART stations. No feeds, no
// DB — just the logic. Run: npm run demo:access

function line(label: string, model: StationModel, down: string[]): void {
  const set = new Set(down);
  const ok = stationAccessible(model, set);
  const state = ok ? "ACCESSIBLE  " : "INACCESSIBLE";
  const failed = downSegments(model, set).map((s) => s.label).join(", ");
  const why = ok ? "" : `  <- ${failed}: no working step-free path`;
  console.log(`    ${label.padEnd(34)} ${state}${why}`);
}

const models = new Map(STATION_MODELS.map((m) => [m.stationExternalId, m]));

const twelfth = models.get("12TH")!;
console.log(`\n  12th St / Oakland City Center  (redundant: ${isSingleFaultTolerant(twelfth)})`);
line("all elevators working", twelfth, []);
line("14th St street elevator out", twelfth, ["12TH-ST-14TH"]);
line("14th St + 11th St out", twelfth, ["12TH-ST-14TH", "12TH-ST-11TH"]);
line("platform elevator out", twelfth, ["12TH-PLAT"]);

const ashby = models.get("ASHB")!;
console.log(`\n  Ashby  (redundant: ${isSingleFaultTolerant(ashby)})`);
line("all elevators working", ashby, []);
line("street elevator out", ashby, ["ASHB-ST-ADELINE-E"]);
line("one platform elevator out", ashby, ["ASHB-PLAT-1"]);
line("both platform elevators out", ashby, ["ASHB-PLAT-1", "ASHB-PLAT-2"]);

const richmond = models.get("RICH")!;
console.log(`\n  Richmond  (redundant: ${isSingleFaultTolerant(richmond)})`);
line("both street elevators out", richmond, ["RICH-ST-1", "RICH-ST-2"]);
line("platform elevator out", richmond, ["RICH-PLAT"]);

const sfo = models.get("SFIA")!;
console.log(`\n  SFO Airport  (redundant: ${isSingleFaultTolerant(sfo)})`);
line("one platform elevator out", sfo, ["SFIA-PLAT-1"]);
line("both platform elevators out", sfo, ["SFIA-PLAT-1", "SFIA-PLAT-2"]);

const warm = models.get("WARM")!;
console.log(`\n  Warm Springs  (redundant: ${isSingleFaultTolerant(warm)})`);
line("one street + one platform out", warm, ["WARM-ST-1", "WARM-PLAT-1"]);
line("both platform elevators out", warm, ["WARM-PLAT-1", "WARM-PLAT-2"]);

// Attribution: mapping a station-level advisory string to a specific elevator.
function attrLine(model: StationModel, description: string): void {
  const a = attributeOutage(description, model);
  const result = a ? `${findElevator(model, a.elevatorExternalId)?.label} [${a.segmentId}]` : "unattributed -> conservative fallback";
  console.log(`    "${description}"`.padEnd(38) + ` -> ${result}`);
}
console.log(`\n  attribution (advisory text -> specific elevator):`);
attrLine(twelfth, "14th St elevator");
attrLine(twelfth, "platform elevator out");
attrLine(twelfth, "Station"); // the current live BART text — too vague
attrLine(richmond, "platform");
attrLine(richmond, "street entrance");
console.log("");
