// Offline regression check for the LIRR/MNR chain generator. Run:
//   npm run check:rail-chains
//
// Re-runs the mapper + inference engine against the committed raw-feed fixture
// (src/catalog/mta-rail-data/fixture.json, written by scripts/rail-chains.mts)
// and asserts, with no network:
//   1. GROUND TRUTH — for every hand-curated station the engine models, the
//      generated chains match the hand model semantically; the four complex
//      curated stations stay conservatively excluded.
//   2. REGRESSIONS — Chappaqua (the motivating case: two sole-access legs, an
//      148I outage severs Tracks 1 & 2) and Fairfield-Black Rock (a
//      platform-only unit must exclude its station, never guess an origin).
//   3. COMMITTED-JSON INVARIANTS — generated models never cover a curated
//      station or reuse a curated elevator (the adapter aggregates redundancy
//      across every chain an elevator sits in, so overlap would blend machine
//      topology into human-verified truth); no generated model ever claims a
//      stepFreeAlternative (only humans may claim ramps); locked counts catch
//      accidental drift (update them when deliberately regenerating).

import { classifyRailUnit } from "../adapters/mta-rail/chain-mapper.js";
import { compareStationSemantics, inferStationChains } from "../lib/chain-inference.js";
import { MTA_RAIL_STATION_MODELS } from "../catalog/mta-rail-models.js";
import { stationAccessible, type StationModel } from "../lib/accessibility.js";
import fixtureJson from "../catalog/mta-rail-data/fixture.json" with { type: "json" };
import chainsJson from "../catalog/mta-rail-data/chains.json" with { type: "json" };

// Locked counts — regenerate via `npm run rail:chains`, then update here.
const LOCKED = { chains: 115, stations: 72 };

interface FixtureStation {
  name: string;
  railroad: string;
  accessibility: string | null;
  elevators: { unitId: string; location: string | null }[];
}
const fixture = (fixtureJson as { stations: Record<string, FixtureStation> }).stations;
const generated = (chainsJson as { models: StationModel[] }).models;

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) passed++;
  else failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const runEngine = (code: string, st: FixtureStation) =>
  inferStationChains({
    stationExternalId: code,
    name: st.name,
    accessibilityFull: st.accessibility === "FULL",
    units: st.elevators.map((u) => classifyRailUnit(`${code}-${u.unitId.trim()}`, u.location)),
  });

// --- 1. Ground truth ---------------------------------------------------------
const curatedByCode = new Map<string, StationModel[]>();
for (const m of MTA_RAIL_STATION_MODELS) {
  curatedByCode.set(m.stationExternalId, [...(curatedByCode.get(m.stationExternalId) ?? []), m]);
}
// Curated stations the engine must keep refusing to model: the complex four,
// plus Greenwich (2GN) — its 218T "Ticket Office" landing is unplaceable from
// text, and the human-verified truth (overpass at grade, Track 3 ramp off
// Greenwich Plaza, 218T outside the chains) is knowledge no text parse could
// derive. Hand-curated 2026-07-10. Amityville/Lindenhurst (AVL/LHT,
// unknown-landing — "station plaza" isn't a recognized landing keyword),
// Purdy's (1PY, unknown-landing — the ambiguous 158B unit), and Cortlandt
// (0CT, unparseable-unit — the 045PW parking-lot unit) added 2026-07-15 via
// /liftwatch-station-review: the engine's own parser still can't place these,
// same conservative-exclusion shape as the original five.
const EXPECT_EXCLUDED = new Set(["GCT", "0NY", "2SM", "0YS", "2GN", "AVL", "LHT", "1PY", "0CT"]);
for (const [code, curated] of curatedByCode) {
  const st = fixture[code];
  check(`fixture has curated station ${code}`, !!st);
  if (!st) continue;
  const res = runEngine(code, st);
  if (EXPECT_EXCLUDED.has(code)) {
    check(`${code} stays conservatively excluded`, !res.ok, res.ok ? "engine now models it — re-verify vs hand model before trusting" : "");
  } else {
    check(`${code} is modeled`, res.ok, res.ok ? "" : `excluded: ${(res as { excluded: { reason: string } }).excluded.reason}`);
    if (res.ok) {
      const problems = compareStationSemantics(res.result.models, curated);
      check(`${code} matches the hand model`, problems.length === 0, problems.join("; "));
    }
  }
}

// --- 2. Regressions ----------------------------------------------------------
{
  const res = runEngine("1CQ", fixture["1CQ"]!);
  check("Chappaqua is modeled", res.ok);
  if (res.ok) {
    const models = res.result.models;
    check("Chappaqua: one chain", models.length === 1);
    const m = models[0]!;
    check("Chappaqua: two segments (parking->overpass, overpass->island)", m.segments.length === 2);
    const ids = m.segments.map((s) => s.elevators.map((e) => e.externalId).join(","));
    check("Chappaqua: 148P is the sole street leg", ids[0] === "1CQ-148P", `got [${ids[0]}]`);
    check("Chappaqua: 148I is the sole platform leg", ids[1] === "1CQ-148I", `got [${ids[1]}]`);
    check(
      "Chappaqua: a lone 148I outage severs the chain (the reported real-world case)",
      !stationAccessible({ systemId: "mta-mnr", ...m }, new Set(["1CQ-148I"])),
    );
    check(
      "Chappaqua: a lone 148P outage also severs it (required street leg)",
      !stationAccessible({ systemId: "mta-mnr", ...m }, new Set(["1CQ-148P"])),
    );
  }
}
{
  const res = runEngine("2FM", fixture["2FM"]!);
  check(
    "Fairfield-Black Rock is excluded (platform-only unit, origin unknowable)",
    !res.ok && (res as { excluded: { reason: string } }).excluded.reason === "missing-origin",
  );
}

// --- 3. Committed-JSON invariants ---------------------------------------------
const curatedCodes = new Set(curatedByCode.keys());
check(
  "generated models never cover a curated station",
  generated.every((m) => !curatedCodes.has(m.stationExternalId)),
  generated.filter((m) => curatedCodes.has(m.stationExternalId)).map((m) => m.stationExternalId).join(","),
);
const handIds = new Set(MTA_RAIL_STATION_MODELS.flatMap((m) => m.segments.flatMap((s) => s.elevators.map((e) => e.externalId))));
const genIds = generated.flatMap((m) => m.segments.flatMap((s) => s.elevators.map((e) => e.externalId)));
check("generated models never reuse a curated elevator", genIds.every((id) => !handIds.has(id)));
check(
  "an elevator never spans two stations",
  generated.every((m) => m.segments.every((s) => s.elevators.every((e) => e.externalId.startsWith(`${m.stationExternalId}-`)))),
);
check(
  "every generated segment has at least one elevator",
  generated.every((m) => m.segments.length > 0 && m.segments.every((s) => s.elevators.length > 0)),
);
check(
  "no generated model claims a step-free alternative (humans only)",
  generated.every((m) => m.segments.every((s) => !s.stepFreeAlternative)),
);
check(
  `locked counts: ${LOCKED.chains} chains`,
  generated.length === LOCKED.chains,
  `got ${generated.length} — update LOCKED after a deliberate regeneration`,
);
check(
  `locked counts: ${LOCKED.stations} stations`,
  new Set(generated.map((m) => m.stationExternalId)).size === LOCKED.stations,
  `got ${new Set(generated.map((m) => m.stationExternalId)).size}`,
);

if (failures.length) {
  console.error(`\n✗ ${failures.length} check(s) FAILED (${passed} passed):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\n  all ${passed} rail-chain checks passed`);
