// WMATA FINAL ACCURACY AUDIT — independent cross-check of the production models
// against every ground-truth source. NOT the self-check (check:wmata) — this
// re-derives from the raw sources so it can catch what the models + their own
// self-check share as blind spots.
//
// Sources:
//   A. Production STATION_MODELS (curated wmata-models.ts + generated chains.json)
//   B. rider-tools-inventory.json — WMATA's OWN per-station elevator roster (real ids)
//   C. observed-units.json — every UnitName ever seen live/in-archive
//   D. cip-elevator-mentions.md — incidental real ids from the CIP report
//
// Run: npx tsx scripts/wmata-final-audit.mts
import fs from "node:fs";
import { STATION_MODELS } from "../src/catalog/station-models.js";
import type { StationModel } from "../src/lib/accessibility.js";

const DATA = "src/catalog/wmata-data";
const rt = JSON.parse(fs.readFileSync(`${DATA}/rider-tools-inventory.json`, "utf8"));
const observed = JSON.parse(fs.readFileSync(`${DATA}/observed-units.json`, "utf8"));
const cipText = fs.readFileSync(`${DATA}/cip-elevator-mentions.md`, "utf8");

const wmataModels = STATION_MODELS.filter((m) => m.systemId === "wmata-dc") as StationModel[];

// ---- helpers ----
const isRealUnitId = (id: string) => /^[A-Z]\d{2}[A-Z]\d{2}$/.test(id); // e.g. A07X01, C13N01
const isSynthetic = (id: string) => id.startsWith("WMATA-");
const stationCodeOf = (id: string) => (isRealUnitId(id) ? id.slice(0, 3) : null);
// A model may cover several real feed codes; treat all of them as this model's codes.
const coveredOf = (m: StationModel): string[] => m.coveredStationExternalIds ?? [m.stationExternalId];

// ---- build ground-truth id sets ----
// Rider-tools: real elevator ids per station (split elevators vs garages by name)
const rtElevatorIds = new Set<string>();
const rtGarageIds = new Set<string>();
const rtIdsByStation = new Map<string, Set<string>>();
const rtGarageByStation = new Map<string, Set<string>>();
const rtNameById = new Map<string, string>();
for (const code in rt.stations) {
  const st = rt.stations[code];
  for (const g of st.groups) {
    for (const e of g.elevators) {
      const id: string = e.id;
      const name: string = e.name || "";
      const isGarage = /garage|parking|kiss\s*&\s*ride/i.test(name);
      const scode = stationCodeOf(id) ?? code;
      if (isGarage) {
        rtGarageIds.add(id);
        if (!rtGarageByStation.has(scode)) rtGarageByStation.set(scode, new Set());
        rtGarageByStation.get(scode)!.add(id);
      } else {
        rtElevatorIds.add(id);
        if (!rtIdsByStation.has(scode)) rtIdsByStation.set(scode, new Set());
        rtIdsByStation.get(scode)!.add(id);
      }
      rtNameById.set(id, name);
    }
  }
}

// Observed units
const observedIds = new Set<string>(observed.units.map((u: any) => u.unitName));
const observedLocById = new Map<string, string>();
for (const u of observed.units) observedLocById.set(u.unitName, u.location || "");

// CIP mentions (regex over the text)
const cipIds = new Set<string>((cipText.match(/[A-Z]\d{2}[EX]\d{2}/g) || []));

// ---- collect modeled elevators ----
type ModeledEle = { id: string; station: string; chainLabel?: string; segLabel: string; segEleCount: number; synthetic: boolean };
const modeled: ModeledEle[] = [];
const modeledIds = new Set<string>();
const modeledStations = new Set<string>();
const coveredCodesByStation = new Map<string, string[]>();
for (const m of wmataModels) {
  for (const code of coveredOf(m)) modeledStations.add(code);
  coveredCodesByStation.set(m.stationExternalId, coveredOf(m));
  for (const seg of m.segments) {
    for (const e of seg.elevators) {
      modeled.push({
        id: e.externalId,
        station: m.stationExternalId,
        chainLabel: m.chainLabel,
        segLabel: seg.label,
        segEleCount: seg.elevators.length,
        synthetic: isSynthetic(e.externalId),
      });
      modeledIds.add(e.externalId);
    }
  }
}

const findings: { sev: "ERROR" | "WARN" | "INFO"; code: string; msg: string }[] = [];
const add = (sev: "ERROR" | "WARN" | "INFO", code: string, msg: string) => findings.push({ sev, code, msg });

console.log("=".repeat(72));
console.log("WMATA FINAL ACCURACY AUDIT");
console.log("=".repeat(72));
console.log(`Models: ${wmataModels.length} StationModels over ${modeledStations.size} station codes`);
console.log(`Modeled elevators: ${modeled.length} (${new Set([...modeledIds].filter(isSynthetic)).size} synthetic ids)`);
console.log(`Ground truth — rider-tools: ${rtElevatorIds.size} elevators + ${rtGarageIds.size} garage, over ${Object.keys(rt.stations).length} stations`);
console.log(`Ground truth — observed: ${observedIds.size} unit ids`);
console.log(`Ground truth — CIP mentions: ${cipIds.size} ids`);
console.log();

// ============================================================
// CHECK A — Station coverage: every rider-tools station is modeled
// ============================================================
const rtStationCodes = new Set<string>();
for (const code in rt.stations) {
  // derive real station code from ids where possible, else the key
  const ids = rt.stations[code].groups.flatMap((g: any) => g.elevators.map((e: any) => e.id));
  const codes = new Set(ids.map((id: string) => stationCodeOf(id)).filter(Boolean));
  if (codes.size) codes.forEach((c: any) => rtStationCodes.add(c));
  else rtStationCodes.add(code);
}
for (const code of [...rtStationCodes].sort()) {
  if (!modeledStations.has(code)) {
    // could be covered via coveredStationExternalIds
    const covered = wmataModels.some((m) => (m.coveredStationExternalIds || []).includes(code));
    if (!covered) add("ERROR", "COVERAGE", `Station ${code} (${rt.stations[Object.keys(rt.stations).find(k=>k)]?.name||'?'}) in rider-tools has NO model`);
  }
}
// also: stations modeled but not in rider-tools
for (const code of [...modeledStations].sort()) {
  if (!rtStationCodes.has(code)) add("INFO", "COVERAGE", `Modeled station ${code} not in rider-tools snapshot (2 known fetch misses: A01/C01, D03/F03)`);
}

// ============================================================
// CHECK B — ID authenticity: every real-looking modeled id must exist in a source
// ============================================================
for (const me of modeled) {
  if (me.synthetic) continue;
  if (!isRealUnitId(me.id)) {
    add("WARN", "ID-FORMAT", `Modeled id "${me.id}" (${me.station}) is neither synthetic nor a standard UnitName format`);
    continue;
  }
  const inRT = rtElevatorIds.has(me.id) || rtGarageIds.has(me.id);
  const inObs = observedIds.has(me.id);
  const inCip = cipIds.has(me.id);
  if (!inRT && !inObs && !inCip) {
    add("ERROR", "ID-GHOST", `Modeled real id "${me.id}" (${me.station}, "${me.segLabel}") appears in NO ground-truth source (rider-tools/observed/CIP) — possible typo or fabrication`);
  } else if (!inRT && !inObs && inCip) {
    add("WARN", "ID-CIP-ONLY", `Modeled id "${me.id}" (${me.station}) is corroborated ONLY by the CIP report, not rider-tools or observed`);
  }
  // station-code sanity: the id's embedded station code should be one of the
  // model's covered feed codes (canonical or a merged sibling).
  const sc = stationCodeOf(me.id);
  const covered = coveredCodesByStation.get(me.station) ?? [me.station];
  if (sc && !covered.includes(sc)) {
    add("WARN", "ID-STATION-MISMATCH", `Modeled id "${me.id}" embeds station code ${sc} but is placed under station ${me.station} (covers ${covered.join(",")})`);
  }
}

// ============================================================
// CHECK C — Synthetic remnants: only Huntington inclinator + Ballston K04 allowed
// ============================================================
const KNOWN_SYNTH_OK = /huntington|inclinator|ballston|K04/i;
for (const me of modeled) {
  if (!me.synthetic) continue;
  const m = wmataModels.find((x) => x.stationExternalId === me.station);
  const ctx = `${me.id} @ ${me.station} (${m?.chainLabel || ""} "${me.segLabel}")`;
  const noteBlob = `${me.id} ${me.station} ${m?.internalNote || ""} ${m?.note || ""}`;
  if (KNOWN_SYNTH_OK.test(noteBlob) || me.station === "C15" || me.station === "K04") {
    add("INFO", "SYNTH-KNOWN", `Synthetic id retained (expected exception): ${ctx}`);
  } else {
    add("ERROR", "SYNTH-UNEXPECTED", `Synthetic id remains where a real UnitName was expected: ${ctx}`);
  }
}

// ============================================================
// CHECK D — Completeness / under-modeling: every rider-tools ELEVATOR (non-garage)
//   should be represented in a chain OR be a known observed garage/aux. A rider-tools
//   elevator in NO model is a potential MISSING chain member (the under-warn risk).
// ============================================================
for (const id of [...rtElevatorIds].sort()) {
  if (modeledIds.has(id)) continue;
  const sc = stationCodeOf(id);
  // Is the station modeled at all?
  const stModeled = sc && (modeledStations.has(sc) || wmataModels.some(m=>(m.coveredStationExternalIds||[]).includes(sc)));
  const name = rtNameById.get(id) || "";
  if (stModeled) {
    add("ERROR", "MISSING-ELEVATOR", `Rider-tools elevator "${id}" (${sc}, "${name}") is NOT in any model — station IS modeled, so this may be an unmodeled chain member (under-warn)`);
  } else {
    add("WARN", "MISSING-ELEVATOR-NOSTATION", `Rider-tools elevator "${id}" (${sc}, "${name}") not modeled and its station isn't either`);
  }
}

// ============================================================
// CHECK E — observed units fully mapped: an observed real elevator not in any
//   model AND not a known garage = a real elevator we've seen but don't model.
// ============================================================
for (const id of [...observedIds].sort()) {
  if (modeledIds.has(id)) continue;
  if (rtGarageIds.has(id)) { add("INFO", "OBS-GARAGE", `Observed id "${id}" is a rider-tools garage (roster-only, no chain) — expected`); continue; }
  const loc = observedLocById.get(id) || "";
  const isGarageLoc = /garage|parking/i.test(loc);
  if (isGarageLoc) { add("INFO", "OBS-GARAGE", `Observed id "${id}" ("${loc}") looks like garage — roster-only`); continue; }
  add("ERROR", "OBS-UNMODELED", `Observed (real, live) elevator "${id}" ("${loc}") is in NO model and isn't a garage — under-warn risk`);
}

// ============================================================
// CHECK F — duplicate ids: an id in two different stations, or same id twice in one station's segments
// ============================================================
const idToStations = new Map<string, Set<string>>();
const idToSegKeys = new Map<string, string[]>();
for (const me of modeled) {
  if (!idToStations.has(me.id)) idToStations.set(me.id, new Set());
  idToStations.get(me.id)!.add(me.station);
  if (!idToSegKeys.has(me.id)) idToSegKeys.set(me.id, []);
  idToSegKeys.get(me.id)!.push(`${me.station}|${me.chainLabel||""}|${me.segLabel}`);
}
for (const [id, stns] of idToStations) {
  if (stns.size > 1) add("ERROR", "DUP-STATION", `Elevator id "${id}" appears under multiple stations: ${[...stns].join(", ")}`);
}
for (const [id, keys] of idToSegKeys) {
  if (keys.length > 1) {
    // allowed when it's the SAME physical elevator shared across chains? WMATA generator forbids id in two generated chains; curated may share deliberately.
    const uniq = new Set(keys);
    if (uniq.size > 1) add("WARN", "ID-MULTI-SEG", `Elevator id "${id}" appears in ${keys.length} segments: ${[...uniq].join(" ; ")} (verify intentional shared-prerequisite)`);
  }
}

// ============================================================
// CHECK G — redundancy inventory: list every redundant segment for eyeball review
// ============================================================
const redundantSegs: string[] = [];
for (const m of wmataModels) {
  for (const seg of m.segments) {
    if (seg.elevators.length >= 2) {
      redundantSegs.push(`${m.stationExternalId}${m.chainLabel||""} "${seg.label}": ${seg.elevators.map(e=>e.externalId).join(" | ")}`);
    }
  }
}

// ---- report ----
const order = { ERROR: 0, WARN: 1, INFO: 2 } as const;
findings.sort((a, b) => order[a.sev] - order[b.sev] || a.code.localeCompare(b.code));
const bySev = { ERROR: 0, WARN: 0, INFO: 0 };
for (const f of findings) bySev[f.sev]++;

console.log("-".repeat(72));
console.log(`REDUNDANT SEGMENTS (${redundantSegs.length}) — eyeball each has a real backing signal:`);
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
console.log(bySev.ERROR === 0 ? "NO ERRORS — models reconcile with all ground-truth sources." : `${bySev.ERROR} ERRORS need resolution before WMATA can be called final.`);
