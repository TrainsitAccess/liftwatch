// Types for the bundled TfL catalog (built by scripts/tfl-import.mjs from
// TfL's published step-free station topology CSVs — see SPEC.md) and the live
// Disruptions/Lifts/v2 feed.

export interface TflCatalogStation {
  id: string; // e.g. "940GZZLUWYP", "910GHACKNYW", "HUBWIJ" (hub code)
  name: string;
  fareZones: string; // free-text: "3", "2|3", "Outside", "Trams fare zone"
  hubCode: string | null;
  wifi: boolean;
  blueBadgeCarParking: boolean | null;
  blueBadgeCarParkSpaces: number | null;
  taxiRanksOutsideStation: boolean | null;
  mainBusInterchange: string | null; // "Full" | "Partial" | null
  pierInterchange: string | null;
  nationalRailInterchange: string | null;
  airportInterchange: string | null;
  emiratesAirLineInterchange: string | null;
  lat: number | null; // centroid of the station's points — no direct station coordinate is published
  lon: number | null;
}

export interface TflCatalogLift {
  id: string; // LiftUniqueId, verbatim (~5% don't follow "Station-Lift-N" — never reconstruct)
  stationId: string;
  liftId: string; // display only — not unique, even within a station
  friendlyName: string | null;
  fromAreas: string; // pipe-delimited area id(s); opaque graph-node identifiers
  toAreas: string;
  intermediateAreas: string | null;
  intermediateAreas2: string | null;
  limitedCapacity: boolean;
  notes: string | null;
  // Precomputed by the import script: true iff another lift at the same
  // station shares this exact (fromAreas, toAreas) tuple. Verified against
  // real counter-examples (Kingsbury: same origin, different platforms ->
  // false; South Quay DLR: 3 lifts, identical route -> true).
  isRedundant: boolean;
  redundancyGroupSize: number;
}

/** One element of GET https://api.tfl.gov.uk/Disruptions/Lifts/v2 (no auth needed). */
export interface TflLiftDisruptionRaw {
  stationUniqueId: string;
  disruptedLiftUniqueIds: string[];
  message: string;
}
