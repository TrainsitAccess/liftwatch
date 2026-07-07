import { normalizeRail, LIRR_CONFIG, MNR_CONFIG } from "../adapters/mta-rail/index.js";
import type {
  CamsysAlertsResponse,
  RailEeStatusResponse,
  RailInfrastructureResponse,
} from "../adapters/mta-rail/raw.js";

// Offline asserting regression for the shared LIRR/Metro-North adapter
// (src/adapters/mta-rail). Exercises the pure feed->NormalizedRead mapper
// against a fixture distilled from the LIVE feeds (2026-07-06), locking in
// every verified quirk: two status casings, per-station-only unitId
// uniqueness (incl. elevator-vs-escalator collisions), MNR epoch timestamps
// vs LIRR nulls, "long term outage" -> planned, railroad filtering, the
// "BOTH" combined Grand Central entry belonging to neither system, and the
// camsys alert enrichment (unique-match attribution, never-guess ambiguity,
// never-downgrade, cross-railroad stop-id collision guard).
// Run: npm run check:rail   (no network)

const NO_ALERTS: CamsysAlertsResponse = { entity: [] };

const FIXED_AT = "2026-07-06T00:00:00.000Z";

// Distilled from the live feeds. JAM really has an elevator AND an escalator
// both numbered "761"; 2SM really has unitId "1 STM"; 2NR-206E really is a
// "long term outage" (the announced New Rochelle rebuild).
const eestatus: RailEeStatusResponse = {
  JAM: {
    elevators: [
      { location: "Between eastern overpass and Tracks 11 & 12", unitId: "761", status: "Working", lastUpdated: null },
      { location: "Between eastern overpass and Tracks 4 & 5", unitId: "342", status: "Not Working", lastUpdated: null },
    ],
    escalators: [
      { location: "Escalator sharing the elevator's number", unitId: "761", status: "Not Working", lastUpdated: null },
    ],
  },
  GCT: {
    elevators: [
      // Padded unitId: must be trimmed into the external id.
      { location: "EL01 - Between LIRR Concourse and Mezzanine for access to all tracks", unitId: " 947 ", status: "Working", lastUpdated: null },
    ],
  },
  "2NR": {
    elevators: [
      { location: "Elevator from the street to the Stamford/New Haven-bound platform (Track 4).", unitId: "206E", status: "long term outage", lastUpdated: 1750000000 },
      { location: "Elevator from the New York-bound platform (Track 3) to the overpass.", unitId: "206W", status: "working", lastUpdated: 1750000001 },
    ],
  },
  "2SM": {
    elevators: [
      { location: "Elevator 01 - To/from concourse, Track 5 & street (South State Street)", unitId: "1 STM", status: "not working", lastUpdated: 1750000002 },
    ],
  },
  // Un-modeled station: units must carry NO redundancy claim (ingest then
  // applies single_elevator/assumed).
  "0AR": {
    elevators: [
      { location: "Elevator from the Northbound platform (Tk 3) to the overpass.", unitId: "026N", status: "working", lastUpdated: 1750000003 },
      { location: "Elevator from the Southbound platform (Tk 4) to the overpass..", unitId: "026S", status: "working", lastUpdated: 1750000004 },
    ],
  },
  // A station code missing from infrastructure entirely — units must be
  // skipped (with a warning), never attributed to the wrong railroad.
  XXX: {
    elevators: [{ location: "Phantom", unitId: "1", status: "not working", lastUpdated: null }],
  },
};

const infrastructure: RailInfrastructureResponse = {
  stations: [
    { code: "JAM", name: "Jamaica", branch: "City Terminal Zone", latitude: 40.7, longitude: -73.83, railroad: "LIRR", accessibility: "FULL", gtfs_stop_id: 102 },
    { code: "GCT", name: "Grand Central", branch: "City Terminal Zone", latitude: 40.752, longitude: -73.977, railroad: "LIRR", accessibility: "FULL" },
    // Elevator-less station (ramps/level boarding): in the station layer,
    // never in units.
    { code: "ABT", name: "Albertson", branch: "Oyster Bay", latitude: 40.77, longitude: -73.64, railroad: "LIRR", accessibility: "FULL" },
    { code: "2NR", name: "New Rochelle", branch: "New Haven", latitude: 40.911, longitude: -73.784, railroad: "MNR", accessibility: "PARTIAL" },
    { code: "2SM", name: "Stamford", branch: "New Haven", latitude: 41.047, longitude: -73.542, railroad: "MNR", accessibility: "FULL" },
    { code: "0AR", name: "Ardsley-on-Hudson", branch: "Hudson", latitude: 41.016, longitude: -73.876, railroad: "MNR", accessibility: "PARTIAL" },
    // The unified app's combined Grand Central entry — belongs to NEITHER
    // system (the real stations are GCT/LIRR and 0NY/MNR).
    { code: "_GC", name: "Grand Central", railroad: "BOTH", accessibility: "FULL" },
  ],
};

let failures = 0;
const ok = (cond: boolean, msg: string): void => {
  if (!cond) failures++;
  console.log(`    ${cond ? "PASS" : "FAIL"}  ${msg}`);
};

const lirr = normalizeRail(eestatus, infrastructure, NO_ALERTS, LIRR_CONFIG, FIXED_AT);
const mnr = normalizeRail(eestatus, infrastructure, NO_ALERTS, MNR_CONFIG, FIXED_AT);

console.log("\n  Railroad filtering (one shared feed, two systems):");
ok(lirr.units.every((u) => ["JAM", "GCT"].includes(u.stationExternalId)), "LIRR units come only from LIRR stations");
ok(mnr.units.every((u) => ["2NR", "2SM", "0AR"].includes(u.stationExternalId)), "MNR units come only from MNR stations");
ok(lirr.stations!.some((s) => s.externalId === "ABT"), "elevator-less LIRR station is still in the station layer");
ok(!lirr.stations!.some((s) => s.externalId === "2NR") && !mnr.stations!.some((s) => s.externalId === "JAM"), "station layers don't cross railroads");
ok(!lirr.stations!.some((s) => s.externalId === "_GC") && !mnr.stations!.some((s) => s.externalId === "_GC"), "the 'BOTH' combined Grand Central entry belongs to neither system");
ok(![...lirr.units, ...mnr.units].some((u) => u.stationExternalId === "XXX"), "eestatus code missing from infrastructure is skipped, not misattributed");

console.log("\n  Unit identity (station-qualified, trimmed, elevators only):");
ok(lirr.units.filter((u) => u.externalId === "JAM-761").length === 1, "JAM elevator 761 kept once; the escalator sharing its number is ignored");
ok(lirr.units.some((u) => u.externalId === "GCT-947"), "padded unitId ' 947 ' trims to GCT-947");
ok(mnr.units.some((u) => u.externalId === "2SM-1 STM"), "MNR unitId with an embedded space survives verbatim (2SM-1 STM)");
ok(lirr.units.length === 3 && mnr.units.length === 5, `inventories complete (LIRR 3, MNR 5 — got ${lirr.units.length}, ${mnr.units.length})`);

console.log("\n  Outage derivation (two casings, planned mapping, timestamps):");
const lirrOut = lirr.outages.map((o) => o.unitExternalId).sort();
const mnrOut = mnr.outages.map((o) => o.unitExternalId).sort();
ok(JSON.stringify(lirrOut) === JSON.stringify(["JAM-342"]), `LIRR: capitalized "Not Working" -> outage, "Working" -> not (got ${JSON.stringify(lirrOut)})`);
ok(JSON.stringify(mnrOut) === JSON.stringify(["2NR-206E", "2SM-1 STM"]), `MNR: lowercase "not working"/"long term outage" -> outage, "working" -> not (got ${JSON.stringify(mnrOut)})`);
const newRochelle = mnr.outages.find((o) => o.unitExternalId === "2NR-206E");
const stamford = mnr.outages.find((o) => o.unitExternalId === "2SM-1 STM");
const jamaica = lirr.outages.find((o) => o.unitExternalId === "JAM-342");
ok(newRochelle?.isPlanned === true, `"long term outage" maps to planned (validated vs the announced New Rochelle closure)`);
ok(stamford?.isPlanned === false && jamaica?.isPlanned === false, `plain "not working" is unplanned`);
ok(newRochelle?.sourceStartedAt === "2025-06-15T15:06:40.000Z", `MNR lastUpdated (epoch seconds) becomes sourceStartedAt (got ${newRochelle?.sourceStartedAt})`);
ok(jamaica?.sourceStartedAt === undefined, "LIRR lastUpdated is always null -> no sourceStartedAt (our polling timestamps it)");

console.log("\n  Curated redundancy from station models (src/catalog/mta-rail-models.ts):");
const unit = (read: typeof mnr, id: string) => read.units.find((u) => u.externalId === id);
const nr206e = unit(mnr, "2NR-206E");
ok(nr206e?.isRedundant === false && nr206e?.redundancySource === "curated", "2NR-206E: sole per-direction elevator -> curated non-redundant");
const stm1 = unit(mnr, "2SM-1 STM");
ok(stm1?.isRedundant === true && stm1?.redundancySource === "curated", "2SM Elevator 01: backed up in every chain it serves (ramp on Track 5, Elevator 04 on the concourse leg) -> curated redundant");
const jam342 = unit(lirr, "JAM-342");
ok(jam342?.isRedundant === false && jam342?.redundancySource === "curated", "JAM-342: sole platform elevator for Tracks 4 & 5 -> curated non-redundant");
const gct947 = unit(lirr, "GCT-947");
ok(gct947?.isRedundant === true && gct947?.redundancySource === "curated", "GCT-947 (EL01): concourse-mezzanine pair with EL02 -> curated redundant");
const ar026n = unit(mnr, "0AR-026N");
ok(ar026n?.isRedundant === undefined && ar026n?.redundancySource === undefined, "un-modeled station's units carry no redundancy claim (ingest decides)");

console.log("\n  Station metadata:");
const jam = lirr.stations!.find((s) => s.externalId === "JAM");
ok(jam?.name === "Jamaica" && jam?.borough === "City Terminal Zone", "name + branch (in the borough slot) come from infrastructure");
ok(jam?.gtfsStopId === "102", "numeric gtfs_stop_id is stringified");
ok(lirr.units.every((u) => u.isAda && u.isActive && u.unitType === "elevator"), "units are elevator-type, accessible-path, active");

// ---------------------------------------------------------------------------
// camsys alert enrichment — a separate, purpose-built fixture (own eestatus +
// infrastructure + alerts) so each attribution rule is exercised in isolation.
// ---------------------------------------------------------------------------
console.log("\n  camsys alert enrichment (unique-match, never-guess, never-downgrade):");

const NOW_S = 1783000000; // sits inside the "active" windows below
const NOW_MS = NOW_S * 1000;

const enrichInfra: RailInfrastructureResponse = {
  stations: [
    { code: "2NR", name: "New Rochelle", railroad: "MNR", gtfs_stop_id: 108 },
    { code: "MTZ", name: "Multi-Track", railroad: "MNR", gtfs_stop_id: 200 },
    { code: "GEN", name: "Generic", railroad: "MNR", gtfs_stop_id: 300 },
    { code: "FUT", name: "Future Work", railroad: "MNR", gtfs_stop_id: 400 },
    // LIRR station sharing gtfs_stop_id 108 with MNR's New Rochelle — the
    // real cross-railroad collision this guards against.
    { code: "LIX", name: "LIRR Collision", railroad: "LIRR", gtfs_stop_id: 108 },
  ],
};

const enrichEe: RailEeStatusResponse = {
  "2NR": {
    elevators: [
      { location: "Elevator from the street to the Stamford/New Haven-bound platform (Track 4).", unitId: "206E", status: "long term outage", lastUpdated: 1782000000 },
      { location: "Elevator from the New York-bound platform (Track 3) to the overpass.", unitId: "206W", status: "working", lastUpdated: 1782000001 },
    ],
  },
  // Two out-of-service elevators BOTH serving Track 4 -> ambiguous; plus a
  // Track 7 breakdown that must never match a Track 4 alert.
  MTZ: {
    elevators: [
      { location: "Elevator A to the Track 4 platform.", unitId: "A", status: "not working", lastUpdated: null },
      { location: "Elevator B to the Tracks 4 & 6 platform.", unitId: "B", status: "not working", lastUpdated: null },
      { location: "Elevator C to the Track 7 platform.", unitId: "C", status: "not working", lastUpdated: null },
    ],
  },
  // One out-of-service elevator, one working — a no-track (generic) alert.
  GEN: {
    elevators: [
      { location: "Main street elevator.", unitId: "1", status: "not working", lastUpdated: null },
      { location: "Platform elevator.", unitId: "2", status: "working", lastUpdated: null },
    ],
  },
  FUT: { elevators: [{ location: "Elevator to the Track 2 platform.", unitId: "1", status: "not working", lastUpdated: null }] },
  LIX: { elevators: [{ location: "Elevator to the Track 4 platform.", unitId: "1", status: "not working", lastUpdated: null }] },
};

const win = (s: number, e: number) => [{ start: s, end: e }];
const en = (text: string) => ({ translation: [{ text, language: "en" }] });
const enrichAlerts: CamsysAlertsResponse = {
  entity: [
    // New Rochelle: planned upgrade naming Tracks 2 & 4; only 206E (Track 4) is out.
    { id: "lmm:planned_work:1", alert: {
      active_period: win(NOW_S - 100_000, NOW_S + 100_000),
      informed_entity: [{ agency_id: "MNR", stop_id: "108" }],
      header_text: en("The elevator leading to the tracks 2 and 4 platform at New Rochelle is closed for upgrade work."),
      description_text: en("Use the stairs; consider Larchmont station."),
    } },
    // Multi-Track: names Track 4, but TWO out-of-service elevators serve it -> skip.
    { id: "lmm:planned_work:2", alert: {
      active_period: win(NOW_S - 1000, NOW_S + 1000),
      informed_entity: [{ agency_id: "MNR", stop_id: "200" }],
      header_text: en("The elevator to the track 4 platform is closed for scheduled replacement."),
    } },
    // Generic: no track named, one out-of-service elevator at the station -> attribute.
    { id: "lmm:planned_work:3", alert: {
      active_period: win(NOW_S - 1000, NOW_S + 1000),
      informed_entity: [{ agency_id: "MNR", stop_id: "300" }],
      header_text: en("An elevator at this station is out of service for planned maintenance."),
    } },
    // Future window: must NOT apply even though the elevator is out now.
    { id: "lmm:planned_work:4", alert: {
      active_period: win(NOW_S + 50_000, NOW_S + 100_000),
      informed_entity: [{ agency_id: "MNR", stop_id: "400" }],
      header_text: en("The elevator to the track 2 platform will be closed for upgrade work."),
    } },
  ],
};

const mnrE = normalizeRail(enrichEe, enrichInfra, enrichAlerts, MNR_CONFIG, FIXED_AT, NOW_MS);
const lirrE = normalizeRail(enrichEe, enrichInfra, enrichAlerts, LIRR_CONFIG, FIXED_AT, NOW_MS);
const eout = (r: typeof mnrE, id: string) => r.outages.find((o) => o.unitExternalId === id);

const nrE = eout(mnrE, "2NR-206E");
ok(nrE?.reason === "The elevator leading to the tracks 2 and 4 platform at New Rochelle is closed for upgrade work.", "unique track match attaches the alert's human-readable reason");
ok(nrE?.isPlanned === true, "matched planned alert keeps/sets isPlanned");
ok(nrE?.estimatedReturn === new Date((NOW_S + 100_000) * 1000).toISOString(), `alert active_period end becomes estimatedReturn (got ${nrE?.estimatedReturn})`);
ok(!mnrE.outages.some((o) => o.unitExternalId === "2NR-206W"), "the working New Rochelle elevator is never enriched (not out of service)");

const mtzA = eout(mnrE, "MTZ-A");
const mtzB = eout(mnrE, "MTZ-B");
const mtzC = eout(mnrE, "MTZ-C");
ok(mtzA?.isPlanned === false && mtzA?.reason === "not working", "two out-of-service elevators share the alert's track -> ambiguous -> A untouched");
ok(mtzB?.isPlanned === false && mtzB?.reason === "not working", "  ...and B untouched (never guess between candidates)");
ok(mtzC?.isPlanned === false && mtzC?.reason === "not working", "the Track 7 breakdown never matches a Track 4 alert");

const gen1 = eout(mnrE, "GEN-1");
ok(gen1?.isPlanned === true && /planned maintenance/.test(gen1?.reason ?? ""), "no-track alert attributes to the sole out-of-service elevator at the station");

const futE = eout(mnrE, "FUT-1");
ok(futE?.isPlanned === false && futE?.reason === "not working", "an alert whose active window is in the future is not applied");

// Cross-railroad guard: the MNR New Rochelle alert (stop_id 108, agency MNR)
// must NOT enrich the LIRR station that happens to share gtfs_stop_id 108.
const lix = eout(lirrE, "LIX-1");
ok(lix?.isPlanned === false && lix?.reason === "not working", "gtfs_stop_id collision: an MNR-agency alert never enriches a same-numbered LIRR station");

console.log(`\n  ${failures === 0 ? "all checks passed" : `${failures} check(s) FAILED`}\n`);
if (failures > 0) process.exitCode = 1;
