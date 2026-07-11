// System-agnostic access-chain inference over LANDING-CLASSIFIED elevators.
//
// Many transit feeds describe each elevator's coverage as free text ("Elevator
// from the overpass to the island platform (Tracks 2 & 1)"). This engine turns
// a normalized, per-system-mapped view of that text into StationModels — but
// ONLY for stations whose topology is simple enough to derive mechanically.
// Anything ambiguous is EXCLUDED with a reason (never guessed), following the
// TfL chain generator's precedent: auto-model the safe majority, queue the
// tangled minority for human review.
//
// The engine knows nothing about any agency. A thin per-system MAPPER (e.g.
// src/adapters/mta-rail/chain-mapper.ts) parses that system's location text
// into InferenceUnits; the engine consumes only the normalized shape. A future
// system with "from X to Y"-style elevator descriptions reuses this whole file
// with its own mapper — same engine/mapper split as scripts/mta-chains.mjs and
// scripts/tfl-chains.mjs.
//
// The topology vocabulary (deliberately minimal):
//   - STREET landing: ground truth entry (street, parking lot, plaza, ...)
//   - PLATFORM landing: where the trains are, identified by a platform KEY
//     (a normalized track-set like "1&2", a platform letter, or "" unnamed)
//   - HUB landing: an intermediate level (overpass, underpass, concourse, ...)
//     identified by NAME so street legs and spokes can be matched
//   - GARAGE-only units are parked outside chains (they serve parking, not the
//     step-free access path — White Plains WP2 precedent from the hand models)
//
// Unit roles fall out of the landings:
//   fullPath  = street + platform         (one elevator IS the whole route)
//   spoke     = hub + platform, no street (needs the hub reached first)
//   streetLeg = street + hub, no platform (how the hub is reached)
// A fullPath unit that ALSO lists the hub doubles as a streetLeg for spokes on
// that hub — the Woodside-449 pattern from the hand-curated rail models.
//
// CONSERVATIVE BY CONSTRUCTION (the project's standing rule — over-warn, never
// under-warn):
//   - stepFreeAlternative is NEVER emitted (only a human, or verified alert
//     evidence, may claim a ramp exists).
//   - A street-leg elevator, when present, is modeled as REQUIRED — if the hub
//     is also reachable at grade, we over-warn on that elevator's outages.
//   - A hub with NO street-leg elevator is treated as grade-reachable only
//     when the agency itself declares the station fully accessible
//     (accessibilityFull) — the New Rochelle 206W precedent from the
//     hand-curated models; otherwise the station is excluded.
//   - Redundancy (multiple elevators in one segment) is claimed only on an
//     EXACT platform-key match between same-role units (the TfL exact
//     from/to-match precedent: "2+ lifts at a station" is never enough).

import {
  allElevators,
  stationAccessible,
  type AccessSegment,
  type StationModel,
} from "./accessibility.js";

/** One elevator, as classified by a per-system mapper from its feed text. */
export interface InferenceUnit {
  externalId: string;
  /** Rider-facing label — typically the feed's own location text. */
  label: string;
  street: boolean;
  /** Normalized platform identity ("1&2", "P:A", "" = unnamed) or null if no platform landing. */
  platformKey: string | null;
  /** Rider-facing form of platformKey ("Tracks 1 & 2", "Platform A", "platform"). */
  platformDisplay: string | null;
  /** Normalized hub identities this unit serves (e.g. "eastern overpass"). */
  hubs: string[];
  /** Serves a parking garage (garage-ONLY units sit outside chains). */
  garage: boolean;
  /** Any landing phrase the mapper could not confidently classify. */
  unknown: boolean;
  /** The raw feed text, for the excluded-stations review file. */
  raw: string;
}

export interface InferenceStation {
  stationExternalId: string;
  name: string;
  /** The agency's own accessibility declaration for the station. */
  accessibilityFull: boolean;
  units: InferenceUnit[];
}

export type ExclusionReason =
  | "unknown-landing" // a unit's text has an unclassifiable landing phrase
  | "unparseable-unit" // empty/blank text, or no classifiable landing at all
  | "multi-level-hub" // a unit connects two hubs (GCT's concourse<->mezzanine)
  | "missing-origin" // a platform-only unit — no way to know where it comes from
  | "street-leg-hub-mismatch" // a street leg serves a hub no spoke uses (topology unclear)
  | "ambiguous-platform" // an unnamed platform alongside named ones
  | "multi-hub-platform" // one platform's spokes hang off different hubs
  | "mixed-route-platform" // a platform served by both a fullPath and a spoke (needs CNF — human territory)
  | "no-street-leg-not-full" // spokes with no street leg at a station the agency doesn't call fully accessible
  | "no-chain-units"; // nothing but garage/non-chain units

export interface InferenceResult {
  models: Omit<StationModel, "systemId">[];
  /** Units deliberately left outside all chains (garage-only). Informational. */
  nonChainUnits: InferenceUnit[];
}

export interface InferenceExclusion {
  reason: ExclusionReason;
  detail: string;
}

/** Infer a station's chains, or explain exactly why it can't be done safely. */
export function inferStationChains(
  station: InferenceStation,
): { ok: true; result: InferenceResult } | { ok: false; excluded: InferenceExclusion } {
  const fail = (reason: ExclusionReason, detail: string) => ({ ok: false as const, excluded: { reason, detail } });

  for (const u of station.units) {
    if (u.unknown) return fail("unknown-landing", `${u.externalId}: "${u.raw}"`);
    if (u.hubs.length >= 2) return fail("multi-level-hub", `${u.externalId} connects hubs ${u.hubs.join(" + ")}`);
  }

  // Garage units without a platform landing sit outside chains — they serve
  // parking, not the access path (White Plains WP2 precedent), whether they
  // land at street or at a hub level (MBTA's Wonderland lobby<->garage
  // elevators). Anything else with no platform, no hub, and no street is
  // unplaceable; street-only units likewise (destination unknown).
  const nonChainUnits: InferenceUnit[] = [];
  const chainUnits: InferenceUnit[] = [];
  for (const u of station.units) {
    if (u.garage && u.platformKey === null) {
      nonChainUnits.push(u);
      continue;
    }
    const placeable = u.platformKey !== null || u.hubs.length > 0;
    if (!placeable) {
      return fail("unparseable-unit", `${u.externalId}: "${u.raw}"`);
    }
    chainUnits.push(u);
  }
  if (!chainUnits.length) return fail("no-chain-units", "only garage/non-chain units found");

  // Roles.
  const fullPath = chainUnits.filter((u) => u.street && u.platformKey !== null);
  const spokes = chainUnits.filter((u) => !u.street && u.platformKey !== null);
  const streetLegs = chainUnits.filter((u) => u.street && u.platformKey === null);
  const placelessSpoke = chainUnits.find((u) => !u.street && u.platformKey !== null && u.hubs.length === 0);
  if (placelessSpoke) return fail("missing-origin", `${placelessSpoke.externalId}: "${placelessSpoke.raw}"`);
  const hubOnly = chainUnits.find((u) => u.platformKey === null && !u.street);
  if (hubOnly) return fail("missing-origin", `${hubOnly.externalId}: "${hubOnly.raw}"`);

  // Platform identities. An unnamed platform ("") is only safe when it is the
  // station's SOLE platform identity — otherwise we can't tell whether two
  // units serve the same platform or different ones.
  const keys = [...new Set([...fullPath, ...spokes].map((u) => u.platformKey!))];
  if (keys.includes("") && keys.length > 1) {
    return fail("ambiguous-platform", `unnamed platform alongside named ones (${keys.filter(Boolean).join(", ")})`);
  }

  // Every spoke's hub must have street access: street-leg units on that hub,
  // fullPath units that also list the hub (Woodside-449 pattern), or — only
  // when the agency itself declares the station fully accessible — the hub
  // assumed grade-reachable (New Rochelle 206W pattern).
  const spokeHubs = new Set(spokes.map((u) => u.hubs[0]!));
  for (const leg of streetLegs) {
    if (!spokeHubs.has(leg.hubs[0]!)) {
      return fail(
        "street-leg-hub-mismatch",
        `${leg.externalId} serves hub "${leg.hubs[0]}" but no platform elevator uses it`,
      );
    }
  }
  const streetLegsForHub = (hub: string): InferenceUnit[] => [
    ...streetLegs.filter((u) => u.hubs[0] === hub),
    ...fullPath.filter((u) => u.hubs.includes(hub)),
  ];

  // Build one chain per platform key.
  const models: Omit<StationModel, "systemId">[] = [];
  const sortedKeys = [...keys].sort();
  for (const key of sortedKeys) {
    const keyFull = fullPath.filter((u) => u.platformKey === key);
    const keySpokes = spokes.filter((u) => u.platformKey === key);
    if (keyFull.length && keySpokes.length) {
      // A platform reachable directly (fullPath) OR via hub+spoke needs the
      // paired-segment CNF encoding — hand-model territory (Stamford), not
      // safe to generate.
      return fail("mixed-route-platform", `platform "${key}" has both direct and via-hub elevators`);
    }
    const display = (keyFull[0] ?? keySpokes[0])!.platformDisplay || "platform";
    const segments: AccessSegment[] = [];
    if (keySpokes.length) {
      const hubsForKey = [...new Set(keySpokes.map((u) => u.hubs[0]!))];
      if (hubsForKey.length > 1) {
        return fail("multi-hub-platform", `platform "${key}" is served from hubs ${hubsForKey.join(" + ")}`);
      }
      const hub = hubsForKey[0]!;
      const legs = streetLegsForHub(hub);
      if (!legs.length && !station.accessibilityFull) {
        return fail(
          "no-street-leg-not-full",
          `hub "${hub}" has no street-leg elevator and the agency doesn't declare the station fully accessible`,
        );
      }
      if (legs.length) {
        segments.push({
          id: "street",
          label: `Street/parking to ${hub}`,
          elevators: legs.map((u) => ({ externalId: u.externalId, label: u.label })),
        });
      }
      segments.push({
        id: `platform-${key || "main"}`,
        label: `${capitalize(hub)} to ${display}`,
        elevators: keySpokes.map((u) => ({ externalId: u.externalId, label: u.label })),
      });
    } else {
      segments.push({
        id: `street-platform-${key || "main"}`,
        label: `Street to ${display}`,
        elevators: keyFull.map((u) => ({ externalId: u.externalId, label: u.label })),
      });
    }
    models.push({
      stationExternalId: station.stationExternalId,
      ...(sortedKeys.length > 1 ? { chainLabel: ` (${display})` } : {}),
      segments,
      note:
        "Auto-modeled from the agency's own per-elevator location text (rail chain generator, " +
        "conservative rules). Only listed elevators count as step-free access — an unlisted ramp " +
        "or grade path would make this over-warn, never under-warn.",
    });
  }

  return { ok: true, result: { models, nonChainUnits } };
}

const capitalize = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

// --- Ground-truth semantic comparison ---------------------------------------
// The self-check contract (per the project owner, verbatim): the hand-curated
// models are ground truth — "if what you generate disagrees with what I've
// told you, then your generator is broken." Labels and segment naming may
// differ freely; what must MATCH is the semantics that reach ingest and the
// access boards:
//   1. chain count,
//   2. the exact set of chain-member elevators,
//   3. for every member elevator, HOW MANY chains its lone outage severs
//      (simulated via the same stationAccessible() production code) — which
//      also pins the derived redundancy the adapter archives (severs 0 ⇔
//      redundant).

export function compareStationSemantics(
  generated: Pick<StationModel, "segments">[],
  curated: Pick<StationModel, "segments">[],
): string[] {
  const problems: string[] = [];
  if (generated.length !== curated.length) {
    problems.push(`chain count: generated ${generated.length}, curated ${curated.length}`);
  }
  const memberIds = (models: Pick<StationModel, "segments">[]) =>
    new Set(models.flatMap((m) => allElevators(m as StationModel).map((e) => e.externalId)));
  const gen = memberIds(generated);
  const cur = memberIds(curated);
  for (const id of gen) if (!cur.has(id)) problems.push(`elevator ${id}: in generated chains but outside curated ones`);
  for (const id of cur) if (!gen.has(id)) problems.push(`elevator ${id}: in curated chains but outside generated ones`);
  if (problems.length) return problems; // membership differs — severed-count comparison would just be noise

  const severedCount = (models: Pick<StationModel, "segments">[], id: string) =>
    models.filter((m) => !stationAccessible(m as StationModel, new Set([id]))).length;
  for (const id of [...cur].sort()) {
    const g = severedCount(generated, id);
    const c = severedCount(curated, id);
    if (g !== c) problems.push(`elevator ${id}: lone outage severs ${g} generated chain(s) vs ${c} curated`);
  }
  return problems;
}
