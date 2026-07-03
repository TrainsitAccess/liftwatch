// Per-elevator, chain-aware accessibility model.
//
// A station's step-free access is a chain of SEGMENTS (street -> concourse ->
// platform). Each segment is served by one or more elevators and is "up" if any
// of its elevators works — or if a non-elevator step-free path exists (e.g. a
// ramp or a sunken parking lot that reaches the concourse without the elevator).
// The station is accessible only if EVERY segment is up.
//
// Redundancy is then derived, not hand-set: a station is single-fault tolerant
// when no single elevator outage makes it inaccessible; an individual elevator
// is redundant when its own outage alone doesn't sever access.

export interface CuratedElevator {
  externalId: string; // stable id we assign, e.g. "12TH-ST-14TH"
  label: string; // "14th St street elevator"
  matchHints?: string[]; // lowercase substrings to attribute a station-level advisory
}

export interface AccessSegment {
  id: string; // "street-concourse", "concourse-platform"
  label: string;
  elevators: CuratedElevator[];
  stepFreeAlternative?: boolean; // non-elevator step-free path exists for this leg
}

export interface StationModel {
  systemId: string;
  stationExternalId: string;
  segments: AccessSegment[];
  note?: string;
}

/** A segment is up if it has a non-elevator alternative or any working elevator. */
export function segmentUp(seg: AccessSegment, downIds: Set<string>): boolean {
  if (seg.stepFreeAlternative) return true;
  return seg.elevators.some((e) => !downIds.has(e.externalId));
}

/** Segments with no working step-free path given the currently-down elevators. */
export function downSegments(model: StationModel, downIds: Set<string>): AccessSegment[] {
  return model.segments.filter((seg) => !segmentUp(seg, downIds));
}

/** The station is step-free accessible only if every segment is up. */
export function stationAccessible(model: StationModel, downIds: Set<string>): boolean {
  return model.segments.every((seg) => segmentUp(seg, downIds));
}

export function allElevators(model: StationModel): CuratedElevator[] {
  return model.segments.flatMap((s) => s.elevators);
}

/** True when no single elevator outage can make the station inaccessible. */
export function isSingleFaultTolerant(model: StationModel): boolean {
  return allElevators(model).every((e) => stationAccessible(model, new Set([e.externalId])));
}

/** True when this elevator's own outage does not sever step-free access. */
export function elevatorRedundant(model: StationModel, externalId: string): boolean {
  return stationAccessible(model, new Set([externalId]));
}
