// Normalized domain types. Every adapter maps its agency feed into these,
// so nothing downstream (ingest, rollups, leaderboards) knows or cares which
// agency the data came from. This is the seam that lets us add systems by
// config instead of bespoke code.

export type UnitType = "elevator" | "escalator";

// How a unit's redundancy was determined. Doubles as precedence order: a poll
// only overwrites redundancy with a source of equal-or-higher rank, so curated
// (human-confirmed) values are never clobbered by re-polling.
export type RedundancySource =
  | "assumed" // defaulted to non-redundant, unconfirmed
  | "single_elevator" // station has exactly one elevator
  | "serving_text" // inferred from what each elevator serves
  | "pathways" // derived from a GTFS-Pathways access graph
  | "explicit" // the feed states it (e.g. MTA `redundant`)
  | "curated"; // a human confirmed it

export const REDUNDANCY_PRECEDENCE: Record<RedundancySource, number> = {
  assumed: 0,
  single_elevator: 1,
  serving_text: 2,
  pathways: 3,
  explicit: 4,
  curated: 5,
};

/** One physical elevator, from the agency's full-equipment ("denominator") feed. */
export interface NormalizedUnit {
  externalId: string; // agency's stable equipment id, e.g. "EL293"
  unitType: UnitType;
  stationExternalId: string; // stable station id (NOT the free-text name)
  stationName: string;
  stationNameNative?: string;
  borough?: string;
  description?: string;
  lines?: string;
  isAda: boolean;
  isRedundant?: boolean; // false => sole step-free access (impact weighting)
  // Set only when the adapter has a real signal (explicit / pathways / serving_text).
  // Left undefined otherwise; ingest then applies single_elevator or assumed.
  redundancySource?: RedundancySource;
  segment?: string; // access-chain leg this elevator serves (curated per-elevator model)
  isActive: boolean;
  gtfsStopId?: string;
  latitude?: number;
  longitude?: number;
}

/** One outage, current or upcoming, from the agency's outage feed. */
export interface NormalizedOutage {
  unitExternalId: string;
  unitType: UnitType;
  stationExternalId?: string;
  stationName: string;
  isPlanned: boolean;
  isUpcoming: boolean;
  reason?: string;
  sourceStartedAt?: string; // ISO-8601 UTC (feed-reported start; may predate us)
  estimatedReturn?: string; // ISO-8601 UTC
  // Station-level feeds (BART): whether we mapped this to a specific curated
  // elevator (true) or fell back to an unspecified/conservative unit (false).
  attributed?: boolean;
  segmentId?: string;
  // UNIVERSAL "unidentified outage" flag: an outage we could NOT confidently
  // place onto a specific known elevator — a conservative/unspecified fallback,
  // or a low-confidence guess (BART's platform default at a station that also
  // has other equipment). Surfaced for human review (a "Needs review" board, a
  // poll warning, and an ntfy push). Any adapter may set it; today BART does.
  needsReview?: boolean;
}

// OTHER ACCESSIBILITY EQUIPMENT — a NON-ELEVATOR facility whose loss removes
// step-free/accessible access — a mini-high or fully-elevated boarding platform,
// a portable boarding lift, a wheelchair lift, a ramp. Deliberately SEPARATE
// from elevators: these never enter the elevator inventory, the "% of fleet
// down" math, or any elevator leaderboard. They are a supplementary "before you
// go" access signal, archived in their own table. Only adapters whose agency
// exposes such equipment populate these (MBTA by facility type; BART's Coliseum
// parking-lot wheelchair lift by curated matchHint); other systems leave them
// undefined.
export type OtherEquipmentType =
  | "elevated_subplatform" // mini-high platform
  | "fully_elevated_platform"
  | "portable_boarding_lift"
  | "wheelchair_lift"
  | "ramp";

/** One piece of other accessibility equipment currently out of service. */
export interface NormalizedOtherEquipment {
  facilityExternalId: string; // agency's stable id, e.g. "subplat-SB-0189-1"
  facilityType: OtherEquipmentType;
  stationExternalId?: string;
  stationName: string;
  description?: string; // long name, e.g. "Stoughton mini-high platform"
  isPlanned: boolean;
  isUpcoming: boolean;
  reason?: string;
  sourceStartedAt?: string; // ISO-8601 UTC
  estimatedReturn?: string; // ISO-8601 UTC
}

/** A station known independently of any unit (e.g. from a full station-list feed). */
export interface NormalizedStation {
  externalId: string;
  name: string;
  nameNative?: string;
  borough?: string;
  latitude?: number;
  longitude?: number;
  gtfsStopId?: string;
}

/** A single point-in-time read of a system. */
export interface NormalizedRead {
  systemId: string;
  fetchedAt: string; // ISO-8601 UTC
  units: NormalizedUnit[]; // full inventory = the denominator (or discovered units, see catalog inventoryComplete)
  outages: NormalizedOutage[]; // currently out
  upcoming: NormalizedOutage[]; // scheduled future work
  // Optional complete station list, for systems whose station feed is richer
  // than their unit feed (WMATA: all 102 stations w/ coords, but units are
  // only discovered as they break). Ingest upserts these BEFORE unit-derived
  // stations; units still add any station missing from this list.
  stations?: NormalizedStation[];
  // OTHER ACCESSIBILITY EQUIPMENT outages, currently out (see
  // NormalizedOtherEquipment). Walled off from all elevator metrics; archived
  // separately. Populated only by adapters whose agency exposes such equipment
  // (MBTA, BART Coliseum lift); undefined elsewhere.
  otherEquipment?: NormalizedOtherEquipment[];
}

/** The contract every system adapter implements. */
export interface Adapter {
  /** The system this instance is bound to, e.g. "mta-nyct". */
  readonly systemId: string;
  fetch(): Promise<NormalizedRead>;
}
