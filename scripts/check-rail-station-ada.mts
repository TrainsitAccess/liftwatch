// Offline regression for the LIRR/MNR station-ADA snapshot
// (src/catalog/mta-rail-data/station-ada.json, built by scripts/rail-station-ada.mts).
// Asserts the snapshot is well-formed and that known real stations reproduce
// their expected status + a non-empty explanation for every non-fully entry
// (the same "never a bare status word" guarantee as check:mta-ada), and that a
// fully-accessible station stays quiet (null explanation).

import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync("src/catalog/mta-rail-data/station-ada.json", "utf8")) as {
  railroads: Record<string, { stations: { code: string; name: string; ada: number; explanation: string | null }[] }>;
};

let pass = 0;
const fail: string[] = [];
const assert = (cond: boolean, msg: string) => (cond ? pass++ : fail.push(msg));

const lirr = data.railroads["mta-lirr"];
const mnr = data.railroads["mta-mnr"];
assert(!!lirr && !!mnr, "both mta-lirr and mta-mnr railroads present");
assert((lirr?.stations.length ?? 0) > 100, `expected 100+ LIRR stations, got ${lirr?.stations.length}`);
assert((mnr?.stations.length ?? 0) > 100, `expected 100+ MNR stations, got ${mnr?.stations.length}`);

const byCode = new Map<string, { code: string; name: string; ada: number; explanation: string | null }>();
for (const rr of [lirr, mnr]) for (const s of rr?.stations ?? []) byCode.set(s.code, s);

// A known FULL station stays quiet (ada 1, no explanation).
const jam = byCode.get("JAM");
assert(jam?.ada === 1, `Jamaica (JAM) should be fully accessible (ada 1), got ${jam?.ada}`);
assert(jam?.explanation === null, `Jamaica (JAM) fully accessible must have null explanation, got: ${jam?.explanation}`);

// A known NONE station: ada 0 + a real explanation.
const marble = byCode.get("0MB"); // Marble Hill (MNR)
assert(marble?.ada === 0, `Marble Hill (0MB) should be not accessible (ada 0), got ${marble?.ada}`);
assert(/not accessible/i.test(marble?.explanation ?? ""), `Marble Hill explanation must say not accessible, got: ${marble?.explanation}`);

// A known PARTIAL station: ada 2 + a real explanation.
const rowayton = byCode.get("2RO"); // Rowayton (MNR)
assert(rowayton?.ada === 2, `Rowayton (2RO) should be partially accessible (ada 2), got ${rowayton?.ada}`);
assert(/partially accessible/i.test(rowayton?.explanation ?? ""), `Rowayton explanation must say partially accessible, got: ${rowayton?.explanation}`);

// The join key is `code` == our rail stationExternalId — codes must be the raw
// station codes (LIRR all-letters, MNR digit-prefixed), never a synthesized id.
assert(byCode.has("EMT") && byCode.has("0BC"), "known LIRR (EMT) and MNR (0BC) codes present as-is");

// Every non-fully entry MUST carry a non-empty explanation; every fully entry
// MUST be quiet (null) — the core guarantees.
for (const s of byCode.values()) {
  if (s.ada !== 1 && !(s.explanation && s.explanation.trim().length > 0)) fail.push(`${s.code} ${s.name}: ada=${s.ada} but no explanation`);
  else if (s.ada !== 1) pass++;
  if (s.ada === 1 && s.explanation !== null) fail.push(`${s.code} ${s.name}: ada=1 but non-null explanation (should be quiet)`);
  else if (s.ada === 1) pass++;
}

console.log(`check:rail-station-ada — ${pass} passed, ${fail.length} failed`);
if (fail.length) { console.log("FAILURES:\n  " + fail.join("\n  ")); process.exit(1); }
console.log("  every partial/inaccessible LIRR/MNR station carries an explanation; fully-accessible ones stay quiet.");
