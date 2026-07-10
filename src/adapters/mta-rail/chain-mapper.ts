// MTA-rail-specific mapper: eestatus elevator location text -> InferenceUnit.
//
// The thin, per-system half of the engine/mapper split (see
// src/lib/chain-inference.ts). Everything here is vocabulary: which words in
// THIS feed's free text mean street / platform / hub / garage, and which words
// mean "too complex to model mechanically". The vocabulary was calibrated
// against the complete live feed (all 99 elevator-equipped stations,
// 2026-07-10) and is locked by the ground-truth self-check against the 13
// hand-curated station models (src/checks/rail-chains-check.ts) — extend it
// only with the check green.
//
// Classification is PRESENCE-based, not positional: an elevator is the set of
// landings its text mentions. That survives the feed's grammar drift ("Between
// A and B", "from A to B", "A / B and C", trailing spatial notes) far better
// than from/to parsing would. Words neither classified nor explicitly ignored
// contribute nothing (station names, "west end", directions) — but a word on
// the UNKNOWN-trigger list poisons the unit, excluding its whole station to
// the human-review file (a landing we can't place could be the load-bearing
// one).

import type { InferenceUnit } from "../../lib/chain-inference.js";

// Complexity triggers: these words mark topology the simple street/hub/platform
// model can't express — pedestrian bridges (Stamford), passages (GCT), ramps
// (only humans may claim step-free alternatives), interior rooms whose level
// is unknowable from text. Any hit => the unit is `unknown` => station excluded.
const UNKNOWN_TRIGGERS =
  /\b(ticket office|waiting room|waterway|bridge|passageway|passage|ramps?|tunnel|lobby|lower level|walkway|wheelchair lift)\b/i;

// Garage phrases classify as garage and are REMOVED before street matching, so
// "parking garage" never leaks a "parking" hit into the street class.
const GARAGE = /\b(?:parking\s+garage|garage)\b/gi;

// Street-class landings. Every entry is justified by a live feed instance:
// "street level"/"street" (ubiquitous), "parking lot"/"parking" (Chappaqua
// 148P, ...), "plaza" (Ronkonkoma 442, Amityville), "kiss-and-ride" (Mineola
// 1017), "ferries" (Yankees 003W), "intermodal" (Mineola's Intermodal Center),
// "station building" (Harlem-125 002N, New Haven 252SU, Hicksville), named
// roads as landings: "avenue"/"av"/"ave" (Garden Avenue, Railroad Av,
// Westchester Ave), "boulevard"/"blvd" (Nassau Boulevard).
const STREET =
  /\b(?:street\s+level|street|parking\s+lot|parking|plaza|kiss[\s-]*(?:and|n)[\s-]*ride|ferr(?:y|ies)|intermodal|station\s+building|avenue|ave?|boulevard|blvd)\b/i;

// Hub-class landings, with directional/positional qualifiers captured so hub
// IDENTITY comparisons work ("eastern overpass" at Jamaica is one hub across
// seven units; Tarrytown's "north overpass" vs bare "Overpass" is a real
// mismatch that correctly excludes the station). concourse/mezzanine are
// allowed as SIMPLE hubs — the truly tangled stations (GCT, Stamford, Yankees)
// still self-exclude via hub<->hub units, multi-hub mismatches, or unknown
// triggers, which the ground-truth check proves.
const HUB =
  /((?:(?:eastern|western|northern|southern|north|south|east|west|main|station|lirr|metro-north)\s+){0,2}(?:overpass|underpass|mezzanine|concourse))/gi;

// Words that are genuinely present but deliberately contribute nothing:
// "subway" on Jamaica's 521 is an extra way INTO the hub — ignoring it only
// ever over-warns (we never claim access we can't see), never under-warns.
const IGNORED = /\b(subway)\b/gi;

// Track tokens: "Tracks 1 & 2", "Track 2,4", "track 4/6", "Tk 3", "Tks 34 &
// 35", "track #3", "Tracks A1 & A2" (Lynbrook's lettered tracks), "(Tracks 2 )"
// (Katonah's trailing space). Ranges keep endpoints only (adapter precedent).
// The "Tk"/"Tks" abbreviation MUST match: missing it collapsed the Hudson
// line's per-side "(Tk 3)"/"(Tk 4)" platforms into one unnamed platform and
// generated FIVE false redundant pairs on the first run (0AR/0GY/0HS/0RV/2WP)
// — the under-warn direction this whole design exists to prevent.
const TRACKS = /\bt(?:rack|k)s?\s*#?\s*((?:[a-z]?\d+)(?:\s*(?:,|&|\/|and|to|-|#)\s*(?:[a-z]?\d+))*)/gi;
const PLATFORM_LETTER = /\bplatforms?\s+([a-z])\b/gi;
const PLATFORM_WORD = /\b(?:platform|island)\b/i;

export function classifyRailUnit(externalId: string, location: string | null | undefined): InferenceUnit {
  const raw = (location ?? "").trim();
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
  let text = raw.toLowerCase();

  if (UNKNOWN_TRIGGERS.test(text)) return { ...base, unknown: true };

  // Garage first, then strip so "parking garage" can't read as street parking.
  base.garage = GARAGE.test(text);
  text = text.replace(GARAGE, " ").replace(IGNORED, " ");

  // Platform identity: explicit tracks win; else a platform letter; else the
  // bare platform/island word = an unnamed platform (engine allows that only
  // when it's the station's sole platform identity).
  const tracks = new Set<string>();
  for (const m of text.matchAll(TRACKS)) {
    for (const tok of m[1]!.match(/[a-z]?\d+/g) ?? []) tracks.add(tok.toUpperCase());
  }
  const letters = new Set<string>();
  for (const m of text.matchAll(PLATFORM_LETTER)) letters.add(m[1]!.toUpperCase());
  if (tracks.size) {
    const sorted = [...tracks].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    base.platformKey = sorted.join("&");
    base.platformDisplay = sorted.length === 1 ? `Track ${sorted[0]}` : `Tracks ${sorted.join(" & ")}`;
  } else if (letters.size) {
    const sorted = [...letters].sort();
    base.platformKey = `P:${sorted.join("&")}`;
    base.platformDisplay = `Platform ${sorted.join(" & ")}`;
  } else if (PLATFORM_WORD.test(text)) {
    base.platformKey = "";
    base.platformDisplay = "platform";
  }

  for (const m of text.matchAll(HUB)) {
    const hub = m[1]!.replace(/\s+/g, " ").trim();
    if (!base.hubs.includes(hub)) base.hubs.push(hub);
  }

  base.street = STREET.test(text);
  return base;
}
