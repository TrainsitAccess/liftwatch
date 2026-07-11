// MBTA-specific mapper: facility long_name route text -> InferenceUnit.
//
// The thin, per-system half of the engine/mapper split (src/lib/
// chain-inference.ts) — the MBTA sibling of the MTA-rail mapper. Every MBTA
// elevator's long_name ends with a parenthetical route: "Porter Elevator 985
// (Lobby to Somerville Avenue)", "South Acton Elevator 704 (Track 1 (outbound
// platform) to pedestrian bridge)". Vocabulary calibrated against the complete
// live facilities feed (237 elevators, 166 distinct landing phrases,
// 2026-07-10).
//
// MBTA vocabulary differs from MTA-rail on purpose — this is exactly why
// mappers are per-system:
//   - "lobby" and "pedestrian bridge" are ordinary HUBS here (fare lobbies and
//     bridges are the standard intermediate level), where the rail mapper
//     treats bridges as complexity triggers;
//   - paid/unpaid variants are DISTINCT hub identities ("paid pedestrian
//     bridge" vs "unpaid pedestrian bridge" at Orient Heights are different
//     places — conflating them would invent connectivity);
//   - platforms are usually DIRECTION-named ("Alewife platform", "Bowdoin
//     platform") or line-named ("Orange Line platform") rather than
//     track-numbered — the platform identity is the normalized name;
//   - an elevator whose text names TWO different platform identities (a
//     platform-to-platform transfer elevator, e.g. Government Center's Blue
//     Line <-> Green Line) is beyond the street/hub/platform model — marked
//     unknown so the whole station lands in the review queue.
//
// Landing phrases are split on commas / "and" / "&" before classification, so
// compound landings ("street, parking garage") classify each part.

import type { InferenceUnit } from "../../lib/chain-inference.js";

// Complexity triggers: multi-platform transfer text is handled structurally
// (two platform identities => unknown); no free-text triggers needed so far.
const GARAGE = /\bparking\s+garage\b|\bgarage\b/i;

// Hub phrases. Checked BEFORE street so "State Street lobby" reads as a hub
// (a named lobby), not a street. Identity = the full normalized phrase, so
// paid/unpaid/upper/northern/etc. variants stay distinct.
const HUB_WORD = /\b(?:lobby|lobbies|pedestrian\s+bridge|underpass|passageway|concourse|walkway|pedestrian\s+plaza|mezzanine|bridge)\b/i;

// Street-class: an at-grade public way or bus area. Street names ("Waverly
// Street", "Ocean Avenue", "Revolution Drive", "Bridge St"), busways and bus
// terminals, pick-up/drop-off loops, plain "street", surface parking (NOT
// "parking garage" — stripped as garage first).
const STREET_WORD =
  /\b(?:street|streets|\bst\b\.?|avenue|ave\b\.?|drive|road|\brd\b\.?|boulevard|blvd|square|busway|bus\s+terminal|pick-?up\/?drop-?off|drop-?off|parking(?:\s+lot)?|plaza\s+entrance)\b/i;
const PLAIN_STREET = /^street$/i;

const PLATFORM_WORD = /\bplatforms?\b|\btracks?\s+\d/i;
const TRACKS = /\btracks?\s*((?:\d+)(?:\s*(?:,|&|\/|and|to|-)\s*(?:\d+))*)/gi;

/** Normalize one landing phrase to a platform identity, or null if not a platform. */
function platformIdentity(phrase: string): string | null {
  if (!PLATFORM_WORD.test(phrase)) return null;
  const tracks = new Set<string>();
  for (const m of phrase.matchAll(TRACKS)) {
    for (const tok of m[1]!.match(/\d+/g) ?? []) tracks.add(tok);
  }
  if (tracks.size) {
    return [...tracks].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join("&");
  }
  // Direction/line-named platform: identity = the qualifier before
  // "platform(s)", normalized ("Alewife platform" -> "alewife"; bare
  // "platform" -> "" unnamed). Slashes and commas in the qualifier (a center
  // platform serving both directions: "Forest Hills, Wonderland platforms")
  // sort into one canonical identity.
  const qualifier = phrase
    .replace(/\bplatforms?\b/gi, " ")
    .replace(/\bcenter\b/gi, " ")
    .replace(/[(),]/g, " ")
    .trim()
    .toLowerCase();
  if (!qualifier) return "";
  return qualifier.split(/\s*(?:\/|,|&|and)\s*/).filter(Boolean).sort().join("+");
}

/** Rider-facing display form for a platform identity derived above. */
function platformDisplay(phrase: string): string {
  const t = phrase.trim().replace(/\s+/g, " ");
  return t ? t[0]!.toUpperCase() + t.slice(1) : "platform";
}

export function classifyMbtaUnit(externalId: string, longName: string | null | undefined): InferenceUnit {
  const raw = (longName ?? "").trim();
  const base: InferenceUnit = {
    externalId,
    label: raw,
    street: false,
    platformKey: null,
    platformDisplay: null,
    hubs: [],
    garage: false,
    unknown: false,
    raw,
  };
  if (!raw) return { ...base, unknown: true };

  // The route lives in the trailing parenthetical (may contain nested parens:
  // "Track 1 (outbound platform) to pedestrian bridge").
  const m = /\(([\s\S]+)\)\s*$/.exec(raw);
  if (!m) return { ...base, unknown: true };
  // Drop nested parentheticals (they qualify, never name, a landing), then
  // split into landing phrases: " to " separates ends, commas/"and"/"&"
  // separate compound landings.
  const route = m[1]!.replace(/\([^)]*\)/g, " ");
  const phrases = route
    .split(/\s+to\s+/i)
    .flatMap((part) => part.split(/\s*(?:,|&|\band\b)\s*/i))
    .map((p) => p.trim())
    .filter(Boolean);
  if (!phrases.length) return { ...base, unknown: true };

  const platformKeys = new Map<string, string>(); // identity -> display
  for (const phrase of phrases) {
    if (GARAGE.test(phrase)) {
      base.garage = true;
      continue;
    }
    const pid = platformIdentity(phrase);
    if (pid !== null) {
      platformKeys.set(pid, platformDisplay(phrase));
      continue;
    }
    if (HUB_WORD.test(phrase)) {
      const hub = phrase.toLowerCase().replace(/\s+/g, " ").trim();
      if (!base.hubs.includes(hub)) base.hubs.push(hub);
      continue;
    }
    if (PLAIN_STREET.test(phrase) || STREET_WORD.test(phrase)) {
      base.street = true;
      continue;
    }
    // A landing we can't place — could be the load-bearing one. Poison the
    // unit; the engine excludes the whole station to the review queue.
    return { ...base, unknown: true };
  }

  // Two DIFFERENT platform identities on one elevator = a platform-to-platform
  // transfer unit (Government Center's Blue <-> Green) — beyond this model.
  if (platformKeys.size > 1) return { ...base, unknown: true };
  if (platformKeys.size === 1) {
    const [pid, display] = [...platformKeys.entries()][0]!;
    base.platformKey = pid;
    base.platformDisplay = display;
  }
  return base;
}
