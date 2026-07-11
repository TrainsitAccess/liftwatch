// Offline regression check for the MBTA chain generator. Run:
//   npm run check:mbta-chains
//
// Re-runs the mapper + engine + declared-alternate validation against the
// committed FULL-FEED fixture (src/catalog/mbta-data/fixture.json — every
// elevator-equipped station, written by scripts/mbta-chains.mts) and asserts,
// with no network:
//   1. REPRODUCTION — the committed chains.json is exactly what the fixture
//      regenerates (station set + chain count + per-elevator membership), so
//      mapper/engine edits can't silently drift the shipped models;
//   2. VALIDATION SEMANTICS — every modeled elevator with a usable
//      alternate-service declaration agrees with its topology-derived
//      redundancy (the in-feed answer key holds);
//   3. INVARIANTS — no generated model claims a stepFreeAlternative (humans
//      only); every model's elevators belong to its own station's facility
//      set; locked counts catch accidental drift (update on deliberate
//      regeneration);
//   4. REGRESSIONS — the detour-precedence rule (a ride-around that NAMES an
//      elevator is still a detour: Fields Corner) and the one live
//      topology-vs-guidance disagreement (Wellington) staying excluded.

import { classifyMbtaUnit } from "../adapters/mbta/chain-mapper.js";
import { inferStationChains } from "../lib/chain-inference.js";
import { allElevators, stationAccessible, type StationModel } from "../lib/accessibility.js";
import fixtureJson from "../catalog/mbta-data/fixture.json" with { type: "json" };
import chainsJson from "../catalog/mbta-data/chains.json" with { type: "json" };

// Locked counts — regenerate via `npm run mbta:chains`, then update here.
const LOCKED = { chains: 60, stations: 39 };

interface FixtureStation {
  name: string;
  wheelchairBoarding: number | null;
  facilities: { id: string; longName: string; altText: string | null }[];
}
const fixture = (fixtureJson as { stations: Record<string, FixtureStation> }).stations;
const committed = (chainsJson as { models: StationModel[] }).models;

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) passed++;
  else failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

// The same declared-alternate parser the generator uses, duplicated here as a
// FROZEN copy on purpose: if the generator's parsing changes behavior, the
// reproduction check below fails loudly instead of both halves drifting
// together.
type Declared = { kind: "named"; ids: string[] } | { kind: "personnel" } | { kind: "detour" } | { kind: "street" } | { kind: "none" };
function parseAlternate(text: string | null): Declared {
  if (!text || !text.trim()) return { kind: "none" };
  if (/exit the train at\s|\btake an?\s+[\w\s\/&-]*-?bound\b|then take an?\b|shuttle/i.test(text)) return { kind: "detour" };
  const ids = [...text.matchAll(/[Ee]levators?\s+#?(\d+(?:\s*(?:,|or|and|&)\s*\d+)*)/g)].flatMap((m) => m[1]!.match(/\d+/g) ?? []);
  if (ids.length) return { kind: "named", ids: [...new Set(ids)] };
  if (/station personnel|customer service|for assistance/i.test(text)) return { kind: "personnel" };
  if (/street|cross|walk|ramp|entrance/i.test(text)) return { kind: "street" };
  return { kind: "none" };
}

// Regenerate everything from the fixture.
const regen: StationModel[] = [];
const regenExcluded = new Map<string, string>(); // stopId -> reason
for (const [stopId, st] of Object.entries(fixture)) {
  const units = st.facilities.map((f) => classifyMbtaUnit(f.id, f.longName));
  const inference = inferStationChains({
    stationExternalId: stopId,
    name: st.name,
    accessibilityFull: st.wheelchairBoarding === 1,
    units,
  });
  if (!inference.ok) {
    regenExcluded.set(stopId, inference.excluded.reason);
    continue;
  }
  const models = inference.result.models.map((m) => ({ systemId: "mbta-boston", ...m }));
  const stationIds = new Set(st.facilities.map((f) => f.id));
  const memberIds = new Set(models.flatMap((m) => allElevators(m).map((e) => e.externalId)));
  let mismatch = false;
  for (const f of st.facilities) {
    if (!memberIds.has(f.id)) continue;
    const topologyRedundant = !models.some((m) => !stationAccessible(m, new Set([f.id])));
    const d = parseAlternate(f.altText);
    if (d.kind === "named") {
      const expect = d.ids.some((id) => stationIds.has(id) && id !== f.id);
      if (topologyRedundant !== expect) { mismatch = true; break; }
    } else if ((d.kind === "personnel" || d.kind === "detour") && topologyRedundant) { mismatch = true; break; }
  }
  if (mismatch) {
    regenExcluded.set(stopId, "declared-alternate-mismatch");
    continue;
  }
  regen.push(...models);
}

// --- 1. Reproduction -----------------------------------------------------------
const keyOf = (models: StationModel[]) =>
  models
    .map((m) => `${m.stationExternalId}${m.chainLabel ?? ""}:${m.segments.map((s) => s.elevators.map((e) => e.externalId).sort().join(",")).join("|")}`)
    .sort()
    .join("\n");
check("fixture regenerates the committed chains exactly", keyOf(regen) === keyOf(committed),
  `regenerated ${regen.length} chains vs committed ${committed.length}`);

// --- 3. Invariants ---------------------------------------------------------------
check("no generated model claims a step-free alternative (humans only)",
  committed.every((m) => m.segments.every((s) => !s.stepFreeAlternative)));
const facilityStation = new Map<string, string>();
for (const [stopId, st] of Object.entries(fixture)) for (const f of st.facilities) facilityStation.set(f.id, stopId);
check("every model's elevators belong to its own station",
  committed.every((m) => allElevators(m).every((e) => facilityStation.get(e.externalId) === m.stationExternalId)));
check(`locked counts: ${LOCKED.chains} chains`, committed.length === LOCKED.chains, `got ${committed.length}`);
check(`locked counts: ${LOCKED.stations} stations`,
  new Set(committed.map((m) => m.stationExternalId)).size === LOCKED.stations,
  `got ${new Set(committed.map((m) => m.stationExternalId)).size}`);

// --- 4. Regressions ---------------------------------------------------------------
{
  // Fields Corner: guidance names elevator 958 but only via a ride-around —
  // detour precedence must keep reading it as a detour, so the station models
  // cleanly with per-platform sole access.
  const fc = fixture["place-fldcr"];
  check("fixture has Fields Corner", !!fc);
  if (fc) {
    const alt = fc.facilities.find((f) => f.id === "957")?.altText ?? null;
    check("Fields Corner 957 guidance parses as a detour, not a named backup", parseAlternate(alt).kind === "detour");
    check("Fields Corner is modeled", committed.some((m) => m.stationExternalId === "place-fldcr"));
    const models = committed.filter((m) => m.stationExternalId === "place-fldcr");
    check("Fields Corner 957 is sole access on its own chain",
      models.some((m) => !stationAccessible(m, new Set(["957"]))));
  }
}
check("Wellington stays excluded (center-platform subtlety — human review)",
  regenExcluded.get("place-welln") === "declared-alternate-mismatch" && !committed.some((m) => m.stationExternalId === "place-welln"),
  `got ${regenExcluded.get("place-welln") ?? "modeled"}`);

if (failures.length) {
  console.error(`\n✗ ${failures.length} check(s) FAILED (${passed} passed):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\n  all ${passed} MBTA-chain checks passed`);
