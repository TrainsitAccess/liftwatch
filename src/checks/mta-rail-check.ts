import { normalizeRail, LIRR_CONFIG, MNR_CONFIG } from "../adapters/mta-rail/index.js";
import type { RailEeStatusResponse, RailInfrastructureResponse } from "../adapters/mta-rail/raw.js";

// Offline asserting regression for the shared LIRR/Metro-North adapter
// (src/adapters/mta-rail). Exercises the pure feed->NormalizedRead mapper
// against a fixture distilled from the LIVE feeds (2026-07-06), locking in
// every verified quirk: two status casings, per-station-only unitId
// uniqueness (incl. elevator-vs-escalator collisions), MNR epoch timestamps
// vs LIRR nulls, "long term outage" -> planned, railroad filtering, and the
// "BOTH" combined Grand Central entry belonging to neither system.
// Run: npm run check:rail   (no network)

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

const lirr = normalizeRail(eestatus, infrastructure, LIRR_CONFIG, FIXED_AT);
const mnr = normalizeRail(eestatus, infrastructure, MNR_CONFIG, FIXED_AT);

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

console.log(`\n  ${failures === 0 ? "all checks passed" : `${failures} check(s) FAILED`}\n`);
if (failures > 0) process.exitCode = 1;
