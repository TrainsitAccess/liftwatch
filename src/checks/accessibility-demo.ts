import { stationModelsFor } from "../catalog/station-models.js";
import { matchBartOtherEquipment } from "../catalog/bart-other-equipment.js";
import { missingExpectedFields } from "../catalog/field-expectations.js";
import type { NormalizedOutage, NormalizedUnit } from "../types.js";
import {
  attributeOutage,
  attributeOutageAcrossChains,
  platformDefaultElevator,
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

// Explicit picker for stations with >1 chain (e.g. WARM's separate
// pedestrian-bridge chain, added 2026-07-08) — same never-guess spirit as
// m(), but the caller states which chain it means instead of the demo
// silently picking one.
const mChain = (abbr: string, chainLabel: string | undefined): StationModel => {
  const chains = models.get(abbr);
  const found = chains?.find((c) => c.chainLabel === chainLabel);
  if (!found) throw new Error(`No ${abbr} chain with label ${JSON.stringify(chainLabel)}`);
  return found;
};

console.log("\n  derived station redundancy (single-fault tolerance):");
check("ASHB redundant", isSingleFaultTolerant(m("ASHB")), true);
check("SFIA redundant", isSingleFaultTolerant(m("SFIA")), true);
check("WARM redundant", isSingleFaultTolerant(mChain("WARM", undefined)), true);
check("WARM pedestrian bridge not redundant (single elevator, no backup)", isSingleFaultTolerant(mChain("WARM", " (pedestrian bridge)")), false);
// WDUB was corrected 2026-07-08 against bart.gov's own outage-options page:
// the platform elevator is a single point of failure SHARED as a bottleneck
// by both garage sides (not 2 redundant platform elevators as previously
// modeled), so neither chain is single-fault-tolerant on its own.
check("WDUB North/Dublin side NOT redundant (shared platform elevator is a SPOF)", isSingleFaultTolerant(mChain("WDUB", " (North/Dublin side)")), false);
check("WDUB South/Pleasanton side NOT redundant (shared platform elevator is a SPOF)", isSingleFaultTolerant(mChain("WDUB", " (South/Pleasanton side)")), false);
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
check("WARM: one street + one platform out -> accessible", accessible(mChain("WARM", undefined), ["WARM-ST-1", "WARM-PLAT-1"]), true);
check("WARM: both platform elevators out -> inaccessible", accessible(mChain("WARM", undefined), ["WARM-PLAT-1", "WARM-PLAT-2"]), false);
check("WARM pedestrian bridge: elevator out -> inaccessible (no backup)", accessible(mChain("WARM", " (pedestrian bridge)"), ["WARM-BRIDGE"]), false);

console.log("\n  new BART stations, curated 2026-07-08 from bart.gov's own outage-options page:");
check("BALB: single elevator, no working -> accessible", accessible(m("BALB"), []), true);
check("BALB: single elevator out -> inaccessible (no backup)", accessible(m("BALB"), ["BALB-EL"]), false);
// DELN's two directions are INDEPENDENT chains (a detour through another
// station isn't a same-station backup) — one direction's elevator failing
// must not affect the other direction's chain.
check("DELN Richmond direction: elevator out -> inaccessible", accessible(mChain("DELN", " (Richmond direction)"), ["DELN-PLAT-1"]), false);
check(
  "DELN Berryessa/SFO direction: unaffected by the Richmond-direction elevator being out",
  accessible(mChain("DELN", " (Berryessa/SFO/Millbrae/Daly City direction)"), ["DELN-PLAT-1"]),
  true,
);
// WDUB's platform elevator is a SHARED bottleneck across both garage-side
// chains — it going out must take down BOTH, even though the garage pairs
// are independently redundant.
check("WDUB North side: garage pair redundant, one out -> accessible", accessible(mChain("WDUB", " (North/Dublin side)"), ["WDUB-GAR-N1"]), true);
check("WDUB North side: shared platform elevator out -> inaccessible", accessible(mChain("WDUB", " (North/Dublin side)"), ["WDUB-PLAT"]), false);
check("WDUB South side: also inaccessible when the SAME shared platform elevator is out", accessible(mChain("WDUB", " (South/Pleasanton side)"), ["WDUB-PLAT"]), false);

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

console.log("\n  cross-chain attribution (2026-07-08 — a station-level advisory doesn't");
console.log("  say WHICH independent chain it means, e.g. HAYW's two directions):");
const haywChains = models.get("HAYW")!;
check('HAYW "Station - SF/Richmond" (real historical phrasing) -> Richmond-direction elevator', attributeOutageAcrossChains("Station - SF/Richmond", haywChains), {
  model: mChain("HAYW", " (Richmond/Daly City direction)"),
  elevatorExternalId: "HAYW-PLAT-2",
  segmentId: "platform-2",
});
check('HAYW "Station - Berryessa" -> Berryessa-direction elevator, unaffected by the other chain', attributeOutageAcrossChains("Station - Berryessa", haywChains), {
  model: mChain("HAYW", " (Berryessa direction)"),
  elevatorExternalId: "HAYW-PLAT-1",
  segmentId: "platform-1",
});
check('HAYW "Station" (no direction, both chains) -> unattributed, never guess which chain', attributeOutageAcrossChains("Station", haywChains), null);
check('12TH "Station - Convention Center" (real historical phrasing) -> 11th St elevator', attributeOutage("Station - Convention Center", m("12TH")), {
  elevatorExternalId: "12TH-ST-11TH",
  segmentId: "street-concourse",
});
// Synthetic models isolate attributeOutageAcrossChains's own ambiguity rule
// (matching >1 chain is exactly as ambiguous as 0) from any real station's
// data, in case a future station's chains ever share hint vocabulary.
const fakeChainA: StationModel = { systemId: "test", stationExternalId: "FAKE", chainLabel: " (A)", segments: [{ id: "seg", label: "seg", elevators: [{ externalId: "FAKE-A", label: "A", matchHints: ["shared", "onlya"] }] }] };
const fakeChainB: StationModel = { systemId: "test", stationExternalId: "FAKE", chainLabel: " (B)", segments: [{ id: "seg", label: "seg", elevators: [{ externalId: "FAKE-B", label: "B", matchHints: ["shared", "onlyb"] }] }] };
check("synthetic: text matching BOTH chains' hints -> unattributed, never guess which chain", attributeOutageAcrossChains("shared", [fakeChainA, fakeChainB]), null);
check("synthetic: text matching only chain A's unique hint -> chain A", attributeOutageAcrossChains("onlya", [fakeChainA, fakeChainB]), {
  model: fakeChainA,
  elevatorExternalId: "FAKE-A",
  segmentId: "seg",
});

console.log("\n  platform-default attribution (2026-07-12 — a bare 'station elevator'");
console.log("  advisory means the platform elevator, but ONLY when unambiguous):");
check('RICH bare "Station" -> RICH-PLAT (single platform elevator)',
  platformDefaultElevator(models.get("RICH")!), { elevatorExternalId: "RICH-PLAT", segmentId: "concourse-platform" });
check('POWL bare "Station" -> POWL-PLAT (street elevator is a separate segment)',
  platformDefaultElevator(models.get("POWL")!), { elevatorExternalId: "POWL-PLAT", segmentId: "mezzanine-platform" });
check('COLS bare "Station" -> COLS-EL (auxiliary chains skipped, platform chain remains)',
  platformDefaultElevator(models.get("COLS")!), { elevatorExternalId: "COLS-EL", segmentId: "station" });
check('HAYW bare "Station" -> null (two per-direction platform elevators, never guess)',
  platformDefaultElevator(models.get("HAYW")!), null);

console.log("\n  Coliseum multi-destination attribution (2026-07-12 — 4 tracked elevators;");
console.log("  auxiliary chains attribute distinctly and never hijack the platform default):");
const colsChains = models.get("COLS")!;
check('COLS "Station - Tunnel" -> COLS-ARENA (per Bryce: BART\'s "Tunnel" text is the arena elevator)',
  attributeOutageAcrossChains("Station - Tunnel", colsChains), { model: mChain("COLS", " (Arena footbridge)"), elevatorExternalId: "COLS-ARENA", segmentId: "arena" });
check('COLS "Airport Connector out" -> COLS-OAC (GUESSED hint, pending live confirmation)',
  attributeOutageAcrossChains("Airport Connector out", colsChains), { model: mChain("COLS", " (Oakland Airport Connector)"), elevatorExternalId: "COLS-OAC", segmentId: "oac" });
check('COLS "Terminal/Station" -> null via hints (station elevator is hint-free by design)',
  attributeOutageAcrossChains("Terminal/Station", colsChains), null);
check('COLS "Terminal/Station" then platform-default -> COLS-EL (auxiliaries filtered out)',
  platformDefaultElevator(colsChains), { elevatorExternalId: "COLS-EL", segmentId: "station" });

console.log("\n  Other accessibility equipment + unidentified-outage flag (2026-07-12):");
check('COLS "parking" advisory -> the wheelchair lift (other equipment, NOT an elevator)',
  matchBartOtherEquipment("COLS", "Parking lot lift out")?.facilityExternalId ?? null, "COLS-PARKING-LIFT");
check('COLS "Terminal/Station" -> NOT other equipment (no parking hint)',
  matchBartOtherEquipment("COLS", "Terminal/Station"), null);
check('COLS has auxiliary chains -> a platform default there is flagged needsReview',
  models.get("COLS")!.some((m) => m.auxiliary === true), true);
check('RICH has no auxiliary chains -> its platform default is confident (no flag)',
  models.get("RICH")!.some((m) => m.auxiliary === true), false);

console.log("\n  missing-information flag (per-system field expectations, 2026-07-12):");
const mkO = (o: Partial<NormalizedOutage>): NormalizedOutage =>
  ({ unitType: "elevator", stationName: "Test Station", isPlanned: false, isUpcoming: false, reason: "out of service", ...o } as NormalizedOutage);
const mkU = (src?: string): NormalizedUnit => (src ? { redundancySource: src } : {}) as unknown as NormalizedUnit;
check("MTA modeled outage with a return -> complete (no flag)",
  missingExpectedFields("mta-nyct", mkO({ unitExternalId: "EL1", estimatedReturn: "2026-08-01T00:00:00Z" }), mkU("explicit")), []);
check("MTA outage MISSING a return -> flagged (agency always provides one)",
  missingExpectedFields("mta-nyct", mkO({ unitExternalId: "EL1" }), mkU("explicit")), ["predicted return"]);
check("WMATA outage missing a return -> flagged (expectsReturn)",
  missingExpectedFields("wmata-dc", mkO({ unitExternalId: "A1" }), mkU()), ["predicted return"]);
check("CTA outage with no return/redundancy -> complete (both are agency limits)",
  missingExpectedFields("cta-chicago", mkO({ unitExternalId: "1" }), undefined), []);
check("BART curated unit -> complete (no return expected)",
  missingExpectedFields("bart-bay-area", mkO({ unitExternalId: "RICH-PLAT" }), mkU("curated")), []);
check("BART unspecified (unmodeled) -> route/redundancy flagged",
  missingExpectedFields("bart-bay-area", mkO({ unitExternalId: "RICH-UNSPECIFIED" }), undefined), ["route/redundancy"]);
check("MBTA un-modeled (assumed) unit -> route/redundancy flagged",
  missingExpectedFields("mbta-boston", mkO({ unitExternalId: "929" }), mkU("assumed")), ["route/redundancy"]);
check("empty reason anywhere -> reason flagged",
  missingExpectedFields("tfl-london", mkO({ unitExternalId: "L1", reason: "" }), mkU("pathways")), ["reason"]);

const total = 61;
if (failures) {
  console.error(`\n  ${failures} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`\n  all ${total} checks passed\n`);
}
