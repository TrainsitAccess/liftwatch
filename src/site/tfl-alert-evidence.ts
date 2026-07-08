import "dotenv/config";
import { writeFileSync } from "node:fs";
import { getSupabase } from "../lib/supabase.js";

// Mines TfL's own alert text — already archived verbatim in outage_events.reason
// every poll, no new capture needed — for structural routing signals, and
// accumulates them into a versioned catalog file that grows every time this is
// re-run against a bigger archive. This is the "progressive" half of the TfL
// multi-chain work: rather than a one-off audit, each elevator that has ever
// gone down contributes its alert text as evidence, and re-running this after
// more polls/outages naturally absorbs more of it.
//
// TfL's alerts sometimes name a concrete step-free alternative when a lift is
// broken ("use the ramp on Hepscott Road", "step-free access is still
// available by using the entrance/exit on Bridge Road") — this is a REAL,
// TfL-published fact about redundancy that our own topology-graph derivation
// (scripts/tfl-chains.mjs) can't see (a ramp isn't a lift, so it's invisible
// to Lifts.csv). Per Bryce's explicit instruction: TfL's own words are trusted
// as ground truth for this — where an alert names an alternative, that's used
// to correct/annotate our model, never the reverse. Absence of a mentioned
// alternative is NOT treated as proof of non-redundancy (a single boilerplate
// "no step step-free access... due to a faulty lift, call us" message doesn't
// confirm there's no alternative, only that TfL didn't publish one that time)
// — that asymmetry matters: adding a confirmed alternative only ever REDUCES
// a false "no access" claim, so it's safe to apply automatically; the
// project's "assumed vs confirmed" distinction (see CLAUDE.md) means absence
// of positive evidence stays informative context for a human review, never an
// auto-applied fact.
//
// Usage: npm run tfl:alert-evidence (re-run periodically as the archive grows)

const db = getSupabase();
if (!db) {
  console.error("No SUPABASE_* env configured — fill in .env first.");
  process.exit(1);
}

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
    (from, to) => db.from("units").select("id, external_id").eq("system_id", "tfl-london").range(from, to),
    "units",
  ),
  fetchAll<EventRow>(
    (from, to) =>
      db
        .from("outage_events")
        .select("unit_id, reason, started_at, source_started_at")
        .eq("system_id", "tfl-london")
        .range(from, to),
    "outage_events",
  ),
]);

const externalIdByUnitId = new Map(units.map((u) => [u.id, u.external_id]));

// --- Structural-signal extraction ---
// Conservative by design: only flags a POSITIVE alternative when the message
// contains an explicit, well-known phrase pattern naming one. Never
// paraphrases or interprets beyond that — the verbatim message is always kept
// alongside, so a human reviewing this later can judge any phrasing these
// patterns miss (a real gap, not silently hidden: see `unmatchedPositiveHints`
// below for messages that use alternative-sounding language this script
// didn't confidently parse).
const ALTERNATIVE_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "use-the-X", re: /for step[- ]free access,?\s*(?:please\s+)?use\s+(the [^.]+?)\.?(?:\s+call us|$)/i },
  { name: "still-available", re: /step[- ]free access is still available\s*([^.]+?)\.?(?:\s+lifts remain|$)/i },
  { name: "please-use-X", re: /please use\s+([^.]+?)\s+for step[- ]free access/i },
  { name: "lifts-remain-available", re: /(lifts remain available[^.]*)\./i },
];
// A hint something alternative-ish is being said but no pattern above matched
// confidently — surfaced separately so nothing is silently lost.
const SOFT_HINT_RE = /\b(alternative|instead|nearby|another (lift|entrance|route)|remain(s)? available)\b/i;

interface Occurrence {
  since: string;
  message: string;
}
interface LiftEvidence {
  occurrences: number;
  alternativeMentions: { pattern: string; phrase: string; since: string; message: string }[];
  noAlternativeMentioned: number;
  unmatchedPositiveHints: Occurrence[];
  sampleMessages: string[];
}

const byLift = new Map<string, LiftEvidence>();
let skippedNoReason = 0;
let skippedUnknownUnit = 0;

for (const e of events) {
  if (!e.reason) { skippedNoReason++; continue; }
  const externalId = externalIdByUnitId.get(e.unit_id);
  if (!externalId) { skippedUnknownUnit++; continue; }

  const ev: LiftEvidence = byLift.get(externalId) ?? {
    occurrences: 0,
    alternativeMentions: [],
    noAlternativeMentioned: 0,
    unmatchedPositiveHints: [],
    sampleMessages: [],
  };
  ev.occurrences++;
  const since = e.source_started_at ?? e.started_at;

  let matched = false;
  for (const { name, re } of ALTERNATIVE_PATTERNS) {
    const m = e.reason.match(re);
    if (m) {
      ev.alternativeMentions.push({ pattern: name, phrase: (m[1] ?? m[0]).trim(), since, message: e.reason });
      matched = true;
      break; // one confirmed mention per occurrence is enough evidence
    }
  }
  if (!matched) {
    if (SOFT_HINT_RE.test(e.reason)) {
      ev.unmatchedPositiveHints.push({ since, message: e.reason });
    } else {
      ev.noAlternativeMentioned++;
    }
  }
  if (ev.sampleMessages.length < 3 && !ev.sampleMessages.includes(e.reason)) ev.sampleMessages.push(e.reason);

  byLift.set(externalId, ev);
}

const withAlternative = [...byLift.values()].filter((e) => e.alternativeMentions.length > 0).length;
const withSoftHint = [...byLift.values()].filter((e) => e.unmatchedPositiveHints.length > 0).length;

console.log(`Processed ${events.length} TfL outage events (${skippedNoReason} with no reason text, ${skippedUnknownUnit} with an unknown unit).`);
console.log(`Evidence gathered for ${byLift.size} distinct lifts.`);
console.log(`  ${withAlternative} lift(s) have a CONFIRMED alternative mention (a real, TfL-published bypass).`);
console.log(`  ${withSoftHint} lift(s) have an unmatched soft hint — review sampleMessages by hand.`);

writeFileSync(
  new URL("../catalog/tfl-data/alert-evidence.json", import.meta.url),
  JSON.stringify(
    {
      note:
        "Generated by src/site/tfl-alert-evidence.ts from the archived outage_events.reason text for tfl-london " +
        "(the poller already captures this verbatim every 10 minutes — no new capture mechanism needed). " +
        "Re-run periodically (npm run tfl:alert-evidence) to absorb more outage history as it accrues. " +
        "alternativeMentions are CONFIRMED, TfL-published facts (a matched phrase pattern naming a real bypass) " +
        "— trusted per Bryce's instruction that TfL's own alert text is ground truth. noAlternativeMentioned is " +
        "NOT proof of non-redundancy (TfL just didn't publish one that time) — informative context only, never " +
        "auto-applied as a fact. unmatchedPositiveHints are messages this script's patterns didn't confidently " +
        "parse but that use alternative-sounding language — worth a human look, not silently dropped.",
      generatedAt: new Date().toISOString(),
      byLift: Object.fromEntries(byLift),
    },
    null,
    2,
  ) + "\n",
);
console.log("\nWrote src/catalog/tfl-data/alert-evidence.json");
