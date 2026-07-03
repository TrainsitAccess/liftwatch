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
}

/** A single point-in-time read of a system. */
export interface NormalizedRead {
  systemId: string;
  fetchedAt: string; // ISO-8601 UTC
  units: NormalizedUnit[]; // full inventory = the denominator
  outages: NormalizedOutage[]; // currently out
  upcoming: NormalizedOutage[]; // scheduled future work
}

/** The contract every system adapter implements. */
export interface Adapter {
  /** Adapter type id, e.g. "mta". Many systems can share one adapter. */
  readonly id: string;
  /** The system this instance is bound to, e.g. "mta-nyct". */
  readonly systemId: string;
  fetch(): Promise<NormalizedRead>;
}
