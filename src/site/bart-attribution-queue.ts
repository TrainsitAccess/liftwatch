import "dotenv/config";
import { getSupabase } from "../lib/supabase.js";
import { stationModelsFor } from "../catalog/station-models.js";
import { attributeOutageAcrossChains } from "../lib/accessibility.js";
import { attributionOverridesFor } from "../catalog/attribution-overrides.js";

// A repeatable version of what happened by hand for Richmond (2026-07-08):
// Bryce called/checked BART directly and confirmed which specific elevator a
// bare "Station" advisory meant, then that confirmation was hand-recorded in
// attribution-overrides.ts. This script generalizes "unspecified -> ask a
// human -> attributed" into a queue instead of a one-off — it does NOT guess,
// does NOT auto-write anything (no DB writes, no source edits); it only lists
// CURRENTLY OPEN outages that are genuinely ambiguous under today's matchHints
// and shows the candidate elevators a human would need to check between, so
// confirming one is fast (BART's app, calling the station, or riding it).
//
// Deliberately scoped OUT: single-elevator "pureSpof" stations (see
// SPEC.md/bart-attribution-evidence.ts) aren't listed here — those are
// logically unambiguous already (no OTHER elevator it could mean), so asking
// a human to confirm one would be a wasted call. That's a separate, narrower
// fix (auto-attribute them) Bryce chose NOT to pursue this round.
//
// Workflow: run this, read the candidates, confirm the real elevator any way
// you like (BART's app, a phone call, riding it), then tell Claude which one
// — recording it is a hand-edit to attribution-overrides.ts (mirrors how
// Richmond was done), not an auto-write, so a human's real-world confirmation
// is always the thing that goes in, never a guess.
//
// Usage: npm run bart:attribution-queue (run any time; only shows what's
// CURRENTLY open, so re-running after outages resolve naturally shrinks it).

const db = getSupabase();
if (!db) {
  console.error("No SUPABASE_* env configured — fill in .env first.");
  process.exit(1);
}

const SYSTEM_ID = "bart-bay-area";

interface UnitRow { id: string; external_id: string; station_id: string | null }
interface StationRow { id: string; name: string }
interface EventRow { unit_id: string; reason: string | null; started_at: string; source_started_at: string | null }

const [{ data: units, error: unitsErr }, { data: stations, error: stationsErr }, { data: events, error: eventsErr }] = await Promise.all([
  db.from("units").select("id, external_id, station_id").eq("system_id", SYSTEM_ID),
  db.from("stations").select("id, name").eq("system_id", SYSTEM_ID),
  db.from("outage_events").select("unit_id, reason, started_at, source_started_at").eq("system_id", SYSTEM_ID).is("ended_at", null),
]);
if (unitsErr) throw new Error(`units: ${unitsErr.message}`);
if (stationsErr) throw new Error(`stations: ${stationsErr.message}`);
if (eventsErr) throw new Error(`outage_events: ${eventsErr.message}`);

const externalIdByUnitId = new Map((units ?? []).map((u) => [u.id, u.external_id]));
const stationIdByUnitId = new Map((units ?? []).map((u) => [u.id, u.station_id]));
const stationNameById = new Map((stations ?? []).map((s: StationRow) => [s.id, s.name]));
const modelsByStation = stationModelsFor(SYSTEM_ID);

function stationAbbrOf(externalId: string): string {
  return externalId.slice(0, 4);
}

const ADAPTER_SUFFIX_RE = /\s*\([^)]*—\s*(?:ambiguous, )?conservative\)\s*$/i;
function cleanReason(raw: string): string {
  return raw.replace(ADAPTER_SUFFIX_RE, "").trim();
}

const overridesByStation = new Map<string, string>();
for (const o of attributionOverridesFor(SYSTEM_ID).values()) {
  overridesByStation.set(stationAbbrOf(o.fromUnitExternalId), o.toUnitExternalId);
}

interface QueueItem {
  abbr: string;
  stationName: string;
  reason: string;
  since: string;
  candidates: { externalId: string; label: string; chainLabel?: string }[];
  unmodeled: boolean;
}

const items: QueueItem[] = [];
let skippedNoReason = 0;
let skippedUnknownUnit = 0;
let skippedAttributed = 0;
let skippedPureSpof = 0;
let skippedAlreadyOverridden = 0;

for (const e of events ?? []) {
  if (!e.reason) { skippedNoReason++; continue; }
  const externalId = externalIdByUnitId.get(e.unit_id);
  if (!externalId) { skippedUnknownUnit++; continue; }
  const abbr = stationAbbrOf(externalId);
  const cleaned = cleanReason(e.reason);
  const models = modelsByStation.get(abbr) ?? [];
  const since = e.source_started_at ?? e.started_at;
  const stationId = stationIdByUnitId.get(e.unit_id);
  const stationName = (stationId && stationNameById.get(stationId)) || abbr;

  if (models.length === 0) {
    // Unmodeled station — no candidate list to offer, out of scope for this
    // queue (curation work, not an attribution confirmation).
    continue;
  }

  const attr = attributeOutageAcrossChains(cleaned, models);
  if (attr?.elevatorExternalId) { skippedAttributed++; continue; } // already resolves today

  if (overridesByStation.has(abbr)) { skippedAlreadyOverridden++; continue; } // already handled by a human

  const onlyModel = models.length === 1 ? models[0]! : null;
  const hasKnownAuxiliaryElevators = onlyModel ? /auxiliar|not modeled/i.test(onlyModel.note ?? "") : false;
  if (onlyModel && onlyModel.segments.length === 1 && onlyModel.segments[0]!.elevators.length === 1 && !hasKnownAuxiliaryElevators) {
    skippedPureSpof++; // logically unambiguous already — no human confirmation needed
    continue;
  }

  const candidates = models.flatMap((m) => m.segments.flatMap((s) => s.elevators.map((el) => ({ externalId: el.externalId, label: el.label, chainLabel: m.chainLabel }))));
  items.push({ abbr, stationName, reason: cleaned, since, candidates, unmodeled: false });
}

items.sort((a, b) => a.since.localeCompare(b.since)); // longest-open first

console.log(`${items.length} outage(s) genuinely need a human confirmation right now.`);
console.log(`(${skippedNoReason} no reason, ${skippedUnknownUnit} unknown unit, ${skippedAttributed} already resolve under today's hints, ${skippedAlreadyOverridden} already have a human override, ${skippedPureSpof} are unambiguous single-elevator stations not requiring one.)`);
console.log("");

if (items.length === 0) {
  console.log("Queue is empty — nothing to confirm right now.");
} else {
  for (const item of items) {
    const openedAt = new Date(item.since);
    const hoursOpen = Math.round((Date.now() - openedAt.getTime()) / 36e5);
    console.log(`--- ${item.stationName} (${item.abbr}) — open ~${hoursOpen}h, since ${item.since} ---`);
    console.log(`  Advisory text: "${item.reason}"`);
    console.log(`  Candidate elevators (confirm which one, e.g. via BART's app or calling the station):`);
    for (const c of item.candidates) {
      console.log(`    - ${c.externalId}${c.chainLabel ? c.chainLabel : ""}: ${c.label}`);
    }
    console.log(`  Once confirmed, tell Claude the real elevator id — it'll be hand-recorded in`);
    console.log(`  attribution-overrides.ts (from: ${item.abbr}-UNSPECIFIED or similar, to: <confirmed id>).`);
    console.log("");
  }
}
