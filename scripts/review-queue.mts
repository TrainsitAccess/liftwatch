// Station-review queue — the single work list for the human verification
// walkthrough ("one station at a time"). Assembles EVERY excluded/unresolved
// station across all systems into src/catalog/review/queue.json, with all
// committed evidence attached (feed texts, agency guidance, research facts,
// GTFS topology, exclusion reasons) so a review session can present a complete
// dossier from one file read.
//
// MERGE-SAFE: re-running refreshes evidence and adds newly-excluded stations
// but NEVER touches an existing entry's status/resolution/priority — verdicts
// are durable. Progress: `npm run review:status` (same script, --status).
//
// Priorities (lower = sooner) seed from the per-system research (CTA dossier
// order, Aquarium-first for MBTA, WMATA undercounts before side-platforms);
// hand-edit `priority` in queue.json to reorder — the merge preserves it.
//
// BART is deliberately NOT here: its open item is matchHint confirmation, a
// different review type with its own command (/liftwatch-bart-attribution).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const statusOnly = process.argv.includes("--status");
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(`${root}/${p}`, "utf8"));
const outPath = `${root}/src/catalog/review/queue.json`;

interface Evidence { source: string; text: string }
interface Entry {
  key: string;
  system: string;
  stationId: string;
  name: string;
  status: "pending" | "in-review" | "modeled" | "excluded-confirmed" | "deferred";
  priority: number;
  reason: string;
  evidence: Evidence[];
  resolution?: { verdict: string; notes: string; date: string; commit?: string };
}

const entries = new Map<string, Entry>();
const add = (e: Entry) => entries.set(e.key, e);

// ---------- WMATA ----------
{
  const excluded = read("src/catalog/wmata-data/chains-excluded.json").stations as {
    station: string; name: string; reason: string; detail: string; levels: string[];
  }[];
  const roster = read("src/catalog/wmata-data/units.json").units as {
    externalId: string; station: string; description: string; levelFrom: string; levelTo: string;
  }[];
  const observed = read("src/catalog/wmata-data/observed-units.json").units as {
    unitName: string; stationCode: string; location: string;
  }[];
  // Hand-modeled outside the queue — excluded from the generator but curated in
  // wmata-models.ts, so they must not resurface as pending. A14: Rockville
  // (hand-modeled from the start). The 8 grade-separated stations: audited
  // 2026-07-17, moved out of the auto tier and curated per-entrance because
  // their GTFS street→mezzanine redundancy was false (see COVERAGE-AUDIT.md).
  // A08 Friendship Heights: spot-checked 2026-07-17, separate mezzanines +
  // a 4-elevator Jenifer St. street bank GTFS drew as 1 — curated CNF (see
  // spot-check-log.md). C13/D01/N06/N10/N11: 2026-07-17 auto-tier audit
  // (page-inventory-undercount) — WMATA's Rider Tools inventory showed more
  // elevators than GTFS drew; curated with real page ids.
  // F06 Anacostia: 2026-07-17 audit (step-free-detour-redundant) — separate
  // at-grade mezzanines, redundant via a disclosed ~0.3 mi step-free walk.
  // B10 Wheaton: 2026-07-17 audit (mezzanine-at-grade) — at-grade mezzanine via
  // a ramp; GTFS drew a phantom street elevator; only B10X01 gates.
  // B11 Glenmont: 2026-07-17 audit (surface-crossing-redundant) — two street
  // elevators flank Georgia Ave, crossable at grade; Bryce confirmed redundant.
  const CURATED = new Set(["A14", "A08", "B10", "B11", "C13", "D01", "F06", "N06", "N10", "N11", "N01", "N02", "N03", "N04", "N07", "N08", "N12", "E09"]);
  const prio: Record<string, number> = {
    "observed-undercount": 20, "observed-unmappable": 22, "side-platforms": 30,
    "multi-level-shaft": 38, "non-standard-levels": 40, "unorderable-levels": 44, "corrupt-levels": 46,
  };
  for (const s of excluded) {
    if (CURATED.has(s.station)) continue;
    const ev: Evidence[] = [
      { source: "exclusion gate", text: `${s.reason}: ${s.detail} (levels: ${s.levels.join(", ")})` },
      ...roster.filter((u) => u.station === s.station).map((u) => ({
        source: "GTFS roster", text: `${u.externalId}: ${u.description}`,
      })),
      ...observed.filter((o) => {
        const code = s.station.split("_");
        return code.includes(o.stationCode) || o.stationCode === s.station;
      }).map((o) => ({ source: "live feed (observed)", text: `${o.unitName}: "${o.location}"` })),
    ];
    add({ key: `wmata:${s.station}`, system: "wmata-dc", stationId: s.station, name: s.name,
      status: "pending", priority: prio[s.reason] ?? 42, reason: s.reason, evidence: ev });
  }
}

// ---------- CTA ----------
{
  const observed = read("src/catalog/cta-data/observed-units.json").units as {
    unitId: string; stationId: string; texts: string[];
  }[];
  let research = "";
  try { research = readFileSync(`${root}/src/catalog/cta-data/STATION-RESEARCH.md`, "utf8"); } catch { /* optional */ }
  const stations = new Map<string, { name: string; texts: string[]; unitIds: string[] }>();
  for (const u of observed) {
    const st = stations.get(u.stationId) ?? { name: u.stationId, texts: [], unitIds: [] };
    st.unitIds.push(u.unitId === u.stationId ? "(vague/station-level)" : u.unitId);
    st.texts.push(...u.texts);
    stations.set(u.stationId, st);
  }
  // dossier verification order (see STATION-RESEARCH.md tail)
  const order: Record<string, number> = {
    "41690": 10, // Cermak — likely CTA's only clean redundant pair
    "40530": 12, "41440": 12, "41500": 12, "41480": 12, "40710": 12, // Brown batch
    "40330": 14, "40070": 14, "40560": 14, "41400": 14, // subway series-chains
    "41270": 16, "40170": 16, "41670": 16, "41360": 16, // transfer-bridge quartet
    "41140": 18, "40720": 18, // exit-only rotogates (policy call)
  };
  for (const [id, st] of stations) {
    const nameMatch = st.texts.map((t) => / at ([A-Za-z0-9/'.\- ]+?) \(/.exec(t)?.[1]).find(Boolean);
    // dossier bullet for this station (single paragraph starting "- **<id> ")
    const bullet = research.split(/\n(?=- \*\*)/).find((b) => b.startsWith(`- **${id} `));
    const ev: Evidence[] = [
      ...st.texts.slice(0, 8).map((t) => ({ source: "live feed (alert text)", text: t })),
      ...(bullet ? [{ source: "chicago-L.org research (STATION-RESEARCH.md)", text: bullet.replace(/\s+/g, " ").trim() }] : []),
    ];
    add({ key: `cta:${id}`, system: "cta-chicago", stationId: id, name: nameMatch ?? st.name,
      status: "pending", priority: order[id] ?? 50, reason: "no chains modeled (no agency inventory — text-identity only)",
      evidence: ev });
  }
}

// ---------- MBTA ----------
{
  const excluded = read("src/catalog/mbta-data/chains-excluded.json").stations as {
    stopId: string; name: string; reason: string; detail: string;
    units: { id: string; longName: string; altText?: string }[];
  }[];
  // Machine-derived proposals from the GTFS pathways generator (2026-07-14) —
  // gate-validated but deliberately unshipped: they are the reviewer's BEST
  // GUESS, and go live only on Bryce's per-station verdict.
  let pathwayProposals = new Map<string, string>();
  let pathwayExcluded = new Map<string, string>();
  try {
    const pc = read("src/catalog/mbta-data/pathway-chains.json") as { models: { stationExternalId: string; chainLabel?: string; segments: { elevators: { externalId: string }[] }[] }[] };
    for (const m of pc.models) {
      const line = `${(m.chainLabel ?? "").trim() || "(single chain)"}: ${m.segments.map((s) => s.elevators.map((e) => e.externalId).join("∨")).join("  AND  ")}`;
      pathwayProposals.set(m.stationExternalId, [pathwayProposals.get(m.stationExternalId), line].filter(Boolean).join("\n"));
    }
    const px = read("src/catalog/mbta-data/pathway-chains-excluded.json") as { stations: { stationId: string; reason: string; detail: string }[] };
    for (const s of px.stations) pathwayExcluded.set(s.stationId, `${s.reason}: ${s.detail}`);
  } catch { /* generator not run yet */ }
  const prio: Record<string, number> = { "place-aqucl": 5, "place-pktrm": 8, "place-sstat": 24, "place-north": 24, "place-state": 24, "place-haecl": 24, "place-astao": 26, "place-lech": 26, "place-wlsta": 26, "place-harsq": 28, "place-welln": 28 };
  for (const s of excluded) {
    const ev: Evidence[] = [
      { source: "exclusion gate", text: `${s.reason}: ${s.detail}` },
      ...s.units.flatMap((u) => [
        { source: "MBTA facility (longName)", text: `${u.id}: ${u.longName}` },
        ...(u.altText ? [{ source: "MBTA alternate-service guidance", text: `${u.id}: ${u.altText}` }] : []),
      ]),
    ];
    if (s.stopId === "place-aqucl") ev.push({
      source: "prior session (2026-07-13, topology decoded — see memory/curation todo)",
      text: "Structure decoded from MBTA guidance: 2 side platforms × 2 lobbies. State St side: 915 street↔lobby, 913 lobby↔Wonderland plat, 914 lobby↔Bowdoin plat. Atlantic side: 925 lobby↔Long Wharf, 924 lobby↔Wonderland, 923 lobby↔Bowdoin. FIELD QUESTION (was blocking): is the Atlantic Ave lobby at street grade, or does street entry require 925? Reading A (925 required, conservative): per direction CNF (915∨925)∧(915∨92x)∧(914/913∨925)∧(914/913∨92x). Reading B: 923/924 alone are complete backup paths.",
    }, {
      source: "MBTA GTFS pathways.txt (2026-07-14 audit — agency's own topology, facility ids match the live API)",
      text: "READING A SUPPORTED BY MBTA'S OWN DATA: pathway aqucl-000/001 connects node-925-lobby ↔ door-aqucl-atlanticelev (the Atlantic/Waterfront street door) as a mode-5 ELEVATOR pathway (facility 925); the only parallel street↔lobby verticals on that side are escalators (facilities 405/406) and stairs — no ramp found. Confirm with a full step-free graph trace at review time, but the field trip is likely unnecessary.",
    });
    if (pathwayProposals.has(s.stopId)) ev.push({
      source: "GTFS-pathways generator PROPOSAL (gate-validated best guess — approve/adjust to ship)",
      text: `Segments are minimal cuts (AND of ORs), round-trip-verified against the agency's own walking graph, answer-key-validated:\n${pathwayProposals.get(s.stopId)!}`,
    });
    if (pathwayExcluded.has(s.stopId)) ev.push({
      source: "GTFS-pathways generator (refused to model)",
      text: pathwayExcluded.get(s.stopId)!,
    });
    add({ key: `mbta:${s.stopId}`, system: "mbta-boston", stationId: s.stopId, name: s.name,
      // pathway-proposal stations review FAST (best guess ready) — bump them up
      status: "pending", priority: pathwayProposals.has(s.stopId) ? Math.min(prio[s.stopId] ?? 34, 15) : (prio[s.stopId] ?? 34), reason: s.reason, evidence: ev });
  }
}

// ---------- LIRR / Metro-North ----------
{
  const excluded = read("src/catalog/mta-rail-data/chains-excluded.json").stations as {
    code: string; name: string; railroad: string; reason: string; detail: string;
    units: { unitId: string; location: string }[];
  }[];
  for (const s of excluded) {
    add({
      key: `rail:${s.code}`, system: s.railroad === "LIRR" ? "mta-lirr" : "mta-mnr",
      stationId: s.code, name: s.name, status: "pending", priority: 32, reason: s.reason,
      evidence: [
        { source: "exclusion gate", text: `${s.reason}: ${s.detail}` },
        ...s.units.map((u) => ({ source: "eestatus location text", text: `${u.unitId}: ${u.location}` })),
      ],
    });
  }
  // GCT North End — not in the excluded file (0NY is partially hand-modeled);
  // the un-modeled passage units are a standing walkthrough item.
  add({
    key: "rail:0NY-north-end", system: "mta-mnr", stationId: "0NY", name: "Grand Central — North End passages",
    status: "pending", priority: 28, reason: "NE-1/2/3/5/6 tracked but not modeled — passage topology unverified",
    evidence: [{
      source: "curated model internalNote (mta-rail-models.ts)",
      text: "NE-4 (45th St cross passage → Tk 116 / Tks 34-35) is hand-modeled, sole access, out since March 2023. The other North End units (NE-1/2/3/5/6) are tracked but not yet modeled — passage topology unverified. Live flags seen on 0NY-NE-2 and 0NY-NE-3.",
    }],
  });
}

// ---------- TfL ----------
{
  const x = read("src/catalog/tfl-data/chains-excluded.json") as {
    excluded: { station: string; stationId: string; lifts: string[]; reason: string; evidenceHints?: { liftId: string; phrase: string; message?: string }[] }[];
  };
  for (const s of x.excluded) {
    add({
      key: `tfl:${s.stationId}`, system: "tfl-london", stationId: s.stationId, name: s.station,
      status: "pending", priority: s.evidenceHints?.length ? 70 : 80, reason: s.reason,
      evidence: [
        { source: "exclusion gate", text: `${s.reason}; lifts: ${s.lifts.join(", ")}` },
        ...(s.evidenceHints ?? []).map((h) => ({ source: "TfL alert evidence (hint)", text: `${h.liftId}: "${h.phrase}"${h.message ? ` — from alert: ${h.message.slice(0, 200)}` : ""}` })),
      ],
    });
  }
}

// ---------- merge with existing (verdicts + priorities are durable) ----------
if (existsSync(outPath)) {
  const prev = read("src/catalog/review/queue.json") as { stations: Entry[] };
  for (const old of prev.stations) {
    const cur = entries.get(old.key);
    if (!cur) {
      // Gone from the source files. A PENDING entry that vanished was
      // auto-resolved by better data (e.g. TfL's step-free paths freed it) —
      // drop it, no human needed. Anything with human history stays.
      if (old.status !== "pending") entries.set(old.key, old);
      continue;
    }
    cur.status = old.status;
    cur.priority = old.priority;
    if (old.resolution) cur.resolution = old.resolution;
    // Evidence added by hand during review (Bryce's confirmations, elevator
    // locations, agency quotes pasted in chat) lives ONLY in queue.json —
    // regenerating from source files would silently discard it (this
    // actually happened 2026-07-16: every "Bryce (…)" entry since Mt Vernon
    // Sq was wiped by routine rebuilds and had to be restored from the chat
    // log). Carry forward any prior entry the regenerated list doesn't
    // already contain, exact source+text match. Grows-only, same philosophy
    // as observed-units.json.
    const have = new Set(cur.evidence.map((e) => `${e.source} ${e.text}`));
    for (const e of old.evidence) {
      if (!have.has(`${e.source} ${e.text}`)) cur.evidence.push(e);
    }
  }
}

const stations = [...entries.values()].sort((a, b) => a.priority - b.priority || a.key.localeCompare(b.key));

// ---------- progress ----------
const bySystem = new Map<string, Entry[]>();
for (const e of stations) (bySystem.get(e.system) ?? bySystem.set(e.system, []).get(e.system)!).push(e);
const done = (l: Entry[]) => l.filter((e) => e.status === "modeled" || e.status === "excluded-confirmed").length;
console.log("\n  Station-review progress");
console.log("  system            done / total   (pending, deferred)");
let td = 0, tt = 0;
for (const [sys, l] of [...bySystem.entries()].sort()) {
  const d = done(l);
  td += d; tt += l.length;
  console.log(`  ${sys.padEnd(16)} ${String(d).padStart(4)} / ${String(l.length).padEnd(6)} (${l.filter((e) => e.status === "pending").length} pending, ${l.filter((e) => e.status === "deferred").length} deferred)`);
}
console.log(`  ${"TOTAL".padEnd(16)} ${String(td).padStart(4)} / ${tt}   ${(100 * td / Math.max(1, tt)).toFixed(1)}%`);
const next = stations.find((e) => e.status === "pending");
if (next) console.log(`\n  next up: ${next.key}  ${next.name}  (priority ${next.priority}, ${next.reason})`);

if (!statusOnly) {
  mkdirSync(`${root}/src/catalog/review`, { recursive: true });
  writeFileSync(outPath, JSON.stringify({
    updatedAt: new Date().toISOString(),
    note: "Human station-review queue (one station at a time — /liftwatch-station-review). Rebuild with `npm run review:queue` (verdicts/priorities survive); progress via `npm run review:status`. Statuses: pending → modeled | excluded-confirmed | deferred.",
    stations,
  }, null, 1) + "\n");
  console.log(`\n  wrote src/catalog/review/queue.json (${stations.length} stations)`);
}
