import { stationModelsFor } from "../catalog/station-models.js";
import { platformDefaultAmbiguous } from "../adapters/bart/index.js";
import { matchBartOtherEquipment } from "../catalog/bart-other-equipment.js";
import { missingExpectedFields } from "../catalog/field-expectations.js";
import { MBTA_STATION_MODELS } from "../catalog/mbta-models.js";
import type { NormalizedOutage, NormalizedUnit } from "../types.js";
import {
  attributeOutage,
  attributeOutageAcrossChains,
  elevatorLetterMap,
  platformDefaultElevator,
  isSingleFaultTolerant,
  stationAccessible,
  withElevatorLetter,
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
// RICH gained a second (auxiliary "Amtrak connector") chain 2026-07-20, so it
// no longer has exactly one chain — pick the main BART platform chain explicitly.
check("RICH not redundant (single platform elevator)", isSingleFaultTolerant(mChain("RICH", undefined)), false);

console.log("\n  accessibility scenarios:");
check("12TH: all working -> accessible", accessible(m("12TH"), []), true);
check("12TH: 14th St street elevator out -> accessible", accessible(m("12TH"), ["K10-22"]), true);
check("12TH: both street elevators out -> inaccessible", accessible(m("12TH"), ["K10-22", "K10-120"]), false);
check("12TH: platform elevator out -> inaccessible", accessible(m("12TH"), ["K10-23"]), false);
check("ASHB: street elevator out -> accessible (parking lot)", accessible(m("ASHB"), ["R10-113"]), true);
check("ASHB: one platform elevator out -> accessible", accessible(m("ASHB"), ["R10-43"]), true);
check("ASHB: both platform elevators out -> inaccessible", accessible(m("ASHB"), ["R10-43", "R10-111"]), false);
check("RICH: both street elevators out -> accessible (ramp)", accessible(mChain("RICH", undefined), ["R60-61", "R60-80"]), true);
check("RICH: platform elevator out -> inaccessible", accessible(mChain("RICH", undefined), ["R60-51"]), false);
check("SFIA: one platform elevator out -> accessible", accessible(m("SFIA"), ["Y10-930"]), true);
check("SFIA: both platform elevators out -> inaccessible", accessible(m("SFIA"), ["Y10-930", "Y10-931"]), false);
check("WARM: one street + one platform out -> accessible", accessible(mChain("WARM", undefined), ["S20-148", "S20-146"]), true);
check("WARM: both platform elevators out -> inaccessible", accessible(mChain("WARM", undefined), ["S20-146", "S20-147"]), false);
check("WARM pedestrian bridge: elevator out -> inaccessible (no backup)", accessible(mChain("WARM", " (pedestrian bridge)"), ["S20-162"]), false);

console.log("\n  new BART stations, curated 2026-07-08 from bart.gov's own outage-options page:");
check("BALB: single elevator, no working -> accessible", accessible(m("BALB"), []), true);
check("BALB: single elevator out -> inaccessible (no backup)", accessible(m("BALB"), ["M80-38"]), false);
// DELN's two directions are INDEPENDENT chains (a detour through another
// station isn't a same-station backup) — one direction's elevator failing
// must not affect the other direction's chain.
check("DELN Richmond direction: elevator out -> inaccessible", accessible(mChain("DELN", " (Richmond direction)"), ["R50-164"]), false);
check(
  "DELN Berryessa/SFO direction: unaffected by the Richmond-direction elevator being out",
  accessible(mChain("DELN", " (Berryessa/SFO/Millbrae/Daly City direction)"), ["R50-164"]),
  true,
);
// WDUB's platform elevator is a SHARED bottleneck across both garage-side
// chains — it going out must take down BOTH, even though the garage pairs
// are independently redundant.
check("WDUB North side: garage pair redundant, one out -> accessible", accessible(mChain("WDUB", " (North/Dublin side)"), ["WDUB-GAR-N1"]), true);
check("WDUB North side: shared platform elevator out -> inaccessible", accessible(mChain("WDUB", " (North/Dublin side)"), ["L20-132"]), false);
check("WDUB South side: also inaccessible when the SAME shared platform elevator is out", accessible(mChain("WDUB", " (South/Pleasanton side)"), ["L20-132"]), false);

console.log("\n  attribution (advisory text -> elevator or segment):");
check('12TH "14th St elevator" -> specific elevator', attributeOutage("14th St elevator", m("12TH")), {
  elevatorExternalId: "K10-22",
  segmentId: "street-concourse",
});
check('12TH "platform elevator out" -> specific (only one)', attributeOutage("platform elevator out", m("12TH")), {
  elevatorExternalId: "K10-23",
  segmentId: "concourse-platform",
});
check('ASHB "platform elevator" -> segment only (two candidates)', attributeOutage("platform elevator", m("ASHB")), {
  elevatorExternalId: null,
  segmentId: "concourse-platform",
});
check('RICH "street entrance" -> segment only (two candidates)', attributeOutage("street entrance", mChain("RICH", undefined)), {
  elevatorExternalId: null,
  segmentId: "street-concourse",
});
check('12TH "Station" -> unattributed', attributeOutage("Station", m("12TH")), null);

console.log("\n  cross-chain attribution (2026-07-08 — a station-level advisory doesn't");
console.log("  say WHICH independent chain it means, e.g. HAYW's two directions):");
const haywChains = models.get("HAYW")!;
check('HAYW "Station - SF/Richmond" (real historical phrasing) -> Richmond-direction elevator', attributeOutageAcrossChains("Station - SF/Richmond", haywChains), {
  model: mChain("HAYW", " (Richmond/Daly City direction)"),
  elevatorExternalId: "A60-7",
  segmentId: "platform-2",
});
check('HAYW "Station - Berryessa" -> Berryessa-direction elevator, unaffected by the other chain', attributeOutageAcrossChains("Station - Berryessa", haywChains), {
  model: mChain("HAYW", " (Berryessa direction)"),
  elevatorExternalId: "A60-8",
  segmentId: "platform-1",
});
check('HAYW "Station" (no direction, both chains) -> unattributed, never guess which chain', attributeOutageAcrossChains("Station", haywChains), null);
check('12TH "Station - Convention Center" (real historical phrasing) -> 11th St elevator', attributeOutage("Station - Convention Center", m("12TH")), {
  elevatorExternalId: "K10-120",
  segmentId: "street-concourse",
});
// MLBR directional attribution (2026-07-16): Millbrae's real live advisory
// "Station - SF/East Bay/SFO Airport" (a terminus → only the outbound platform
// direction exists) must resolve to the BART Platform 3 elevator, not stay
// -UNSPECIFIED. Mirrors the confirmed Milpitas "Station - SF/East Bay" pattern.
check('MLBR "Station - SF/East Bay/SFO Airport" (real advisory) -> BART Platform 3 elevator', attributeOutage("Station - SF/East Bay/SFO Airport", m("MLBR")), {
  elevatorExternalId: "W40-109",
  segmentId: "platform-3",
});
// MLBR-PLAT-3 is redundant (Caltrain NB backs it up) — so attributing this
// advisory to it correctly keeps the station ACCESSIBLE, never a false blackout.
check("MLBR Platform 3 elevator out alone -> still accessible (Caltrain NB backup)", accessible(m("MLBR"), ["W40-109"]), true);
// The directional hints must stay DISJOINT from the concourse elevators' hints:
// a plaza/garage advisory must never be dragged onto the platform elevator.
check('MLBR "Station - East Plaza" (concourse) -> East Plaza elevator, not the platform', attributeOutage("Station - East Plaza", m("MLBR")), {
  elevatorExternalId: "W40-116", // East Plaza street elevator (promoted from MLBR-EAST-PLAZA, 2026-07-20 BART audit)
  segmentId: "concourse-access",
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
  platformDefaultElevator(models.get("RICH")!), { elevatorExternalId: "R60-51", segmentId: "concourse-platform" });
check('POWL bare "Station" -> POWL-PLAT (street elevator is a separate segment)',
  platformDefaultElevator(models.get("POWL")!), { elevatorExternalId: "M30-55", segmentId: "mezzanine-platform" });
check('COLS bare "Station" -> COLS-EL (auxiliary chains skipped, platform chain remains)',
  platformDefaultElevator(models.get("COLS")!), { elevatorExternalId: "A30-3", segmentId: "station" });
check('HAYW bare "Station" -> null (two per-direction platform elevators, never guess)',
  platformDefaultElevator(models.get("HAYW")!), null);

console.log("\n  Coliseum multi-destination attribution (2026-07-12 — 4 tracked elevators;");
console.log("  auxiliary chains attribute distinctly and never hijack the platform default):");
const colsChains = models.get("COLS")!;
check('COLS "Station - Tunnel" -> COLS-ARENA (per Bryce: BART\'s "Tunnel" text is the arena elevator)',
  attributeOutageAcrossChains("Station - Tunnel", colsChains), { model: mChain("COLS", " (Arena footbridge)"), elevatorExternalId: "COLS-ARENA", segmentId: "arena" });
check('COLS "Airport Connector out" -> COLS-OAC (GUESSED hint, pending live confirmation)',
  attributeOutageAcrossChains("Airport Connector out", colsChains), { model: mChain("COLS", " (Oakland Airport Connector)"), elevatorExternalId: "A30-30", segmentId: "oac" });
check('COLS "Terminal/Station" -> null via hints (station elevator is hint-free by design)',
  attributeOutageAcrossChains("Terminal/Station", colsChains), null);
check('COLS "Terminal/Station" then platform-default -> COLS-EL (auxiliaries filtered out)',
  platformDefaultElevator(colsChains), { elevatorExternalId: "A30-3", segmentId: "station" });

console.log("\n  Other accessibility equipment + unidentified-outage flag (2026-07-12):");
check('COLS "parking" advisory -> the wheelchair lift (other equipment, NOT an elevator)',
  matchBartOtherEquipment("COLS", "Parking lot lift out")?.facilityExternalId ?? null, "COLS-PARKING-LIFT");
check('COLS "Terminal/Station" -> NOT other equipment (no parking hint)',
  matchBartOtherEquipment("COLS", "Terminal/Station"), null);
// COLS's platform default is confident too — its OAC/arena auxiliaries are all
// hinted, so a bare "Station" advisory can't be confused with one of them (the
// standing platformDefaultAmbiguous policy; check:bart also asserts a constructed
// hint-less auxiliary still flags, the case that keeps this rule meaningful).
check('COLS platform default is confident (its OAC/arena auxiliaries are hinted)',
  platformDefaultAmbiguous(models.get("COLS")!), false);
// RICH now HAS an auxiliary chain (the Amtrak connector), but its bare-"Station"
// platform default stays confident because that auxiliary elevator is hinted
// ("amtrak") — so it can't be confused with a hint-less bare advisory.
check('RICH platform default is confident despite its (hinted) Amtrak auxiliary',
  platformDefaultAmbiguous(models.get("RICH")!), false);

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
check("WMATA 'Other'-symptom outage missing a return -> NOT flagged (agency limit for the catch-all)",
  missingExpectedFields("wmata-dc", mkO({ unitExternalId: "F04X01", reason: "Other" }), mkU()), []);
check("WMATA 'Other'-symptom outage WITH a fail-safe note still exempt (symptom stripped of the ' (' note)",
  missingExpectedFields("wmata-dc", mkO({ unitExternalId: "F04X01", reason: "Other (unrecognized elevator at a modeled station — access shown as unknown; refresh the WMATA model)" }), mkU()), []);
check("CTA outage with no return/redundancy -> complete (both are agency limits)",
  missingExpectedFields("cta-chicago", mkO({ unitExternalId: "1" }), undefined), []);
check("BART curated unit -> complete (no return expected)",
  missingExpectedFields("bart-bay-area", mkO({ unitExternalId: "R60-51" }), mkU("curated")), []);
check("BART unspecified (unmodeled) -> route/redundancy flagged",
  missingExpectedFields("bart-bay-area", mkO({ unitExternalId: "RICH-UNSPECIFIED" }), undefined), ["route/redundancy"]);
check("MBTA un-modeled (assumed) unit -> route/redundancy flagged",
  missingExpectedFields("mbta-boston", mkO({ unitExternalId: "929" }), mkU("assumed")), ["route/redundancy"]);
check("empty reason anywhere -> reason flagged",
  missingExpectedFields("tfl-london", mkO({ unitExternalId: "L1", reason: "" }), mkU("pathways")), ["reason"]);

// The reciprocal-PAIR curated models (each leg names a same-station backup in
// MBTA's guidance) must stay single-fault-tolerant. The machine-validated
// pathways-proposal models added later (Aquarium, Park St, and Batch 1 —
// 2026-07-14) faithfully mirror the real MBTA layout, which at many stations
// includes genuine single-elevator legs (e.g. Arlington's lone street
// elevator 964): those are legitimately NOT single-fault-tolerant, and a
// single-fault model is the conservative, over-warn-safe representation. So
// the redundancy assertion is scoped to the pair models; ALL curated models
// are still checked for structural validity.
console.log("\n  hand-curated MBTA models: reciprocal pairs stay redundant; all are structurally valid:");
const MBTA_RECIPROCAL_PAIR_STATIONS = new Set([
  "place-gover", "place-alfcl", "place-mvbcl", "place-gilmn",
  "place-orhte", "place-ER-0115", "place-ER-0183", "place-aport",
]);
check("every reciprocal-pair curated MBTA model is single-fault-tolerant (no sole access)",
  MBTA_STATION_MODELS.filter((m) => MBTA_RECIPROCAL_PAIR_STATIONS.has(m.stationExternalId)).every((m) => isSingleFaultTolerant(m)), true);
check("every curated MBTA model is structurally valid (>=1 segment, every segment >=1 elevator)",
  MBTA_STATION_MODELS.every((m) => m.segments.length >= 1 && m.segments.every((s) => s.elevators.length >= 1)), true);
check("Government Center Blue-Line chain: 722 out is covered by 723 (redundant)",
  MBTA_STATION_MODELS.some((m) => m.stationExternalId === "place-gover" && m.chainLabel === " (Blue Line)" && stationAccessible(m, new Set(["722"]))), true);

// --- Same-name elevator letter designations (A/B/C…) -------------------------
// Standing rule (Bryce, 2026-07-20): within a physical station, elevators that
// share an IDENTICAL label are lettered so an outage names WHICH one is down;
// uniquely-named elevators get no letter. Derived, per-system, never hand-typed.
console.log("\n  same-name elevator letter designations:");
const wmataLetters = elevatorLetterMap([...stationModelsFor("wmata-dc").values()].flat());
// Rosslyn (C05) has three identically-labeled "street to eastbound platform"
// elevators, shared across the eastbound AND westbound chains — lettered A/B/C
// by sorted id, and the SAME letter in every chain the elevator appears in.
check("Rosslyn C05E01 → A", wmataLetters.get("C05E01"), "A");
check("Rosslyn C05E02 → B", wmataLetters.get("C05E02"), "B");
check("Rosslyn C05E03 → C", wmataLetters.get("C05E03"), "C");
// C05W04 is the sole upper→lower elevator with a UNIQUE label → no letter.
check("Rosslyn C05W04 (unique label) → no letter", wmataLetters.get("C05W04"), undefined);
// The display helper appends the letter in parentheses (Bryce's chosen format);
// a letterless name is returned unchanged.
check("withElevatorLetter appends (A)", withElevatorLetter("Elevator between street and upper platform", "A"), "Elevator between street and upper platform (A)");
check("withElevatorLetter no-op without a letter", withElevatorLetter("Platform elevator", undefined), "Platform elevator");
// Grouping is per physical station: a station whose elevators all carry
// distinct labels contributes no letters at all.
check("distinct-label station contributes no letters", elevatorLetterMap([
  { systemId: "x", stationExternalId: "S", segments: [
    { id: "a", label: "a", elevators: [{ externalId: "S-1", label: "Street elevator" }, { externalId: "S-2", label: "Platform elevator" }] },
  ] },
]).size, 0);

const total = 76;
if (failures) {
  console.error(`\n  ${failures} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`\n  all ${total} checks passed\n`);
}
