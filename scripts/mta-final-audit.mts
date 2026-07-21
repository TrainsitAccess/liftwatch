// MTA FINAL ACCURACY AUDIT — independent cross-check of the NYC-subway models
// against every ground-truth source, and the reconciliation report that drives
// full-coverage modeling. The NYCT analog to bart:audit / wmata:audit.
//
// Sources (all committed, offline):
//   A. Production MTA StationModels — stationModelsFor("mta-nyct").
//   B. data.ny.gov 94fv-bak7 inventory (mta-data/ny-elevator-inventory.json) —
//      MTA's OWN per-elevator redundancy (`redundant_elevator` + named backup
//      `redundant_elevator_mezzanine`), direction, per-level flags, reroute.
//      THIS IS THE GROUND-TRUTH GATE.
//   C. tsdataclinic (community, Apache-2.0, corroboration-tier): elevator-importance
//      (failure-impact: Perc. Importance 100 = sole access) + per-elevator
//      line/direction. PROPOSES/corroborates; never gates.
//
// Policy (Bryce): the 19 hand-verified complex interchanges are CORRECT — the
// audit FLAGS where a source disagrees with them but never "fails" on it. For the
// rest, MTA's data is authoritative.
//
// Run: npm run mta:audit
import fs from "node:fs";
import { stationModelsFor } from "../src/catalog/station-models.js";
import { allElevators, stationAccessible, type StationModel } from "../src/lib/accessibility.js";

const DATA = "src/catalog/mta-data";
const inv = JSON.parse(fs.readFileSync(`${DATA}/ny-elevator-inventory.json`, "utf8"));
const invArr: any[] = Array.isArray(inv) ? inv : (inv.elevators || Object.values(inv));
const invByCode = new Map<string, any>(invArr.map((e) => [e.equipment_code, e]));

// Known/expected redundancy differences: human-documented feed exceptions +
// the generator's logged conservative over-warn fallbacks. These are surfaced
// as INFO ("known"), not FLAG ("review"), so the audit stays a clean regression.
const chainsData = JSON.parse(fs.readFileSync(`${DATA}/station-chains.json`, "utf8"));
const documentedException = new Set(Object.keys(chainsData.redundancyExceptions || {}));
const overWarnAllowed = new Set<string>(chainsData.overWarnAllowed || []); // "station|elevator"

// Physical stations MTA splits across complex-ids — must match mta-chains.mjs.
const MERGES: Record<string, string> = { "318": "164", "624": "628" };
const canon = (id: string) => MERGES[id] ?? id;

// ---- tsdataclinic (corroboration) ----
const impText = fs.readFileSync(`${DATA}/tsdataclinic/elevator-importance.csv`, "utf8");
const importancePct = new Map<string, number>();
for (const line of impText.split("\n").slice(1)) {
  const m = line.match(/,(EL\w+),(\d+),([\d.]+),/); // …,Elevator,Importance,Perc,Betweenness
  if (m) importancePct.set(m[1], parseFloat(m[3]));
}

// ---- models ----
const models = stationModelsFor("mta-nyct");
const modeledComplexes = new Set<string>([...models.keys()]);
const modeledIds = new Set<string>();
for (const chains of models.values()) for (const m of chains) for (const e of allElevators(m)) modeledIds.add(e.externalId);

// model-derived redundancy for an elevator, aggregated across all chains at its
// complex: redundant iff the station stays accessible with ONLY it down, in
// EVERY chain it appears in (the mta-chains.mjs rule).
function modelRedundant(complexChains: StationModel[], id: string): boolean {
  let red = true;
  let seen = false;
  for (const c of complexChains) {
    if (!allElevators(c).some((e) => e.externalId === id)) continue;
    seen = true;
    red = red && stationAccessible(c, new Set([id]));
  }
  return seen && red;
}

type Sev = "FLAG" | "GAP" | "INFO";
const findings: { sev: Sev; code: string; msg: string }[] = [];
const add = (sev: Sev, code: string, msg: string) => findings.push({ sev, code, msg });

// data.ny.gov grouped by our canonical complex id. Some rows carry NO station
// assignment (no complex/line/redundancy fields — relay/equipment buildings and
// uncatalogued 2025 installs, e.g. EL147 "Relay Building A"); they are not
// station-access elevators and are excluded from modeling.
const noComplex = invArr.filter((e) => e.station_complex_mrn === undefined || String(e.station_complex_mrn).trim() === "");
const invByComplex = new Map<string, any[]>();
for (const e of invArr) {
  if (e.station_complex_mrn === undefined || String(e.station_complex_mrn).trim() === "") continue;
  const c = canon(String(e.station_complex_mrn));
  if (!invByComplex.has(c)) invByComplex.set(c, []);
  invByComplex.get(c)!.push(e);
}

console.log("=".repeat(72));
console.log("MTA FINAL ACCURACY AUDIT / RECONCILIATION");
console.log("=".repeat(72));
console.log(`Models: ${modeledComplexes.size} complexes, ${modeledIds.size} modeled elevators`);
console.log(`data.ny.gov: ${invArr.length} elevators over ${invByComplex.size} complexes (merged)`);
console.log(`tsdataclinic importance: ${importancePct.size} elevators`);
console.log();

// ============================================================
// CHECK A — modeled ids exist in data.ny.gov at the right complex
// ============================================================
for (const [complexId, chains] of models) {
  for (const m of chains) for (const e of allElevators(m)) {
    const rec = invByCode.get(e.externalId);
    if (!rec) { add("FLAG", "ID-GHOST", `${e.externalId} (${complexId}) modeled but NOT in data.ny.gov inventory`); continue; }
    if (rec.station_complex_mrn === undefined || String(rec.station_complex_mrn).trim() === "") {
      add("INFO", "ID-NY-LAG", `${e.externalId} (${complexId}): in the feed but data.ny.gov hasn't catalogued its complex yet (feed authoritative)`);
      continue;
    }
    const recCx = canon(String(rec.station_complex_mrn));
    if (recCx !== complexId && !(m.coveredStationExternalIds || []).includes(String(rec.station_complex_mrn)))
      add("FLAG", "ID-COMPLEX", `${e.externalId}: data.ny.gov complex ${rec.station_complex_mrn}(→${recCx}) but modeled at ${complexId}`);
  }
}

// ============================================================
// CHECK B — redundancy: model-derived vs data.ny.gov (the 19 complexes).
//   Per Bryce these hand models are CORRECT — so mismatches are FLAGs to review,
//   applying the documented "redundant_elevator is stricter (whole-journey)"
//   nuance: data.ny.gov "-" while model=redundant is often the known nuance
//   (segment-level backup that isn't a whole-journey replacement), not an error.
// ============================================================
for (const [complexId, chains] of models) {
  for (const id of new Set([...chains].flatMap((c) => allElevators(c).map((e) => e.externalId)))) {
    const rec = invByCode.get(id);
    if (!rec) continue;
    const ny = rec.redundant_elevator; // "+" | "-" | undefined
    if (ny !== "+" && ny !== "-") continue;
    const nyRed = ny === "+";
    const modelRed = modelRedundant([...chains], id);
    if (modelRed !== nyRed) {
      const known = documentedException.has(id) || overWarnAllowed.has(`${complexId}|${id}`);
      const why = documentedException.has(id)
        ? " (documented human exception — REDUNDANCY_EXCEPTIONS)"
        : overWarnAllowed.has(`${complexId}|${id}`)
          ? " (logged conservative over-warn — generator couldn't place MTA's declared backup; safe)"
          : modelRed && !nyRed
            ? " (stricter-whole-journey nuance — model backs it up at segment level)"
            : " (model says NOT redundant but data.ny.gov marks it redundant — REVIEW)";
      add(known ? "INFO" : "FLAG", "REDUND-DIFF", `${id} (${complexId} "${(rec.notes || rec.station_name || "").slice(0, 40)}"): model=${modelRed ? "redundant" : "sole"} vs data.ny.gov=${ny}${why}`);
    }
  }
}

// ============================================================
// CHECK C — FLEET COVERAGE GAP: data.ny.gov complexes with elevators that have
//   NO chain model = the Phase-1 modeling worklist. Report each with its
//   elevator count + how many data.ny.gov marks redundant.
// ============================================================
const gapComplexes: { id: string; name: string; n: number; red: number; sole: number }[] = [];
for (const [complexId, els] of invByComplex) {
  if (modeledComplexes.has(complexId)) continue;
  const name = (els[0].station_name || "").replace(/-[A-Z0-9/]+$/, "");
  const red = els.filter((e) => e.redundant_elevator === "+").length;
  const sole = els.filter((e) => e.redundant_elevator === "-").length;
  gapComplexes.push({ id: complexId, name, n: els.length, red, sole });
}
gapComplexes.sort((a, b) => b.n - a.n || a.id.localeCompare(b.id));
add("INFO", "COVERAGE", `${gapComplexes.length} elevator complexes are NOT yet chain-modeled (of ${invByComplex.size}); ${modeledComplexes.size} are.`);

// ============================================================
// CHECK D — tsdataclinic corroboration (CONTEXT ONLY). "Perc. Importance" is a
//   continuous graph-criticality/betweenness score, NOT a binary redundancy
//   flag — so it can't gate. The one signal worth surfacing: importance=100%
//   (the graph routes ALL of a platform's paths through this elevator = sole
//   access) while data.ny.gov marks it REDUNDANT — a genuine topology-vs-flag
//   tension worth a human glance. Everything else is just the score's spread.
// ============================================================
{
  const soleButRedundant: string[] = [];
  for (const id of modeledIds) {
    const pct = importancePct.get(id);
    const rec = invByCode.get(id);
    if (pct === undefined || !rec) continue;
    if (pct >= 100 && rec.redundant_elevator === "+") soleButRedundant.push(id);
  }
  if (soleButRedundant.length)
    add("INFO", "TS-SOLE-VS-REDUND", `tsdataclinic graph routes all paths through these yet data.ny.gov marks them redundant (context, not a gate): ${soleButRedundant.join(", ")}`);
}
add("INFO", "NO-COMPLEX", `${noComplex.length} data.ny.gov rows have NO station assignment (relay/equipment buildings, uncatalogued installs) — excluded from modeling`);

// ============================================================
// CHECK E — TOPOLOGY RECONCILIATION vs the tsdataclinic elevator GRAPH
//   (edgelist_w_pid.csv), an INDEPENDENT reconstruction of each elevator's
//   Street/Mezzanine/Platform connections + the platform's line+direction.
//   Cross-checks every model's STRUCTURE + DIRECTION station-by-station.
//   Corroboration-tier (the ~2024 snapshot lacks the newest elevators, e.g.
//   EL622), so conflicts are REVIEW flags, not proof of a bug.
// ============================================================
{
  const edgeText = fs.readFileSync(`${DATA}/tsdataclinic/edgelist_w_pid.csv`, "utf8");
  type Edge = { station: string; from: string; ft: string; to: string; tt: string };
  const edges: Edge[] = [];
  for (const line of edgeText.split("\n").slice(1)) {
    const m = line.match(/^"([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)"/);
    if (m) edges.push({ station: m[1], from: m[2], ft: m[3], to: m[4], tt: m[5] });
  }
  const isMezz = (t: string) => /mezzanine|concourse|balcony|footbridge|overpass|retail|connection|passageway|nassau/i.test(t);
  // platform pid -> set of direction tokens (train label after the first "-")
  const dirOf = (train: string) => train.split("-").slice(1).join("-").trim();
  // north/northbound/uptown → N; south/southbound/downtown → S. (Terminus names
  // like "manhattan"/"brooklyn" are intentionally unmapped — not a global axis.)
  const axisOf = (d: string): "N" | "S" | null =>
    /north|uptown/.test(d) ? "N" : /south|downtown/.test(d) ? "S" : null;
  const pidDirs = new Map<string, Set<string>>();
  for (const e of edges) {
    let pid: string | null = null, train: string | null = null;
    if (e.ft === "Platform" && e.tt === "Train") { pid = `${e.station}|${e.from}`; train = e.to; }
    else if (e.tt === "Platform" && e.ft === "Train") { pid = `${e.station}|${e.to}`; train = e.from; }
    if (pid && train) (pidDirs.get(pid) ?? pidDirs.set(pid, new Set()).get(pid)!).add(dirOf(train));
  }
  // elevator -> role
  type Role = { street: boolean; mezz: boolean; platform: boolean; pids: Set<string>; station: string };
  const gRole = new Map<string, Role>();
  for (const e of edges) {
    let el: string | null = null, other = "", otype = "";
    if (e.ft === "Elevator") { el = e.from; other = e.to; otype = e.tt; }
    else if (e.tt === "Elevator") { el = e.to; other = e.from; otype = e.ft; }
    if (!el) continue;
    const r = gRole.get(el) ?? { street: false, mezz: false, platform: false, pids: new Set<string>(), station: e.station };
    if (otype === "Street") r.street = true;
    else if (otype === "Platform") { r.platform = true; r.pids.add(`${e.station}|${other}`); }
    else if (isMezz(otype)) r.mezz = true;
    gRole.set(el, r);
  }
  const gAxis = (el: string): Set<"N" | "S"> => {
    const r = gRole.get(el); const out = new Set<"N" | "S">();
    if (r) for (const pid of r.pids) for (const d of pidDirs.get(pid) ?? []) { const a = axisOf(d); if (a) out.add(a); }
    return out;
  };
  // model per-elevator: complex + set of chain-direction axes
  const mAxis = new Map<string, Set<"N" | "S">>();
  const mComplexOf = new Map<string, string>();
  for (const [complexId, chains] of models) for (const m of chains) {
    const a = axisOf((m.chainLabel || "").toLowerCase());
    for (const e of allElevators(m)) {
      mComplexOf.set(e.externalId, complexId);
      if (a) (mAxis.get(e.externalId) ?? mAxis.set(e.externalId, new Set()).get(e.externalId)!).add(a);
    }
  }
  // E1 — direction inversion (unambiguous N/S only, both sides one-axis)
  let checkedStations = new Set<string>(), flaggedStations = new Set<string>(), dirCompared = 0;
  for (const id of modeledIds) {
    const g = gAxis(id); const m = mAxis.get(id);
    if (!gRole.has(id)) continue;
    checkedStations.add(mComplexOf.get(id) ?? id);
    if (g.size === 1 && m && m.size === 1) {
      dirCompared++;
      const gv = [...g][0], mv = [...m][0];
      if (gv !== mv) { add("FLAG", "TOPO-DIRECTION", `${id} (${mComplexOf.get(id)}): topology graph puts it on the ${gv === "N" ? "UPTOWN/north" : "DOWNTOWN/south"} platform but the model chains it ${mv === "N" ? "uptown/north" : "downtown/south"} — possible direction inversion`); flaggedStations.add(mComplexOf.get(id) ?? id); }
    }
  }
  // NOTE: a "relative grouping" check (opposite-platform elevators must not share
  // a chain) was tried and REMOVED — it's confounded by two legitimate patterns
  // and only produced false positives (flagged Columbus Circle / Penn / 161 St /
  // every hand-verified override): (1) MTA redundancy spans opposite platforms via
  // step-free mezzanine cross-connections (Parkchester, Far Rockaway), and (2) a
  // shared street/mezz prerequisite or a mesh cross-connector legitimately appears
  // in a chain for a different direction. The graph's platform split and MTA's
  // redundancy measure different things, so the graph can validate a single
  // elevator's OWN direction (E1) but not the grouping.

  // E2 — coverage: an ADA graph elevator at a MODELED complex, not in the model
  for (const [el, r] of gRole) {
    if (modeledIds.has(el)) continue;
    const rec = invByCode.get(el); if (!rec) continue;
    const cx = canon(String(rec.station_complex_mrn ?? "")); if (!cx || !modeledComplexes.has(cx)) continue;
    const ada = rec.ada_compliant === "YES" || rec.ada_compliant === "1" || rec.ada_compliant === true;
    if (ada && (r.platform || r.mezz))
      add("FLAG", "TOPO-MISSING", `${el} (${cx}): in the topology graph as ADA${r.platform ? " platform" : ""} access but NOT in the model — possible missing elevator`);
  }
  add("INFO", "TOPO-COVERAGE", `Topology cross-check ran on ${checkedStations.size} modeled complexes present in the graph; ${dirCompared} elevators had an unambiguous N/S axis on BOTH sides and were direction-compared; ${checkedStations.size - flaggedStations.size} complexes clean, ${flaggedStations.size} flagged.`);
}

// ---- report ----
const order = { FLAG: 0, GAP: 1, INFO: 2 } as const;
findings.sort((a, b) => order[a.sev] - order[b.sev] || a.code.localeCompare(b.code));
console.log("-".repeat(72));
console.log("FLEET COVERAGE GAP — complexes to model (Phase 1 worklist), largest first:");
for (const g of gapComplexes) console.log(`   ${g.id.padEnd(5)} ${g.name.padEnd(34)} ${g.n} elevators  (${g.red}+ redundant / ${g.sole}- sole per data.ny.gov)`);
console.log();
const bySev = { FLAG: 0, GAP: 0, INFO: 0 };
for (const f of findings) bySev[f.sev]++;
console.log("-".repeat(72));
console.log(`FINDINGS: ${bySev.FLAG} FLAG · ${bySev.INFO} INFO`);
console.log("-".repeat(72));
for (const sev of ["FLAG", "INFO"] as const) {
  const fs2 = findings.filter((f) => f.sev === sev);
  if (!fs2.length) continue;
  console.log(`\n### ${sev} (${fs2.length})`);
  for (const f of fs2) console.log(`  [${f.code}] ${f.msg}`);
}
console.log();
console.log("=".repeat(72));
console.log(`${bySev.FLAG} discrepancy flag(s) vs our existing models · ${gapComplexes.length} complexes still to model.`);
