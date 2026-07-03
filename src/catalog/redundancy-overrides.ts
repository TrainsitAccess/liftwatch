// MANUAL redundancy overrides — a slim escape hatch for quick, human-confirmed
// boolean calls on units that DON'T have a structural station model.
//
// This is NOT the main curation mechanism. Structured curation lives in
// station-models.ts: modeled stations expand into per-elevator units in the
// adapter, each carrying derived, `curated`-source redundancy. Use this file
// only for simple cases (e.g. "unit X on system Y is confirmed redundant")
// where building a full segment model isn't warranted yet.
//
// Applied by ingest at top precedence (`curated`), re-asserted every poll, and
// keyed by the unit's externalId as the adapter emits it. Editing an entry
// propagates on the next poll (curated-vs-curated: the file wins). A real feed
// signal that contradicts an entry raises a redundancy_flag instead of
// overwriting. The dry-run poll warns about entries that match no live unit.

export interface RedundancyOverride {
  systemId: string;
  unitExternalId: string;
  isRedundant: boolean;
  note: string;
  reviewedOn: string; // ISO date
}

export const REDUNDANCY_OVERRIDES: RedundancyOverride[] = [
  // e.g. { systemId: "mta-nyct", unitExternalId: "EL123", isRedundant: true,
  //        note: "…", reviewedOn: "2026-07-03" },
];

export function overridesFor(systemId: string): Map<string, RedundancyOverride> {
  return new Map(
    REDUNDANCY_OVERRIDES.filter((o) => o.systemId === systemId).map((o) => [o.unitExternalId, o]),
  );
}
