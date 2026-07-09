import "dotenv/config";
import { writeFileSync } from "node:fs";
import { getSupabase } from "../lib/supabase.js";
import { stationModelsFor } from "../catalog/station-models.js";
import { attributeOutageAcrossChains } from "../lib/accessibility.js";
import type { CuratedElevator, StationModel } from "../lib/accessibility.js";
import { attributionOverridesFor } from "../catalog/attribution-overrides.js";

// Mines BART's own advisory text — already archived verbatim in
// outage_events.reason every poll, no new capture needed — for evidence about
// how well the curated matchHints (bart-station-models.ts) actually attribute
// live advisories. This is the "progressive" half of the BART attribution
// work: rather than one-off hand queries (which is how Milpitas/Hayward/12th
// St. were confirmed), re-running this after more polls/outages absorbs more
// evidence automatically. See SPEC.md's BART "Attribution" section and
// CLAUDE.md for the full background on why this problem is structurally hard
// (BART's live feed carries no per-elevator id, only free text).
//
// IMPORTANT design choice: this does NOT trust the archived `unit_id` (what
// the adapter attributed AT INGEST TIME). It re-derives attribution fresh,
// running the CURRENT matchHints (bart-station-models.ts as it exists right
// now) against the archived raw `reason` text for every historical event.
// Trusting the stored unit_id would silently understate progress — e.g. 12th
// St.'s "convention center" hint was added 2026-07-08, but every archived
// 12TH event predates that, so its stored unit_id is still the OLD
// "unspecified" fallback even though today's hint would now resolve it. A
// fresh recompute against today's catalog is the only way to see "would this
// historical advisory be solved NOW" — the same question a human re-reading
// old text by hand is really asking. `reason` sometimes carries an
// adapter-added suffix like "(unspecified elevator — conservative)" from
// its ORIGINAL ingest — stripped before recompute so it doesn't contaminate
// matching (that suffix always contains the literal word "elevator").
//
// What this surfaces, all read-only (never auto-applies a fix):
//
// 1. CONFIRMED — a station-level advisory that resolves to exactly one
//    elevator under today's hints. Real evidence those hints work, same
//    evidentiary bar as the Milpitas/Hayward/12th St. examples in SPEC.md.
// 2. CHAIN-AMBIGUOUS — raw text at multi-chain (per-direction) stations that
//    matches zero or 2+ chains under today's hints — the main mining target.
//    Could be a genuinely bare "Station" advisory (unfixable) or real
//    direction text today's hints don't recognize (fixable) — a human
//    reading the raw text is what would confirm or correct an entry, never
//    auto-applied here.
// 3. SEGMENT-AMBIGUOUS — a segment identified but more than one elevator
//    within it matched (currently only possible at MLBR's shared segments).
// 4. GENERIC-HINT RISK — a confirmed match whose ONLY matching hint is a
//    single generic word (e.g. "elevator") AND whose text also contains a
//    location word (tunnel, bridge, garage, connector, parking, arena,
//    plaza) that ISN'T among that elevator's own hints. BART's advisory text
//    always contains the phrase "N elevators out:", so a bare "elevator"
//    hint at a single-elevator-modeled station matches EVERY advisory for
//    that station — including ones really about a different, unmodeled
//    auxiliary elevator there (confirmed live example, 2026-07-08: Bryce
//    reports Coliseum's advisory can read "Station - Tunnel", about the
//    pedestrian-bridge/tunnel elevator to the arena, not the main COLS-EL
//    station elevator that "elevator" would wrongly claim). Surfaced for
//    human review, not auto-fixed — fixing this means modeling the auxiliary
//    elevator as its own tracked unit, a real change to redundancy curation
//    (a separate, DONE piece of work per CLAUDE.md) that needs Bryce's
//    steer, not a silent matchHints edit.
// 5. structuralUnsolvable — single-chain/unmodeled-station advisories that
//    resolve to nothing under today's hints either. Flagged with a note when
//    a manual attribution-overrides.ts entry exists for that station (a
//    human already worked around this specific case).
//
// Usage: npm run bart:attribution-evidence (re-run periodically as the
// archive grows).

const db = getSupabase();
if (!db) {
  console.error("No SUPABASE_* env configured — fill in .env first.");
  process.exit(1);
}

const SYSTEM_ID = "bart-bay-area";

const PAGE_SIZE = 1000;
async function fetchAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${label}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

interface UnitRow { id: string; external_id: string }
interface EventRow { unit_id: string; reason: string | null; started_at: string; source_started_at: string | null }

const [units, events] = await Promise.all([
  fetchAll<UnitRow>(
    (from, to) => db.from("units").select("id, external_id").eq("system_id", SYSTEM_ID).range(from, to),
    "units",
  ),
  fetchAll<EventRow>(
    (from, to) =>
      db.from("outage_events").select("unit_id, reason, started_at, source_started_at").eq("system_id", SYSTEM_ID).range(from, to),
    "outage_events",
  ),
]);

const externalIdByUnitId = new Map(units.map((u) => [u.id, u.external_id]));
const modelsByStation = stationModelsFor(SYSTEM_ID);

// A station's own BART abbreviation is always exactly 4 characters, and
// every adapter-constructed externalId (`${abbr}`, `${abbr}-...`) keeps that
// prefix verbatim — verified against every abbr currently in the catalog.
function stationAbbrOf(externalId: string): string {
  return externalId.slice(0, 4);
}

// Adapter-added suffixes describing an already-ambiguous outcome (added at
// ORIGINAL ingest time) always contain the literal word "elevator" and would
// contaminate a fresh recompute — strip them back to the underlying text.
const ADAPTER_SUFFIX_RE = /\s*\([^)]*—\s*(?:ambiguous, )?conservative\)\s*$/i;
function cleanReason(raw: string): string {
  return raw.replace(ADAPTER_SUFFIX_RE, "").trim();
}

// Which stations have an active manual override (attribution-overrides.ts) —
// annotated onto structuralUnsolvable entries as useful context, not treated
// as attribution evidence itself (a human bypassed the hints entirely).
const overridesByStation = new Map<string, string[]>();
for (const o of attributionOverridesFor(SYSTEM_ID).values()) {
  const abbr = stationAbbrOf(o.fromUnitExternalId);
  const list = overridesByStation.get(abbr) ?? [];
  list.push(o.note);
  overridesByStation.set(abbr, list);
}

const GENERIC_HINTS = new Set(["elevator", "platform", "street"]);
const AUX_LOCATION_WORDS = ["tunnel", "bridge", "garage", "connector", "parking", "arena", "plaza"];

interface Occurrence {
  since: string;
  reason: string;
}

interface ConfirmedEvidence {
  station: string;
  chainLabel?: string;
  label: string;
  occurrences: number;
  sampleReasons: string[];
  since: string; // earliest seen
  genericHintRisk?: { hint: string; suspectWords: string[]; note: string };
}

interface AmbiguousEvidence {
  station: string;
  chainCount: number;
  occurrences: number;
  samples: Occurrence[]; // capped
}

interface StructuralEntry {
  occurrences: number;
  samples: Occurrence[];
  manualOverrideNotes?: string[];
  // True when this station's model has exactly one segment and one elevator
  // AND its own curated note doesn't mention other, unmodeled auxiliary
  // elevators at the same physical station (see COLS: "auxiliary elevators
  // for the Oakland Airport Connector... not modeled here" — a real
  // competing candidate the advisory could actually mean, so COLS must NOT
  // be flagged pure here even though its MODEL happens to have one segment).
  // A genuinely pure-SPOF station landing here means its matchHints never
  // matched the text even though the advisory is logically unambiguous by
  // construction (there's no OTHER elevator it could mean) — worth a look,
  // but still not a safe BLANKET "always attribute every single-chain
  // station" fix, since that would misfire at stations like COLS.
  pureSpof?: { elevatorExternalId: string };
}

const confirmed = new Map<string, ConfirmedEvidence>(); // keyed by elevatorExternalId
const chainAmbiguous = new Map<string, AmbiguousEvidence>(); // keyed by station abbr, multi-chain only
const segmentAmbiguous = new Map<string, AmbiguousEvidence>(); // keyed by `${abbr}:${segmentId}`
const structuralUnsolvable = new Map<string, StructuralEntry>(); // keyed by station abbr
const unmodeledStations = new Map<string, number>(); // station has no curated model at all yet
let skippedNoReason = 0;
let skippedUnknownUnit = 0;

const SAMPLE_CAP = 5;

function pushSample(list: Occurrence[], occ: Occurrence): void {
  if (list.length < SAMPLE_CAP && !list.some((s) => s.reason === occ.reason)) list.push(occ);
}

for (const e of events) {
  if (!e.reason) { skippedNoReason++; continue; }
  const externalId = externalIdByUnitId.get(e.unit_id);
  if (!externalId) { skippedUnknownUnit++; continue; }
  const since = e.source_started_at ?? e.started_at;
  const abbr = stationAbbrOf(externalId);
  const cleaned = cleanReason(e.reason);

  const models = modelsByStation.get(abbr) ?? [];
  if (models.length === 0) {
    unmodeledStations.set(abbr, (unmodeledStations.get(abbr) ?? 0) + 1);
    continue;
  }

  const attr = attributeOutageAcrossChains(cleaned, models);

  if (attr?.elevatorExternalId) {
    const elevator = attr.model.segments.flatMap((s) => s.elevators).find((el) => el.externalId === attr.elevatorExternalId) as CuratedElevator | undefined;
    const ev: ConfirmedEvidence = confirmed.get(attr.elevatorExternalId) ?? {
      station: attr.model.stationExternalId,
      chainLabel: attr.model.chainLabel,
      label: elevator?.label ?? attr.elevatorExternalId,
      occurrences: 0,
      sampleReasons: [],
      since,
    };
    ev.occurrences++;
    if (since < ev.since) ev.since = since;
    if (ev.sampleReasons.length < SAMPLE_CAP && !ev.sampleReasons.includes(cleaned)) ev.sampleReasons.push(cleaned);

    const hints = elevator?.matchHints ?? [];
    const d = cleaned.toLowerCase();
    const matchedGenericHints = hints.filter((h) => GENERIC_HINTS.has(h) && d.includes(h));
    if (matchedGenericHints.length > 0 && hints.length === matchedGenericHints.length) {
      const suspectWords = AUX_LOCATION_WORDS.filter((w) => d.includes(w) && !hints.includes(w));
      if (suspectWords.length > 0) {
        ev.genericHintRisk = {
          hint: matchedGenericHints.join(", "),
          suspectWords,
          note:
            `Only a generic hint ("${matchedGenericHints.join(", ")}") matched, but the reason text also contains ` +
            `${suspectWords.map((w) => `"${w}"`).join(", ")} — a word not among this elevator's own hints. BART's ` +
            `advisory text always contains "elevators out:", so a bare "elevator" hint matches every advisory at ` +
            `this station, including ones about a different, unmodeled elevator there. Review before trusting.`,
        };
      }
    }
    confirmed.set(attr.elevatorExternalId, ev);
    continue;
  }

  if (attr) {
    // Segment identified but more than one elevator within it matched.
    const key = `${abbr}:${attr.segmentId}`;
    const ev: AmbiguousEvidence = segmentAmbiguous.get(key) ?? { station: abbr, chainCount: 1, occurrences: 0, samples: [] };
    ev.occurrences++;
    pushSample(ev.samples, { since, reason: cleaned });
    segmentAmbiguous.set(key, ev);
    continue;
  }

  // Zero or 2+ chains matched at all — nothing to guess from.
  if (models.length > 1) {
    const ev: AmbiguousEvidence = chainAmbiguous.get(abbr) ?? { station: abbr, chainCount: models.length, occurrences: 0, samples: [] };
    ev.occurrences++;
    pushSample(ev.samples, { since, reason: cleaned });
    chainAmbiguous.set(abbr, ev);
  } else {
    const ev: StructuralEntry = structuralUnsolvable.get(abbr) ?? { occurrences: 0, samples: [] };
    ev.occurrences++;
    pushSample(ev.samples, { since, reason: cleaned });
    if (overridesByStation.has(abbr)) ev.manualOverrideNotes = overridesByStation.get(abbr);
    const onlyModel = models[0]!;
    const hasKnownAuxiliaryElevators = /auxiliar|not modeled/i.test(onlyModel.note ?? "");
    if (onlyModel.segments.length === 1 && onlyModel.segments[0]!.elevators.length === 1 && !hasKnownAuxiliaryElevators) {
      ev.pureSpof = { elevatorExternalId: onlyModel.segments[0]!.elevators[0]!.externalId };
    }
    structuralUnsolvable.set(abbr, ev);
  }
}

const genericHintRiskCount = [...confirmed.values()].filter((c) => c.genericHintRisk).length;
const structuralEventTotal = [...structuralUnsolvable.values()].reduce((sum, e) => sum + e.occurrences, 0);

console.log(`Processed ${events.length} BART outage events (${skippedNoReason} with no reason text, ${skippedUnknownUnit} with an unknown unit).`);
console.log(`Confirmed specific-elevator matches (recomputed against TODAY's hints) for ${confirmed.size} distinct elevators.`);
console.log(`  ${genericHintRiskCount} of those carry a GENERIC-HINT RISK flag — review before trusting.`);
console.log(`Chain-ambiguous evidence at ${chainAmbiguous.size} multi-chain (per-direction) station(s) — the main mining target.`);
console.log(`Segment-ambiguous evidence at ${segmentAmbiguous.size} multi-elevator segment(s).`);
console.log(`Structurally unsolvable even under today's hints: ${structuralEventTotal} event(s) across ${structuralUnsolvable.size} station(s).`);
console.log(`Unmodeled stations seen in the archive: ${unmodeledStations.size}.`);

writeFileSync(
  new URL("../catalog/bart-data/attribution-evidence.json", import.meta.url),
  JSON.stringify(
    {
      note:
        "Generated by src/site/bart-attribution-evidence.ts from the archived outage_events.reason text for " +
        "bart-bay-area (the poller already captures this verbatim every 10 minutes — no new capture mechanism " +
        "needed). Re-run periodically (npm run bart:attribution-evidence) to absorb more outage history as it " +
        "accrues. Attribution is RECOMPUTED fresh from raw reason text against TODAY's bart-station-models.ts " +
        "matchHints for every event — NOT read from the archived unit_id, which reflects whatever hints existed " +
        "at ORIGINAL ingest time and would understate progress after a hint is added or corrected. " +
        "confirmed[*] are elevators a live advisory DOES resolve to under today's hints — real evidence they " +
        "work, same evidentiary bar as the Milpitas/Hayward/12th St. examples in SPEC.md. A confirmed[*] entry " +
        "with genericHintRisk set is NOT necessarily wrong, but its only matching hint is a generic word that " +
        "would match ANY advisory at that station — worth a human look before trusting it, especially at " +
        "stations with unmodeled auxiliary elevators (see Coliseum/COLS-EL). chainAmbiguous[*] is raw advisory " +
        "text at multi-chain (per-direction) stations that matches zero or 2+ chains — the tool never guesses " +
        "which one; a human reviewing this text is what would confirm or correct a matchHints entry, same " +
        "process that confirmed Milpitas's regional-shorthand hint. segmentAmbiguous[*] is the rarer case of a " +
        "multi-elevator segment where more than one elevator's hint matches. structuralUnsolvable[*] is raw text " +
        "at single-chain/unmodeled stations that resolves to nothing even under today's hints — includes a " +
        "manualOverrideNotes field when a human has already worked around that specific station via " +
        "attribution-overrides.ts, and a pureSpof field when the station's model has exactly one segment/elevator " +
        "AND its own curated note doesn't mention other unmodeled auxiliary elevators there (excludes COLS, whose " +
        "note names real unmodeled auxiliary elevators a bare advisory could actually mean instead). A pureSpof " +
        "entry means the advisory is logically unambiguous (no OTHER elevator it could mean) but its matchHints " +
        "still didn't match the raw text — evidence worth a look, NOT a safe blanket 'always attribute every " +
        "single-chain station' fix (that would misfire at stations like COLS). unmodeledStations tallies events " +
        "at stations with no curated model at all.",
      generatedAt: new Date().toISOString(),
      confirmed: Object.fromEntries(confirmed),
      chainAmbiguous: Object.fromEntries(chainAmbiguous),
      segmentAmbiguous: Object.fromEntries(segmentAmbiguous),
      structuralUnsolvable: Object.fromEntries(structuralUnsolvable),
      unmodeledStations: Object.fromEntries(unmodeledStations),
    },
    null,
    2,
  ) + "\n",
);
console.log("\nWrote src/catalog/bart-data/attribution-evidence.json");
