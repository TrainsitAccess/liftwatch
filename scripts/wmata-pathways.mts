// Generate WMATA's in-station elevator inventory + access-chain models from its
// GTFS pathways graph (pathways.txt + stops.txt + levels.txt). WMATA's live feed
// (Incidents.svc) only lists BROKEN elevators — no roster, no topology — which is
// why WMATA was `inventoryComplete: false` with no redundancy. GTFS pathways fill
// the topology gap for the IN-STATION (street↔platform) elevators.
//
// ── Extraction (the correctness-critical part) ────────────────────────────────
// A physical elevator = a CONNECTED COMPONENT of the mode-5 (elevator) pathway
// subgraph, NOT a regex over node names. Two nodes are the same elevator iff a
// mode-5 pathway links them; different elevators never share a mode-5 edge. This
// is robust to WMATA's inconsistent node naming (ELV/ELE/EL markers, BT/TP/MID/LG
// suffixes, ENT_-prefixed entrances) and structurally groups a 3-level shaft
// (Street↔Mezz↔Platform, three pairwise pathways) into ONE elevator — so it can
// never over-split one elevator into a false redundant pair (the cardinal
// under-warn). Levels come from stops.txt (level_id → levels.txt), NOT the node
// name; entrances (location_type 2, blank level) are the Street level. This
// captures all ~206 in-station elevators (the first-pass regex got only 154).
//
// ── What GTFS does NOT contain (see the header notes + the session findings) ───
//  • GARAGE / facility elevators — absent from the rail pathways graph, but they
//    exist, break, and appear in the live feed ("Garage elevator"). ~206 GTFS
//    in-station + ~garage/facility ≈ WMATA's published ~320. So the roster here
//    is COMPLETE for in-station access but is NOT the whole fleet.
//  • Side-platform stations — where the two mezzanine→platform elevators serve
//    DIFFERENT directions (distinct platform faces PF_x_1 / PF_x_2) and are NOT
//    redundant. Grouping by level name alone would mark them redundant = a false
//    ACCESSIBLE = under-warn. We detect these via step-free platform reachability
//    and EXCLUDE them (per-direction modeling is a human pass, and a live
//    "mezzanine and platform" advisory can't even say which direction).
//
// DELIBERATELY CONSERVATIVE: only single-platform stations whose levels are the
// standard Street → (Mezzanine) → Platform ladder AND whose any-redundancy is
// backed by identical platform reachability are modeled; everything else is
// EXCLUDED to chains-excluded.json with a reason for a human pass.
//
// The live outage feed crosswalks in by LEVEL PAIR: Incidents carry a
// LocationDescription like "Elevator between street and mezzanine", mapped onto
// the segment the pathways graph knows (see the adapter, once wired).
//
// Usage: node scripts/wmata-pathways.mts <gtfs-dir> [out-dir]
//   <gtfs-dir> holds the extracted rail-gtfs-static.zip (pathways/stops/levels).
//   Download: GET https://api.wmata.com/gtfs/rail-gtfs-static.zip?api_key=KEY

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { elevatorRedundant, type StationModel, type AccessSegment } from "../src/lib/accessibility.js";

const gtfsDir = process.argv[2];
const outDir = process.argv[3] ?? fileURLToPath(new URL("../src/catalog/wmata-data/", import.meta.url));
if (!gtfsDir) {
  console.error("Usage: node scripts/wmata-pathways.mts <gtfs-dir> [out-dir]");
  process.exit(1);
}

// ── Observed-units gate (scripts/wmata-observed.mts) ─────────────────────────
// Every UnitName the live feed has EVER shown us, with its LocationDescription.
// WMATA's GTFS undercounts some stations (live-verified: Forest Glen B09 = one
// mode-5 component but THREE real "mezzanine and platform" UnitNames — a bank
// drawn as one pathway; Mt Vernon Sq E01 = 2 platform elevators vs 1 in GTFS;
// Rockville A14's two pedestrian-bridge elevators absent entirely). A modeled
// station whose observations exceed or can't map onto its GTFS segments would
// under-warn, so it is EXCLUDED here — the static analog of the adapter's
// unmapped-outage fail-safe. Garage/parking elevators are expected to be absent
// from the rail GTFS and never gate anything (tracked units, never chain
// members unless the agency or a human confirms the route).
interface ObservedUnit { unitName: string; stationCode: string; location: string }
let observed: ObservedUnit[] = [];
try {
  const p = fileURLToPath(new URL("../src/catalog/wmata-data/observed-units.json", import.meta.url));
  observed = (JSON.parse(readFileSync(p, "utf8")) as { units: ObservedUnit[] }).units;
} catch {
  console.warn("WARN: no observed-units.json — undercount gate skipped (run scripts/wmata-observed.mts)");
}

// The SAME vocabulary the live adapter uses at poll time — never fork it.
import { parseWmataLocation, segmentIdsForPair } from "../src/adapters/wmata/location.js";

// --- minimal CSV (WMATA GTFS is simple; quoted fields with commas do occur) ---
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  const header = splitRow(lines[0]!);
  return lines.slice(1).map((l) => {
    const cells = splitRow(l);
    const o: Record<string, string> = {};
    header.forEach((h, i) => (o[h] = cells[i] ?? ""));
    return o;
  });
}
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
const read = (f: string) => parseCsv(readFileSync(join(gtfsDir, f), "utf8"));

// level_id -> normalized level name
const levelName = new Map<string, string>();
for (const l of read("levels.txt")) levelName.set(l.level_id!, (l.level_name || "").trim());

// node metadata
interface NodeInfo { levelId: string; level: string; loctype: string; parent: string; name: string }
const node = new Map<string, NodeInfo>();
const stationName = new Map<string, string>();
for (const s of read("stops.txt")) {
  node.set(s.stop_id!, {
    levelId: s.level_id || "",
    level: s.level_id ? (levelName.get(s.level_id) ?? `?${s.level_id}`) : "",
    loctype: s.location_type || "",
    parent: s.parent_station || "",
    name: s.stop_name || "",
  });
  if (s.location_type === "1") stationName.set(s.stop_id!, s.stop_name || s.stop_id!);
}

const stripPrefix = (id: string) => id.replace(/^(NODE_|ENT_|PF_|PLF_)/, "");
const stationCodeOf = (id: string): string => {
  const info = node.get(id);
  if (info && info.parent) return info.parent.replace(/^STN_/, "");
  const m = stripPrefix(id).match(/^([A-Z]\d{2}(?:_[A-Z]\d{2})?)/);
  return m ? m[1]! : "??";
};
const stationCodeOfLevel = (levelId: string): string => {
  const m = levelId.match(/^([A-Z]\d{2}(?:_[A-Z]\d{2})?)/);
  return m ? m[1]! : "";
};
// ORIGINAL level straight from stops.txt (entrances → Street). Used for the
// exclusion gates so a genuinely non-standard level (Upper/Lower Platform, named
// mezzanine, passageway) or a 3-level shaft is never masked by the override below.
const origLevelOf = (id: string): string => {
  const info = node.get(id);
  if (!info) return "?missing";
  if (info.level) return info.level;
  if (info.loctype === "2") return "Street";
  return "?nolevel";
};
// STRUCTURAL level: a node with a direct walkway (mode 1/3) to a PLF_ platform is
// physically AT platform level — trust that over its stops.txt level_id, which
// WMATA mislabels at the platform end of several elevators (K07/D05/E02: both
// ends read the mezzanine/combined level). Used to build segments for stations
// the gates already cleared as standard, so it only ever FIXES a degenerate
// same-level pair; it can't invent a non-standard-platform station into cleanness
// (those are excluded on origLevel first).
const levelOf = (id: string): string => (platformNode.has(id) ? "Platform" : origLevelOf(id));
const isElevNode = (id: string) => /(ELE|ELV|EL)\d*/.test(id);
const isPlatformLevel = (l: string) => /platform/i.test(l);

// --- graph edges by mode ---
const modeAdj = new Map<string, { to: string; mode: string }[]>();
const m5adj = new Map<string, Set<string>>();
const m5nodes = new Set<string>();
function link(a: string, b: string, mode: string) {
  if (!modeAdj.has(a)) modeAdj.set(a, []);
  if (!modeAdj.has(b)) modeAdj.set(b, []);
  modeAdj.get(a)!.push({ to: b, mode });
  modeAdj.get(b)!.push({ to: a, mode });
}
for (const p of read("pathways.txt")) {
  link(p.from_stop_id!, p.to_stop_id!, p.pathway_mode!);
  if (p.pathway_mode === "5") {
    m5nodes.add(p.from_stop_id!); m5nodes.add(p.to_stop_id!);
    if (!m5adj.has(p.from_stop_id!)) m5adj.set(p.from_stop_id!, new Set());
    if (!m5adj.has(p.to_stop_id!)) m5adj.set(p.to_stop_id!, new Set());
    m5adj.get(p.from_stop_id!)!.add(p.to_stop_id!);
    m5adj.get(p.to_stop_id!)!.add(p.from_stop_id!);
  }
}

// Structural platform-level override: a node with a DIRECT same-level walkway
// (mode 1 / travelator 3) edge to a PLF_ platform stop is physically AT platform
// level — trust that over its stops.txt level_id, which WMATA mislabels at the
// platform end of several elevators (K07/N09/E10/D05/E02: both ends read the
// mezzanine/combined level). Fare gates (6/7) sit at the mezzanine, so they are
// excluded — only a walkway edge implies same-level-as-platform.
const platformNode = new Set<string>();
for (const [n, nbrs] of modeAdj) {
  if (nbrs.some(({ to, mode }) => to.startsWith("PLF_") && (mode === "1" || mode === "3"))) platformNode.add(n);
}

// --- physical elevators = connected components of the mode-5 subgraph ---
interface Elev { station: string; elevId: string; nodes: string[]; levels: string[]; origLevels: string[]; servedPlf: string[] }
const compSeen = new Set<string>();
const elevators: Elev[] = [];
// step-free non-elevator reachability: modes 1 (walkway) / 3 (travelator) / 6,7 (fare gates)
const STEPFREE = new Set(["1", "3", "6", "7"]);
function reachablePlf(from: string): Set<string> {
  const vis = new Set([from]);
  const st = [from];
  const plfs = new Set<string>();
  while (st.length) {
    const n = st.pop()!;
    if (n.startsWith("PLF_")) plfs.add(n);
    for (const { to, mode } of modeAdj.get(n) ?? []) {
      if (!STEPFREE.has(mode) || vis.has(to)) continue;
      vis.add(to); st.push(to);
    }
  }
  return plfs;
}
for (const start of m5nodes) {
  if (compSeen.has(start)) continue;
  const comp: string[] = [];
  const st = [start];
  compSeen.add(start);
  while (st.length) {
    const n = st.pop()!;
    comp.push(n);
    for (const nb of m5adj.get(n) ?? []) if (!compSeen.has(nb)) { compSeen.add(nb); st.push(nb); }
  }
  const elevNodes = comp.filter(isElevNode);
  if (!elevNodes.length) continue; // stray non-elevator component (e.g. faregate leak)
  const station = stationCodeOf(elevNodes[0]!);
  // stable id = node name with the trailing position token stripped
  const elevId = stripPrefix(elevNodes.slice().sort()[0]!).replace(/_(BT|TP|MZ|LPLF|UPLF|MID|LL|LG|UP)$/i, "");
  const levels = [...new Set(elevNodes.map(levelOf))];
  const origLevels = [...new Set(elevNodes.map(origLevelOf))];
  const servedPlf = new Set<string>();
  for (const n of comp) if (isPlatformLevel(levelOf(n))) for (const p of reachablePlf(n)) servedPlf.add(p);
  elevators.push({ station, elevId, nodes: comp, levels, origLevels, servedPlf: [...servedPlf] });
}

// --- classify + model per station ---
const STD = new Set(["Street", "Mezzanine", "Platform", "Street/Mezzanine"]);
const RANK: Record<string, number> = { Street: 0, "Street/Mezzanine": 0, Mezzanine: 1, Platform: 2 };
const segId = (a: string, b: string) => `${a}-${b}`.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
const segLabel = (a: string, b: string) => `${a} to ${b}`;

const byStation = new Map<string, Elev[]>();
for (const e of elevators) (byStation.get(e.station) ?? byStation.set(e.station, []).get(e.station)!).push(e);

// all platform faces (PF_*) and directional platform stops (PLF_*) per station
const stationPlf = new Map<string, Set<string>>();
for (const [id] of node) if (id.startsWith("PLF_")) {
  const s = stationCodeOf(id);
  (stationPlf.get(s) ?? stationPlf.set(s, new Set()).get(s)!).add(id);
}

// observed units keyed by GTFS station code (live codes are single — "C01" —
// while GTFS transfer stations are compound — "A01_C01" — so alias the halves)
const obsByStation = new Map<string, ObservedUnit[]>();
{
  const gtfsCodeFor = (live: string): string | undefined =>
    byStation.has(live) ? live : [...byStation.keys()].find((k) => k.split("_").includes(live));
  for (const o of observed) {
    const code = gtfsCodeFor(o.stationCode);
    if (!code) continue; // station has no GTFS elevators at all (nothing modeled to gate)
    (obsByStation.get(code) ?? obsByStation.set(code, []).get(code)!).push(o);
  }
}

const models: StationModel[] = [];
interface Unit { externalId: string; station: string; stationName: string; description: string; levelFrom: string; levelTo: string; segment: string; modeled: boolean; isRedundant: boolean }
const units: Unit[] = [];
const excluded: { station: string; name: string; reason: string; detail: string; levels: string[] }[] = [];

// Human-reviewed stations that PASS the structural gates but whose auto-model
// is nonetheless wrong, so they are hand-curated in wmata-models.ts instead.
// The generator can't see this from GTFS alone (pathways don't encode which
// side of a highway/rail corridor an entrance is on), so it's a manual list —
// the street/entrance analog of the (4) side-platforms gate. These stations
// have two street-entrance elevators GTFS treats as a redundant street→
// mezzanine pair, but the entrances sit on OPPOSITE sides of a highway or rail
// corridor with no step-free crossing at street level: one elevator failing
// strands riders on that side, so the pair is NOT redundant. Confirmed by a
// 2026-07-17 audit (see wmata-data/COVERAGE-AUDIT.md); curated per-entrance in
// wmata-models.ts. Keep this list and the curated tier in sync — a code here
// with no curated model would leave the station unmodeled.
const CURATED_GRADE_SEPARATED: Record<string, string> = {
  N01: "McLean — Silver Line median, N/S pavilions across the Dulles Access Rd",
  N02: "Tysons — Silver Line median, N/S pavilions across Rte 123",
  N03: "Greensboro — Silver Line median, N/S pavilions across Rte 7",
  N04: "Spring Hill — Silver Line median, N/S pavilions across Rte 7",
  N07: "Reston Town Center — Silver Line median, N/S pavilions across the Dulles corridor",
  N08: "Herndon — Silver Line median, N/S pavilions across the Dulles corridor",
  N12: "Ashburn — Silver Line median, N/S pavilions across the Dulles Greenway",
  E09: "College Park-U of Md — island platform, entrances both sides of the rail corridor",
};

// Human-reviewed stations with genuinely SEPARATE (unconnected) mezzanines per
// entrance, where GTFS also undercounts a redundant bank on one leg. Not
// grade-separated (no highway/rail barrier between entrances) — the failure
// is GTFS assuming one connected mezzanine spanning both entrances, drawn as
// a plain symmetric N×N when the real structure needs a per-entrance CNF
// pairing (Navy Yard F05 shape) AND an intra-leg bank on one side (Forest
// Glen/Rosslyn shape). Confirmed by Bryce via /liftwatch-wmata-spot-check
// 2026-07-17; curated per-entrance CNF in wmata-models.ts.
const CURATED_SPLIT_MEZZANINE: Record<string, string> = {
  A08: "Friendship Heights — separate Jenifer St. (north) and Western Ave. (south) mezzanines; Jenifer St. street leg is a 4-elevator bank GTFS drew as 1",
};

// Human-reviewed stations where WMATA's own Rider Tools station-page inventory
// (wmata-data/rider-tools-inventory.json, fetched 2026-07-17) shows MORE
// in-station elevators than GTFS drew — the same undercount class as Forest
// Glen/Rosslyn, but caught from WMATA's page rather than live observation.
// All four verified single-mezzanine (no A08 split-mezzanine risk): N06/N11
// have one entry pavilion each, N10 is entered from the airport at mezzanine
// level, D01 has one mezzanine. Curated with the real page ids in
// wmata-models.ts (2026-07-17 auto-tier audit, spot-check-log.md).
const CURATED_PAGE_UNDERCOUNT: Record<string, string> = {
  N06: "Wiehle-Reston East — page shows 2x2 (two south-pavilion street elevators + two platform elevators); GTFS drew 1+1",
  N10: "Washington Dulles International Airport — page shows a 4-elevator mezzanine-to-platform bank; GTFS drew 2",
  N11: "Loudoun Gateway — page shows 2x2 (two north-pavilion street elevators + two platform elevators); GTFS drew 1+1",
  D01: "Federal Triangle — page shows a redundant mezzanine-to-platform pair (D01X02/D01X03); GTFS drew 1+1",
  C13: "King St-Old Town — page + Bryce: a third standalone platform elevator (C13S01) slightly south of King St; GTFS drew only the N-pair",
};

// Human-reviewed stations whose two elevators serve SEPARATE (unconnected)
// at-grade mezzanines but stay mutually redundant only via a DISCLOSED
// step-free surface walk between the entrances (≤0.3 mi step-free detour
// policy, 2026-07-10). The generated redundant-pair STRUCTURE is correct, but
// its auto-composed note wrongly implies one connected mezzanine and hides the
// walk — so these are curated in wmata-models.ts with an honest note that
// discloses the walk (the policy REQUIRES the walk always be surfaced to
// riders). Distinct from grade-separated (§CURATED_GRADE_SEPARATED — no
// step-free crossing → genuinely NOT redundant) and from A08 split-mezzanine
// (no walk between the ends).
const CURATED_STEP_FREE_DETOUR: Record<string, string> = {
  F06: "Anacostia — separate at-grade Howard Rd + Kiss & Ride mezzanines, each with its own platform elevator; redundant only via a disclosed ~0.3 mi step-free surface walk between the two entrances (Bryce 2026-07-17)",
};

// Human-reviewed stations whose GTFS "street→mezzanine" elevator is a PHANTOM:
// the mezzanine is reachable step-free from the street WITHOUT an elevator (a
// ramp / at-grade entrance), so that leg is omitted and only the platform
// elevator gates — the §3C mezzanine-at-grade pattern (Rockville, Downtown
// Largo, West Falls Church). GTFS models a street→mezz pathway that doesn't
// actually gate step-free access. Curated in wmata-models.ts.
const CURATED_MEZZANINE_AT_GRADE: Record<string, string> = {
  B10: "Wheaton — at-grade mezzanine reached step-free by a ramp from Georgia Ave (bus-bay entrance) plus a Kiss & Ride/garage-elevator entrance; GTFS drew a phantom street→mezz elevator. Only B10X01 (mezz→platform) gates (Bryce 2026-07-17)",
};

// Human-reviewed stations whose two street entrances flank a SURFACE road
// crossable at grade, so the street→mezzanine pair IS genuinely redundant
// (a rider can cross to the other entrance step-free) — the milder-case
// counterpart to CURATED_GRADE_SEPARATED (where a highway/rail corridor makes
// the crossing impossible → NOT redundant). The generated redundant-pair
// structure is already correct; curated in wmata-models.ts to promote real
// page ids + locations and disclose the crossing in the rider note.
const CURATED_SURFACE_CROSSING: Record<string, string> = {
  B11: "Glenmont — two street elevators flank Georgia Ave (Rte 97), a signalized surface road crossable at grade → redundant street pair feeding one mezzanine (Bryce confirmed redundant 2026-07-17); one sole mezz→platform elevator B11X03",
};

function nameOf(st: string) { return stationName.get(`STN_${st}`) ?? stationName.get(st) ?? st; }
function exclude(st: string, reason: string, detail: string, levels: string[]) {
  excluded.push({ station: st, name: nameOf(st), reason, detail, levels });
  // still emit the elevators into the inventory (roster), just unmodeled
  for (const e of byStation.get(st) ?? []) {
    const [a, b] = e.levels.length === 2 ? [e.levels[0]!, e.levels[1]!] : [e.levels.join("/"), ""];
    units.push({
      externalId: `WMATA-${e.elevId}`, station: st, stationName: nameOf(st),
      description: e.levels.join(" ↔ "), levelFrom: a, levelTo: b, segment: "",
      modeled: false, isRedundant: false,
    });
  }
}

for (const [st, els] of [...byStation.entries()].sort()) {
  const name = nameOf(st);
  // (0) human-reviewed grade-separated stations: hand-curated in wmata-models.ts
  //     because their GTFS-derived street→mezzanine redundancy is false (see the
  //     CURATED_GRADE_SEPARATED note above).
  if (CURATED_GRADE_SEPARATED[st]) {
    exclude(st, "grade-separated-entrances", CURATED_GRADE_SEPARATED[st], [...new Set(els.flatMap((e) => e.levels))]);
    continue;
  }
  if (CURATED_SPLIT_MEZZANINE[st]) {
    exclude(st, "split-mezzanine", CURATED_SPLIT_MEZZANINE[st], [...new Set(els.flatMap((e) => e.levels))]);
    continue;
  }
  if (CURATED_PAGE_UNDERCOUNT[st]) {
    exclude(st, "page-inventory-undercount", CURATED_PAGE_UNDERCOUNT[st], [...new Set(els.flatMap((e) => e.levels))]);
    continue;
  }
  if (CURATED_STEP_FREE_DETOUR[st]) {
    exclude(st, "step-free-detour-redundant", CURATED_STEP_FREE_DETOUR[st], [...new Set(els.flatMap((e) => e.levels))]);
    continue;
  }
  if (CURATED_MEZZANINE_AT_GRADE[st]) {
    exclude(st, "mezzanine-at-grade", CURATED_MEZZANINE_AT_GRADE[st], [...new Set(els.flatMap((e) => e.levels))]);
    continue;
  }
  if (CURATED_SURFACE_CROSSING[st]) {
    exclude(st, "surface-crossing-redundant", CURATED_SURFACE_CROSSING[st], [...new Set(els.flatMap((e) => e.levels))]);
    continue;
  }
  // (1) corruption guard: any elevator node whose level_id belongs to a DIFFERENT
  //     station (live-observed at A02, whose nodes point at A03's levels).
  const corrupt = els.some((e) => e.nodes.some((n) => {
    const lid = node.get(n)?.levelId || "";
    const ls = stationCodeOfLevel(lid);
    return ls && ls !== st;
  }));
  if (corrupt) { exclude(st, "corrupt-levels", "GTFS level_id points at another station's levels", [...new Set(els.flatMap((e) => e.levels))]); continue; }

  const allLevels = new Set(els.flatMap((e) => e.levels));
  const allOrig = new Set(els.flatMap((e) => e.origLevels));
  // (2) any 3+ level shaft (spans two segments) — complex, human pass. Uses the
  //     ORIGINAL levels so the platform override can't collapse a true 3-level
  //     shaft (e.g. Fort Totten's Upper+Lower Platform) into a clean 2-rung ladder.
  if (els.some((e) => e.origLevels.length > 2)) { exclude(st, "multi-level-shaft", "an elevator serves 3+ named levels", [...allOrig]); continue; }
  // (3) non-standard levels (lower/upper platform, multiple/named mezzanines, ped
  //     bridge, passageway) — again on ORIGINAL levels.
  const nonStd = [...allOrig].filter((l) => !STD.has(l));
  if (nonStd.length) { exclude(st, "non-standard-levels", nonStd.join(", "), [...allOrig]); continue; }

  // (4) side-platform detection: >1 directional platform face, and no single
  //     elevator reaches ALL of them (each platform elevator serves one direction).
  const plfAll = [...(stationPlf.get(st) ?? [])];
  const platEls = els.filter((e) => e.levels.some(isPlatformLevel));
  const coversAll = (e: Elev) => plfAll.length > 0 && plfAll.every((p) => e.servedPlf.includes(p));
  if (plfAll.length > 1 && platEls.length > 0 && !platEls.some(coversAll)) {
    exclude(st, "side-platforms", "platform elevators serve disjoint directions (per-direction, not redundant)", [...allLevels]);
    continue;
  }

  // (5) build the ladder from level pairs; require a contiguous entry→Platform chain
  const segMap = new Map<string, { from: string; to: string; els: Elev[] }>();
  let bad = false;
  for (const e of els) {
    if (e.levels.length !== 2) { bad = true; break; }
    const [x, y] = e.levels as [string, string];
    if (!(x in RANK) || !(y in RANK)) { bad = true; break; }
    const from = RANK[x]! <= RANK[y]! ? x : y;
    const to = RANK[x]! <= RANK[y]! ? y : x;
    if (from === to) { bad = true; break; }
    const key = `${from}|${to}`;
    (segMap.get(key) ?? segMap.set(key, { from, to, els: [] }).get(key)!).els.push(e);
  }
  if (bad) { exclude(st, "unorderable-levels", "elevator level pair not a standard rung", [...allLevels]); continue; }

  const segs = [...segMap.values()].sort((a, b) => RANK[a.from]! - RANK[b.from]!);
  const chainOk = segs.every((s, i) => i === 0 || s.from === segs[i - 1]!.to);
  const reachesPlatform = segs.length > 0 && segs[segs.length - 1]!.to === "Platform";
  if (!chainOk || !reachesPlatform) { exclude(st, "non-contiguous-ladder", "segments do not chain entry→platform", [...allLevels]); continue; }

  // (6) redundancy safety gate: any segment claiming >=2 elevators that touches a
  //     platform must have all its elevators reach an identical, non-empty platform
  //     set (island). Otherwise treat as per-direction (should have been caught in
  //     (4), but double-guard the reachability).
  let redunUnsafe = false;
  for (const s of segs) {
    if (s.els.length < 2 || s.to !== "Platform") continue;
    const sets = s.els.map((e) => new Set(e.servedPlf));
    const first = sets[0]!;
    const identical = first.size > 0 && sets.every((z) => z.size === first.size && [...z].every((v) => first.has(v)));
    if (!identical) redunUnsafe = true;
  }
  if (redunUnsafe) { exclude(st, "unsafe-platform-redundancy", "same-segment platform elevators reach differing platforms", [...allLevels]); continue; }

  // (7) observed-units gate: every UnitName the live feed ever showed at this
  //     station must map onto exactly one modeled segment (per the shared
  //     vocabulary the adapter also uses), and no segment may have more distinct
  //     observed units than GTFS elevators. Garage/parking units are exempt
  //     (expected absent from the rail GTFS; roster-only per universal policy).
  let obsProblem: { reason: string; detail: string } | null = null;
  const obsPerSeg = new Map<string, Set<string>>();
  for (const o of obsByStation.get(st) ?? []) {
    const pair = parseWmataLocation(o.location);
    if (pair === "garage") continue;
    const cands = segs.filter((s) => segmentIdsForPair(pair).includes(segId(s.from, s.to)));
    if (cands.length !== 1) {
      obsProblem = { reason: "observed-unmappable", detail: `live unit ${o.unitName} ("${o.location}") maps to ${cands.length} segments` };
      break;
    }
    const key = `${cands[0]!.from}|${cands[0]!.to}`;
    (obsPerSeg.get(key) ?? obsPerSeg.set(key, new Set()).get(key)!).add(o.unitName);
  }
  if (!obsProblem) {
    for (const [key, names] of obsPerSeg) {
      const seg = segMap.get(key)!;
      if (names.size > seg.els.length) {
        obsProblem = { reason: "observed-undercount", detail: `${names.size} distinct live units (${[...names].sort().join(", ")}) on ${seg.from}→${seg.to} vs ${seg.els.length} in GTFS` };
        break;
      }
    }
  }
  if (obsProblem) { exclude(st, obsProblem.reason, obsProblem.detail, [...allLevels]); continue; }

  // (8) BIND observed real UnitNames onto this station's segment slots. Slots
  //     within a segment are interchangeable (identical access role, identical
  //     redundancy), so assigning sorted observed names to sorted slots is
  //     exact for both access computation and per-unit redundancy. A slot with
  //     no observed name yet keeps its synthetic GTFS id (WMATA-<node>) until
  //     its real UnitName first appears in the feed and the model is
  //     regenerated. This is what lets the live feed's ids match the model
  //     directly — no runtime guessing.
  const boundId = new Map<Elev, string>();
  for (const [key, s] of segMap) {
    const names = [...(obsPerSeg.get(key) ?? [])].sort();
    const slots = s.els.slice().sort((a, b) => a.elevId.localeCompare(b.elevId));
    slots.forEach((e, i) => boundId.set(e, names[i] ?? `WMATA-${e.elevId}`));
  }

  // build the model. Two note tiers (per Bryce, 2026-07-13): `note` is the
  // PUBLIC rider-facing text — plain English, no GTFS/generator jargon;
  // `internalNote` carries the provenance and data caveats for maintainers.
  const humanLevel = (l: string) => (l === "Street/Mezzanine" ? "the street-level mezzanine" : `the ${l.toLowerCase()}`);
  const countWord = (n: number) => ["No", "One", "Two", "Three", "Four", "Five"][n] ?? String(n);
  const segSentences = segs.map((s) =>
    s.els.length === 1
      ? `One elevator connects ${humanLevel(s.from)} to ${humanLevel(s.to)}`
      : `${countWord(s.els.length)} elevators connect ${humanLevel(s.from)} to ${humanLevel(s.to)} — ${s.els.length === 2 ? "either" : "any"} one keeps this leg open`,
  );
  const soleCount = segs.filter((s) => s.els.length === 1).length;
  const tail =
    soleCount === 0
      ? "No single elevator outage removes step-free access."
      : soleCount === segs.length
        ? segs.length === 1
          ? "It has no backup — if it is out of service, the station has no step-free route."
          : "None of these elevators has a backup — if any one is out of service, the station has no step-free route."
        : "A leg served by a single elevator has no backup — an outage there removes the station's step-free route.";
  const model: StationModel = {
    systemId: "wmata-dc",
    stationExternalId: st,
    note: `${segSentences.join(". ")}. ${tail}`,
    internalNote: `Topology from WMATA GTFS pathways (mode-5 elevator components): ${segs.map((s) => `${s.from}→${s.to}: ${s.els.length} elevator${s.els.length > 1 ? "s" : ""}`).join(", ")}. In-station elevators only — garage/facility elevators are not in the rail GTFS. Slot ids are live UnitNames where observed, synthetic WMATA-<node> otherwise.`,
    segments: segs.map((s): AccessSegment => ({
      id: segId(s.from, s.to),
      label: segLabel(s.from, s.to),
      elevators: s.els.map((e) => ({ externalId: boundId.get(e)!, label: `${name} elevator ${boundId.get(e)!.startsWith("WMATA-") ? "" : `${boundId.get(e)!} `}(${segLabel(s.from, s.to)})`.replace("  ", " ") })),
    })),
  };
  models.push(model);
  for (const s of segs) for (const e of s.els) {
    units.push({
      externalId: boundId.get(e)!, station: st, stationName: name,
      description: `Elevator between ${s.from.toLowerCase()} and ${s.to.toLowerCase()}`,
      levelFrom: s.from, levelTo: s.to, segment: segId(s.from, s.to),
      modeled: true, isRedundant: elevatorRedundant(model, boundId.get(e)!),
    });
  }
}

mkdirSync(outDir, { recursive: true });
const generatedAt = new Date().toISOString();
units.sort((a, b) => a.externalId.localeCompare(b.externalId));
writeFileSync(join(outDir, "units.json"), JSON.stringify({ generatedAt, source: "WMATA GTFS rail pathways.txt mode-5 connected components (in-station elevators only)", units }, null, 2) + "\n");
writeFileSync(join(outDir, "chains.json"), JSON.stringify({ generatedAt, source: "WMATA GTFS pathways topology (conservative single-platform Street→Mezzanine→Platform ladders)", models }, null, 2) + "\n");
writeFileSync(join(outDir, "chains-excluded.json"), JSON.stringify({ generatedAt, note: "Stations NOT auto-modeled — complex/side-platform/non-standard, pending a human pass.", stations: excluded.sort((a, b) => a.station.localeCompare(b.station)) }, null, 2) + "\n");

// --- report ---
const modeledUnits = units.filter((u) => u.modeled);
const redundant = modeledUnits.filter((u) => u.isRedundant).length;
const byReason = new Map<string, string[]>();
for (const e of excluded) (byReason.get(e.reason) ?? byReason.set(e.reason, []).get(e.reason)!).push(e.station);
console.log(`WMATA GTFS pathways → ${elevators.length} in-station elevators across ${byStation.size} stations`);
console.log(`  Modeled: ${models.length} stations, ${modeledUnits.length} elevators (${redundant} redundant, ${modeledUnits.length - redundant} sole-access)`);
console.log(`  Excluded: ${excluded.length} stations (${units.length - modeledUnits.length} elevators unmodeled but in roster)`);
for (const [reason, sts] of [...byReason.entries()].sort()) console.log(`    ${reason} (${sts.length}): ${sts.join(", ")}`);
console.log(`Wrote units.json (${units.length}), chains.json (${models.length}), chains-excluded.json (${excluded.length}) → ${outDir}`);
