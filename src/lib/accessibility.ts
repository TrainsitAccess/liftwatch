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
  // A physical station can have multiple INDEPENDENT access chains — e.g. a
  // subway interchange where different elevators gate different lines, and
  // one line's status tells you nothing about the other's (161 St-Yankee
  // Stadium: the 4 and the B/D each depend on their own, non-redundant
  // elevators). Give each chain its own StationModel sharing the same
  // stationExternalId, with a distinct chainLabel appended to the display
  // name (e.g. " (4)", " (B/D)") — see stationModelsFor. Omit for the common
  // case of one unified chain per station (every current BART model).
  chainLabel?: string;
  // Some physical stations are fragmented across MULTIPLE feed-level ids (e.g.
  // MTA reports 34 St-Penn as complex "164" for the 8th Av lines and "318" for
  // the 7th Av lines, though a step-free concourse joins them; the Fulton St /
  // Oculus megacomplex spans "628" and "624"). When several such ids are one
  // real station, the model lives under a single canonical stationExternalId
  // and lists every id it subsumes here so downstream (build-data, poll) counts
  // each covered id exactly once instead of double-counting a flat fallback.
  // Defaults to [stationExternalId] when omitted. System-agnostic.
  coveredStationExternalIds?: string[];
  segments: AccessSegment[];
  note?: string;
}

/** Every feed station id this model accounts for (canonical + any merged-in). */
export function coveredStationIds(model: StationModel): string[] {
  return model.coveredStationExternalIds ?? [model.stationExternalId];
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

export function findElevator(model: StationModel, externalId: string): CuratedElevator | undefined {
  return allElevators(model).find((e) => e.externalId === externalId);
}

export interface Attribution {
  // null => the segment is identified but the specific elevator is ambiguous.
  // Never guess a specific elevator: a wrong guess corrupts per-elevator stats
  // (chronic-offender boards would blame the wrong unit).
  elevatorExternalId: string | null;
  segmentId: string;
}

// Best-effort attribution of a station-level advisory via matchHints. Matches
// only when exactly ONE segment is implicated (otherwise the text is ambiguous).
// Within that segment: a unique hit names the elevator; multiple hits identify
// only the segment. null => too vague entirely; caller falls back conservatively.
export function attributeOutage(description: string, model: StationModel): Attribution | null {
  const d = description.toLowerCase();
  const matched = model.segments
    .map((seg) => ({ seg, hits: seg.elevators.filter((e) => (e.matchHints ?? []).some((h) => d.includes(h))) }))
    .filter((x) => x.hits.length > 0);
  if (matched.length !== 1) return null;
  const { seg, hits } = matched[0]!;
  return { elevatorExternalId: hits.length === 1 ? hits[0]!.externalId : null, segmentId: seg.id };
}

export interface ChainAttribution extends Attribution {
  model: StationModel; // which independent chain matched — the caller needs
  // this because a station-level advisory doesn't say which chain it means,
  // only attributeOutageAcrossChains's own hint-matching determines it.
}

// A physical station can have multiple INDEPENDENT chains (see
// StationModel.chainLabel) — a station-level advisory doesn't say which one
// it means, so this tries attributeOutage against EVERY chain and only
// returns a result when EXACTLY ONE chain's hints matched at all. Two chains
// both matching is exactly as ambiguous as two elevators within one chain
// matching — never guess which chain, same never-guess rule as
// attributeOutage itself. Only meaningful when a station's chains have
// genuinely disjoint matchHints (verified for BART's per-direction stations —
// each chain's hints are that direction's own destination names, never
// shared with the opposite direction at the same station); if a future
// system's chains share hint vocabulary, this correctly degrades to null
// (ambiguous) rather than guessing.
export function attributeOutageAcrossChains(description: string, models: StationModel[]): ChainAttribution | null {
  const matched = models
    .map((model) => ({ model, attr: attributeOutage(description, model) }))
    .filter((x): x is { model: StationModel; attr: Attribution } => x.attr !== null);
  if (matched.length !== 1) return null;
  return { model: matched[0]!.model, ...matched[0]!.attr };
}

// BART policy (Bryce, 2026-07-12): when an advisory is "simply the station
// elevator" — no direction or segment text that any matchHint catches, so
// attributeOutageAcrossChains returned null — it means the PLATFORM elevator by
// default. The platform is the terminus of the access chain, so the elevator in
// each chain's LAST segment (models are authored street → … → platform) is the
// platform elevator. This fires ONLY when the whole station resolves to exactly
// ONE such elevator: a per-direction station has several platform elevators, so
// "the platform elevator" is ambiguous and this returns null, preserving the
// never-guess rule (the caller then falls back to the conservative unspecified
// unit). "Unless I say otherwise" = a station whose real meaning differs gets a
// matchHint that resolves it specifically before this default is ever reached.
export function platformDefaultElevator(models: StationModel[]): Attribution | null {
  const terminals = models.map((m) => m.segments[m.segments.length - 1]).filter((s): s is AccessSegment => !!s);
  const byId = new Map(terminals.flatMap((s) => s.elevators.map((e) => [e.externalId, { segmentId: s.id, e }] as const)));
  if (byId.size !== 1) return null;
  const only = [...byId.values()][0]!;
  return { elevatorExternalId: only.e.externalId, segmentId: only.segmentId };
}

export type AccessState = "accessible" | "inaccessible" | "at_risk";

// Conservative: an outage we couldn't attribute (a down id not in the model)
// yields "at_risk" — never a confident "accessible".
export function stationAccessibilityState(model: StationModel, downIds: Set<string>): AccessState {
  const modelIds = new Set(allElevators(model).map((e) => e.externalId));
  if ([...downIds].some((id) => !modelIds.has(id))) return "at_risk";
  return stationAccessible(model, downIds) ? "accessible" : "inaccessible";
}

// --- Time-series accessibility: how long has a chain actually been down? ---
//
// The functions above answer a POINT-IN-TIME question ("is it accessible
// right now, given this set of down ids"). Ranking a chain by total time
// inaccessible (or its current streak) needs the same "every segment up"
// logic applied across its whole outage HISTORY, not just one instant.
//
// segmentUp says a segment is up if ANY of its elevators works — so a
// segment is DOWN only during the intersection of all its elevators' own
// downtime (they're redundant to each other). A chain is down whenever ANY
// segment is down — the union across segments. For the common case of one
// elevator per segment (every current MTA model), intersection of a single
// list is just that list, so this reduces to exactly what you'd expect.

export interface Interval {
  start: number; // epoch ms
  end: number; // epoch ms
}

/** Sorts and merges overlapping/adjacent intervals into disjoint ones. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const iv of sorted) {
    const last = merged[merged.length - 1];
    if (last && iv.start <= last.end) {
      last.end = Math.max(last.end, iv.end);
    } else {
      merged.push({ ...iv });
    }
  }
  return merged;
}

function intersectPair(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const start = Math.max(a[i]!.start, b[j]!.start);
    const end = Math.min(a[i]!.end, b[j]!.end);
    if (start < end) out.push({ start, end });
    if (a[i]!.end < b[j]!.end) i++;
    else j++;
  }
  return out;
}

/** Every interval-list must overlap for a moment to appear in the result. */
export function intersectAll(lists: Interval[][]): Interval[] {
  if (lists.length === 0) return [];
  let result = lists[0]!;
  for (let i = 1; i < lists.length; i++) {
    result = intersectPair(result, lists[i]!);
    if (result.length === 0) return [];
  }
  return result;
}

export function totalDurationMs(intervals: Interval[]): number {
  return intervals.reduce((sum, iv) => sum + (iv.end - iv.start), 0);
}

/**
 * The chain's down-intervals over its whole history: down whenever any
 * segment is down, where a segment is down only when ALL its elevators are
 * simultaneously down (a stepFreeAlternative segment is never down at all).
 * `downIntervalsByElevator` supplies each elevator's own (already-merged)
 * down-intervals, keyed by externalId; an elevator with no entry is treated
 * as never down (e.g. it's outside this feed's data).
 */
export function chainDownIntervals(
  model: StationModel,
  downIntervalsByElevator: Map<string, Interval[]>,
): Interval[] {
  const perSegment = model.segments.map((seg) => {
    if (seg.stepFreeAlternative) return [] as Interval[];
    const lists = seg.elevators.map((e) => downIntervalsByElevator.get(e.externalId) ?? []);
    return intersectAll(lists);
  });
  return mergeIntervals(perSegment.flat());
}

/** Display name for a chain: the station name plus its chainLabel, if any. */
export function chainDisplayName(stationName: string, model: StationModel): string {
  return model.chainLabel ? `${stationName}${model.chainLabel}` : stationName;
}
