import { readFileSync } from "node:fs";
import { allElevators, stationAccessible, type StationModel } from "../lib/accessibility.js";

// Offline asserting regression for TfL's multi-chain access models
// (scripts/tfl-chains.mjs -> src/catalog/tfl-data/chains.json). Reads only the
// committed JSON + the bundled lift catalog, so it runs with no network. Mirrors
// check:mta's core invariant: for every elevator in a generated chain, the
// model-DERIVED redundancy (does its own outage alone leave the chain
// accessible?) must match its own isRedundant flag from lifts.json — the same
// exact-tuple grouping tfl-import.mjs already computes and the live adapter
// already trusts (redundancy_source: "pathways"). Unlike MTA, no elevator here
// spans more than one chain (ambiguous/branching topology is excluded entirely
// by the generator), so this is a direct 1:1 check, not an aggregate one.
// A mismatch is expected and fine when the elevator is in evidenceExceptions —
// a TfL alert confirmed a real step-free alternative (a ramp, a different
// entrance) that lifts.json's lift-only topology can't see; mirrors MTA's
// REDUNDANCY_EXCEPTIONS pattern exactly.
// Run: npm run check:tfl-chains

interface CatalogLift { id: string; isRedundant: boolean }
const lifts = JSON.parse(readFileSync(new URL("../catalog/tfl-data/lifts.json", import.meta.url), "utf8")) as CatalogLift[];
const liftById = new Map(lifts.map((l) => [l.id, l]));

const data = JSON.parse(readFileSync(new URL("../catalog/tfl-data/chains.json", import.meta.url), "utf8")) as {
  models: StationModel[];
  evidenceExceptions?: Record<string, string>;
};
const evidenceExceptions = data.evidenceExceptions ?? {};
const excluded = JSON.parse(readFileSync(new URL("../catalog/tfl-data/chains-excluded.json", import.meta.url), "utf8")) as {
  excludedStationCount: number;
  excluded: { station: string; stationId: string }[];
};

let failures = 0;
const ok = (cond: boolean, msg: string): void => {
  if (!cond) failures++;
  console.log(`    ${cond ? "PASS" : "FAIL"}  ${msg}`);
};

console.log("\n  Redundancy consistency (derived vs lifts.json's own isRedundant, 1:1 — no chain overlap by construction):");
let checked = 0;
let exceptionsUsed = 0;
for (const m of data.models) {
  for (const el of allElevators(m)) {
    const catalogLift = liftById.get(el.externalId);
    if (!catalogLift) { ok(false, `${m.stationExternalId}${m.chainLabel ?? ""} ${el.externalId}: not in lifts.json`); continue; }
    const derived = stationAccessible(m, new Set([el.externalId]));
    if (derived === catalogLift.isRedundant) { checked++; continue; }
    if (el.externalId in evidenceExceptions) { exceptionsUsed++; continue; }
    ok(false, `${m.stationExternalId}${m.chainLabel ?? ""} ${el.externalId}: derived redundant=${derived} but catalog isRedundant=${catalogLift.isRedundant} with no documented exception`);
  }
}
ok(checked > 0, `${checked} elevators consistent with their own catalog isRedundant flag (${exceptionsUsed} documented alert-evidence exceptions applied)`);

console.log("\n  No elevator appears in more than one chain (the generator's core safety invariant):");
const chainCountByElevator = new Map<string, number>();
for (const m of data.models) for (const el of allElevators(m)) chainCountByElevator.set(el.externalId, (chainCountByElevator.get(el.externalId) ?? 0) + 1);
const overlapping = [...chainCountByElevator.entries()].filter(([, n]) => n > 1);
ok(overlapping.length === 0, `every modeled elevator belongs to exactly one chain (${overlapping.length} overlap(s) found)`);

console.log("\n  No excluded (ambiguous) elevator leaked into the modeled set:");
const excludedLiftIds = new Set(
  (JSON.parse(readFileSync(new URL("../catalog/tfl-data/chains-excluded.json", import.meta.url), "utf8")) as { excluded: { lifts: string[] }[] })
    .excluded.flatMap((e) => e.lifts),
);
const modeledLiftIds = new Set(data.models.flatMap((m) => allElevators(m).map((e) => e.externalId)));
const leaked = [...excludedLiftIds].filter((id) => modeledLiftIds.has(id));
ok(leaked.length === 0, `no excluded lift also appears in chains.json (${leaked.length} leaked)`);

console.log("\n  Verified structural facts (locked from the generator's own analysis):");
const chainsFor = (stationId: string) => data.models.filter((m) => m.stationExternalId === stationId);
const labelsFor = (stationId: string) => chainsFor(stationId).map((m) => m.chainLabel?.trim()).sort();

// Willesden Junction: the Bakerloo-platform lift and the National Rail
// high-level-platform lift share zero area-code nodes — a real, verified
// two-independent-route split (matches the live TfL alert text seen during
// the scouting pass: a fault on one lift only affects "the Bakerloo line and
// the Lioness line", not the whole station).
ok(JSON.stringify(labelsFor("HUBWIJ")) === JSON.stringify(["(Route 1)", "(Route 2)"]), "Willesden Junction splits into two independent routes");

// Alert-evidence enrichment: Hackney Wick's Lift-1 outage alert names a real
// ramp bypass ("use the ramp on Hepscott Road") that lifts.json's lift-only
// topology can't see. This stays true even after that outage closes — the
// archive keeps closed events' reason text permanently.
const hackneyWick = chainsFor("910GHACKNYW").find((m) => m.chainLabel?.trim() === "(Route 1)");
ok(
  hackneyWick?.segments.some((s) => s.stepFreeAlternative) === true && "910GHACKNYW-Lift-1" in evidenceExceptions,
  "Hackney Wick's Lift-1 got a TfL alert-confirmed step-free alternative applied",
);

// Known major interchanges (branching hub topology) must have their complex
// core excluded pending a human review pass — same precedent as MTA's
// hand-authored interchanges. Some may still contribute a small, genuinely
// unambiguous peripheral chain (e.g. Bank's Lift-8/Lift-9 form a clean 2-lift
// route separate from its tangled 8-lift core) — that's fine; the invariant
// is that the STATION as a whole is not fully auto-resolved without review.
// A regression here would mean the generator got less conservative about the
// core ambiguity without a human decision to match.
const excludedStationIds = new Set(excluded.excluded.map((e) => e.stationId));
for (const [name, id] of [
  ["Bank", "HUBBAN"],
  ["King's Cross St Pancras", "HUBKGX"],
  ["Stratford", "HUBSRA"],
  ["Tottenham Court Road", "HUBTCR"],
] as const) {
  ok(excludedStationIds.has(id), `${name} still has ambiguous topology excluded pending human review`);
}

// Paddington graduated from that list on 2026-07-14: TfL's published
// ramp/same-level paths (step-free-paths.json) contracted its branching into
// four clean routes — including the Elizabeth-line side's two genuine
// redundant pairs (Lift-6/7 and Lift-8/9). Pin the shape so a future data or
// generator change that silently degrades it fails loudly.
{
  const pad = chainsFor("HUBPAD");
  ok(pad.length === 4 && !excludedStationIds.has("HUBPAD"), "Paddington fully auto-resolved into four routes (step-free paths, 2026-07-14)");
  const pairSegs = pad.flatMap((m) => m.segments).filter((s) => s.elevators.length === 2).map((s) => s.elevators.map((e) => e.externalId).sort().join("+"));
  ok(pairSegs.includes("HUBPAD-Lift-6+HUBPAD-Lift-7") && pairSegs.includes("HUBPAD-Lift-8+HUBPAD-Lift-9"),
    "Paddington keeps its two genuine redundant pairs (6/7, 8/9)");
}

// Any station with excluded (unmodeled) lifts alongside a safe chain must
// label that chain — otherwise it would appear under the bare station name,
// indistinguishable from a fallback row about one of the unmodeled lifts.
const unlabeledWithExcludedSiblings = [...new Set(data.models.map((m) => m.stationExternalId))].filter(
  (sid) => excludedStationIds.has(sid) && chainsFor(sid).some((m) => !m.chainLabel),
);
ok(unlabeledWithExcludedSiblings.length === 0, `no station mixes a labeled and an unlabeled chain with excluded siblings (${unlabeledWithExcludedSiblings.length} found)`);

ok(data.models.length > 100, `a substantial majority of TfL's lift-equipped stations are modeled (${data.models.length} chains)`);

console.log(`\n  ${failures === 0 ? "all checks passed" : `${failures} check(s) FAILED`}\n`);
if (failures > 0) process.exitCode = 1;
