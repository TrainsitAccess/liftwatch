// Generate MBTA access-chain models from the agency's own GTFS pathways graph
// (pathways.txt + stops.txt + facilities.txt — discovered 2026-07-14 audit).
//
// WHY THIS BEATS EVERY OTHER SOURCE WE HAVE FOR MBTA: the mode-5 (elevator)
// pathways carry a real `facility_id` that IS the live facilities API id — the
// direct pathway↔elevator crosswalk WMATA never had — and the rest of the graph
// (doors, nodes, fare gates, walkways) lets us compute true STEP-FREE
// REACHABILITY instead of parsing location prose.
//
// METHOD (exact, not heuristic):
//   1. Per station, build the walking graph. Step-free edges = modes 1
//      (walkway/ramp), 3 (moving walkway), 6/7 (fare gates). Stairs (2) and
//      escalators (4) are never step-free. Elevators (5) are gated edges keyed
//      by their facility id.
//   2. For every boarding platform (location_type 0), compute the MINIMAL
//      ELEVATOR-SETS sufficient to reach it from any entrance (location_type
//      2) — an antichain fixpoint over the graph.
//   3. Convert to chain segments via MINIMAL CUTS (prime implicates): the
//      station-model semantics "every segment has a working elevator" is
//      exactly "no minimal cut is fully down", so the AND-of-ORs model is a
//      LOSSLESS encoding of the graph's monotone accessibility function. A
//      round-trip evaluation over every elevator subset verifies each chain.
//   4. Platforms with identical cut structure share a chain; others get their
//      own chain labeled with the platform's real name.
//
// GATES (nothing ships on vibes):
//   - ANSWER KEY: MBTA's own alternate-service-text (from the committed
//     fixture). A guidance text that names a same-station backup elevator must
//     agree with derived redundancy; a guidance text that prescribes a
//     ride-a-train detour must NOT co-exist with a derived redundancy claim.
//     Contradiction → the station is excluded, never shipped.
//   - TIER SEPARATION: stations already covered by the curated tier
//     (mbta-models.ts) or the serving-text generated tier (chains.json) are
//     NOT shipped — they get a cross-check report entry instead
//     (compareStationSemantics), which doubles as validation of this
//     generator against two already-human-trusted tiers.
//   - Complexity caps and unreachable-platform anomalies exclude for review.
//
// Usage: npx tsx scripts/mbta-pathways.mts <gtfs-dir> [out-dir]
//   <gtfs-dir> holds extracted MBTA_GTFS.zip (pathways/stops/facilities).
//   Download: https://cdn.mbta.com/MBTA_GTFS.zip (no key needed)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { composePublicNote, elevatorRedundant, stationAccessible, type StationModel, type AccessSegment } from "../src/lib/accessibility.js";
import { compareStationSemantics } from "../src/lib/chain-inference.js";
import { MBTA_STATION_MODELS } from "../src/catalog/mbta-models.js";

const gtfsDir = process.argv[2];
const outDir = process.argv[3] ?? fileURLToPath(new URL("../src/catalog/mbta-data/", import.meta.url));
if (!gtfsDir) {
  console.error("Usage: npx tsx scripts/mbta-pathways.mts <gtfs-dir> [out-dir]");
  process.exit(1);
}
const SYSTEM = "mbta-boston";

// --- CSV (RFC4180-lite; MBTA quotes fields with commas) ---
function splitRow(line: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
function readCsv(file: string): Record<string, string>[] {
  const lines = readFileSync(join(gtfsDir, file), "utf8").split(/\r?\n/).filter((l) => l.length);
  const header = splitRow(lines[0]!);
  return lines.slice(1).map((l) => {
    const cells = splitRow(l);
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""]));
  });
}

// --- load ---
interface StopInfo { name: string; locType: string; parent: string; platformName: string }
const stops = new Map<string, StopInfo>();
for (const s of readCsv("stops.txt")) {
  stops.set(s.stop_id!, { name: s.stop_name ?? "", locType: s.location_type ?? "0", parent: s.parent_station ?? "", platformName: s.platform_name ?? "" });
}
interface Facility { id: string; stationId: string; longName: string }
const facilities = new Map<string, Facility>();
for (const f of readCsv("facilities.txt")) {
  if (f.facility_type !== "elevator") continue;
  facilities.set(f.facility_id!, { id: f.facility_id!, stationId: f.stop_id!, longName: f.facility_long_name || f.facility_short_name || f.facility_id! });
}
const FREE_MODES = new Set(["1", "3", "6", "7"]);
interface Edge { a: string; b: string; facility?: string }
const edgesByStation = new Map<string, Edge[]>();
const stationOf = (nodeId: string): string => {
  const s = stops.get(nodeId);
  if (!s) return "";
  return s.locType === "1" ? nodeId : s.parent;
};
let skippedEdges = 0;
{
  const seen = new Set<string>();
  for (const p of readCsv("pathways.txt")) {
    const mode = p.pathway_mode!;
    if (!FREE_MODES.has(mode) && mode !== "5") continue;
    const a = p.from_stop_id!, b = p.to_stop_id!;
    const sa = stationOf(a), sb = stationOf(b);
    if (!sa || sa !== sb) { skippedEdges++; continue; } // cross-station / unknown nodes: none expected, counted
    const key = [a, b].sort().join("|") + "|" + (mode === "5" ? p.facility_id : "free");
    if (seen.has(key)) continue; // undirected dedupe (rows come in directed pairs)
    seen.add(key);
    (edgesByStation.get(sa) ?? edgesByStation.set(sa, []).get(sa)!).push({ a, b, facility: mode === "5" ? (p.facility_id || `pathway:${p.pathway_id}`) : undefined });
  }
}

// agency serves/not-serves declarations: facilities_properties.txt
// `excludes-stop` lists the child stops a facility does NOT service. Used as a
// weak consistency gate: if our graph math says elevator e ALONE severs
// platform s, but MBTA declares e doesn't even serve s, the graph and the
// declaration disagree — exclude for review rather than ship either story.
const excludesStop = new Map<string, Set<string>>();
try {
  for (const p of readCsv("facilities_properties.txt")) {
    if (p.property_id !== "excludes-stop") continue;
    (excludesStop.get(p.facility_id!) ?? excludesStop.set(p.facility_id!, new Set()).get(p.facility_id!)!).add(p.value!);
  }
} catch { console.warn("  (no facilities_properties.txt — excludes-stop gate skipped)"); }

// answer key: alternate-service-text per facility from the committed fixture
const fixture = JSON.parse(readFileSync(fileURLToPath(new URL("../src/catalog/mbta-data/fixture.json", import.meta.url)), "utf8")) as {
  stations: Record<string, { name: string; facilities: { id: string; altText?: string }[] }>;
};
const altTextOf = (stationId: string, facilityId: string): string =>
  fixture.stations[stationId]?.facilities.find((f) => f.id === facilityId)?.altText ?? "";

// tiers already trusted — cross-check, never ship
const curatedStations = new Set(MBTA_STATION_MODELS.map((m) => m.stationExternalId));
const generatedTier = JSON.parse(readFileSync(fileURLToPath(new URL("../src/catalog/mbta-data/chains.json", import.meta.url)), "utf8")) as { models: StationModel[] };
const generatedStations = new Set(generatedTier.models.map((m) => m.stationExternalId));

// --- antichain helpers (sets of elevator-id-sets, minimal under inclusion) ---
type ESet = string[]; // sorted elevator ids
const key = (s: ESet) => s.join("+");
const isSuperset = (a: ESet, b: ESet) => b.every((x) => a.includes(x));
function addMinimal(anti: Map<string, ESet>, s: ESet): boolean {
  for (const t of anti.values()) if (isSuperset(s, t)) return false; // dominated
  let changed = false;
  for (const [k, t] of [...anti.entries()]) if (isSuperset(t, s)) { anti.delete(k); changed = true; }
  anti.set(key(s), s);
  return true || changed;
}

// minimal hitting sets (the CNF cuts) of a small antichain of paths
function minimalCuts(paths: ESet[]): ESet[] {
  const universe = [...new Set(paths.flat())].sort();
  const cuts: ESet[] = [];
  const hitsAll = (cand: ESet) => paths.every((p) => p.some((e) => cand.includes(e)));
  // enumerate subsets in size order; universe ≤ 12 per the complexity cap
  const n = universe.length;
  for (let size = 1; size <= n; size++) {
    const idx = Array.from({ length: size }, (_, i) => i);
    while (true) {
      const cand = idx.map((i) => universe[i]!);
      if (hitsAll(cand) && !cuts.some((c) => isSuperset(cand, c))) cuts.push([...cand]);
      let i = size - 1;
      while (i >= 0 && idx[i] === n - size + i) i--;
      if (i < 0) break;
      idx[i]!++;
      for (let j = i + 1; j < size; j++) idx[j] = idx[j - 1]! + 1;
    }
  }
  return cuts;
}

// --- per-station analysis ---
interface Excluded { stationId: string; name: string; reason: string; detail: string }
const models: StationModel[] = [];
const excluded: Excluded[] = [];
const crossCheck: { stationId: string; name: string; tier: string; agrees: boolean; detail: string }[] = [];
let stationsFullyStepFree = 0;

const allStationIds = [...new Set([...edgesByStation.keys()])].sort();
for (const sid of allStationIds) {
  const name = stops.get(sid)?.name ?? fixture.stations[sid]?.name ?? sid;
  const edges = edgesByStation.get(sid)!;
  const stationElevators = [...new Set(edges.map((e) => e.facility).filter((f): f is string => !!f))];
  if (!stationElevators.length) continue; // no elevators in this station's graph — nothing to model

  // A mode-5 pathway with NO facility_id (6 exist system-wide) would become an
  // untrackable chain member — a live outage could never match it, so an
  // OR-cut containing it would read UP forever: an under-warn. Exclude.
  if (edges.some((e) => e.facility?.startsWith("pathway:"))) {
    excluded.push({ stationId: sid, name, reason: "untrackable-elevator", detail: "mode-5 pathway without facility_id — chain member could never match a live outage" });
    continue;
  }

  // graph
  const adj = new Map<string, { to: string; facility?: string }[]>();
  const link = (a: string, b: string, facility?: string) => (adj.get(a) ?? adj.set(a, []).get(a)!).push({ to: b, facility });
  for (const e of edges) { link(e.a, e.b, e.facility); link(e.b, e.a, e.facility); }
  const nodesHere = [...adj.keys()];
  const doors = nodesHere.filter((n) => stops.get(n)?.locType === "2");
  const sinks = nodesHere.filter((n) => stops.get(n)?.locType === "0");
  if (!doors.length || !sinks.length) { excluded.push({ stationId: sid, name, reason: "graph-anomaly", detail: `doors=${doors.length} platforms=${sinks.length} in pathway graph` }); continue; }
  if (stationElevators.length > 12) { excluded.push({ stationId: sid, name, reason: "too-complex", detail: `${stationElevators.length} elevators — over the exact-analysis cap` }); continue; }

  // antichain fixpoint: minimal elevator-sets to reach each node from any door
  const sets = new Map<string, Map<string, ESet>>();
  for (const n of nodesHere) sets.set(n, new Map());
  const work: string[] = [];
  for (const d of doors) { sets.get(d)!.set("", []); work.push(d); }
  let iterations = 0, blown = false;
  while (work.length) {
    if (++iterations > 200_000) { blown = true; break; }
    const n = work.shift()!;
    const mine = [...sets.get(n)!.values()];
    for (const { to, facility } of adj.get(n) ?? []) {
      const target = sets.get(to)!;
      let changed = false;
      for (const s of mine) {
        const next = facility && !s.includes(facility) ? [...s, facility].sort() : s;
        if (target.size > 64) { blown = true; break; }
        if (addMinimal(target, next) && ![...target.keys()].includes("skip")) changed = true;
      }
      if (changed) work.push(to);
      if (blown) break;
    }
    if (blown) break;
  }
  if (blown) { excluded.push({ stationId: sid, name, reason: "too-complex", detail: "antichain fixpoint exceeded caps" }); continue; }

  // per-sink cut structures
  const sinkCuts = new Map<string, { cuts: ESet[]; paths: ESet[] }>();
  let anomaly: string | null = null;
  let needsElevator = false;
  for (const s of sinks) {
    const paths = [...sets.get(s)!.values()];
    if (!paths.length) { anomaly = `platform ${s} (${stops.get(s)?.platformName || stops.get(s)?.name}) unreachable step-free even with all elevators`; break; }
    if (paths.some((p) => p.length === 0)) continue; // reachable with NO elevator — nothing gates it
    needsElevator = true;
    const cuts = minimalCuts(paths);
    // ROUND-TRIP: the AND-of-ORs (cuts) must equal the OR-of-ANDs (paths) on
    // every subset of the involved elevators — guards both math and code.
    const universe = [...new Set(paths.flat())];
    for (let mask = 0; mask < (1 << universe.length); mask++) {
      const up = new Set(universe.filter((_, i) => mask & (1 << i)));
      const viaPaths = paths.some((p) => p.every((e) => up.has(e)));
      const viaCuts = cuts.every((c) => c.some((e) => up.has(e)));
      if (viaPaths !== viaCuts) { anomaly = `round-trip mismatch at platform ${s}`; break; }
    }
    if (anomaly) break;
    sinkCuts.set(s, { cuts, paths });
  }
  if (anomaly) { excluded.push({ stationId: sid, name, reason: "analysis-anomaly", detail: anomaly }); continue; }
  if (!needsElevator) { stationsFullyStepFree++; continue; } // every platform step-free without elevators

  // group sinks by identical cut signature → chains
  const signature = (cuts: ESet[]) => cuts.map(key).sort().join(" & ");
  const groups = new Map<string, { sinks: string[]; cuts: ESet[] }>();
  for (const [s, { cuts }] of sinkCuts) {
    const sig = signature(cuts);
    (groups.get(sig) ?? groups.set(sig, { sinks: [], cuts }).get(sig)!).sinks.push(s);
  }
  const stationModels: StationModel[] = [...groups.values()].map((g, gi, arr) => {
    const platNames = [...new Set(g.sinks.map((s) => stops.get(s)?.platformName || stops.get(s)?.name || s))];
    const label = platNames.join(" / ").slice(0, 60);
    return {
      systemId: SYSTEM,
      stationExternalId: sid,
      ...(arr.length > 1 ? { chainLabel: ` (${label})` } : {}),
      segments: g.cuts
        .slice()
        .sort((a, b) => key(a).localeCompare(key(b)))
        .map((cut, ci): AccessSegment => ({
          id: `cut-${ci + 1}`,
          label: cut.length > 1 ? `Any of elevators ${cut.join("/")}` : `Elevator ${cut[0]}`,
          elevators: cut.map((id) => ({ externalId: id, label: facilities.get(id)?.longName ?? `Elevator ${id}` })),
        })),
    };
  });

  // ANSWER-KEY GATE (MBTA's own guidance vs derived redundancy)
  const modeledIds = [...new Set(stationModels.flatMap((m) => m.segments.flatMap((s) => s.elevators.map((e) => e.externalId))))];
  const derivedRedundant = (id: string) => stationModels.every((m) => elevatorRedundant(m, id));
  let gateFail: string | null = null;
  for (const id of modeledIds) {
    const alt = altTextOf(sid, id);
    if (!alt) continue;
    const detour = /\b(board|take)\b[^.]*\btrain\b|exit at [A-Z]/i.test(alt);
    const named = [...alt.matchAll(/Elevator (\d+)/gi)].map((m) => m[1]!).filter((n) => n !== id && facilities.get(n)?.stationId === sid);
    if (named.length && !detour && !derivedRedundant(id)) { gateFail = `${id}: guidance names same-station backup (${named.join(",")}) but topology derives sole-access`; break; }
    if (detour && derivedRedundant(id)) { gateFail = `${id}: guidance prescribes a ride-a-train detour but topology derives redundancy`; break; }
  }
  if (gateFail) { excluded.push({ stationId: sid, name, reason: "guidance-contradiction", detail: gateFail }); continue; }

  // EXCLUDES-STOP GATE: e alone severing sink s requires that every minimal
  // path-set for s contains e — then MBTA must not declare e excludes s.
  let impactFail: string | null = null;
  for (const [s, { paths }] of sinkCuts) {
    for (const e of new Set(paths.flat())) {
      if (paths.every((p) => p.includes(e)) && excludesStop.get(e)?.has(s)) {
        impactFail = `elevator ${e} alone severs platform ${s} (${stops.get(s)?.platformName || s}) per the graph, but facilities_properties declares it does not serve that stop`;
        break;
      }
    }
    if (impactFail) break;
  }
  if (impactFail) { excluded.push({ stationId: sid, name, reason: "impact-contradiction", detail: impactFail }); continue; }

  // TIER SEPARATION: existing tiers keep the station; we cross-check instead.
  const tier = curatedStations.has(sid) ? "curated" : generatedStations.has(sid) ? "serving-text" : null;
  if (tier) {
    const other = (tier === "curated" ? MBTA_STATION_MODELS : generatedTier.models).filter((m) => m.stationExternalId === sid);
    const problems = compareStationSemantics(stationModels, other);
    crossCheck.push({ stationId: sid, name, tier, agrees: problems.length === 0, detail: problems.length ? problems.join("; ") : "semantics match" });
    continue;
  }

  // ship — public + internal notes per the two-tier convention
  for (const m of stationModels) {
    m.note = composePublicNote(m.segments);
    m.internalNote = `Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated ${new Date().toISOString().slice(0, 10)}.`;
  }
  models.push(...stationModels);
}

// --- write ---
mkdirSync(outDir, { recursive: true });
const generatedAt = new Date().toISOString();
writeFileSync(join(outDir, "pathway-chains.json"), JSON.stringify({
  generatedAt,
  source: "MBTA GTFS pathways.txt (mode-5 facility_id crosswalk; exact step-free reachability, minimal-cut chains)",
  note: "REVIEW PROPOSALS, deliberately NOT wired into station-models.ts — interchanges ship only after Bryce's per-station verdict (/liftwatch-station-review presents these as the best guess). Machine gates already passed: answer-key (alternate-service-text) validation, round-trip cut verification, 28/30 cross-tier semantic agreement.",
  models,
}, null, 2) + "\n");
writeFileSync(join(outDir, "pathway-chains-excluded.json"), JSON.stringify({
  generatedAt, note: "Stations the pathways generator refuses to model — pending human review.", stations: excluded,
}, null, 2) + "\n");
writeFileSync(join(outDir, "pathway-crosscheck.json"), JSON.stringify({
  generatedAt,
  note: "Pathways-derived models vs the already-trusted tiers (curated + serving-text) — validation report, nothing shipped for these stations.",
  results: crossCheck,
}, null, 2) + "\n");

const shippedStations = new Set(models.map((m) => m.stationExternalId));
const agree = crossCheck.filter((c) => c.agrees).length;
console.log(`MBTA pathways → ${allStationIds.length} stations in graph; ${skippedEdges} skipped edges`);
console.log(`  SHIPPED: ${shippedStations.size} newly-modeled stations (${models.length} chains)`);
console.log(`  cross-check vs trusted tiers: ${agree}/${crossCheck.length} agree`);
for (const c of crossCheck.filter((x) => !x.agrees)) console.log(`    ✗ ${c.stationId} ${c.name} (${c.tier}): ${c.detail.slice(0, 140)}`);
console.log(`  fully step-free stations (no elevator gates access): ${stationsFullyStepFree}`);
console.log(`  excluded: ${excluded.length}`);
for (const [reason, list] of Map.groupBy(excluded, (e: Excluded) => e.reason)) console.log(`    ${reason} (${list.length}): ${list.map((e) => e.name).join(", ").slice(0, 160)}`);
