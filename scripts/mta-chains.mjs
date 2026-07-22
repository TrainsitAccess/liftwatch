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
// The clean stations are inferred automatically. Nine interchanges whose real
// topology the feed can't express (verified with a human, station by station)
// are hand-authored OVERRIDES, plus two physical stations MTA fragments across
// two complex-ids each (Penn 164+318, Fulton/Oculus 628+624) that MERGE here.
//
// "(LIRR)" chains (2026-07-06): subway stations that gate access to the Long
// Island Rail Road get a chain built ONLY from subway-feed elevators — the
// railroad's own platform elevators live in the separate mta-lirr system
// (backend-unified.mylirr.org/eestatus), whose curated models cover the
// railroad side of the same interchanges (src/catalog/mta-rail-models.ts).
// Penn's EL34X is physically the LIRR feed's NYK-861 ("P34") — tracked in
// both systems deliberately.
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

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
// Runs via tsx (see package.json) so the canonical public-note composer is
// shared with every other generator.
import { composePublicNote } from "../src/lib/accessibility.js";

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
      { label: " (4)", note: "Each direction of the 4 platform has its own elevator — EL132 for Bronx-bound, EL133 for Manhattan-bound — and they do not back each other up. Both routes also depend on EL131 (street to mezzanine), which is shared with the B/D side: if EL131 is out, the whole station loses step-free access. EL132 and EL133 are being replaced and are expected back in summer 2026.", internalNote: "Hand-authored interchange override (human-verified walk-through). Direction labels verified directly — the feed's text for EL132 ('B/D mezzanine to 4 train') omits the direction, so this chain can't be auto-derived. EL132/EL133 are marked inactive in MTA's feed despite the real ongoing capital-replacement outage.", segments: [
        ["street", "Street to mezzanine", ["EL131"]],
        ["bronx-4", "Mezzanine to Bronx-bound 4", ["EL132"]],
        ["manhattan-4", "Mezzanine to Manhattan-bound 4", ["EL133"]],
      ]},
      { label: " (B/D)", note: "Each direction of the B/D platform has its own elevator — EL134 for Manhattan-bound, EL135 for Bronx-bound — and they do not back each other up. Both routes also depend on EL131 (street to mezzanine), which is shared with the 4 side: if EL131 is out, the whole station loses step-free access.", internalNote: "Hand-authored interchange override (human-verified walk-through).", segments: [
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
      { label: " (LIRR)", note: "Street access to the LIRR concourse from the subway side of Penn Station. The LIRR's own platform elevators are tracked separately under LIRR.", internalNote: "Hand-authored interchange override. EL34X is physically the same elevator as the LIRR feed's NYK-861 (Unit P34) — deliberately tracked in both systems.", segments: [
        ["concourse", "Street to Penn concourse (8th & 7th Av entrances)", ["EL34X", "EL618", "EL225"]],
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
      { label: " (LIRR)", note: "Street access to the LIRR's Atlantic Terminal concourse from the subway side. The terminal's own elevators (a redundant pair) are tracked separately under LIRR.", internalNote: "Hand-authored interchange override. EL300X/EL737X both serve '…& LIRR' per the feed.", segments: [
        ["access", "Street to LIRR concourse", ["EL300X", "EL737X"]],
      ]},
    ],
  },
  {
    // Sutphin Blvd-Archer Av <-> LIRR Jamaica: the fifth railroad
    // interchange. The three street elevators are a redundant trio into the
    // shared mezzanine (the Jamaica hub); EL411 alone gates both E/J/Z
    // platforms. LIRR Jamaica's own overpass + platform elevators are
    // tracked in the mta-lirr system (its 521 reaches this subway too).
    canonicalId: "279", name: "Sutphin Blvd-Archer Av-JFK Airport", covers: ["279"],
    chains: [
      { label: " (E/J/Z)", segments: [
        ["street", "Street to mezzanine", ["EL448X", "EL449X", "EL450X"]],
        ["platforms", "Mezzanine to E/J/Z platforms (both directions)", ["EL411"]],
      ]},
      { label: " (LIRR)", segments: [
        ["street", "Street to mezzanine (LIRR Jamaica hub)", ["EL448X", "EL449X", "EL450X"]],
      ]},
    ],
  },
  {
    // 61 St-Woodside <-> LIRR Woodside: EL415X is the single ADA street
    // elevator to the shared mezzanine for both the 7 and the LIRR (the
    // mezzanine-to-LIRR elevators EL418X/EL419X are non-ADA and stay out of
    // chains by policy; LIRR's own Woodside platform elevators — including
    // its street-capable 449 — are tracked in the mta-lirr system).
    canonicalId: "456", name: "61 St-Woodside", covers: ["456"],
    chains: [
      { label: " (7)", segments: [
        ["street", "Street to mezzanine", ["EL415X"]],
        ["manhattan", "Mezzanine to Manhattan-bound 7", ["EL416X"]],
        ["flushing", "Mezzanine to Flushing-bound 7", ["EL417X"]],
      ]},
      { label: " (LIRR)", segments: [
        ["street", "Street to mezzanine (LIRR transfer)", ["EL415X"]],
      ]},
    ],
  },
  {
    // 59 St-Columbus Circle (614): a 6-elevator MESH the auto tier over-warned
    // (EL276X/EL280 logged as unplaced-backup). Hand-verified with Bryce
    // (2026-07-21): the complex is FULLY step-free interconnected, so the two
    // opposite-side street entrances back each other up — EL276X (8th Av/58 St,
    // south) reaches the downtown "lower mezzanine"; EL280 (Central Park West/
    // 60 St, north) reaches the uptown side; and EL278 is the cross-under linking
    // the lower mezzanine to the uptown A/B/C/D platform. Both downtown-platform
    // elevators (EL277, EL622) reach BOTH the downtown 1 and A/B/C/D platforms;
    // uptown A/B/C/D has a redundant pair (EL278 from the south, EL279 from the
    // north). EL279's feed note says "Withdrawn - Confirmed Duplicate" but it is
    // a REAL operating elevator (Bryce) — stale MTA bookkeeping (MTA_NOTE_JUNK).
    // Each leg with a cross-side backup is a "direct OR detour" encoded as CNF
    // paired segments (the Stamford/Jackson-Red pattern): so every SINGLE elevator
    // outage still leaves every platform reachable (matching MTA marking all 6
    // redundant), while a real double-outage that severs a leg still reads out.
    canonicalId: "614", name: "59 St-Columbus Circle", covers: ["614"],
    chains: [
      { label: " (1/A/B/C/D)",
        note: "Downtown 1 and A/B/C/D share step-free access. Normally: the 8th Av & 58 St elevator to the downtown mezzanine, then either downtown-platform elevator (both reach the 1 and the A/B/C/D platforms). If the 8th Av elevator is out, enter via the Central Park West & 60 St elevator and cross under to the downtown mezzanine — so the two street entrances back each other up.",
        segments: [
          // downtown mezzanine reachable via EL276X directly OR (EL280 AND EL278):
          // CNF -> (276X|280) AND (276X|278).
          ["dt-entry-a", "Street to downtown mezzanine (8th Av/58 St, or Central Park West/60 St as backup)", ["EL276X", "EL280"]],
          ["dt-entry-b", "Downtown mezzanine reached directly or via the cross-under from the north side", ["EL276X", "EL278"]],
          ["dt-platform", "Downtown mezzanine to the downtown 1 and A/B/C/D platforms", ["EL277", "EL622"]],
        ]},
      { label: " (A/B/C/D uptown)",
        note: "The uptown A/B/C/D platform is reached two ways that back each other up: from the 8th Av & 58 St entrance via the cross-under elevator, or from the Central Park West & 60 St entrance via the uptown-mezzanine elevator.",
        segments: [
          // UT-ABCD via (276X AND 278) OR (280 AND 279): CNF -> (276X|280)(276X|279)(278|280)(278|279).
          ["ua-a", "Uptown A/B/C/D — 8th Av entrance or Central Park West entrance", ["EL276X", "EL280"]],
          ["ua-b", "Uptown A/B/C/D — 8th Av entrance or uptown-mezzanine elevator", ["EL276X", "EL279"]],
          ["ua-c", "Uptown A/B/C/D — cross-under elevator or Central Park West entrance", ["EL278", "EL280"]],
          ["ua-d", "Uptown A/B/C/D — cross-under elevator or uptown-mezzanine elevator", ["EL278", "EL279"]],
        ]},
      { label: " (1 uptown)",
        note: "The uptown 1 platform is reached from the Central Park West & 60 St elevator. If it's out, the step-free backup is a longer path from the 8th Av & 58 St entrance via the cross-under and uptown-mezzanine elevators.",
        segments: [
          // UT-1 via EL280 OR (276X AND 278 AND 279): CNF -> (280|276X)(280|278)(280|279).
          ["u1-a", "Uptown 1 — Central Park West entrance, or 8th Av entrance via the detour", ["EL280", "EL276X"]],
          ["u1-b", "Uptown 1 — Central Park West entrance or the cross-under elevator", ["EL280", "EL278"]],
          ["u1-c", "Uptown 1 — Central Park West entrance or the uptown-mezzanine elevator", ["EL280", "EL279"]],
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
// UNIVERSAL (full-coverage) inference for the SIMPLE stations inferChains skips
// (single line-component). Structure comes from data.ny.gov's STRUCTURED fields
// (per-level access + direction), redundancy comes straight from MTA's flag
// (feed `redundant` == data.ny.gov `redundant_elevator`, verified 0 disagreements
// fleet-wide) — so a claimed backup is always MTA's own, never guessed. Segment =
// a redundant group (union-find over MTA's named/flagged backups); chain = one
// per platform-reaching segment, prefixed with the shared street→mezz prereqs.
// Anything that can't be classified is modeled CONSERVATIVELY (all-required,
// over-warn) and logged to generator-disagreements.json — never under-warns.
// ---------------------------------------------------------------------------

// data.ny.gov direction → normalized {key, word}. "Both"/blank = non-directional.
function normDir(nyDir, desc) {
  const d = (nyDir || "").toLowerCase();
  const t = (desc || "").toLowerCase();
  // MTA explicitly says the elevator serves BOTH directions → never assert a
  // single direction (don't parse a stray direction fragment out of the feed
  // description, e.g. "…transfer to 4/5 via Manhattan-bound 2/3"). Verified
  // 2026-07-21 by the direction-reconciliation workflow: these 5 were the only
  // "uncertain" cases and were all cosmetic-label artifacts, never under-warns.
  if (d === "both" || d === "northbound/southbound") return { key: "", word: "" };
  if (!d) {
    // MTA left direction blank — fall back to a direction word in the description.
    const m = t.match(/\b(uptown|downtown|manhattan-bound|brooklyn-bound|bronx-bound|queens-bound|[a-z. ]+-bound)\b/);
    if (m) return { key: m[1].replace(/\s+/g, "-"), word: m[1] };
    return { key: "", word: "" };
  }
  const word = d === "northbound" ? "northbound" : d === "southbound" ? "southbound" : d;
  return { key: d, word };
}

// Enrich a mapped feed elevator with data.ny.gov structure.
function nyStructure(e, nyByCode) {
  const ny = nyByCode.get(e.id) || {};
  return {
    ...e,
    mez: ny.elevator_mezzanine_1_access === "+" || ny.elevator_mezzanine_2_access === "+",
    plat: ny.elevator_platform_access === "+",
    dir: normDir(ny.elevator_direction_serviced, e.description),
    nyRedundant: ny.redundant_elevator === "+",
    backupId: ny.redundant_elevator_mezzanine && /^EL/.test(ny.redundant_elevator_mezzanine) ? ny.redundant_elevator_mezzanine : null,
  };
}

// Union-find redundant groups among elevators serving the SAME functional leg.
// Two elevators unite iff MTA names one as the other's backup, OR both are
// MTA-redundant AND share the same leg signature (level-role + overlapping lines).
function redundantGroups(els) {
  const parent = new Map(els.map((e) => [e.id, e.id]));
  const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));
  const union = (a, b) => { if (parent.has(a) && parent.has(b)) parent.set(find(a), find(b)); };
  const legSig = (e) => `${e.mez ? "m" : ""}${e.plat ? "p" : ""}`;
  for (const e of els) if (e.backupId) union(e.id, e.backupId);
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
    const a = els[i], b = els[j];
    if (a.nyRedundant && b.nyRedundant && legSig(a) === legSig(b) && overlaps(a.lineSet, b.lineSet)) union(a.id, b.id);
  }
  const groups = new Map();
  for (const e of els) (groups.get(find(e.id)) ?? groups.set(find(e.id), []).get(find(e.id))).push(e);
  return [...groups.values()];
}

// Build simple/per-direction chains for one line-component's ADA elevators.
function componentChains(comp, disagreements, complexId) {
  const groups = redundantGroups(comp);
  // classify groups by role
  const streetToMezz = groups.filter((g) => g.every((e) => e.mez && !e.plat)); // prereq legs
  const hasPrereq = streetToMezz.length > 0;
  const platformGroups = groups.filter((g) => g.some((e) => e.plat));
  if (!platformGroups.length) {
    // no platform elevator (mezz-only ADA access) — model what exists, flag it
    disagreements.push({ station: complexId, kind: "no-platform-elevator", elevators: comp.map((e) => e.id) });
    return [{ label: labelFor(comp), segments: groups.map(toSeg), lines: linesOf(comp) }];
  }
  const prereqSegs = streetToMezz.map(toSeg);
  const chains = [];
  for (const g of platformGroups) {
    // a platform group that ALSO touches mezz is a spoke (needs prereq) only when
    // the station has a dedicated street→mezz leg; otherwise it's a direct
    // single-shaft street→platform (no prereq).
    const isSpoke = hasPrereq && g.every((e) => e.mez);
    const segs = [...(isSpoke ? prereqSegs : (hasPrereq && !g.every((e) => e.mez) ? prereqSegs : [])), toSeg(g)];
    chains.push({ label: labelFor(g), segments: segs, lines: linesOf(g) });
  }
  return chains;
}

const linesOf = (els) => els.reduce((a, e) => { for (const x of e.lineSet) a.add(x); return a; }, new Set());
function labelFor(els) {
  const lines = fmtLines(linesOf(els));
  const dirs = [...new Set(els.map((e) => e.dir.word).filter(Boolean))];
  const dir = dirs.length === 1 ? " " + dirs[0] : "";
  return ` (${lines}${dir})`;
}
function toSeg(group) {
  // one segment = a redundant group (order-stable by id). Label from the feed desc.
  const els = [...group].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  return { id: slug(els[0].description) || "segment", label: els[0].description || "Elevator", elevators: els.map((e) => e.id) };
}

// When MTA marks an elevator "Both" we drop the direction label — but if that
// leaves two chains at one complex with an IDENTICAL label (same lines, both
// non-directional), the "Both" was imprecise and they actually serve different
// platforms. Disambiguate from the platform-segment description (a real direction
// word if present, else the segment id), so labels stay unique and meaningful.
function disambiguateLabels(chains) {
  const byLabel = new Map();
  for (const ch of chains) (byLabel.get(ch.label) ?? byLabel.set(ch.label, []).get(ch.label)).push(ch);
  const dirOf = (ch) => {
    const desc = (ch.segments[ch.segments.length - 1]?.label || "").toLowerCase();
    const m = desc.match(/\b(uptown|downtown|manhattan-bound|brooklyn-bound|bronx-bound|queens-bound|coney island-bound|northbound|southbound)\b/);
    return m ? m[1] : "";
  };
  for (const [label, group] of byLabel) {
    if (group.length < 2) continue;
    const dirs = group.map(dirOf);
    // Use real direction words only if they UNIQUELY distinguish every chain;
    // otherwise fall back to short lettered ordinals so labels stay clean + unique.
    const clean = dirs.every(Boolean) && new Set(dirs).size === dirs.length;
    group.forEach((ch, i) => {
      const suffix = clean ? dirs[i] : String.fromCharCode(65 + i); // A, B, C…
      ch.label = label.replace(/\)$/, ` ${suffix})`);
    });
  }
  return chains;
}

function inferDirectional(rawEls, nyByCode, disagreements, complexId) {
  const ada = rawEls.filter((e) => e.ada).map((e) => nyStructure(e, nyByCode));
  if (!ada.length) return null; // no ADA elevator → no step-free chain to model
  const comps = components(ada);
  const chains = disambiguateLabels(comps.flatMap((c) => componentChains(c, disagreements, complexId)));
  return chains.length ? chains : null;
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
  return chains.map((c) => {
    const segments = c.segments.map((s) => ({
      id: s.id,
      label: s.label,
      elevators: s.elevators.map((id) => ({ externalId: id, label: descById.get(id) ?? id })),
    }));
    return {
      systemId: SYSTEM_ID,
      stationExternalId: canonicalId,
      chainLabel: c.label,
      ...(covers.length > 1 ? { coveredStationExternalIds: covers } : {}),
      // PUBLIC note: hand-written where an override provides one (already
      // rider-focused after the note split), composed from the segments
      // otherwise. INTERNAL note: provenance — never shipped to the site.
      note: c.note ?? composePublicNote(segments),
      ...(c.internalNote ? { internalNote: c.internalNote } : {}),
      segments,
    };
  });
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

  // data.ny.gov structural ground truth (committed snapshot) — per-elevator level
  // access + direction + redundancy. Keyed by equipment_code (== our EL ids).
  const nyInv = JSON.parse(readFileSync(join(OUT_DIR, "ny-elevator-inventory.json"), "utf8")).elevators;
  const nyByCode = new Map(nyInv.map((e) => [e.equipment_code, e]));
  const disagreements = []; // generator-vs-MTA structural log (the engine-improvement worklist)

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

  // Auto stations (skip any that are hand-authored overrides). Multi-line-group
  // interchanges go through inferChains; every remaining elevator complex (the
  // simple/per-direction majority) goes through the universal inferDirectional,
  // structured from data.ny.gov. Redundancy in BOTH is MTA's own flag.
  for (const [id, els] of byStation) {
    if (overrideIds.has(id)) continue;
    const viaInterchange = inferChains(els);
    const chains = viaInterchange ?? inferDirectional(els, nyByCode, disagreements, id);
    if (!chains) continue; // no ADA elevator at this complex — no step-free chain
    for (const c of chains) {
      c.internalNote = viaInterchange
        ? "Generated by scripts/mta-chains.mjs from MTA's live elevator inventory (one chain per platform line-group; self-checked against MTA's own declared redundancy flags)."
        : "Generated by scripts/mta-chains.mjs — universal per-station inference from data.ny.gov structure (per-level access + direction) with redundancy read from MTA's own flag. Self-checked against MTA's declared redundancy.";
    }
    chainsByStation.set(id, chains);
    models.push(...toModel(id, nameOf.get(id), [id], chains, descById));
  }
  // Overrides.
  for (const o of OVERRIDES) {
    const chains = o.chains.map((c) => ({
      label: c.label,
      note: c.note,
      internalNote: c.internalNote ?? "Hand-authored interchange override (human-verified walk-through) — not auto-derived.",
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
    const isOverride = overrideIds.has(id);
    for (const el of seen) {
      const flag = flagsById.get(el);
      if (!flag) { warnings.push(`UNKNOWN-ID  ${id} ${el}: not in feed`); continue; }
      if (!flag.ada) warnings.push(`NON-ADA-IN  ${id} ${el}: non-ADA elevator appears in a chain`);
      const derived = derivedByEl.get(el);
      if (derived === flag.redundant || el in REDUNDANCY_EXCEPTIONS) continue;
      // Overrides are hand-verified — an undocumented mismatch is a real error.
      // Auto stations CONFORM to MTA by construction (redundancy is read from the
      // flag), so a residual mismatch is always the SAFE over-warn direction
      // (derived=sole where MTA=redundant: we couldn't place a backup) — log it as
      // the engine-improvement worklist, never fail the build (Bryce's directive).
      if (isOverride) {
        warnings.push(`REDUNDANCY  ${id} ${el}: derived redundant=${derived} but feed=${flag.redundant} (no exception)`);
      } else if (derived === false && flag.redundant === true) {
        disagreements.push({ station: id, elevator: el, kind: "over-warn-unplaced-backup", derived: "sole", mta: "redundant" });
      } else {
        // derived=redundant but MTA=sole would be an UNDER-warn — must never happen
        // for auto stations (we only group what MTA marks redundant); flag loudly.
        warnings.push(`UNDER-WARN  ${id} ${el}: derived redundant but MTA says sole — auto grouping bug`);
      }
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
    // Hand-authored interchanges (strict redundancy gate) vs the auto tier where a
    // residual over-warn (derived sole where MTA=redundant, backup unplaceable) is
    // an ALLOWED conservative fallback — the offline check applies the same policy.
    overrideStations: [...overrideIds],
    overWarnAllowed: disagreements.filter((d) => d.kind === "over-warn-unplaced-backup").map((d) => `${d.station}|${d.elevator}`),
    merges: MERGES,
  };
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "station-chains.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(`\nWrote src/catalog/mta-data/station-chains.json (${models.length} models).`);

  // The generator-vs-MTA disagreement worklist (Bryce's "model everything, still
  // improve the engine" artifact): stations modeled CONSERVATIVELY where the
  // structured data couldn't fully resolve the layout. Always the safe over-warn
  // direction; each entry is a candidate for a future engine/config sharpening.
  const disOut = {
    note: "Generated by scripts/mta-chains.mjs. Each entry is a station where the universal inference fell back to a conservative (over-warn) structure — the worklist for sharpening the engine, NOT a rider-facing under-warn. See CLAUDE.md.",
    count: disagreements.length,
    disagreements: disagreements.sort((a, b) => String(a.station).localeCompare(String(b.station))),
  };
  writeFileSync(join(OUT_DIR, "generator-disagreements.json"), JSON.stringify(disOut, null, 2) + "\n");
  console.log(`Wrote generator-disagreements.json (${disagreements.length} conservative-fallback entries).`);
}

main().catch((err) => { console.error("mta-chains failed:", err); process.exitCode = 1; });
