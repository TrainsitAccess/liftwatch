// Raw shapes from the MTA commuter-railroad (LIRR + Metro-North) feeds at
// backend-unified.mylirr.org — the backend of MTA's OWN elevator-escalator-
// status page and the unified TrainTime app. UNDOCUMENTED (found by network
// inspection of mta.info's status page, same method as TMB's alerts feed —
// see SPEC.md); could change without notice. Live-verified 2026-07-06.

/** One unit inside an /eestatus station entry (elevator or escalator). */
export interface RailEeUnitRaw {
  location: string; // descriptive, segment-grade: "Between eastern overpass and Tracks 4 & 5"
  // Only unique PER STATION — and collides across unit types (Jamaica has an
  // elevator AND an escalator both numbered "761"). MNR ids can contain
  // spaces ("1 STM"). Always station-qualify; never use bare.
  unitId: string;
  // Two upstream systems share this feed and are distinguishable per unit:
  // LIRR = "Working"/"Not Working" (capitalized) with lastUpdated null;
  // MNR = "working"/"not working"/"long term outage" (lowercase) with
  // lastUpdated = epoch SECONDS of the last status change (validated against
  // a known planned closure: New Rochelle 206E). Compare case-insensitively.
  status: string;
  lastUpdated: number | null;
}

/** GET https://backend-unified.mylirr.org/eestatus — keyed by station code.
 * Inventory AND live status in one feed: working units are listed too, so
 * this is a complete denominator (unlike WMATA/CTA discovered inventories).
 * Stations with no elevators/escalators simply have no key. */
export type RailEeStatusResponse = Record<
  string,
  { elevators?: RailEeUnitRaw[]; escalators?: RailEeUnitRaw[] }
>;

/** One station from GET .../infrastructure?language=en (242 stations). */
export interface RailInfrastructureStationRaw {
  code: string; // "JAM", "0NY" — joins eestatus keys exactly (99/99 verified)
  name: string;
  branch?: string; // "Montauk", "Hudson", ...
  branch_id?: string;
  latitude?: number;
  longitude?: number;
  railroad: string; // "LIRR" | "MNR" | "BOTH" ("BOTH" = the app's combined Grand Central entry — no units of its own)
  accessibility?: string; // "FULL" | "PARTIAL" | "NONE"
  gtfs_stop_id?: number;
  locCode?: number;
  stationDetailURL?: string;
}

export interface RailInfrastructureResponse {
  stations?: RailInfrastructureStationRaw[];
}

// --- camsys service-alert feed (GTFS-RT + MTA "Mercury" extensions) ---------
// GET .../camsys%2Flirr-alerts.json  and  .../camsys%2Fmnr-alerts.json
// General service alerts (extra service, stops skipped, station notices…).
// A small minority are planned elevator-closure notices with a scheduled
// window and human prose — used ONLY to enrich the eestatus outages (better
// planned/unplanned classification + a real reason + scheduled return). NOT
// a status feed: it names a station (stop_id) and describes the elevator in
// free text, never a unitId.

export interface CamsysTranslation {
  text: string;
  language: string; // "en", "en-html"
}

export interface CamsysTranslatedString {
  translation?: CamsysTranslation[];
}

export interface CamsysActivePeriod {
  start?: number; // epoch SECONDS
  end?: number; // epoch seconds
}

export interface CamsysInformedEntity {
  agency_id?: string; // "MNR" for Metro-North, "LI" for the LIRR (note: not "LIRR")
  route_id?: string;
  stop_id?: string; // GTFS stop id — crosswalks to infrastructure gtfs_stop_id, but only WITHIN one railroad (the id space collides across LIRR/MNR)
}

export interface CamsysMercuryAlert {
  alert_type?: string; // "Station Notice", "Planned - Stops Skipped", … (NOT a reliable elevator/planned signal on its own)
  created_at?: number;
  updated_at?: number;
  human_readable_active_period?: CamsysTranslatedString; // e.g. "May 26 - Jul 17"
}

export interface CamsysAlert {
  active_period?: CamsysActivePeriod[];
  informed_entity?: CamsysInformedEntity[];
  header_text?: CamsysTranslatedString;
  description_text?: CamsysTranslatedString;
  "transit_realtime.mercury_alert"?: CamsysMercuryAlert;
}

export interface CamsysEntity {
  id?: string; // "lmm:planned_work:32172" — the planned_work prefix is broad, not elevator-specific
  alert?: CamsysAlert;
}

export interface CamsysAlertsResponse {
  entity?: CamsysEntity[];
}
