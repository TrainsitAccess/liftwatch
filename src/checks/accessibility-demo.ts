import { stationModelsFor } from "../catalog/station-models.js";
import {
  attributeOutage,
  isSingleFaultTolerant,
  stationAccessible,
  type StationModel,
} from "../lib/accessibility.js";

// Asserting checks for the chain-aware accessibility model and advisory
// attribution. Exits non-zero on any failure so regressions are caught.
// Run: npm run demo:access

let failures = 0;
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  const detail = ok ? "" : `   got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`;
  console.log(`    ${ok ? "PASS" : "FAIL"}  ${label}${detail}`);
}

// stationModelsFor returns chains as ARRAYS (a station can have several
// independent chains sharing its id — every MTA multi-chain station does).
// A flat Map keyed by stationExternalId would silently keep only the LAST
// chain per station; this demo exercises single-chain BART stations, so
// demand exactly one chain and fail loudly on misuse.
const models = stationModelsFor("bart-bay-area");
const m = (abbr: string): StationModel => {
  const chains = models.get(abbr);
  if (!chains?.length) throw new Error(`No station model for ${abbr}`);
  if (chains.length > 1) {
    throw new Error(`${abbr} has ${chains.length} chains — pick one explicitly instead of using m()`);
  }
  return chains[0]!;
};
const accessible = (model: StationModel, down: string[]) => stationAccessible(model, new Set(down));

console.log("\n  derived station redundancy (single-fault tolerance):");
check("ASHB redundant", isSingleFaultTolerant(m("ASHB")), true);
check("SFIA redundant", isSingleFaultTolerant(m("SFIA")), true);
check("WARM redundant", isSingleFaultTolerant(m("WARM")), true);
check("WDUB redundant", isSingleFaultTolerant(m("WDUB")), true);
check("12TH not redundant (single platform elevator)", isSingleFaultTolerant(m("12TH")), false);
check("19TH not redundant (single street elevator)", isSingleFaultTolerant(m("19TH")), false);
check("RICH not redundant (single platform elevator)", isSingleFaultTolerant(m("RICH")), false);

console.log("\n  accessibility scenarios:");
check("12TH: all working -> accessible", accessible(m("12TH"), []), true);
check("12TH: 14th St street elevator out -> accessible", accessible(m("12TH"), ["12TH-ST-14TH"]), true);
check("12TH: both street elevators out -> inaccessible", accessible(m("12TH"), ["12TH-ST-14TH", "12TH-ST-11TH"]), false);
check("12TH: platform elevator out -> inaccessible", accessible(m("12TH"), ["12TH-PLAT"]), false);
check("ASHB: street elevator out -> accessible (parking lot)", accessible(m("ASHB"), ["ASHB-ST-ADELINE-E"]), true);
check("ASHB: one platform elevator out -> accessible", accessible(m("ASHB"), ["ASHB-PLAT-1"]), true);
check("ASHB: both platform elevators out -> inaccessible", accessible(m("ASHB"), ["ASHB-PLAT-1", "ASHB-PLAT-2"]), false);
check("RICH: both street elevators out -> accessible (ramp)", accessible(m("RICH"), ["RICH-ST-1", "RICH-ST-2"]), true);
check("RICH: platform elevator out -> inaccessible", accessible(m("RICH"), ["RICH-PLAT"]), false);
check("SFIA: one platform elevator out -> accessible", accessible(m("SFIA"), ["SFIA-PLAT-1"]), true);
check("SFIA: both platform elevators out -> inaccessible", accessible(m("SFIA"), ["SFIA-PLAT-1", "SFIA-PLAT-2"]), false);
check("WARM: one street + one platform out -> accessible", accessible(m("WARM"), ["WARM-ST-1", "WARM-PLAT-1"]), true);
check("WARM: both platform elevators out -> inaccessible", accessible(m("WARM"), ["WARM-PLAT-1", "WARM-PLAT-2"]), false);

console.log("\n  attribution (advisory text -> elevator or segment):");
check('12TH "14th St elevator" -> specific elevator', attributeOutage("14th St elevator", m("12TH")), {
  elevatorExternalId: "12TH-ST-14TH",
  segmentId: "street-concourse",
});
check('12TH "platform elevator out" -> specific (only one)', attributeOutage("platform elevator out", m("12TH")), {
  elevatorExternalId: "12TH-PLAT",
  segmentId: "concourse-platform",
});
check('ASHB "platform elevator" -> segment only (two candidates)', attributeOutage("platform elevator", m("ASHB")), {
  elevatorExternalId: null,
  segmentId: "concourse-platform",
});
check('RICH "street entrance" -> segment only (two candidates)', attributeOutage("street entrance", m("RICH")), {
  elevatorExternalId: null,
  segmentId: "street-concourse",
});
check('12TH "Station" -> unattributed', attributeOutage("Station", m("12TH")), null);

const total = 25;
if (failures) {
  console.error(`\n  ${failures} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`\n  all ${total} checks passed\n`);
}
