// BART FINAL ACCURACY AUDIT — independent cross-check of the production BART
// models against every NEW ground-truth source we now have. NOT the self-check
// (check:bart) — this re-derives from the raw sources so it can catch what the
// models + their own self-check share as blind spots (the WMATA-audit lesson).
//
// Sources:
//   A. Production BART StationModels (bart-station-models.ts + 7 inline in
//      station-models.ts) — via stationModelsFor("bart-bay-area").
//   B. settlement-elevator-inventory.json — BART's OWN per-elevator asset ids +
//      function/position, from the ADA settlement Exhibit F/E (the real-id source).
//   C. elevator-dimensions-guide.md — BART's 2022 "Bikes on BART" dimensions
//      guide: a per-station elevator roster with landing descriptions (a
//      STRUCTURE corroboration source, with documented collapse/omit behaviour).
//
// What check:bart already covers (not re-litigated as ERRORs here): model→
// settlement ghost-id detection, station-key, hygiene, attribution crosswalk,
// platform-default confidence. This audit adds the REVERSE and structural
// dimensions check:bart lacks:
//   - COVERAGE settlement→model: a real settlement street/platform elevator in
//     NO model = a potential unmodeled chain member (under-warn risk).
//   - replacedBy hygiene: a model must use the CURRENT id, never a superseded one.
//   - FUNCTION placement: an elevator's settlement func vs the segment it sits in
//     (esp. a redundant pair whose members have DIFFERENT settlement functions).
//   - dimensions-guide row-count structure cross-check per station.
//
// Reads only committed JSON/MD + code — no network, no keys. Run: npm run bart:audit
import fs from "node:fs";
import { stationModelsFor } from "../src/catalog/station-models.js";
import { allElevators, type StationModel } from "../src/lib/accessibility.js";

const DATA = "src/catalog/bart-data";
const inv = JSON.parse(fs.readFileSync(`${DATA}/settlement-elevator-inventory.json`, "utf8")) as {
  elevators: { id: string; abbr: string; station: string; func: string; position: string | null; replacedBy?: string; note?: string }[];
};
const guideText = fs.readFileSync(`${DATA}/elevator-dimensions-guide.md`, "utf8");

const models = stationModelsFor("bart-bay-area");
const chains: StationModel[] = [...models.values()].flat();

// ---- findings collector ----
type Sev = "ERROR" | "WARN" | "INFO";
const findings: { sev: Sev; code: string; msg: string }[] = [];
const add = (sev: Sev, code: string, msg: string) => findings.push({ sev, code, msg });

const isRealAssetId = (id: string) => /^[A-Z][0-9]{2}-[0-9]+$/.test(id);

// Descriptive (non-asset) ids that are deliberately kept — the settlement has no
// clean match (garages, Millbrae plaza/Caltrain access, tunnel/arena bridges).
// Mirrors check:bart's KNOWN_INVENTED.
const KNOWN_INVENTED = new Set<string>([
  // MLBR-EAST-PLAZA promoted to its real id W40-116 (2026-07-20 BART audit).
  "MLBR-CALTRAIN-NB", "MLBR-GARAGE", "MLBR-WEST-PLAZA",
  "DALY-TUNNEL", "COLS-ARENA", "WDUB-GAR-N1", "WDUB-GAR-N2", "WDUB-GAR-S1", "WDUB-GAR-S2",
]);

// ---- settlement indexes ----
const invById = new Map(inv.elevators.map((e) => [e.id, e]));
const invByAbbr = new Map<string, typeof inv.elevators>();
for (const e of inv.elevators) {
  if (!invByAbbr.has(e.abbr)) invByAbbr.set(e.abbr, []);
  invByAbbr.get(e.abbr)!.push(e);
}
const supersededIds = new Map<string, string>(); // oldId -> replacedBy
for (const e of inv.elevators) if (e.replacedBy) supersededIds.set(e.id, e.replacedBy);

// Settlement ids that are real but deliberately OUT of BART's step-free scope —
// they carry the shared-complex asset prefix but belong to another agency's
// platforms/access. Documented here so the coverage check doesn't re-flag them.
const OUT_OF_BART_SCOPE = new Map<string, string>([
  // Millbrae is a shared BART/Caltrain complex; all elevators get the W40 asset
  // prefix, but BART operates only Platform 3 (W40-109). W40-108/110/112 (P5/P4/
  // P1) are Caltrain-platform shafts — bart.gov/stations/mlbr/accessible lists
  // only 4 BART-scope elevators. (Verified in the 2026-07-20 BART final audit.)
  ["W40-108", "MLBR Caltrain Platform 5 shaft — out of BART scope"],
  ["W40-110", "MLBR Caltrain Platform 4 shaft — out of BART scope"],
  ["W40-112", "MLBR Caltrain Platform 1 shaft — out of BART scope"],
]);

// Funcs that MUST be represented as a step-free chain member somewhere in the
// station's model (a rider needs them). garage/amtrak-connector are allowed to
// be absent-or-descriptive (tracked units / out-of-scope), same policy as WMATA
// garages and the documented BART scope rules.
const CHAIN_FUNCS = new Set(["street", "platform", "street-platform"]);

// ---- collect modeled elevators ----
type ModeledEle = { id: string; abbr: string; chainLabel?: string; segLabel: string; segEleCount: number; auxiliary?: boolean };
const modeled: ModeledEle[] = [];
const modeledIds = new Set<string>();
for (const m of chains) {
  for (const seg of m.segments) {
    for (const e of seg.elevators) {
      modeled.push({ id: e.externalId, abbr: m.stationExternalId, chainLabel: m.chainLabel, segLabel: seg.label, segEleCount: seg.elevators.length, auxiliary: m.auxiliary });
      modeledIds.add(e.externalId);
    }
  }
}

// classify a segment label as street-side / platform-side / ambiguous(single-shaft)
const segKind = (label: string): "street" | "platform" | "ambiguous" => {
  const l = label.toLowerCase();
  const platform = /platform|walkway to|mezzanine to|concourse to (all )?platform|concourse\/|to bart platform/.test(l);
  const street = /street to|street\/|to concourse|to mezzanine|to walkway|garage to|street elevator|street and|plaza to/.test(l);
  if (platform && !street) return "platform";
  if (street && !platform) return "street";
  return "ambiguous"; // "Station elevator", "Platform access (…Caltrain…)", OAC/arena, etc.
};

console.log("=".repeat(72));
console.log("BART FINAL ACCURACY AUDIT");
console.log("=".repeat(72));
console.log(`Models: ${chains.length} chains over ${models.size} stations`);
console.log(`Modeled elevators: ${modeled.length} (${[...modeledIds].filter(isRealAssetId).length} real asset ids, ${[...modeledIds].filter((i) => KNOWN_INVENTED.has(i)).length} documented descriptive)`);
console.log(`Ground truth — settlement: ${inv.elevators.length} elevators over ${invByAbbr.size} station codes`);
console.log();

// ============================================================
// CHECK A — every real-asset modeled id exists in the settlement at the right
//   station, and is NOT a superseded id. (Independent re-derivation; check:bart
//   also does the ghost half, kept here so the audit stands alone.)
// ============================================================
for (const me of modeled) {
  if (!isRealAssetId(me.id)) {
    if (!KNOWN_INVENTED.has(me.id)) add("ERROR", "ID-UNKNOWN", `${me.id} (${me.abbr}): non-asset id that is NOT a documented descriptive remnant`);
    continue;
  }
  const s = invById.get(me.id);
  if (!s) { add("ERROR", "ID-GHOST", `${me.id} (${me.abbr}, "${me.segLabel}") is real-format but NOT in the settlement inventory (typo/fabrication?)`); continue; }
  if (s.abbr !== me.abbr) add("ERROR", "ID-STATION", `${me.id}: settlement places it at ${s.abbr}, model at ${me.abbr}`);
  if (supersededIds.has(me.id)) add("ERROR", "ID-SUPERSEDED", `${me.id} (${me.abbr}) is SUPERSEDED by ${supersededIds.get(me.id)} in the settlement — model should use the current id`);
}

// ============================================================
// CHECK B — COVERAGE: every settlement chain-function elevator (street/platform/
//   single-shaft) must be modeled somewhere. A missing one = under-warn risk.
//   garage/amtrak-connector may be absent (tracked-unit / out-of-scope policy).
// ============================================================
for (const e of inv.elevators) {
  if (modeledIds.has(e.id)) continue;
  if (supersededIds.has(e.id)) { add("INFO", "COV-SUPERSEDED", `Settlement ${e.id} (${e.abbr}) is superseded by ${e.replacedBy} — correctly absent from models`); continue; }
  if (OUT_OF_BART_SCOPE.has(e.id)) { add("INFO", "COV-OUT-OF-SCOPE", `Settlement ${e.id} (${e.abbr}): ${OUT_OF_BART_SCOPE.get(e.id)} — correctly unmodeled`); continue; }
  if (CHAIN_FUNCS.has(e.func)) {
    // Is this station otherwise modeled with descriptive ids (Millbrae case)?
    const stationModeled = invByAbbr.get(e.abbr) && chains.some((m) => m.stationExternalId === e.abbr);
    add(stationModeled ? "WARN" : "ERROR", "COV-MISSING",
      `Settlement ${e.func} elevator ${e.id} (${e.abbr} ${e.station}${e.position ? ", " + e.position : ""}) is in NO model` +
      (stationModeled ? " — station IS modeled (may be tracked under a descriptive id, or a real under-warn gap)" : " — and its station is unmodeled"));
  } else {
    add("INFO", "COV-NONCHAIN", `Settlement ${e.func} elevator ${e.id} (${e.abbr} ${e.station}) not modeled — allowed (garage/amtrak, tracked-unit/out-of-scope policy)`);
  }
}

// ============================================================
// CHECK C — FUNCTION placement: an elevator's settlement func vs its segment.
//   (1) redundant pair with MIXED settlement functions = suspicious id↔side.
//   (2) a real id whose segment kind contradicts its settlement func.
//   Both are WARN (settlement func is sometimes imprecise for single shafts;
//   the dimensions guide is the tie-breaker — surfaced for human eyeball).
// ============================================================
// (1) redundant pairs
for (const m of chains) {
  for (const seg of m.segments) {
    if (seg.elevators.length < 2) continue;
    const funcs = seg.elevators
      .map((e) => ({ id: e.externalId, func: invById.get(e.externalId)?.func }))
      .filter((x) => x.func && CHAIN_FUNCS.has(x.func!));
    const distinct = new Set(funcs.map((f) => f.func));
    if (distinct.size > 1) {
      add("WARN", "FUNC-REDUN-MIXED",
        `${m.stationExternalId}${m.chainLabel ?? ""} redundant segment "${seg.label}" mixes settlement functions: ` +
        funcs.map((f) => `${f.id}=${f.func}`).join(", ") + " — a redundant pair should be same-function; verify id↔position");
    }
  }
}
// (2) per-elevator kind vs func
for (const me of modeled) {
  const s = invById.get(me.id);
  if (!s || !CHAIN_FUNCS.has(s.func)) continue;
  if (s.func === "street-platform") continue; // single shaft — any segment kind ok
  const kind = segKind(me.segLabel);
  if (kind === "ambiguous") continue;
  if (kind !== s.func) {
    add("WARN", "FUNC-PLACEMENT", `${me.id} (${me.abbr}) settlement func "${s.func}" but sits in a ${kind}-kind segment "${me.segLabel}" — verify (settlement func can be imprecise; check the dimensions guide)`);
  }
}

// ============================================================
// CHECK D — duplicate id across stations (an id must never span two stations;
//   repeating within one station across chains is a legit shared prerequisite).
// ============================================================
{
  const byId = new Map<string, Set<string>>();
  for (const me of modeled) (byId.get(me.id) ?? byId.set(me.id, new Set()).get(me.id)!).add(me.abbr);
  for (const [id, s] of byId) if (s.size > 1) add("ERROR", "DUP-STATION", `${id} appears under multiple stations: ${[...s].join(", ")}`);
}

// ============================================================
// CHECK E — dimensions-guide structure cross-check. Parse the guide's per-station
//   row count; compare to the model's distinct REAL-id count. The guide is known
//   to COLLAPSE same-dimension pairs and OMIT aux/garage/bridge elevators, so
//   guide<model is expected (INFO); guide>model is the interesting direction
//   (the guide sees an elevator the model may miss) → WARN.
// ============================================================
{
  // station name (as in the guide table) -> abbr, from the settlement's own names
  const nameToAbbr = new Map<string, string>();
  for (const e of inv.elevators) nameToAbbr.set(norm(e.station), e.abbr);
  // a few guide spellings differ from the settlement station names
  const GUIDE_ALIASES: Record<string, string> = {
    "12th st oakland": "12TH", "16th st mission": "16TH", "19th st oakland": "19TH", "24th st mission": "24TH",
    "el cerrito del norte": "DELN", "el cerrito plaza": "PLZA", "coliseum oak": "COLS", "oak oakland intl airport": "OAKL",
    "pittsburg bay point": "PITT", "sfo": "SFIA", "west dublin pleasanton": "WDUB", "powell": "POWL",
  };
  const guideRowsByAbbr = new Map<string, number>();
  for (const line of guideText.split("\n")) {
    if (!line.includes("|") || !/\d+"|—|Not necessary/.test(line)) continue; // data rows only
    if (/duplicate row/i.test(line)) continue; // guide's own annotated typo rows (COLM) — not a real elevator
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 3) continue;
    const station = norm(cells[0].replace(/\*.*$/, ""));
    if (!station || station === "station") continue;
    const abbr = GUIDE_ALIASES[station] ?? nameToAbbr.get(station) ?? guessAbbr(station, nameToAbbr);
    if (!abbr) { continue; }
    // SFIA "Not necessary" row = 0 physical elevators in the guide's view
    const isNone = /not necessary|^—$/.test(cells[1]?.toLowerCase() ?? "");
    guideRowsByAbbr.set(abbr, (guideRowsByAbbr.get(abbr) ?? 0) + (isNone ? 0 : 1));
  }
  for (const [abbr, guideN] of [...guideRowsByAbbr].sort()) {
    const modelReal = new Set(modeled.filter((me) => me.abbr === abbr && isRealAssetId(me.id)).map((me) => me.id)).size;
    const modelDescriptive = new Set(modeled.filter((me) => me.abbr === abbr && KNOWN_INVENTED.has(me.id)).map((me) => me.id)).size;
    const modelTotal = modelReal + modelDescriptive;
    if (guideN > modelTotal) {
      add("WARN", "GUIDE-EXTRA", `Dimensions guide lists ${guideN} elevator rows for ${abbr}, model has ${modelTotal} — guide sees more; verify no missing elevator (known non-issues: MLBR stale, RICH Amtrak)`);
    }
  }
}

// ============================================================
// CHECK F — redundant-segment inventory for eyeball (each needs a real signal)
// ============================================================
const redundantSegs: string[] = [];
for (const m of chains) for (const seg of m.segments) if (seg.elevators.length >= 2) {
  redundantSegs.push(`${m.stationExternalId}${m.chainLabel ?? ""} "${seg.label}": ${seg.elevators.map((e) => e.externalId).join(" | ")}`);
}

// ---- helpers ----
function norm(s: string): string {
  return s.toLowerCase().replace(/[./()',]/g, " ").replace(/\bst\b/g, "st").replace(/\s+/g, " ").trim();
}
function guessAbbr(station: string, nameToAbbr: Map<string, string>): string | undefined {
  for (const [name, abbr] of nameToAbbr) if (name.startsWith(station) || station.startsWith(name)) return abbr;
  return undefined;
}

// ---- report ----
const order = { ERROR: 0, WARN: 1, INFO: 2 } as const;
findings.sort((a, b) => order[a.sev] - order[b.sev] || a.code.localeCompare(b.code));
const bySev = { ERROR: 0, WARN: 0, INFO: 0 };
for (const f of findings) bySev[f.sev]++;

console.log("-".repeat(72));
console.log(`REDUNDANT SEGMENTS (${redundantSegs.length}) — each must have a real backing signal:`);
for (const r of redundantSegs.sort()) console.log("   " + r);
console.log();

console.log("-".repeat(72));
console.log(`FINDINGS: ${bySev.ERROR} ERROR · ${bySev.WARN} WARN · ${bySev.INFO} INFO`);
console.log("-".repeat(72));
for (const sev of ["ERROR", "WARN", "INFO"] as const) {
  const fs2 = findings.filter((f) => f.sev === sev);
  if (!fs2.length) continue;
  console.log(`\n### ${sev} (${fs2.length})`);
  for (const f of fs2) console.log(`  [${f.code}] ${f.msg}`);
}
console.log();
console.log("=".repeat(72));
console.log(bySev.ERROR === 0 ? "NO ERRORS — models reconcile with the settlement + dimensions guide." : `${bySev.ERROR} ERROR(S) need resolution.`);
if (bySev.ERROR) process.exit(1);
