// MANUAL outage-attribution overrides — a slim escape hatch for when a human
// has confirmed which specific elevator an otherwise-unattributable advisory
// refers to, redirecting future polls to that unit instead of the adapter's
// synthetic "unspecified" placeholder.
//
// Why this exists: some feeds (BART's cmd=elev advisory in particular) are
// sometimes just the bare word "Station" — no descriptive text at all, so
// NO amount of matchHints/text-matching can ever attribute it (see SPEC.md's
// BART "Open problem" note). When a human confirms the real elevator by other
// means (calling the station, riding it, BART's own app), a ONE-TIME manual
// database correction (moving the open event's unit_id) gets clobbered by the
// very next poll: ingest sees the adapter still reporting the ambiguous
// synthetic unit id, finds no open event under THAT id (since the fix moved
// it away), opens a brand-new event with started_at reset to poll time — AND
// separately closes the manually-fixed event, since its unit was never in
// this poll's reported-out set. Both losses happen on the SAME next poll.
//
// Applied by ingest.ts BEFORE its open/refresh/close logic: an outage the
// adapter reports against `fromUnitExternalId` is treated as if it were
// reported against `toUnitExternalId` instead, so ingest finds and refreshes
// the SAME already-open event (preserving its true started_at) rather than
// opening a duplicate or closing the real one.
//
// CRITICAL — self-limiting only by construction, not automatically: this
// override has no expiry. It keeps redirecting for as long as the entry
// exists in this file AND the adapter keeps reporting that ambiguous unit id
// — including for a FUTURE, possibly UNRELATED outage at the same station
// that happens to produce the same ambiguous text. Once the confirmed
// elevator's outage actually resolves (its event closes because the
// ambiguous advisory stops being reported), REMOVE the entry — don't leave it
// in place "just in case," or a later different outage at that station could
// get silently mis-attributed to the same elevator without a fresh human
// confirmation. This is a correction for a SPECIFIC known outage, not a
// standing guess about which elevator a station's vague advisories mean.

export interface AttributionOverride {
  systemId: string;
  fromUnitExternalId: string; // the ambiguous/synthetic unit id the adapter emits
  toUnitExternalId: string; // the human-confirmed real elevator to redirect to
  note: string;
  confirmedOn: string; // ISO date
}

export const ATTRIBUTION_OVERRIDES: AttributionOverride[] = [
  // (Empty.) The Richmond override lived here until 2026-07-12, when the general
  // BART policy "a bare 'station elevator' advisory means the platform elevator"
  // (platformDefaultElevator in accessibility.ts) made it redundant — "RICH:
  // Station" now attributes to RICH-PLAT directly at the adapter, with a clean
  // reason, so no ingest-level redirect (and no stale 'unspecified' reason) is
  // needed. This mechanism remains for a future station where a human confirms a
  // specific elevator that neither matchHints nor the platform default can reach.
];

export function attributionOverridesFor(systemId: string): Map<string, AttributionOverride> {
  return new Map(
    ATTRIBUTION_OVERRIDES.filter((o) => o.systemId === systemId).map((o) => [o.fromUnitExternalId, o]),
  );
}
