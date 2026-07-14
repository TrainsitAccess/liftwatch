// Offline asserting regression for the MBTA GTFS-pathways PROPOSAL generator
// (scripts/mbta-pathways.mts → mbta-data/pathway-chains*.json). These models
// are review proposals — deliberately NOT wired into station-models.ts; they
// ship one at a time via /liftwatch-station-review verdicts. This check keeps
// the proposal artifacts honest between regenerations.
// Run: npm run check:mbta-pathways

import { readFileSync } from "node:fs";
import { allElevators, type StationModel } from "../lib/accessibility.js";
import { MBTA_STATION_MODELS } from "../catalog/mbta-models.js";

const load = (f: string) => JSON.parse(readFileSync(new URL(`../catalog/mbta-data/${f}`, import.meta.url), "utf8"));
const proposals = load("pathway-chains.json") as { models: StationModel[] };
const excluded = load("pathway-chains-excluded.json") as { stations: { stationId: string; reason: string }[] };
const crossCheck = load("pathway-crosscheck.json") as { results: { stationId: string; tier: string; agrees: boolean }[] };
const generatedTier = load("chains.json") as { models: StationModel[] };
const fixture = load("fixture.json") as { stations: Record<string, { facilities: { id: string }[] }> };

let failures = 0;
const ok = (cond: boolean, msg: string): void => {
  if (!cond) failures++;
  console.log(`    ${cond ? "PASS" : "FAIL"}  ${msg}`);
};

console.log("\n  Proposal hygiene:");
ok(proposals.models.every((m) => m.systemId === "mbta-boston"), "every proposal is mbta-boston");
ok(proposals.models.every((m) => m.segments.length > 0 && m.segments.every((s) => s.elevators.length > 0)), "no empty segments/cuts");
ok(proposals.models.every((m) => allElevators(m).every((e) => !e.externalId.includes("pathway:"))),
  "no untrackable synthetic elevator ids (a member that can never match a live outage would under-warn)");
{
  const known = new Set(Object.values(fixture.stations).flatMap((s) => s.facilities.map((f) => f.id)));
  ok(proposals.models.every((m) => allElevators(m).every((e) => known.has(e.externalId))),
    "every proposal elevator id exists in the live-feed fixture (real, trackable facility)");
}

console.log("\n  Tier separation (proposals never overlap shipped tiers):");
{
  const curated = new Set(MBTA_STATION_MODELS.map((m) => m.stationExternalId));
  const generated = new Set(generatedTier.models.map((m) => m.stationExternalId));
  ok(proposals.models.every((m) => !curated.has(m.stationExternalId) && !generated.has(m.stationExternalId)),
    "no proposal station is already covered by the curated or serving-text tier");
}

console.log("\n  Cross-tier validation (the generator must keep reproducing the trusted tiers):");
{
  const agree = crossCheck.results.filter((r) => r.agrees).length;
  const disagreeIds = crossCheck.results.filter((r) => !r.agrees).map((r) => r.stationId).sort();
  ok(disagreeIds.every((id) => ["place-alfcl", "place-brntn"].includes(id)),
    `no NEW cross-tier disagreements beyond the two known garage-elevator cases (${agree}/${crossCheck.results.length} agree; diffs: ${disagreeIds.join(", ") || "none"})`);
  ok(crossCheck.results.length >= 25, "cross-check still covers the trusted tiers broadly");
}

console.log("\n  Agency-declaration gate (excludes-stop):");
for (const id of ["place-chmnl", "place-jfk", "place-smmnl"]) {
  ok(excluded.stations.some((s) => s.stationId === id && s.reason === "impact-contradiction"),
    `${id} excluded via impact-contradiction (graph vs facilities_properties serves-declaration — walkthrough item)`);
}

console.log("\n  Known regressions:");
{
  const aq = proposals.models.filter((m) => m.stationExternalId === "place-aqucl");
  ok(aq.length === 2, "Aquarium proposes two per-direction chains");
  const cuts = aq.flatMap((m) => m.segments.map((s) => s.elevators.map((e) => e.externalId).sort().join("+")));
  ok(cuts.includes("915+925"), "Aquarium: both street legs form a cut (915|925) — Reading A from the agency's own graph");
  const wl = excluded.stations.find((s) => s.stationId === "place-welln");
  ok(wl?.reason === "guidance-contradiction",
    "Wellington stays excluded via guidance-contradiction (matches the serving-text tier's historical declared-alternate-mismatch)");
  ok(excluded.stations.some((s) => s.stationId === "place-sstat" && s.reason === "untrackable-elevator"),
    "South Station refused (facility-less elevator pathway)");
  ok(proposals.models.some((m) => m.stationExternalId === "place-pktrm"), "Park Street has a proposal");
}

if (failures) {
  console.error(`\n  ${failures} CHECK(S) FAILED\n`);
  process.exit(1);
}
console.log("\n  all checks passed\n");
