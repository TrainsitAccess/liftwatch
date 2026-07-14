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
// Runs via tsx (see package.json) so the canonical public-note composer is
// shared with every other generator instead of forked per script.
import { composePublicNote } from "../src/lib/accessibility.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(ROOT, "src", "catalog", "tfl-data");
const SYSTEM_ID = "tfl-london";

const lifts = JSON.parse(readFileSync(join(DATA_DIR, "lifts.json"), "utf8"));
const stations = JSON.parse(readFileSync(join(DATA_DIR, "stations.json"), "utf8"));
const nameById = new Map(stations.map((s) => [s.id, s.name]));
const liftById = new Map(lifts.map((l) => [l.id, l]));

const groupIdOf = (area) => area.split("|")[0].split("-")[1];
const areasOf = (field) => field.split("|");

// ---- Permanent step-free connections (RampRoutes + SameLevelPaths) ----
// TfL's own published non-lift topology (step-free-paths.json, built by
// tfl-import.mjs from the same detailed export as Lifts.csv). Two areas
// joined by a ramp or a same-level path are mutually reachable WITHOUT a
// lift, so for access-chain purposes they are ONE place: we CONTRACT them
// into a single canonical node. Consequences, both strictly bypass-adding
// (they can only reduce false "no access" claims, never invent a lift):
//   - a lift whose endpoints contract together is PARALLELED by a permanent
//     step-free path → its leg gets stepFreeAlternative;
//   - two lifts whose routes become identical after contraction are true
//     parallels → one redundant logical edge;
//   - a branching hub can collapse into a clean path → the station's chain
//     becomes safely derivable where it was excluded before.
// Contraction is applied ONLY within one station+area-group (an edge whose
// endpoints live in different groups is skipped and counted — merging
// sub-complexes is interchange-tier work for the human pass, not this
// script). Missing file → no contraction (warn), identical to the old
// behavior.
let stepFreePaths = { ramps: [], sameLevel: [] };
try {
  stepFreePaths = JSON.parse(readFileSync(join(DATA_DIR, "step-free-paths.json"), "utf8"));
} catch {
  console.warn("WARN: no step-free-paths.json — ramp/same-level contraction skipped (re-run tfl-import.mjs)");
}
const ufParent = new Map();
const ufFind = (n) => {
  let r = n;
  while (ufParent.get(r) !== undefined && ufParent.get(r) !== r) r = ufParent.get(r);
  if (r !== n) ufParent.set(n, r);
  return r;
};
const sgOf = (node) => node.split("-").slice(0, 2).join("-"); // station-group prefix
let pathUnions = 0;
let crossGroupSkipped = 0;
for (const [a, b] of [...stepFreePaths.ramps, ...stepFreePaths.sameLevel]) {
  if (sgOf(a) !== sgOf(b)) { crossGroupSkipped++; continue; }
  const ra = ufFind(ufParent.has(a) ? a : (ufParent.set(a, a), a));
  const rb = ufFind(ufParent.has(b) ? b : (ufParent.set(b, b), b));
  if (ra !== rb) {
    // deterministic representative: the lexicographically smaller root
    if (ra < rb) ufParent.set(rb, ra);
    else ufParent.set(ra, rb);
    pathUnions++;
  }
}
const canon = (node) => (ufParent.has(node) ? ufFind(node) : node);

// STREET ANCHORS: every station in the paths data has an explicit
// "<station>-Outside" node (312/312 — a literal marker, not a decoded
// abbreviation). Outside edges are deliberately NOT contracted (contracting
// through Outside would bridge a station's separate sub-complexes — that
// merge is interchange-tier work for the human pass), but a node directly
// path-connected to Outside marks its contracted group as STREET-CONNECTED.
// A chain that passes THROUGH a street-connected node is really two
// independent street→platform routes meeting at the street — splitting there
// (see analyzeComponent) keeps per-route status accurate instead of chaining
// unrelated lifts in series (found live: Willesden Junction's Bakerloo and
// high-level lifts share a step-free street concourse; as one series chain
// the station would read fully severed when either side's lift is down).
const outsideAdjacent = new Set();
for (const [a, b] of [...stepFreePaths.ramps, ...stepFreePaths.sameLevel]) {
  if (/-Outside$/i.test(a)) outsideAdjacent.add(b);
  if (/-Outside$/i.test(b)) outsideAdjacent.add(a);
}
const isStreetNode = (canonNode) => streetRoots.has(canonNode);
let streetRoots = new Set(); // filled after contraction, once canon is stable
const canonList = (field) => [...new Set(areasOf(field).map(canon))].sort().join("|");
// Precompute canonical endpoints per lift; a canonical intermediate landing
// that contracts into an endpoint is no longer a distinct third stop.
for (const l of lifts) {
  l._fromC = canonList(l.fromAreas);
  l._toC = canonList(l.toAreas);
  const ends = new Set([...l._fromC.split("|"), ...l._toC.split("|")]);
  l._interC = [
    ...(l.intermediateAreas ? areasOf(l.intermediateAreas) : []),
    ...(l.intermediateAreas2 ? areasOf(l.intermediateAreas2) : []),
  ].map(canon).filter((n) => !ends.has(n));
  l._bypassed = l._fromC === l._toC; // endpoints step-free-connected without the lift
}
streetRoots = new Set([...outsideAdjacent].map(canon));
if (pathUnions) {
  console.log(`Step-free paths: ${pathUnions} node contraction(s) applied (${crossGroupSkipped} cross-group/Outside edge(s) not contracted); ${lifts.filter((l) => l._bypassed).length} lift(s) fully paralleled by a permanent step-free path; ${streetRoots.size} street-connected node group(s).`);
}

const tupleKey = (l) => `${l._fromC}=>${l._toC}`;
// A multi-level lift ALSO stops at an intermediate landing (Lifts.csv models
// it as one row, per SPEC.md) — that landing is a real physical node other
// lifts can share, so it must count for CONNECTIVITY (which lifts merge into
// one access component) even though tfl-import.mjs's own redundancy grouping
// (and this script's tupleKey, kept identical on purpose — see analyzeComponent)
// ignores it. Missed this in the first pass: King's Cross's Lift-A touches
// "Mezz" as an intermediate stop; Lift-B starts FROM "Mezz" — without this,
// Lift-B looked like an isolated, safe, sole-access chain when it's actually
// part of the same branching complex as Lift-A/C/D (all found via a live
// TfL alert covering Lift-A and Lift-B together, which shouldn't happen for
// two truly-independent routes — the discrepancy is what surfaced the bug).
const allNodesOf = (l) => [
  ...l._fromC.split("|"),
  ...l._interC,
  ...l._toC.split("|"),
];

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
    for (const n of allNodesOf(l)) {
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
  // Lifts fully paralleled by a permanent step-free path (endpoints
  // contracted together) don't gate anything — set them aside; they rejoin
  // the model as always-up stepFreeAlternative segments.
  const bypassed = comp.filter((l) => l._bypassed);
  const active = comp.filter((l) => !l._bypassed);
  const bypassGroups = bypassed.length
    ? [...Map.groupBy(bypassed, (l) => l._fromC).values()].map((g) => ({ node: g[0]._fromC, ids: g.map((l) => l.id) }))
    : [];
  // Distribute bypass groups onto the sub-chain whose nodes contain them;
  // anything unmatched becomes its own always-accessible route.
  const withBypass = (chains) => {
    const out = chains.map((c) => ({ ...c, bypassed: [] }));
    for (const g of bypassGroups) {
      const host = out.find((c) => c.nodes?.has(g.node));
      if (host) host.bypassed.push(g.ids);
      else out.push({ segments: [], bypassed: [g.ids] });
    }
    return { excluded: false, chains: out };
  };
  if (!active.length) {
    return withBypass([]);
  }

  // Dedupe by CANONICAL tuple -> logical edges (parallel lifts on the same
  // step-free-equivalent route are ONE edge; matches tfl-import.mjs's own
  // grouping for uncontracted routes).
  const edgesByTuple = new Map();
  for (const l of active) {
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
    return withBypass([{
      segments: [edges[0].lifts.map((l) => l.id)],
      nodes: new Set([...edges[0].from.split("|"), ...edges[0].to.split("|")]),
    }]);
  }

  // Beyond one edge, a multi-destination (pipe) edge makes degree-counting
  // and path-ordering ambiguous — exclude conservatively rather than guess.
  // (Judged on CANONICAL endpoints — a pipe list that contracts to one node
  // is no longer multi-destination.)
  if (active.some((l) => l._fromC.includes("|") || l._toC.includes("|"))) {
    return { excluded: true, reason: "multi-destination edge in a multi-edge component" };
  }
  // Same for a multi-level lift's intermediate landing: the simple 2-node
  // edge model (this script's path-ordering, and its endpoint/degree checks)
  // has no way to route THROUGH a 3rd stop, so exclude rather than guess at
  // an ordering. (A single-edge component's own intermediate stop is fine —
  // there's nothing to order relative to; only matters once there's 2+ edges.
  // A landing that CONTRACTS into an endpoint no longer counts.)
  if (active.some((l) => l._interC.length)) {
    return { excluded: true, reason: "multi-level lift (intermediate landing) in a multi-edge component" };
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
  const nodeSeq = [cur];
  while (usedEdges.size < edges.length) {
    const candidates = (adj.get(cur) ?? []).filter((e) => !usedEdges.has(e));
    if (candidates.length !== 1) return { excluded: true, reason: "path traversal ambiguous" };
    const e = candidates[0];
    usedEdges.add(e);
    ordered.push(e);
    cur = e.from === cur ? e.to : e.from;
    nodeSeq.push(cur);
  }
  // SPLIT at interior street-connected nodes: two legs meeting at the street
  // are independent street→platform routes, not a series chain (a rider never
  // needs both lifts for one trip — see the Willesden note above).
  const chains = [];
  let seg = [ordered[0]];
  let nodes = new Set([nodeSeq[0].split("|"), nodeSeq[1].split("|")].flat());
  for (let i = 1; i < ordered.length; i++) {
    const joint = nodeSeq[i]; // node between ordered[i-1] and ordered[i]
    if (isStreetNode(joint)) {
      chains.push({ segments: seg.map((e) => e.lifts.map((l) => l.id)), nodes });
      seg = [];
      nodes = new Set(joint.split("|"));
    }
    seg.push(ordered[i]);
    for (const n of nodeSeq[i + 1].split("|")) nodes.add(n);
    for (const n of joint.split("|")) nodes.add(n);
  }
  chains.push({ segments: seg.map((e) => e.lifts.map((l) => l.id)), nodes });
  return withBypass(chains);
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
    for (const chain of result.chains) {
      if (!chain.segments.length && !chain.bypassed.length) continue;
      list.push({ segments: chain.segments, bypassed: chain.bypassed });
    }
    perStationSafeComponents.set(sid, list);
  }
}

const excludedStationIds = new Set(excludedLog.map((e) => e.stationId));

const models = [];
for (const [sid, comps] of perStationSafeComponents) {
  // Deterministic ordering across a station's independent routes.
  const firstId = (c) => c.segments[0]?.[0] ?? c.bypassed[0]?.[0] ?? "";
  comps.sort((a, b) => firstId(a).localeCompare(firstId(b)));
  // A station also needs a distinguishing label when it has excluded (unmodeled)
  // lifts sitting alongside a safe chain — otherwise the safe chain would show
  // under the bare station name, indistinguishable from a fallback row about one
  // of the unmodeled lifts (found by testing: Bank's Lift-8/Lift-9 form a clean
  // 2-lift chain while its other 8 lifts are excluded as too ambiguous; without
  // this, "Bank" could appear twice on the access board for unrelated reasons).
  const multi = comps.length > 1 || excludedStationIds.has(sid);
  comps.forEach((comp, idx) => {
    models.push({
      systemId: SYSTEM_ID,
      stationExternalId: sid,
      ...(multi ? { chainLabel: ` (Route ${idx + 1})` } : {}),
      segments: [
        ...comp.segments.map((liftIds, segIdx) => ({
          id: `seg-${segIdx + 1}`,
          label: `Leg ${segIdx + 1}`,
          elevators: liftIds.map((id) => ({ externalId: id, label: liftById.get(id)?.friendlyName ?? id })),
        })),
        // Lifts fully paralleled by a TfL-published ramp/same-level path:
        // always-up legs (the path is permanent), so their outage alone never
        // severs the route — the bypass is the agency's own topology.
        ...comp.bypassed.map((liftIds, bIdx) => ({
          id: `bypass-${bIdx + 1}`,
          label: `Step-free-bypassed leg ${bIdx + 1}`,
          stepFreeAlternative: true,
          elevators: liftIds.map((id) => ({ externalId: id, label: liftById.get(id)?.friendlyName ?? id })),
        })),
      ],
    });
  });
}

// Lifts whose derived redundancy may legitimately differ from lifts.json's
// lift-only isRedundant because of the published step-free paths: bypassed
// lifts, and lifts merged into a parallel group by node contraction.
const pathAffected = new Set(lifts.filter((l) => l._bypassed).map((l) => l.id));
{
  const byCanon = new Map();
  for (const l of lifts.filter((x) => !x._bypassed)) {
    const k = `${l.stationId}::${tupleKey(l)}`;
    (byCanon.get(k) ?? byCanon.set(k, []).get(k)).push(l);
  }
  for (const group of byCanon.values()) {
    const rawTuples = new Set(group.map((l) => `${l.fromAreas}=>${l.toAreas}`));
    if (rawTuples.size > 1) for (const l of group) pathAffected.add(l.id);
  }
}

// ---- Alert-evidence enrichment ----
// TfL's own alert text (mined into alert-evidence.json by
// tfl-alert-evidence.ts from the archive) sometimes CONFIRMS a real step-free
// alternative our lift-only topology graph can't see (a ramp, a different
// entrance) — e.g. Willesden Junction's neighbor Hackney Wick: "the ramp on
// Hepscott Road". Per Bryce's instruction, TfL's own words are trusted as
// ground truth: a confirmed mention marks that segment stepFreeAlternative
// and records WHY in the chain's note, in TfL's own words. This deliberately
// only ever ADDS a bypass (reduces a false "no access" claim) — it never
// removes one or asserts non-redundancy from an alert's silence, which stays
// merely informative (see tfl-alert-evidence.ts's header for that asymmetry).
let evidence = null;
try {
  evidence = JSON.parse(readFileSync(join(DATA_DIR, "alert-evidence.json"), "utf8"));
} catch {
  console.log("(no alert-evidence.json yet — run `npm run tfl:alert-evidence` first to enable this enrichment)");
}

// Elevators whose stepFreeAlternative came from confirmed TfL evidence rather
// than topology — these are EXPECTED to disagree with lifts.json's own
// isRedundant flag (that catalog only knows "another identical-route LIFT",
// not "a ramp"), so the self-check below documents them instead of failing,
// the same pattern as MTA's REDUNDANCY_EXCEPTIONS.
const evidenceExceptions = new Map(); // externalId -> reason
// Pre-seed with step-free-path effects: these lifts' derived redundancy comes
// from TfL's own published ramp/same-level topology, so a mismatch with
// lifts.json's lift-only isRedundant flag is expected and documented, not a
// failure (same pattern as the alert-evidence exceptions below).
for (const id of pathAffected) {
  evidenceExceptions.set(id, "TfL published ramp/same-level step-free path (step-free-paths.json) parallels this lift's route");
}

const publicEvidence = new Map(); // model -> rider-facing evidence sentences
const internalEvidence = new Map(); // model -> provenance detail
if (evidence) {
  for (const m of models) {
    for (const seg of m.segments) {
      for (const el of seg.elevators) {
        const mention = evidence.byLift[el.externalId]?.alternativeMentions?.[0];
        if (!mention || seg.stepFreeAlternative) continue;
        seg.stepFreeAlternative = true;
        (publicEvidence.get(m) ?? publicEvidence.set(m, []).get(m)).push(
          `TfL has confirmed a step-free alternative for ${el.label}: ${mention.phrase}.`,
        );
        (internalEvidence.get(m) ?? internalEvidence.set(m, []).get(m)).push(
          `Alert-evidence enrichment: ${el.externalId} pattern "${mention.pattern}" — "${mention.phrase}".`,
        );
        evidenceExceptions.set(el.externalId, `TfL alert-confirmed alternative (${mention.pattern}): "${mention.phrase}"`);
      }
    }
  }
}

// Compose the notes LAST — the public text depends on stepFreeAlternative set
// above. `note` = rider-facing plain English (British riders say "lift");
// `internalNote` = provenance, never shipped to the site.
for (const m of models) {
  m.note = [composePublicNote(m.segments, "lift"), ...(publicEvidence.get(m) ?? [])].join(" ");
  const hasPathLift = m.segments.some((s) => s.elevators.some((e) => pathAffected.has(e.externalId)));
  m.internalNote = [
    "Generated from TfL's published lift-route topology (scripts/tfl-chains.mjs). Area codes are deliberately not decoded — legs are ordinal.",
    ...(hasPathLift ? ["Ramp/same-level step-free paths (step-free-paths.json, TfL's own published topology) applied — bypassed legs and contracted parallels come from that data."] : []),
    ...(internalEvidence.get(m) ?? []),
  ].join(" ");
}

// ---- SELF-CHECK ----
// (mirrors src/lib/accessibility.ts's segmentUp/stationAccessible exactly)
const segmentUp = (seg, down) => seg.elevators.some((e) => !down.has(e.externalId)) || !!seg.stepFreeAlternative;
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
      if (derived !== actual && !evidenceExceptions.has(el.externalId)) {
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
if (evidenceExceptions.size) {
  const fromPaths = [...evidenceExceptions.values()].filter((r) => r.includes("step-free-paths.json")).length;
  console.log(`Documented exceptions: ${fromPaths} from published ramp/same-level paths, ${evidenceExceptions.size - fromPaths} from TfL alert evidence.`);
}
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
        "Do not edit by hand — re-run the script after re-importing TfL topology (tfl-import.mjs) or " +
        "alert evidence (tfl-alert-evidence.ts). Covers only stations whose lift topology forms an " +
        "unambiguous single path or set of disjoint paths (no branching hub, no multi-destination edge " +
        "across a multi-edge route). See chains-excluded.json for stations needing a human review pass " +
        "before modeling — same precedent as MTA's 9 hand-authored interchange overrides in " +
        "scripts/mta-chains.mjs.",
      models,
      evidenceExceptions: Object.fromEntries(evidenceExceptions),
    },
    null,
    2,
  ) + "\n",
);
// Attach any alert evidence for an excluded station's own lifts — TfL's alert
// text can hand a human reviewer a real head start (a named alternate route)
// even though the station's overall topology is still too ambiguous to
// auto-model. Never used to auto-resolve the exclusion itself — only surfaced
// as a hint for whoever does the review pass.
const excludedWithHints = excludedLog.map((entry) => {
  if (!evidence) return entry;
  const hints = entry.lifts
    .map((liftId) => {
      const mention = evidence.byLift[liftId]?.alternativeMentions?.[0];
      return mention ? { liftId, phrase: mention.phrase, message: mention.message } : null;
    })
    .filter(Boolean);
  return hints.length ? { ...entry, evidenceHints: hints } : entry;
});
const excludedHintCount = excludedWithHints.filter((e) => e.evidenceHints).length;

writeFileSync(
  join(DATA_DIR, "chains-excluded.json"),
  JSON.stringify(
    {
      note:
        "Stations/access-components whose lift topology is too ambiguous to auto-model safely: a " +
        "branching hub node (3+ distinct routes through one shared area), a multi-destination lift " +
        "within a multi-lift route, or an unclear traversal. Needs a human station-by-station review " +
        "(walking each through with a person who knows the station, per this project's established " +
        "practice for MTA's tangled interchanges) before adding to chains.json. Entries with " +
        "evidenceHints have a real, TfL-published alternative-route mention for one of their lifts " +
        "(from alert-evidence.json) — a head start for the review, not a resolution of the whole " +
        "station's topology.",
      excludedStationCount: new Set(excludedLog.map((e) => e.stationId)).size,
      excludedWithEvidenceHints: excludedHintCount,
      excluded: excludedWithHints,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `\nWrote src/catalog/tfl-data/chains.json (${models.length} models) and chains-excluded.json ` +
    `(${excludedLog.length} entries, ${excludedHintCount} with alert-evidence hints).`,
);
