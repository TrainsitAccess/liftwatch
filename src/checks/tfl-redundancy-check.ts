import { readFileSync } from "node:fs";
import type { TflCatalogLift } from "../adapters/tfl/raw.js";

// Asserting regression check for the TfL redundancy import (scripts/tfl-import.mjs).
// These four cases were verified against TfL's real published topology data
// and must never silently flip when the catalog is re-imported. Redundancy is
// "two lifts sharing the exact same (FromAreas, ToAreas)" — NOT "2+ lifts at
// a station" (Kingsbury and King's Cross are the counter-examples that prove
// the distinction matters). Run: npm run check:tfl

const lifts: TflCatalogLift[] = JSON.parse(
  readFileSync(new URL("../catalog/tfl-data/lifts.json", import.meta.url), "utf8"),
);
const byId = new Map(lifts.map((l) => [l.id, l]));

let failures = 0;
function check(id: string, expected: boolean): void {
  const lift = byId.get(id);
  const actual = lift?.isRedundant;
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`    ${ok ? "PASS" : "FAIL"}  ${id.padEnd(22)} redundant=${actual} (want ${expected})`);
}

console.log("\n  Kingsbury — same origin, different platforms -> NOT redundant:");
check("940GZZLUKBY-Lift-1", false);
check("940GZZLUKBY-Lift-2", false);

console.log("\n  South Quay DLR — 3 lifts, identical route -> redundant:");
check("940GZZDLSIT-Lift-1", true);
check("940GZZDLSIT-Lift-2", true);
check("940GZZDLSIT-Lift-3", true);

console.log("\n  Poplar DLR — 2 lifts, identical route -> redundant:");
check("940GZZDLPOP-Lift-1", true);
check("940GZZDLPOP-Lift-2", true);

console.log("\n  King's Cross St Pancras — different legs of one journey -> NOT redundant:");
check("HUBKGX-Lift-A", false);
check("HUBKGX-Lift-B", false);

console.log(`\n  catalog size: ${new Set(lifts.map((l) => l.stationId)).size} stations, ${lifts.length} lifts`);

if (failures) {
  console.error(`\n  ${failures} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`\n  all 10 checks passed\n`);
}
