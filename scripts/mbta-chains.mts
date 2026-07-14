// Generate access-chain models for SIMPLE MBTA stations from each elevator's
// own route text, validated against MBTA's own per-elevator rider guidance.
// Run: npm run mbta:chains
//
// Same engine/mapper architecture as the rail generator (universality):
// src/lib/chain-inference.ts is the system-agnostic engine;
// src/adapters/mbta/chain-mapper.ts is the MBTA text vocabulary.
//
// THE ANSWER KEY differs from rail. There are no hand-curated MBTA stations
// (the maintainer has never ridden the system), but the feed itself carries
// one: 215 of 237 elevators have `alternate-service-text` — MBTA's own
// guidance for when that elevator is out. "Please use nearby Wonderland
// Elevators 702 or 703" is a DECLARED same-station backup; "please see
// station personnel" or a ride-to-another-station detour is a declared
// absence of one. That declaration is INDEPENDENT of the route-text topology
// the engine infers, so agreement is real validation (the same
// two-independent-signals logic as the subway's declared `redundant` flag):
//   - every modeled elevator's topology-derived redundancy must MATCH its
//     declared expectation, or the whole station is excluded to review;
//   - street-crossing alternates and elevators with no guidance text can't
//     be validated — they ship (topology-only, conservative) but are listed
//     in review-flags.json for the human pass ("flag anything we should
//     review together").

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { classifyMbtaUnit } from "../src/adapters/mbta/chain-mapper.js";
import { inferStationChains } from "../src/lib/chain-inference.js";
import { allElevators, composePublicNote, stationAccessible, type StationModel } from "../src/lib/accessibility.js";

const FACILITIES_URL =
  "https://api-v3.mbta.com/facilities?filter%5Btype%5D=ELEVATOR&sort=id&page%5Blimit%5D=500&include=stop";
const OUT_DIR = fileURLToPath(new URL("../src/catalog/mbta-data/", import.meta.url));
const SYSTEM_ID = "mbta-boston";

interface RawFacility {
  id: string;
  attributes: {
    long_name: string;
    properties: { name: string; value: string | number }[];
  };
  relationships: { stop: { data: { id: string } | null } };
}
interface RawStop {
  id: string;
  attributes: { name: string; wheelchair_boarding?: number };
}

const res = await fetch(FACILITIES_URL, {
  headers: { accept: "application/vnd.api+json" },
  signal: AbortSignal.timeout(30_000),
});
if (!res.ok) throw new Error(`facilities returned HTTP ${res.status}`);
const feed = (await res.json()) as { data: RawFacility[]; included?: RawStop[] };
const stopById = new Map((feed.included ?? []).map((s) => [s.id, s]));

// --- Declared-alternate parsing ---------------------------------------------
type Declared =
  | { kind: "named"; ids: string[] } // same-feed elevator numbers offered as backups
  | { kind: "named-generic" } // "use the elevator directly across the hallway" — a same-station backup without a number
  | { kind: "personnel" } // "see station personnel" — no self-service backup
  | { kind: "detour" } // ride to another station/stop — NOT a backup (BART rule)
  | { kind: "street" } // a street-level crossing/route — possible step-free alt, human review
  | { kind: "none" };

function parseAlternate(text: string | undefined): Declared {
  if (!text || !text.trim()) return { kind: "none" };
  // DETOUR takes precedence over named elevators: MBTA's per-direction
  // guidance routinely reads "exit the train at Savin Hill, then take an
  // Ashmont-bound train to Fields Corner and use Elevator 958" — it NAMES an
  // elevator, but the alternative requires riding past your station and
  // coming back, which is NOT a backup (the BART cross-station rule; a rider
  // already on the platform is functionally stranded). Checking "named"
  // first misread 13 of these as declared backups on the first run.
  if (/exit the train at\s|\btake an?\s+[\w\s\/&-]*-?bound\b|then take an?\b|shuttle/i.test(text)) {
    return { kind: "detour" };
  }
  const ids = [...text.matchAll(/[Ee]levators?\s+#?(\d+(?:\s*(?:,|or|and|&)\s*\d+)*)/g)].flatMap(
    (m) => m[1]!.match(/\d+/g) ?? [],
  );
  if (ids.length) return { kind: "named", ids: [...new Set(ids)] };
  // A same-station backup referenced WITHOUT a number ("Please use the
  // elevator located directly across the hallway" — Pawtucket/Central Falls).
  // First run missed this AND misread it as a street alternate because the
  // un-anchored /cross/ matched "aCROSS" — street words are word-bounded now.
  if (/use the (?:other |nearby |adjacent )?elevator\b(?!s?\s*#?\d)/i.test(text)) return { kind: "named-generic" };
  if (/station personnel|customer service|for assistance/i.test(text)) return { kind: "personnel" };
  if (/\b(?:street|crossing|cross|walk|walkway|ramp|entrance|path)\b/i.test(text)) return { kind: "street" };
  return { kind: "none" };
}

// --- Human-approved street alternates -----------------------------------------
// MBTA's own guidance sometimes contradicts a NO ACCESS claim by describing a
// REAL elevator-free route: a track crossing, a ramp, an accessible walkway.
// Policy (Bryce, 2026-07-10): when the agency's own information contradicts
// us and the detour is elevator-free and at most ~0.3 miles, it counts as a
// step-free alternative — and the walk is always DISCLOSED to the rider (the
// agency's own words go in the note). Entries here are HUMAN-APPROVED, never
// auto-added: the generator flags new street-kind guidance to
// review-flags.json, and only this list applies it. (South Acton 704/705 is
// NOT here — its walk is too long to earn credit; it's a DISCLOSED_ALTERNATE
// below instead.)
const APPROVED_STREET_ALTERNATES = new Map<string, string>([
  ["50", "MBTA: “Please proceed to Concord street to cross over to the outbound platform.”"],
  ["51", "MBTA: “Please proceed to Concord street to cross over to the outbound platform.”"],
  ["750", "MBTA: “Go to the east end of the platform. Take the ramp to Washington St.”"],
  ["751", "MBTA: “Go to the east end of the platform. Take the ramp to Washington St.”"],
  ["769", "MBTA: “proceed to the track crossing located at the south end of the platform … use the Boston Ave entrance”"],
  ["771", "MBTA: “use the accessible walkway that connects the station entrance with Prospect St.”"],
  ["778", "MBTA: “Take the ramp to the parking lot … Take the path near the accessible drop-off/pick-up area.”"],
  ["779", "MBTA: “Take the ramp to the parking lot … Take the path near the accessible drop-off/pick-up area.”"],
]);

// --- Note-only disclosures (joint review 2026-07-12) --------------------------
// A step-free route that is REAL but beyond the 0.3-mile limit earns NO
// step-free credit — the platform still reads NO ACCESS when the elevator is
// out — yet MBTA's routing is surfaced in the rider-facing note for anyone
// willing to make the longer walk. South Acton's ramp-based detour is
// step-free but loops several blocks around the station (Railroad → Main →
// Maple St), so it discloses without qualifying.
const DISCLOSED_ALTERNATES = new Set<string>(["704", "705"]);

// --- Human-confirmed redundant pairs (joint review 2026-07-12) ----------------
// Two elevators the topology engine already groups into ONE redundant segment
// but which carry NO alternate-service-text to corroborate the pairing. The
// "never claim redundancy without a real signal" rule would flag them as
// unvalidated; a human is that signal here. GUARDED: if a feed change ever
// makes one sole-access, the mismatch excludes the station loudly rather than
// trusting a stale human call. (Salem 997 is deliberately NOT here — it needs
// no override: sibling 996's guidance "Please use nearby Salem Elevator 997"
// already corroborates that pair, handled generically below.)
const CONFIRMED_REDUNDANT = new Map<string, string>([
  ["elev_7a57_3d92_400", "TF Green Airport: two walkway↔platform elevators back each other up (human-confirmed 2026-07-12; no MBTA alternate-service-text)"],
  ["elev_7a57_3d92_401", "TF Green Airport: two walkway↔platform elevators back each other up (human-confirmed 2026-07-12; no MBTA alternate-service-text)"],
]);

// --- Group facilities by station ---------------------------------------------
interface FacilityInfo {
  facilityId: string;
  longName: string;
  declared: Declared;
  altText: string | undefined;
}
const byStop = new Map<string, FacilityInfo[]>();
for (const f of feed.data) {
  const stopId = f.relationships.stop.data?.id ?? f.id;
  const alt = (f.attributes.properties ?? []).find((p) => p.name === "alternate-service-text");
  const list = byStop.get(stopId) ?? [];
  list.push({
    facilityId: f.id,
    longName: f.attributes.long_name,
    declared: parseAlternate(alt ? String(alt.value) : undefined),
    altText: alt ? String(alt.value) : undefined,
  });
  byStop.set(stopId, list);
}

// --- Infer + validate ---------------------------------------------------------
const models: StationModel[] = [];
const excluded: { stopId: string; name: string; reason: string; detail: string; units: { id: string; longName: string; altText?: string }[] }[] = [];
const flags: { stopId: string; name: string; kind: string; facilityId: string; detail: string }[] = [];
const nonChain: { stopId: string; facilityId: string; longName: string }[] = [];
let validated = 0;
let stationsModeled = 0;

for (const [stopId, facilities] of byStop) {
  const stop = stopById.get(stopId);
  const name = stop?.attributes.name ?? stopId;
  const excludeRecord = (reason: string, detail: string) =>
    excluded.push({
      stopId,
      name,
      reason,
      detail,
      units: facilities.map((f) => ({ id: f.facilityId, longName: f.longName, altText: f.altText })),
    });

  const units = facilities.map((f) => classifyMbtaUnit(f.facilityId, f.longName));
  const inference = inferStationChains({
    stationExternalId: stopId,
    name,
    accessibilityFull: stop?.attributes.wheelchair_boarding === 1,
    units,
  });
  if (!inference.ok) {
    excludeRecord(inference.excluded.reason, inference.excluded.detail);
    continue;
  }

  // Validation: topology-derived redundancy vs the declared alternate, per
  // modeled elevator. Any hard disagreement excludes the STATION — a topology
  // model that contradicts the agency's own guidance is not trustworthy.
  const stationModels = inference.result.models.map((m) => ({ systemId: SYSTEM_ID, ...m }));
  const stationFacilityIds = new Set(facilities.map((f) => f.facilityId));
  const memberIds = new Set(stationModels.flatMap((m) => allElevators(m).map((e) => e.externalId)));
  // Elevators NAMED as backups by a sibling's guidance are feed-corroborated
  // even when they carry no text of their own (Salem 997 is named by 996's
  // "Please use nearby Salem Elevator 997") — so they don't need a human
  // override and aren't flagged as unvalidated.
  const namedBySiblings = new Set<string>();
  for (const f of facilities) {
    if (f.declared.kind === "named") for (const id of f.declared.ids) if (id !== f.facilityId) namedBySiblings.add(id);
  }
  let mismatch: string | null = null;
  const stationFlags: typeof flags = [];
  for (const f of facilities) {
    if (!memberIds.has(f.facilityId)) continue; // non-chain (garage) units aren't access claims
    const severs = stationModels.some((m) => !stationAccessible(m, new Set([f.facilityId])));
    const topologyRedundant = !severs;
    const d = f.declared;
    if (d.kind === "named") {
      // A named backup only counts if it's a SAME-STATION elevator; a named
      // elevator elsewhere is a detour in disguise (BART cross-station rule).
      const sameStation = d.ids.some((id) => stationFacilityIds.has(id) && id !== f.facilityId);
      const expect = sameStation;
      if (topologyRedundant !== expect) {
        mismatch = `${f.facilityId}: topology says ${topologyRedundant ? "redundant" : "sole-access"}, MBTA's guidance says ${expect ? `backed up by ${d.ids.join("/")}` : "no same-station backup"} — "${(f.altText ?? "").slice(0, 120)}"`;
        break;
      }
      validated++;
    } else if (d.kind === "named-generic") {
      // A same-station backup referenced without a number — the declaration
      // says "redundant" even though we can't name which elevator.
      if (!topologyRedundant) {
        mismatch = `${f.facilityId}: topology says sole-access, but MBTA's guidance points to a nearby elevator — "${(f.altText ?? "").slice(0, 120)}"`;
        break;
      }
      validated++;
    } else if (d.kind === "personnel" || d.kind === "detour") {
      if (topologyRedundant) {
        mismatch = `${f.facilityId}: topology says redundant, but MBTA's guidance offers ${d.kind === "personnel" ? "only station personnel" : "a ride-around detour"} — "${(f.altText ?? "").slice(0, 120)}"`;
        break;
      }
      validated++;
    } else if (d.kind === "street") {
      if (APPROVED_STREET_ALTERNATES.has(f.facilityId)) continue; // step-free credit applied below, no flag
      if (DISCLOSED_ALTERNATES.has(f.facilityId)) continue; // note-only disclosure applied below, no flag

      // Possible step-free alternative (a crossing, a different entrance) —
      // never auto-applied; the model stays conservative and a human reviews.
      stationFlags.push({ stopId, name, kind: "street-alternate", facilityId: f.facilityId, detail: (f.altText ?? "").slice(0, 200) });
    } else {
      // No guidance text of its own. Resolved three ways before falling to a flag:
      if (namedBySiblings.has(f.facilityId)) {
        validated++; // a sibling's alternate names this elevator (feed-corroborated)
      } else if (CONFIRMED_REDUNDANT.has(f.facilityId)) {
        if (!topologyRedundant) {
          mismatch = `${f.facilityId}: human-confirmed redundant, but topology now says sole-access — feed changed, recheck the pairing`;
          break;
        }
        validated++;
      } else {
        stationFlags.push({ stopId, name, kind: "unvalidated", facilityId: f.facilityId, detail: "no alternate-service-text" });
      }
    }
  }
  if (mismatch) {
    excludeRecord("declared-alternate-mismatch", mismatch);
    continue;
  }

  // Apply the HUMAN-APPROVED street alternates (after validation, which is
  // about elevator topology only): every segment containing an approved
  // facility gets stepFreeAlternative + the agency's own words in the note —
  // the walk is always disclosed to the rider. Disclosures are collected in
  // SETS (deduped — Framingham's two approved segments used to append the
  // same sentence twice) and joined into the notes at the end, because the
  // composed public note depends on stepFreeAlternative being final.
  const publicDisclosures = new Map<StationModel, Set<string>>();
  const internalDisclosures = new Map<StationModel, Set<string>>();
  const addTo = (map: Map<StationModel, Set<string>>, m: StationModel, s: string) =>
    (map.get(m) ?? map.set(m, new Set()).get(m)!).add(s);
  for (const m of stationModels) {
    for (const seg of m.segments) {
      const approved = seg.elevators.map((e) => APPROVED_STREET_ALTERNATES.get(e.externalId)).find(Boolean);
      if (!approved) continue;
      seg.stepFreeAlternative = true;
      addTo(publicDisclosures, m, `Elevator-free alternative per MBTA's own guidance (a walk is required): ${approved}`);
      addTo(internalDisclosures, m, "Street alternate human-approved 2026-07-10 (APPROVED_STREET_ALTERNATES), ≤0.3-mile rule.");
    }
  }

  // Apply NOTE-ONLY disclosures: no step-free credit (the segment stays
  // sole-access), but MBTA's routing is surfaced for riders willing to walk it.
  const altById = new Map(facilities.map((f) => [f.facilityId, f.altText]));
  for (const m of stationModels) {
    for (const seg of m.segments) {
      const disclosedId = seg.elevators.map((e) => e.externalId).find((id) => DISCLOSED_ALTERNATES.has(id));
      if (!disclosedId) continue;
      const routing = (altById.get(disclosedId) ?? "").replace(/\s+/g, " ").trim();
      addTo(publicDisclosures, m, `A step-free route exists but is longer than 0.3 miles, so it is not counted as an accessible backup — this platform still shows no step-free access when the elevator is out. Riders able to make the longer walk can follow MBTA's routing: ${routing}`);
      addTo(internalDisclosures, m, "Note-only disclosure (DISCLOSED_ALTERNATES, human-approved 2026-07-12): real route beyond the 0.3-mile limit, no step-free credit.");
    }
  }

  // Compose the notes LAST — stepFreeAlternative is final now. `note` =
  // composed rider-facing text + the agency's own disclosures (public);
  // `internalNote` = chain-inference provenance + approval bookkeeping.
  for (const m of stationModels) {
    m.note = [composePublicNote(m.segments), ...(publicDisclosures.get(m) ?? [])].join(" ");
    const internals = internalDisclosures.get(m);
    if (internals) m.internalNote = [m.internalNote, ...internals].filter(Boolean).join(" ");
  }

  models.push(...stationModels);
  flags.push(...stationFlags);
  for (const u of inference.result.nonChainUnits) nonChain.push({ stopId, facilityId: u.externalId, longName: u.raw });
  stationsModeled++;
}

const generatedAt = new Date().toISOString();
writeFileSync(
  `${OUT_DIR}chains.json`,
  JSON.stringify({ generatedAt, source: "MBTA facilities long_name route text, validated against alternate-service-text", models, nonChainUnits: nonChain }, null, 2) + "\n",
);
writeFileSync(
  `${OUT_DIR}chains-excluded.json`,
  JSON.stringify({ generatedAt, note: "Stations the MBTA chain generator refuses to model — pending human review.", stations: excluded }, null, 2) + "\n",
);
writeFileSync(
  `${OUT_DIR}review-flags.json`,
  JSON.stringify({ generatedAt, note: "Shipped-but-flagged items for the joint review pass: street alternates (possible step-free paths, never auto-applied) and unvalidated elevators (no guidance text).", flags }, null, 2) + "\n",
);
// Full-feed fixture: every station's raw inputs, so the offline check
// re-verifies the ENTIRE generation (engine + mapper + declared-alternate
// validation) with no network.
const fixture: Record<string, { name: string; wheelchairBoarding: number | null; facilities: { id: string; longName: string; altText: string | null }[] }> = {};
for (const [stopId, facilities] of byStop) {
  const stop = stopById.get(stopId);
  fixture[stopId] = {
    name: stop?.attributes.name ?? stopId,
    wheelchairBoarding: stop?.attributes.wheelchair_boarding ?? null,
    facilities: facilities.map((f) => ({ id: f.facilityId, longName: f.longName, altText: f.altText ?? null })),
  };
}
writeFileSync(`${OUT_DIR}fixture.json`, JSON.stringify({ generatedAt, stations: fixture }, null, 2) + "\n");

console.log(`Stations: ${byStop.size} elevator-equipped · modeled ${stationsModeled} (${models.length} chains) · excluded ${excluded.length}`);
console.log(`Validation: ${validated} elevator redundancy claims corroborated by MBTA's own alternate-service guidance`);
console.log(`Review flags: ${flags.filter((f) => f.kind === "street-alternate").length} street-alternate, ${flags.filter((f) => f.kind === "unvalidated").length} unvalidated · non-chain (garage) units: ${nonChain.length}`);
const reasons: Record<string, number> = {};
for (const e of excluded) reasons[e.reason] = (reasons[e.reason] ?? 0) + 1;
console.log(`Exclusion reasons: ${JSON.stringify(reasons)}`);
console.log(`Wrote chains.json, chains-excluded.json, review-flags.json, fixture.json -> src/catalog/mbta-data/`);
