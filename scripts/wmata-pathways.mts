// ⚠️ WIP / DRAFT (2026-07-12) — NOT wired into the app yet, and MUST NOT be
// until the extraction below is completed and validated. Known gap: the
// elevator-node regex `NODE_<code>_<id>_(BT|TP)` on from_stop only captured 154
// of ~205 distinct mode-5 elevators — WMATA's node naming is inconsistent
// (ELV/ELE/EL markers, BT/TP/MID/LG/UP suffixes, some `ENT_`-prefixed nodes,
// both endpoints). A missed elevator on a segment could make a station read
// ACCESSIBLE when it isn't (under-warn — the cardinal sin), so this needs:
//   1. robust elevator-identity extraction across ALL node patterns (get levels
//      from stops.txt regardless of node name; strip the position suffix to
//      group a physical elevator's pathways, incl. 3-level BT/MID/TP elevators);
//   2. reconcile the count (~205 rail-pathways elevators vs WMATA's published
//      ~320 — likely garage/facility elevators excluded from the RAIL GTFS;
//      confirm, don't assume);
//   3. validate redundancy against a ground truth before shipping.
// The ARCHITECTURE is proven though: pathways give inventory + topology
// redundancy, and the live Incidents `LocationDescription` ("Elevator between
// street and mezzanine") crosswalks each outage to its segment by level pair.
//
// Generate WMATA's elevator inventory + access-chain models from its GTFS
// pathways graph (pathways.txt + stops.txt + levels.txt). WMATA's live feed
// (Incidents.svc) only lists BROKEN elevators — no roster, no topology — which
// is why WMATA was `inventoryComplete: false` with no redundancy. GTFS
// pathways fills BOTH gaps: every mode-5 (elevator) pathway is a physical
// elevator connecting two named levels (Street / Mezzanine / Platform), so we
// get a full roster AND topology-derived redundancy (two elevators between the
// same level pair back each other up — same idea as TfL's topology models).
//
// The live outage feed crosswalks in by LEVEL PAIR: Incidents carry a
// LocationDescription like "Elevator between street and mezzanine", which maps
// onto the segment the pathways graph already knows (see the adapter).
//
// DELIBERATELY CONSERVATIVE (TfL precedent): only stations whose levels are the
// standard Street → (Mezzanine) → Platform ladder are modeled; anything with an
// intermediate passageway, multiple/《directional》mezzanines, lower platforms,
// pedestrian bridges, etc. is EXCLUDED to chains-excluded.json for a human pass
// rather than guessed.
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

// stop_id -> { level, station, name } ; also station -> name
const nodeLevel = new Map<string, string>();
const stationName = new Map<string, string>();
for (const s of read("stops.txt")) {
  if (s.level_id) nodeLevel.set(s.stop_id!, levelName.get(s.level_id) ?? s.level_id);
  if (s.location_type === "1") {
    const code = (s.stop_id || "").replace(/^.*_/, ""); // parent stations use the raw code
    stationName.set(s.stop_id!, s.stop_name || s.stop_id!);
  }
}
// Station code -> friendly name (parent station stop_id IS the code, e.g. "C11")
const nameByCode = new Map<string, string>();
for (const s of read("stops.txt")) {
  if (s.location_type === "1" && /^[A-Z]\d{2}$/.test(s.stop_id || "")) nameByCode.set(s.stop_id!, s.stop_name || s.stop_id!);
}

// --- collect elevators (mode-5 pathways) per station ---
interface Elev { station: string; elevId: string; levels: [string, string] }
const byStation = new Map<string, Elev[]>();
for (const p of read("pathways.txt")) {
  if (p.pathway_mode !== "5") continue;
  const m = (p.from_stop_id || "").match(/^NODE_([A-Z]\d{2})_(.+?)_(BT|TP)$/);
  if (!m) continue;
  const station = m[1]!, elevId = m[2]!;
  const a = nodeLevel.get(p.from_stop_id!) ?? "?";
  const b = nodeLevel.get(p.to_stop_id!) ?? "?";
  const list = byStation.get(station) ?? [];
  list.push({ station, elevId, levels: [a, b] });
  byStation.set(station, list);
}

const STD = new Set(["Street", "Mezzanine", "Platform", "Street/Mezzanine"]);
// Order along the access ladder. Street/Mezzanine is the combined entry level.
const LADDER = ["Street", "Street/Mezzanine", "Mezzanine", "Platform"];
const rank = (lvl: string) => LADDER.indexOf(lvl);
const segLabel = (a: string, b: string) => `${a} to ${b}`;
const segId = (a: string, b: string) => `${a}-${b}`.toLowerCase().replace(/[^a-z]+/g, "-");

const models: StationModel[] = [];
const units: { externalId: string; station: string; stationName: string; description: string; segment: string; isRedundant: boolean; levelFrom: string; levelTo: string }[] = [];
const excluded: { station: string; name: string; reason: string; levels: string[] }[] = [];

for (const [station, els] of [...byStation.entries()].sort()) {
  const name = nameByCode.get(station) ?? station;
  const levels = new Set(els.flatMap((e) => e.levels));
  const nonStd = [...levels].filter((l) => !STD.has(l));
  if (nonStd.length) {
    excluded.push({ station, name, reason: "non-standard levels (transfer/multi-level)", levels: [...levels] });
    continue;
  }
  // Group elevators into segments by their (ordered) level pair.
  const segMap = new Map<string, { from: string; to: string; elevIds: string[] }>();
  let bad = false;
  for (const e of els) {
    const [x, y] = e.levels;
    const from = rank(x) <= rank(y) ? x : y;
    const to = rank(x) <= rank(y) ? y : x;
    if (rank(from) < 0 || rank(to) < 0 || from === to) { bad = true; break; }
    const key = `${from}|${to}`;
    const seg = segMap.get(key) ?? { from, to, elevIds: [] };
    if (!seg.elevIds.includes(e.elevId)) seg.elevIds.push(e.elevId);
    segMap.set(key, seg);
  }
  if (bad) { excluded.push({ station, name, reason: "unorderable level pair", levels: [...levels] }); continue; }

  // The segments must form ONE contiguous ladder from the entry level to Platform.
  const segs = [...segMap.values()].sort((a, b) => rank(a.from) - rank(b.from));
  const chainOk = segs.every((s, i) => i === 0 || s.from === segs[i - 1]!.to);
  const reachesPlatform = segs.length > 0 && segs[segs.length - 1]!.to === "Platform";
  if (!chainOk || !reachesPlatform) {
    excluded.push({ station, name, reason: "non-contiguous ladder or no platform elevator", levels: [...levels] });
    continue;
  }

  const model: StationModel = {
    systemId: "wmata-dc",
    stationExternalId: station,
    note: `Topology from WMATA GTFS pathways: ${segs.map((s) => `${s.from}→${s.to} (${s.elevIds.length} elevator${s.elevIds.length > 1 ? "s" : ""})`).join(", ")}.`,
    segments: segs.map((s): AccessSegment => ({
      id: segId(s.from, s.to),
      label: segLabel(s.from, s.to),
      elevators: s.elevIds.map((id) => ({ externalId: `${station}-${id}`, label: `${name} elevator (${segLabel(s.from, s.to)})` })),
    })),
  };
  models.push(model);
  for (const s of segs) for (const id of s.elevIds) {
    units.push({
      externalId: `${station}-${id}`, station, stationName: name,
      description: `Elevator between ${s.from.toLowerCase()} and ${s.to.toLowerCase()}`,
      segment: segId(s.from, s.to), isRedundant: elevatorRedundant(model, `${station}-${id}`),
      levelFrom: s.from, levelTo: s.to,
    });
  }
}

mkdirSync(outDir, { recursive: true });
const generatedAt = new Date().toISOString();
writeFileSync(join(outDir, "units.json"), JSON.stringify({ generatedAt, source: "WMATA GTFS rail pathways.txt (mode 5)", units }, null, 2) + "\n");
writeFileSync(join(outDir, "chains.json"), JSON.stringify({ generatedAt, source: "WMATA GTFS pathways topology (Street→Mezzanine→Platform ladder)", models }, null, 2) + "\n");
writeFileSync(join(outDir, "chains-excluded.json"), JSON.stringify({ generatedAt, note: "Transfer/multi-level stations pending human review.", stations: excluded }, null, 2) + "\n");

const redundant = units.filter((u) => u.isRedundant).length;
console.log(`WMATA pathways: ${byStation.size} stations w/ elevators → modeled ${models.length}, excluded ${excluded.length}`);
console.log(`Inventory: ${units.length} elevators (${redundant} redundant, ${units.length - redundant} sole-access)`);
console.log(`Wrote units.json, chains.json, chains-excluded.json → src/catalog/wmata-data/`);
