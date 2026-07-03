import { STATION_MODELS } from "./station-models.js";
import { isSingleFaultTolerant } from "../lib/accessibility.js";

// Human-curated station-level redundancy — the source of truth for confirmed
// redundancy, applied by ingest at the top of the precedence chain (`curated`),
// re-asserted on every poll. Two inputs:
//   1. DERIVED — computed from the structural station models (station-models.ts):
//      a station is redundant iff no single elevator outage severs access.
//   2. MANUAL — simple boolean calls for stations we haven't structurally modeled.
//
// unitExternalId is the adapter's unit id. For station-level systems like BART
// that means the station code (e.g. "ASHB").

export interface RedundancyOverride {
  systemId: string;
  unitExternalId: string;
  isRedundant: boolean;
  note: string;
  reviewedOn: string; // ISO date
}

const DERIVED: RedundancyOverride[] = STATION_MODELS.map((m) => ({
  systemId: m.systemId,
  unitExternalId: m.stationExternalId,
  isRedundant: isSingleFaultTolerant(m),
  note: m.note ?? "Derived from the station accessibility model.",
  reviewedOn: "2026-07-03",
}));

const MANUAL: RedundancyOverride[] = [
  // e.g. { systemId: "bart-bay-area", unitExternalId: "XXXX", isRedundant: false, note: "...", reviewedOn: "..." },
];

export const REDUNDANCY_OVERRIDES: RedundancyOverride[] = [...DERIVED, ...MANUAL];

export function overridesFor(systemId: string): Map<string, RedundancyOverride> {
  return new Map(
    REDUNDANCY_OVERRIDES.filter((o) => o.systemId === systemId).map((o) => [o.unitExternalId, o]),
  );
}
