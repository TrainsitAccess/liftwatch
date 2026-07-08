// Build TfL's multi-chain station access models from the bundled lift topology
// snapshot (src/catalog/tfl-data/lifts.json, built by tfl-import.mjs).
//
// Unlike MTA, TfL's data has no "lines served" field — only FromAreas/ToAreas
// area-code strings. But those codes ARE a real graph: treat each area code as
// a node and each lift as an edge between its from/to node(s). Lifts sharing
// the EXACT SAME (FromAreas, ToAreas) tuple are already known-redundant
// parallel edges (tfl-import.mjs's own isRedundant computation, unchanged by
// this script). Grouping lifts into CONNECTED COMPONENTS (via shared area-code
// nodes) mechanically reveals when one station actually has multiple
// INDEPENDENT access routes (e.g. Willesden Junction: the Bakerloo-platform
// lift and the National Rail high-level-platform lift share zero area codes —
// two disjoint one-edge components, not one station-wide chain).
//
// SAFETY: this is purely additive to the SITE DISPLAY layer (build-data.ts's
// station-access / blackout / streak / SPOF boards via station-models.ts). It
// does NOT touch the TfL adapter or ingest — per-unit is_redundant/
// redundancy_source in the archive stay exactly as tfl-import.mjs already
// computes them ("pathways" source), unchanged. See CLAUDE.md/SPEC.md for why
// that split matters (curated station-model data only reaches ingest when an
// ADAPTER explicitly consults it — TfL's doesn't).
//
// CONSERVATIVE BY DESIGN: only components whose topology is UNAMBIGUOUS get
// modeled — a single edge (trivial), a single redundant parallel group, or a
// clean path with exactly two degree-1 endpoints and no multi-destination
// (pipe-separated) edge once 2+ distinct edges are involved. Anything else
// (a branching hub node, an ambiguous path, a multi-destination edge in a
// multi-edge component) is EXCLUDED and logged to chains-excluded.json for a
// human review pass — mirroring MTA's 9 hand-authored interchange overrides.
// No line names are guessed anywhere (TfL's area-code abbreviations are
// genuinely ambiguous — e.g. "NTH" could mean "Northern line" or "North
// Ticket Hall" — a wrong guess would be a bad-facing accessibility claim).
// Multi-route stations get a neutral " (Route N)" label instead.
//
// SELF-CHECK: every generated chain's derived per-elevator redundancy
// (removing just that one elevator — does the chain stay accessible?) must
// exactly equal that elevator's own tfl-import.mjs isRedundant flag. Since
// every excluded (ambiguous) component is skipped entirely, no elevator here
// spans more than one chain, so this is a direct 1:1 check (simpler than
// MTA's aggregate-across-chains self-check).
//
// Usage: node scripts/tfl-chains.mjs   (re-run after re-importing TfL topology
// via tfl-import.mjs to pick up any changes)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(ROOT, "src", "catalog", "tfl-data");
const SYSTEM_ID = "tfl-london";

const lifts = JSON.parse(readFileSync(join(DATA_DIR, "lifts.json"), "utf8"));
const stations = JSON.parse(readFileSync(join(DATA_DIR, "stations.json"), "utf8"));
const nameById = new Map(stations.map((s) => [s.id, s.name]));
const liftById = new Map(lifts.map((l) => [l.id, l]));

const groupIdOf = (area) => area.split("|")[0].split("-")[1];
const areasOf = (field) => field.split("|");
const tupleKey = (l) => `${l.fromAreas}=>${l.toAreas}`;

// --- Group lifts by (station, leading numeric area-group id) ---
// The numeric segment right after the station id in FromAreas (e.g. "1001276"
// vs "1000129" at King's Cross St Pancras) reliably separates physically
// distinct sub-complexes under one Hub code — verified across the dataset:
// only 7/201 lift-equipped stations have more than one such group, and they
// are exactly the known major interchanges (Canary Wharf, Paddington, King's
// Cross, Cannon Street, Heathrow T2&3, Vauxhall, Woolwich Arsenal).
const byGroup = new Map();
for (const l of lifts) {
  const key = `${l.stationId}::${groupIdOf(l.fromAreas)}`;
  (byGroup.get(key) ?? byGroup.set(key, []).get(key)).push(l);
}

// --- Connected components within a group, via shared area-code nodes ---
function connectedComponents(els) {
  const parent = els.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a, b) => {
    a = find(a);
    b = find(b);
    if (a !== b) parent[a] = b;
  };
  const nodeOwner = new Map();
  els.forEach((l, i) => {
    for (const n of [...areasOf(l.fromAreas), ...areasOf(l.toAreas)]) {
      if (nodeOwner.has(n)) union(i, nodeOwner.get(n));
      else nodeOwner.set(n, i);
    }
  });
  const comps = new Map();
  els.forEach((l, i) => {
    const r = find(i);
    (comps.get(r) ?? comps.set(r, []).get(r)).push(l);
  });
  return [...comps.values()];
}

// --- Classify + order one component's edges into a chain, or exclude it ---
function analyzeComponent(comp) {
  // Dedupe by exact tuple -> logical edges (parallel lifts on the identical
  // route are ONE edge — matches tfl-import.mjs's own redundancy grouping).
  const edgesByTuple = new Map();
  for (const l of comp) {
    const k = tupleKey(l);
    (edgesByTuple.get(k) ?? edgesByTuple.set(k, []).get(k)).push(l);
  }
  const edges = [...edgesByTuple.entries()].map(([k, group]) => {
    const [from, to] = k.split("=>");
    return { from, to, lifts: group };
  });

  // A single logical edge (however many parallel lifts share it, however
  // many pipe-separated destinations it has) needs no ordering — always safe.
  if (edges.length === 1) {
    return { excluded: false, segments: [edges[0].lifts.map((l) => l.id)] };
  }

  // Beyond one edge, a multi-destination (pipe) edge makes degree-counting
  // and path-ordering ambiguous — exclude conservatively rather than guess.
  if (comp.some((l) => l.fromAreas.includes("|") || l.toAreas.includes("|"))) {
    return { excluded: true, reason: "multi-destination edge in a multi-edge component" };
  }

  const nodeDeg = new Map();
  for (const e of edges) {
    nodeDeg.set(e.from, (nodeDeg.get(e.from) ?? 0) + 1);
    nodeDeg.set(e.to, (nodeDeg.get(e.to) ?? 0) + 1);
  }
  const maxDeg = Math.max(...nodeDeg.values());
  if (maxDeg > 2) return { excluded: true, reason: `branching hub node (maxDeg=${maxDeg})` };

  const endpoints = [...nodeDeg.entries()].filter(([, d]) => d === 1).map(([n]) => n);
  if (endpoints.length !== 2) return { excluded: true, reason: "no clean path endpoints (possible cycle)" };

  const adj = new Map();
  for (const e of edges) {
    (adj.get(e.from) ?? adj.set(e.from, []).get(e.from)).push(e);
    (adj.get(e.to) ?? adj.set(e.to, []).get(e.to)).push(e);
  }
  const ordered = [];
  const usedEdges = new Set();
  let cur = endpoints[0];
  while (usedEdges.size < edges.length) {
    const candidates = (adj.get(cur) ?? []).filter((e) => !usedEdges.has(e));
    if (candidates.length !== 1) return { excluded: true, reason: "path traversal ambiguous" };
    const e = candidates[0];
    usedEdges.add(e);
    ordered.push(e);
    cur = e.from === cur ? e.to : e.from;
  }
  return { excluded: false, segments: ordered.map((e) => e.lifts.map((l) => l.id)) };
}

// --- Assemble per-station models ---
const excludedLog = [];
const perStationSafeComponents = new Map(); // stationId -> [ [ [liftIds...], ... ] ]

for (const [key, els] of byGroup) {
  const [sid] = key.split("::");
  for (const comp of connectedComponents(els)) {
    const result = analyzeComponent(comp);
    if (result.excluded) {
      excludedLog.push({
        station: nameById.get(sid) ?? sid,
        stationId: sid,
        lifts: comp.map((l) => l.id),
        reason: result.reason,
      });
      continue;
    }
    const list = perStationSafeComponents.get(sid) ?? [];
    list.push(result.segments);
    perStationSafeComponents.set(sid, list);
  }
}

const excludedStationIds = new Set(excludedLog.map((e) => e.stationId));

const models = [];
for (const [sid, comps] of perStationSafeComponents) {
  // Deterministic ordering across a station's independent routes.
  comps.sort((a, b) => a[0][0].localeCompare(b[0][0]));
  // A station also needs a distinguishing label when it has excluded (unmodeled)
  // lifts sitting alongside a safe chain — otherwise the safe chain would show
  // under the bare station name, indistinguishable from a fallback row about one
  // of the unmodeled lifts (found by testing: Bank's Lift-8/Lift-9 form a clean
  // 2-lift chain while its other 8 lifts are excluded as too ambiguous; without
  // this, "Bank" could appear twice on the access board for unrelated reasons).
  const multi = comps.length > 1 || excludedStationIds.has(sid);
  comps.forEach((segLiftIdGroups, idx) => {
    models.push({
      systemId: SYSTEM_ID,
      stationExternalId: sid,
      ...(multi ? { chainLabel: ` (Route ${idx + 1})` } : {}),
      segments: segLiftIdGroups.map((liftIds, segIdx) => ({
        id: `seg-${segIdx + 1}`,
        label: `Leg ${segIdx + 1}`,
        elevators: liftIds.map((id) => ({ externalId: id, label: liftById.get(id)?.friendlyName ?? id })),
      })),
    });
  });
}

// ---- SELF-CHECK ----
// (mirrors src/lib/accessibility.ts's segmentUp/stationAccessible exactly)
const segmentUp = (seg, down) => seg.elevators.some((e) => !down.has(e.externalId));
const chainAccessible = (model, down) => model.segments.every((s) => segmentUp(s, down));

const warnings = [];
for (const m of models) {
  for (const seg of m.segments) {
    for (const el of seg.elevators) {
      const derived = chainAccessible(m, new Set([el.externalId]));
      const actual = liftById.get(el.externalId)?.isRedundant;
      if (actual === undefined) {
        warnings.push(`UNKNOWN-ID  ${m.stationExternalId}${m.chainLabel ?? ""} ${el.externalId}: not in lifts.json`);
        continue;
      }
      if (derived !== actual) {
        warnings.push(
          `REDUNDANCY  ${m.stationExternalId}${m.chainLabel ?? ""} ${el.externalId}: derived redundant=${derived} but catalog isRedundant=${actual}`,
        );
      }
    }
  }
}

const totalComponents = [...perStationSafeComponents.values()].reduce((n, c) => n + c.length, 0) + excludedLog.length;
console.log(
  `Generated ${models.length} chain-model(s) across ${perStationSafeComponents.size} station(s) ` +
    `(${totalComponents} total access components examined, ${excludedLog.length} excluded pending human review).`,
);
if (warnings.length) {
  console.error(`\nSELF-CHECK FAILED — ${warnings.length} warning(s):`);
  for (const w of warnings.slice(0, 50)) console.error("  " + w);
  process.exitCode = 1;
} else {
  console.log("SELF-CHECK PASSED — every generated chain's derived redundancy matches lifts.json's own isRedundant flag.");
}

mkdirSync(DATA_DIR, { recursive: true });
writeFileSync(
  join(DATA_DIR, "chains.json"),
  JSON.stringify(
    {
      note:
        "Generated by scripts/tfl-chains.mjs from src/catalog/tfl-data/lifts.json topology. " +
        "Do not edit by hand — re-run the script after re-importing TfL topology (tfl-import.mjs). " +
        "Covers only stations whose lift topology forms an unambiguous single path or set of disjoint " +
        "paths (no branching hub, no multi-destination edge across a multi-edge route). See " +
        "chains-excluded.json for stations needing a human review pass before modeling — same " +
        "precedent as MTA's 9 hand-authored interchange overrides in scripts/mta-chains.mjs.",
      models,
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  join(DATA_DIR, "chains-excluded.json"),
  JSON.stringify(
    {
      note:
        "Stations/access-components whose lift topology is too ambiguous to auto-model safely: a " +
        "branching hub node (3+ distinct routes through one shared area), a multi-destination lift " +
        "within a multi-lift route, or an unclear traversal. Needs a human station-by-station review " +
        "(walking each through with a person who knows the station, per this project's established " +
        "practice for MTA's tangled interchanges) before adding to chains.json.",
      excludedStationCount: new Set(excludedLog.map((e) => e.stationId)).size,
      excluded: excludedLog,
    },
    null,
    2,
  ) + "\n",
);
console.log(`\nWrote src/catalog/tfl-data/chains.json (${models.length} models) and chains-excluded.json (${excludedLog.length} entries).`);
