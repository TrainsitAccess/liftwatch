// Generate access-chain models for SIMPLE LIRR / Metro-North stations from the
// eestatus feed's own per-elevator location text. Run: npm run rail:chains
//
// The engine/mapper split (universality): src/lib/chain-inference.ts is
// system-agnostic; src/adapters/mta-rail/chain-mapper.ts is the MTA-rail text
// vocabulary. This script is only plumbing: fetch, map, infer, self-check,
// write.
//
// GROUND-TRUTH GATE (hard fail): the 13 hand-curated stations in
// src/catalog/mta-rail-models.ts are the answer key — the rail feed has no
// declared redundancy flag (unlike the subway's nyct_ene), so the human
// walk-through IS the only truth available. For every curated station the
// engine chooses to model, the generated chains must match the hand model
// semantically (chain count, member set, per-elevator severed-chain count —
// see compareStationSemantics). ANY mismatch aborts the run with nothing
// written: per the project owner, verbatim — "if what you generate disagrees
// with what I've told you, then your generator is broken." An engine that
// EXCLUDES a curated station is fine (conservative; the hand model covers it).
//
// Curated stations are never emitted (hand models stay authoritative); the
// generated models cover only stations that today fall to assumed redundancy.
// Excluded stations land in chains-excluded.json for human review — the TfL
// precedent. A raw-feed fixture for the curated + regression stations is also
// written so check:rail-chains can re-verify all of this offline in CI.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { classifyRailUnit } from "../src/adapters/mta-rail/chain-mapper.js";
import { compareStationSemantics, inferStationChains } from "../src/lib/chain-inference.js";
import { composePublicNote } from "../src/lib/accessibility.js";
import { MTA_RAIL_STATION_MODELS } from "../src/catalog/mta-rail-models.js";
import type { StationModel } from "../src/lib/accessibility.js";

const EESTATUS_URL = "https://backend-unified.mylirr.org/eestatus";
const INFRASTRUCTURE_URL = "https://backend-unified.mylirr.org/infrastructure?language=en";
const OUT_DIR = fileURLToPath(new URL("../src/catalog/mta-rail-data/", import.meta.url));

interface RawUnit {
  unitId: string;
  location: string | null;
  status?: string;
  lastUpdated?: number | null;
}
interface RawStationEntry {
  elevators?: RawUnit[];
  escalators?: RawUnit[];
}
interface InfraStation {
  code: string;
  name: string;
  railroad: "LIRR" | "MNR" | "BOTH";
  accessibility?: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "Accept-Version": "3.0" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${url.split("?")[0]} returned HTTP ${res.status}`);
  return (await res.json()) as T;
}

const [eestatus, infra] = await Promise.all([
  fetchJson<Record<string, RawStationEntry>>(EESTATUS_URL),
  fetchJson<{ stations: InfraStation[] }>(INFRASTRUCTURE_URL),
]);

const infraByCode = new Map(infra.stations.map((s) => [s.code, s]));
const systemIdFor = (railroad: string): string | null =>
  railroad === "LIRR" ? "mta-lirr" : railroad === "MNR" ? "mta-mnr" : null;

// Hand-curated stations, grouped by station code — the ground truth.
const curatedByCode = new Map<string, StationModel[]>();
for (const m of MTA_RAIL_STATION_MODELS) {
  const list = curatedByCode.get(m.stationExternalId) ?? [];
  list.push(m);
  curatedByCode.set(m.stationExternalId, list);
}

const generated: StationModel[] = [];
const excluded: { code: string; name: string; railroad: string; reason: string; detail: string; units: { unitId: string; location: string }[] }[] = [];
const nonChain: { code: string; unitId: string; location: string }[] = [];
const groundTruthFailures: string[] = [];
let curatedModeledOk = 0;
let curatedExcluded = 0;

for (const [code, entry] of Object.entries(eestatus)) {
  const meta = infraByCode.get(code);
  if (!meta) {
    console.warn(`⚠ eestatus code "${code}" not in infrastructure — skipped`);
    continue;
  }
  const systemId = systemIdFor(meta.railroad);
  if (!systemId) continue; // "BOTH" — the app's combined GCT entry, no real units
  const elevators = entry.elevators ?? [];
  if (!elevators.length) continue;

  const units = elevators.map((u) => classifyRailUnit(`${code}-${(u.unitId ?? "").trim()}`, u.location));
  const inference = inferStationChains({
    stationExternalId: code,
    name: meta.name,
    accessibilityFull: meta.accessibility === "FULL",
    units,
  });

  const curated = curatedByCode.get(code);
  if (curated) {
    // Ground-truth station: validate (if modeled), never emit.
    if (inference.ok) {
      const problems = compareStationSemantics(inference.result.models, curated);
      if (problems.length) {
        groundTruthFailures.push(`${code} ${meta.name}:\n    ${problems.join("\n    ")}`);
      } else {
        curatedModeledOk++;
        console.log(`✓ ground truth ${code} ${meta.name}: generated chains match the hand model (${curated.length} chain(s))`);
      }
    } else {
      curatedExcluded++;
      console.log(`· ground truth ${code} ${meta.name}: engine excludes (${inference.excluded.reason}) — hand model covers it`);
    }
    continue;
  }

  if (inference.ok) {
    // Public note composed here (rail has no post-inference enrichment that
    // changes what it must say); chain-inference set the provenance internalNote.
    for (const m of inference.result.models) generated.push({ systemId, ...m, note: composePublicNote(m.segments) });
    for (const u of inference.result.nonChainUnits) nonChain.push({ code, unitId: u.externalId, location: u.raw });
  } else {
    excluded.push({
      code,
      name: meta.name,
      railroad: meta.railroad,
      reason: inference.excluded.reason,
      detail: inference.excluded.detail,
      units: elevators.map((u) => ({ unitId: (u.unitId ?? "").trim(), location: (u.location ?? "").trim() })),
    });
  }
}

if (groundTruthFailures.length) {
  console.error(`\n✗ GROUND-TRUTH MISMATCH — the generator is broken; nothing written.\n`);
  for (const f of groundTruthFailures) console.error(`  ${f}\n`);
  process.exit(1);
}

// Invariant: no elevator may appear in both generated and hand-curated models —
// the adapter aggregates redundancy across every chain an elevator sits in, so
// an overlap would silently blend generated topology into human-verified truth.
const handIds = new Set(MTA_RAIL_STATION_MODELS.flatMap((m) => m.segments.flatMap((s) => s.elevators.map((e) => e.externalId))));
const overlap = generated.flatMap((m) => m.segments.flatMap((s) => s.elevators.map((e) => e.externalId))).filter((id) => handIds.has(id));
if (overlap.length) {
  console.error(`✗ generated models reuse hand-curated elevators: ${overlap.join(", ")} — nothing written.`);
  process.exit(1);
}

const generatedAt = new Date().toISOString();
writeFileSync(
  `${OUT_DIR}chains.json`,
  JSON.stringify({ generatedAt, source: "backend-unified.mylirr.org/eestatus location text", models: generated, nonChainUnits: nonChain }, null, 2) + "\n",
);
writeFileSync(
  `${OUT_DIR}chains-excluded.json`,
  JSON.stringify({ generatedAt, note: "Stations the chain generator refuses to model — pending human review (TfL precedent).", stations: excluded }, null, 2) + "\n",
);

// Offline fixture: the raw feed slice for every ground-truth station plus the
// locked regression stations, so check:rail-chains re-verifies mapper + engine
// + ground truth in CI with no network.
const REGRESSION_CODES = ["1CQ", "2FM"]; // Chappaqua (the motivating case), Fairfield (missing-origin exclusion)
const fixtureCodes = [...curatedByCode.keys(), ...REGRESSION_CODES];
const fixture: Record<string, { name: string; railroad: string; accessibility: string | null; elevators: { unitId: string; location: string | null }[] }> = {};
for (const code of fixtureCodes) {
  const meta = infraByCode.get(code);
  const entry = eestatus[code];
  if (!meta || !entry) {
    console.error(`✗ fixture station ${code} missing from the live feed — nothing written.`);
    process.exit(1);
  }
  fixture[code] = {
    name: meta.name,
    railroad: meta.railroad,
    accessibility: meta.accessibility ?? null,
    elevators: (entry.elevators ?? []).map((u) => ({ unitId: u.unitId, location: u.location ?? null })),
  };
}
writeFileSync(`${OUT_DIR}fixture.json`, JSON.stringify({ generatedAt, stations: fixture }, null, 2) + "\n");

const stationsModeled = new Set(generated.map((m) => m.stationExternalId)).size;
console.log(`\nGenerated ${generated.length} chain(s) across ${stationsModeled} station(s); ${excluded.length} station(s) excluded for review; ${nonChain.length} non-chain (garage) unit(s).`);
console.log(`Ground truth: ${curatedModeledOk} curated station(s) reproduced exactly, ${curatedExcluded} conservatively excluded (hand models cover them).`);
console.log(`Wrote chains.json, chains-excluded.json, fixture.json -> src/catalog/mta-rail-data/`);
