// Per-system FIELD EXPECTATIONS — the capability profile that powers the
// "missing information" flag. The 2026-07-12 data-integrity audit established
// that most blank fields are AGENCY LIMITATIONS, not bugs: BART and TfL publish
// no cause or estimated return; LIRR has no feed timestamp; WMATA and CTA aren't
// curated so they can't say where an elevator goes or whether there's a backup.
// Flagging those would be constant noise. So we flag an outage ONLY when it is
// missing a field its OWN system is expected to provide — which makes the flag
// a genuine regression/curation-gap detector, quiet until something is actually
// wrong.
//
// When a system's real capability changes (a new curated system, an agency that
// starts publishing returns), update its row here — that is the one source of
// truth for "what should this system be able to tell a rider?".

import type { NormalizedOutage, NormalizedUnit } from "../types.js";

interface SystemFieldExpectations {
  /** Agency reliably publishes an estimated return-to-service (verified: MTA, WMATA = 100%). */
  expectsReturn: boolean;
  /** We curate access chains for this system, so a MODELED unit knows where it
   *  goes and whether it's redundant. An un-modeled unit here is a curation gap. */
  curatedRoute: boolean;
}

const EXPECTATIONS: Record<string, SystemFieldExpectations> = {
  "mta-nyct": { expectsReturn: true, curatedRoute: true },
  "wmata-dc": { expectsReturn: true, curatedRoute: false },
  "bart-bay-area": { expectsReturn: false, curatedRoute: true },
  "mbta-boston": { expectsReturn: false, curatedRoute: true },
  "cta-chicago": { expectsReturn: false, curatedRoute: false },
  "tfl-london": { expectsReturn: false, curatedRoute: true },
  "mta-lirr": { expectsReturn: false, curatedRoute: true },
  "mta-mnr": { expectsReturn: false, curatedRoute: true },
  "tmb-barcelona": { expectsReturn: false, curatedRoute: false },
};

const DEFAULT_EXPECTATIONS: SystemFieldExpectations = { expectsReturn: false, curatedRoute: false };

export function systemFieldExpectations(systemId: string): SystemFieldExpectations {
  return EXPECTATIONS[systemId] ?? DEFAULT_EXPECTATIONS;
}

/**
 * The rider-facing fields an outage is EXPECTED to carry but doesn't. Empty
 * array = complete for what this system can provide. Universal safety checks
 * (reason, location) apply everywhere; return + route/redundancy apply only
 * where the system is expected to supply them.
 */
export function missingExpectedFields(
  systemId: string,
  outage: NormalizedOutage,
  unit: NormalizedUnit | undefined,
): string[] {
  const exp = systemFieldExpectations(systemId);
  const missing: string[] = [];

  // Universal — a real feed should always carry these; empty = an anomaly worth a look.
  if (!outage.reason || !outage.reason.trim()) missing.push("reason");
  if (!outage.stationName || !outage.stationName.trim()) missing.push("location");

  // Expected-only fields.
  if (exp.expectsReturn && !outage.estimatedReturn) missing.push("predicted return");
  if (exp.curatedRoute) {
    // A DETERMINED redundancy source (curated / explicit / pathways / serving_text
    // / single_elevator) means the unit is modeled — it knows where it goes and
    // whether it has a backup. "assumed" or no unit at all = un-modeled: its
    // route + redundancy are unknown, a curation gap at a system we DO curate.
    const src = unit?.redundancySource;
    if (!src || src === "assumed") missing.push("route/redundancy");
  }

  return missing;
}
