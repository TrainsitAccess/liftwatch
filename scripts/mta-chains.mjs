// Build MTA's multi-chain station models from the live elevator-inventory feed.
//
// A single physical station can gate several INDEPENDENT lines through different
// elevators (161 St: the 4 and the B/D each have their own; one being down tells
// you nothing about the other). This derives one access chain per platform
// line-group, drops non-ADA elevators, and treats any elevator that spans
// several groups (a shared street/mezzanine) as a prerequisite in each chain.
//
// UNIVERSAL vs MTA-specific: the chain-inference engine + self-check operate on a
// normalized elevator shape {id, lineSet, ada, redundant, description} and the
// generic StationModel — reusable by any system. Only mapEquipment() (raw feed ->
// that shape) and the hand-verified config below are MTA-specific.
//
// The clean stations are inferred automatically. Six interchanges whose real
// topology the feed can't express (verified with a human, station by station)
// are hand-authored OVERRIDES, plus two physical stations MTA fragments across
// two complex-ids each (Penn 164+318, Fulton/Oculus 628+624) that MERGE here.
//
// SELF-CHECK: for every elevator, compare model-DERIVED redundancy against MTA's
// own `redundant` flag (aggregated across all of the elevator's chains — an
// elevator is only truly non-redundant if it is sole access in at least one).
// Mismatches fail the build unless listed in REDUNDANCY_EXCEPTIONS with a reason
// (MTA's flag is occasionally wrong, or reflects cross-station redundancy a
// per-station model can't see). Also enforces: no non-ADA elevator in any chain,
// every ADA elevator covered.
//
// Usage: node scripts/mta-chains.mjs   (re-run to pick up feed changes, e.g. an
// elevator newly marked ADA — the whole thing is derived from the live flags.)

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "src", "catalog", "mta-data");
const SYSTEM_ID = "mta-nyct";
const FEED = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fnyct_ene_equipments.json";

// ---------------------------------------------------------------------------
// Hand-verified config (walk-through with a human, 2026-07). MTA-specific data,
// not logic. Everything else is inferred from the live feed.
// ---------------------------------------------------------------------------

// Physical stations MTA splits across multiple complex-ids. alias -> canonical.
const MERGES = { "318": "164", "624": "628" };

// Elevators whose model-derived redundancy legitimately disagrees with MTA's
// `redundant` flag, each with a human-verified reason. Keeps the self-check
// honest: a mismatch is either here (documented) or a build failure.
const REDUNDANCY_EXCEPTIONS = {
  EL609: "14 St-6 Av: serves the same L platform as EL610 and genuinely backs it up (human-verified); MTA's feed wrongly marks it non-redundant.",
  EL610: "14 St-6 Av: serves the same L platform as EL609 and genuinely backs it up (human-verified); MTA's feed wrongly marks it non-redundant.",
  EL607X: "Grand Central: sole elevator to the Shuttle platform, so non-redundant within this station; MTA marks it redundant only because the Shuttle's OTHER end at Times Sq is another way in — a cross-station path this model can't see.",
  EL619: "Times Sq: serves all lines in both directions (feed serving text) exactly like EL231X, so modeled as redundant street access; MTA's non-redundant flag is inconsistent with EL231X's redundant flag for the identical role.",
};

// Six interchanges hand-authored from the verified walk-through. Each elevator
// list per segment => that segment is up if ANY of them works (mutual backups);
// separate segments must ALL be up for the chain to be accessible.
const OVERRIDES = [
  {
    // 161 St-Yankee Stadium. Direction labels are human-verified: the feed's own
    // text for EL132 ("B/D mezzanine to 4 train") omits the direction, so the
    // 4 chain's structure can't be reliably auto-derived from text.
    canonicalId: "604", name: "161 St-Yankee Stadium", covers: ["604"],
    chains: [
      { label: " (4)", note: "EL132/EL133 gate the 4 platform by direction and are NOT redundant with each other (EL132 = Bronx-bound, EL133 = Manhattan-bound; verified directly — the feed's text for EL132, 'B/D mezzanine to 4 train', omits the direction). EL131 (street to mezzanine) is a shared prerequisite with the (B/D) chain. EL132/EL133 are mid capital-replacement (expected summer 2026), marked inactive in MTA's feed despite the real ongoing outage.", segments: [
        ["street", "Street to mezzanine", ["EL131"]],
        ["bronx-4", "Mezzanine to Bronx-bound 4", ["EL132"]],
        ["manhattan-4", "Mezzanine to Manhattan-bound 4", ["EL133"]],
      ]},
      { label: " (B/D)", note: "EL134/EL135 gate the B/D platform by direction and are NOT redundant with each other (EL134 = Manhattan-bound, EL135 = Bronx-bound). EL131 (street to mezzanine) is a shared prerequisite with the (4) chain — if it fails, both chains go down together.", segments: [
        ["street", "Street to mezzanine", ["EL131"]],
        ["manhattan-bd", "Mezzanine to Manhattan-bound B/D", ["EL134"]],
        ["bronx-bd", "Mezzanine to Bronx-bound B/D", ["EL135"]],
      ]},
    ],
  },
  {
    canonicalId: "601", name: "14 St", covers: ["601"],
    chains: [
      { label: " (1/2/3)", segments: [
        ["street", "Street to mezzanine", ["EL615"]],
        ["uptown", "Mezzanine to uptown 1/2/3", ["EL616"]],
        ["downtown", "Mezzanine to downtown 1/2/3", ["EL617"]],
      ]},
      { label: " (F/M)", segments: [
        ["uptown-street", "Street to F/M uptown mezzanine", ["EL611"]],
        ["uptown-platform", "F/M uptown mezzanine to platform", ["EL614"]],
        ["downtown-street", "Street to F/M downtown mezzanine", ["EL612"]],
        ["downtown-platform", "F/M downtown mezzanine to platform", ["EL613"]],
      ]},
      { label: " (L)", segments: [
        ["street", "Street to L mezzanine", ["EL611", "EL612"]],
        ["platform", "Mezzanine to L platform", ["EL609", "EL610"]],
      ]},
    ],
  },
  {
    canonicalId: "610", name: "Grand Central-42 St", covers: ["610"],
    chains: [
      { label: " (4/5/6)", segments: [
        ["street", "Street to mezzanine", ["EL204", "EL296", "EL606X"]],
        ["downtown", "Mezzanine to downtown 4/5/6", ["EL205"]],
        ["uptown", "Mezzanine to uptown 4/5/6", ["EL206"]],
      ]},
      { label: " (7)", segments: [
        ["street", "Street to mezzanine", ["EL204", "EL296", "EL606X"]],
        ["platform", "Mezzanine to 7 platform", ["EL244"]],
      ]},
      { label: " (S)", segments: [
        ["street", "Street to mezzanine", ["EL606X", "EL608X"]],
        ["platform", "Mezzanine to Shuttle platform", ["EL607X"]],
      ]},
    ],
  },
  {
    canonicalId: "611", name: "Times Sq-42 St", covers: ["611"],
    chains: [
      { label: " (A/C/E)", segments: [
        ["access", "Port Authority / 8th Av entrances to A/C/E (ramp to platform)", ["EL288X", "EL289X", "EL290X", "EL291X"]],
      ]},
      { label: " (N/Q/R/W)", segments: [
        ["street", "Street to mezzanine (all lines)", ["EL231X", "EL619"]],
        ["downtown", "Mezzanine to downtown N/Q/R/W", ["EL229"]],
        ["uptown", "Mezzanine to uptown N/Q/R/W", ["EL230"]],
      ]},
      { label: " (1/2/3/7)", segments: [
        ["street", "Street to mezzanine (all lines)", ["EL231X", "EL619"]],
        ["uptown", "Mezzanine to uptown 1/2/3", ["EL233"]],
        ["downtown", "Mezzanine to downtown 1/2/3 and 7 platform", ["EL232"]],
      ]},
    ],
  },
  {
    // Penn: 8th Av (164) + 7th Av (318), joined step-free through the Penn
    // concourse. The shared concourse access (EL34X/EL618 from 7th Av, EL225
    // from 8th Av) is why EL225 reads redundant.
    canonicalId: "164", name: "34 St-Penn Station", covers: ["164", "318"],
    chains: [
      { label: " (A/C/E)", segments: [
        ["concourse", "Street to Penn concourse (8th & 7th Av entrances)", ["EL34X", "EL618", "EL225"]],
        ["uptown-ce-link", "Uptown C/E platform to concourse", ["EL226"]],
        ["a", "Concourse to A platform", ["EL227"]],
        ["downtown-ce", "Concourse to downtown C/E platform", ["EL228"]],
      ]},
      { label: " (1)", segments: [
        ["street", "Street to Penn concourse", ["EL34X", "EL618"]],
        ["uptown", "Concourse to uptown 1", ["EL214"]],
        ["downtown", "Concourse to downtown 1", ["EL216"]],
      ]},
      { label: " (2/3)", segments: [
        ["street", "Street to Penn concourse", ["EL34X", "EL618"]],
        ["platform", "Concourse to 2/3 platform", ["EL215"]],
      ]},
    ],
  },
  {
    // Fulton St / Oculus / WTC Cortlandt megacomplex: 628 + 624, one continuous
    // step-free complex. Only two sole-access points in the whole thing:
    // EL727X (uptown R/W) and EL732 (2/3 platform).
    canonicalId: "628", name: "Fulton St", covers: ["628", "624"],
    chains: [
      { label: " (R/W)", segments: [
        ["downtown", "Downtown R/W (street, Oculus & Fulton Center accesses)", ["EL18X", "EL22X", "EL16X", "EL17X", "EL726X", "EL23X", "EL728X"]],
        ["uptown", "Fulton Center to uptown R/W platform", ["EL727X"]],
      ]},
      { label: " (E)", segments: [
        ["access", "Church St to WTC E platform", ["EL23X", "EL326"]],
      ]},
      { label: " (A/C)", segments: [
        ["access", "Street & mezzanine accesses to A/C platform", ["EL716", "EL717X", "EL719", "EL720", "EL721", "EL722", "EL723"]],
      ]},
      { label: " (J/Z)", segments: [
        ["access", "Street & mezzanine accesses to J/Z platform", ["EL716", "EL717X", "EL719", "EL720", "EL722"]],
      ]},
      { label: " (2/3)", segments: [
        ["access", "Street to 2/3 mezzanine", ["EL723", "EL721"]],
        ["platform", "2/3 platform to mezzanine", ["EL732"]],
      ]},
      { label: " (4/5)", segments: [
        ["uptown", "Street to uptown 4/5", ["EL716", "EL717X", "EL718X"]],
        ["downtown", "Street to downtown 4/5", ["EL728X", "EL729X"]],
      ]},
    ],
  },
  {
    // Atlantic Av-Barclays: five services through one hub. The Brooklyn-bound
    // 2/3 elevator (EL304) is the connective backbone — reachable from, and
    // giving step-free passage to, the D/N/R, 4/5 and B/Q mezzanines ("access
    // to rest of complex" in the feed) — which is why so many entrances read as
    // redundant. Sole-access points: EL302, EL303 (D/N/R directions), EL305
    // (4/5), EL307 (B/Q platform). B/Q's two elevators (EL306/EL307) are both
    // inactive (capital work) — build-data flags them "likely being replaced".
    canonicalId: "617", name: "Atlantic Av-Barclays Ctr", covers: ["617"],
    chains: [
      { label: " (2/3)", segments: [
        ["manhattan", "Street to Manhattan-bound 2/3 (Barclays plaza & LIRR concourse)", ["EL300X", "EL700X", "EL737X"]],
        ["brooklyn", "Street/mezzanine to Brooklyn-bound 2/3", ["EL301", "EL304"]],
      ]},
      { label: " (4/5)", segments: [
        ["access", "Complex mezzanine access to 4/5", ["EL301", "EL304"]],
        ["platform", "Mezzanine to 4/5 platform", ["EL305"]],
      ]},
      { label: " (D/N/R)", segments: [
        ["access", "Street/mezzanine access to D/N/R", ["EL301", "EL304"]],
        ["brooklyn", "Mezzanine to Brooklyn-bound D/N/R", ["EL302"]],
        ["manhattan", "Mezzanine to Manhattan-bound D/N/R", ["EL303"]],
      ]},
      { label: " (B/Q)", segments: [
        ["access", "Mezzanine access to B/Q", ["EL306", "EL304"]],
        ["platform", "Mezzanine to B/Q platform", ["EL307"]],
      ]},
    ],
  },
];

// ---------------------------------------------------------------------------
// Generic engine (system-agnostic: operates on {id, lineSet, ada, redundant,
// description}). Only mapEquipment below is MTA-specific.
// ---------------------------------------------------------------------------

const lineSetOf = (lines) => new Set((lines || "").split("/").map((s) => s.trim()).filter(Boolean));
const overlaps = (a, b) => [...a].some((x) => b.has(x));
const superset = (a, b) => [...b].every((x) => a.has(x)); // a ⊇ b
const fmtLines = (set) => [...set].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })).join("/");
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const norm = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim();

// Bridge = line-set that is a proper superset of >=2 mutually-disjoint others.
function bridgeIndices(els) {
  const idx = new Set();
  els.forEach((t, ti) => {
    const ts = t.lineSet;
    const subs = els.filter((o, oi) => oi !== ti && ts.size > o.lineSet.size && superset(ts, o.lineSet));
    for (let i = 0; i < subs.length; i++)
      for (let j = i + 1; j < subs.length; j++)
        if (!overlaps(subs[i].lineSet, subs[j].lineSet)) idx.add(ti);
  });
  return idx;
}
function components(els) {
  const comp = els.map((_, i) => i);
  const find = (i) => (comp[i] === i ? i : (comp[i] = find(comp[i])));
  for (let i = 0; i < els.length; i++)
    for (let j = i + 1; j < els.length; j++)
      if (overlaps(els[i].lineSet, els[j].lineSet)) comp[find(i)] = find(j);
  const g = new Map();
  els.forEach((e, i) => (g.get(find(i)) ?? g.set(find(i), []).get(find(i))).push(e));
  return [...g.values()];
}

// Auto-infer chains for one logical station's ADA elevators. Returns chain
// objects {label, segments:[{id,label,elevators:[id]}], lines} or null if the
// station doesn't split into >=2 chains.
function inferChains(elevators) {
  const ada = elevators.filter((e) => e.ada);
  if (ada.length < 2) return null;
  const bIdx = bridgeIndices(ada);
  const bridges = ada.filter((_, i) => bIdx.has(i));
  const platform = ada.filter((_, i) => !bIdx.has(i));
  const comps = components(platform);
  if (comps.length < 2) return null;

  return comps.map((platEls) => {
    const lines = platEls.reduce((a, e) => { for (const x of e.lineSet) a.add(x); return a; }, new Set());
    const serving = bridges.filter((b) => overlaps(b.lineSet, lines));
    const chainEls = [...serving, ...platEls];
    const bySeg = new Map();
    for (const e of chainEls) {
      const key = norm(e.description);
      (bySeg.get(key) ?? bySeg.set(key, []).get(key)).push(e);
    }
    const segments = [...bySeg.entries()].map(([label, els]) => ({
      id: slug(label) || "segment",
      label: els[0].description || label,
      elevators: els.map((e) => e.id),
    }));
    return { label: ` (${fmtLines(lines)})`, lines, segments };
  });
}

// ---------------------------------------------------------------------------
// Accessibility primitives (mirror src/lib/accessibility.ts) for the self-check.
// ---------------------------------------------------------------------------
const segmentUp = (seg, down) => seg.elevators.some((id) => !down.has(id));
const chainAccessible = (chain, down) => chain.segments.every((s) => segmentUp(s, down));

// Internally a chain's segment.elevators is a list of id-strings (the self-check
// works on ids). The emitted StationModel needs CuratedElevator objects, so
// convert here, labelling each elevator with its feed description.
function toModel(canonicalId, name, covers, chains, descById) {
  return chains.map((c) => ({
    systemId: SYSTEM_ID,
    stationExternalId: canonicalId,
    chainLabel: c.label,
    ...(covers.length > 1 ? { coveredStationExternalIds: covers } : {}),
    ...(c.note ? { note: c.note } : {}),
    segments: c.segments.map((s) => ({
      id: s.id,
      label: s.label,
      elevators: s.elevators.map((id) => ({ externalId: id, label: descById.get(id) ?? id })),
    })),
  }));
}

// ---------------------------------------------------------------------------
// MTA-specific mapping + assembly.
// ---------------------------------------------------------------------------
function mapEquipment(e) {
  return {
    id: e.equipmentno,
    lineSet: lineSetOf(e.linesservedbyelevator),
    ada: e.ADA === "Y",
    redundant: e.redundant > 0,
    description: e.shortdescription || e.serving || e.equipmentno,
    rawStation: e.stationcomplexid || e.station,
    name: e.station,
  };
}

async function main() {
  const eq = await (await fetch(FEED)).json();
  const elevators = eq.filter((e) => e.equipmenttype === "EL").map(mapEquipment);

  // Group by logical station, applying merges.
  const canonical = (id) => MERGES[id] ?? id;
  const byStation = new Map();
  for (const e of elevators) {
    const id = canonical(e.rawStation);
    (byStation.get(id) ?? byStation.set(id, []).get(id)).push(e);
  }
  const nameOf = new Map();
  for (const e of elevators) if (!nameOf.has(canonical(e.rawStation))) nameOf.set(canonical(e.rawStation), e.name);
  const flagsById = new Map(elevators.map((e) => [e.id, { redundant: e.redundant, ada: e.ada }]));
  const descById = new Map(elevators.map((e) => [e.id, e.description]));

  const overrideIds = new Set(OVERRIDES.map((o) => o.canonicalId));
  const models = [];
  const chainsByStation = new Map(); // canonicalId -> [{label, segments}] for self-check

  // Auto stations (skip any that are hand-authored overrides).
  for (const [id, els] of byStation) {
    if (overrideIds.has(id)) continue;
    const chains = inferChains(els);
    if (!chains) continue;
    chainsByStation.set(id, chains);
    models.push(...toModel(id, nameOf.get(id), [id], chains, descById));
  }
  // Overrides.
  for (const o of OVERRIDES) {
    const chains = o.chains.map((c) => ({
      label: c.label,
      note: c.note,
      segments: c.segments.map(([id, label, elevators]) => ({ id, label, elevators })),
    }));
    chainsByStation.set(o.canonicalId, chains);
    models.push(...toModel(o.canonicalId, o.name, o.covers, chains, descById));
  }

  // ---- SELF-CHECK ----
  const warnings = [];
  for (const [id, chains] of chainsByStation) {
    // aggregate derived redundancy across all of an elevator's chains
    const derivedByEl = new Map(); // id -> redundant-everywhere?
    const seen = new Set();
    for (const c of chains) for (const el of new Set(c.segments.flatMap((s) => s.elevators))) {
      seen.add(el);
      const redundantHere = chainAccessible(c, new Set([el]));
      derivedByEl.set(el, (derivedByEl.get(el) ?? true) && redundantHere);
    }
    for (const el of seen) {
      const flag = flagsById.get(el);
      if (!flag) { warnings.push(`UNKNOWN-ID  ${id} ${el}: not in feed`); continue; }
      if (!flag.ada) warnings.push(`NON-ADA-IN  ${id} ${el}: non-ADA elevator appears in a chain`);
      const derived = derivedByEl.get(el);
      if (derived !== flag.redundant && !(el in REDUNDANCY_EXCEPTIONS))
        warnings.push(`REDUNDANCY  ${id} ${el}: derived redundant=${derived} but feed=${flag.redundant} (no exception)`);
    }
  }
  // coverage check across covered station ids
  for (const o of [...OVERRIDES, ...[...chainsByStation.keys()].filter((k) => !overrideIds.has(k)).map((k) => ({ canonicalId: k, covers: [k] }))]) {
    const chains = chainsByStation.get(o.canonicalId);
    const inChains = new Set(chains.flatMap((c) => c.segments.flatMap((s) => s.elevators)));
    const covers = o.covers ?? [o.canonicalId];
    const adaHere = elevators.filter((e) => covers.includes(canonical(e.rawStation)) && e.ada);
    for (const e of adaHere) if (!inChains.has(e.id)) warnings.push(`UNCOVERED   ${o.canonicalId} ${e.id}: ADA elevator in no chain`);
  }

  const applied = Object.keys(REDUNDANCY_EXCEPTIONS).filter((id) =>
    [...chainsByStation.values()].some((chains) => chains.some((c) => c.segments.some((s) => s.elevators.includes(id)))));

  console.log(`Generated ${models.length} chain-models across ${chainsByStation.size} stations (${OVERRIDES.length} hand-authored, rest inferred).`);
  console.log(`Redundancy exceptions applied: ${applied.length ? applied.join(", ") : "none"}`);
  if (warnings.length) {
    console.error(`\nSELF-CHECK FAILED — ${warnings.length} warning(s):`);
    for (const w of warnings) console.error("  " + w);
    process.exitCode = 1;
    return;
  }
  console.log("SELF-CHECK PASSED — every model is consistent with MTA's ADA + redundant flags (or a documented exception).");

  // Embed the declared flags + exceptions so the offline check (src/checks) can
  // re-run the whole self-check with no network.
  const usedIds = new Set([...chainsByStation.values()].flatMap((chains) => chains.flatMap((c) => c.segments.flatMap((s) => s.elevators))));
  const out = {
    note: "Generated by scripts/mta-chains.mjs from MTA's live elevator inventory. Do not edit by hand — re-run the script. See CLAUDE.md.",
    models,
    elevatorFlags: Object.fromEntries([...flagsById].filter(([id]) => usedIds.has(id))),
    redundancyExceptions: REDUNDANCY_EXCEPTIONS,
    merges: MERGES,
  };
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "station-chains.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(`\nWrote src/catalog/mta-data/station-chains.json (${models.length} models).`);
}

main().catch((err) => { console.error("mta-chains failed:", err); process.exitCode = 1; });
