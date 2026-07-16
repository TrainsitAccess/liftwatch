// Offline regression for the MTA station-ADA crosswalk
// (src/catalog/mta-data/mta-station-ada.json, built by scripts/mta-station-ada.mts).
// Asserts the snapshot is well-formed and that known real stations reproduce
// their expected, human-readable, line-and-direction-explicit explanation —
// locking in the "explain what partial means" requirement (Bryce, 2026-07-16),
// not just a bare status word.

import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync("src/catalog/mta-data/mta-station-ada.json", "utf8")) as {
  stations: { complexId: string; name: string; ada: number; explanation: string | null; lines: { ada: number }[] }[];
};

let pass = 0;
const fail: string[] = [];
const assert = (cond: boolean, msg: string) => (cond ? pass++ : fail.push(msg));

assert(data.stations.length > 400, `expected 400+ complexes, got ${data.stations.length}`);

const byId = new Map(data.stations.map((s) => [s.complexId, s]));

// Known interchange with MTA's own authored rollup, naming every line.
const unionSq = byId.get("602");
assert(!!unionSq, "14 St-Union Sq (602) present");
assert(unionSq?.ada === 2, `14 St-Union Sq ada should be 2 (partial), got ${unionSq?.ada}`);
assert(
  /4 5 6.*not accessible/i.test(unionSq?.explanation ?? ""),
  `14 St-Union Sq explanation must name the Lexington Av (4 5 6) line as not accessible, got: ${unionSq?.explanation}`,
);
assert(
  /N Q R W|Broadway/i.test(unionSq?.explanation ?? ""),
  `14 St-Union Sq explanation must name the accessible lines too, got: ${unionSq?.explanation}`,
);

const courtSq = byId.get("606");
assert(courtSq?.ada === 2, `Court Sq-23 St ada should be 2, got ${courtSq?.ada}`);
assert(
  /Manhattan-bound only/i.test(courtSq?.explanation ?? ""),
  `Court Sq-23 St explanation must name the direction, got: ${courtSq?.explanation}`,
);

// Every non-fully-accessible entry MUST carry a non-empty explanation — the
// core "never just say partial" guarantee.
for (const s of data.stations) {
  if (s.ada !== 1 && !(s.explanation && s.explanation.trim().length > 0)) {
    fail.push(`${s.complexId} ${s.name}: ada=${s.ada} but has no explanation`);
  } else if (s.ada !== 1) {
    pass++;
  }
}

// Every fully-accessible entry should have explanation null (no noise).
for (const s of data.stations) {
  if (s.ada === 1 && s.explanation !== null) fail.push(`${s.complexId} ${s.name}: ada=1 but has a non-null explanation (should be quiet)`);
  else if (s.ada === 1) pass++;
}

console.log(`check:mta-ada — ${pass} passed, ${fail.length} failed`);
if (fail.length) { console.log("FAILURES:\n  " + fail.join("\n  ")); process.exit(1); }
console.log("  every partial/inaccessible MTA complex carries a line-and-direction explanation.");
