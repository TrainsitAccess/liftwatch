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

// A known PARTIAL station: ada 2 + MTA's OWN specific "what partial means" text
// (from mta-ada-details.json), not the generic fallback.
const rowayton = byCode.get("2RO"); // Rowayton (MNR)
assert(rowayton?.ada === 2, `Rowayton (2RO) should be partially accessible (ada 2), got ${rowayton?.ada}`);
assert(
  /no accessible path between the platforms/i.test(rowayton?.explanation ?? "") && /Darien.*South Norwalk/i.test(rowayton?.explanation ?? ""),
  `Rowayton explanation must carry MTA's specific text (no accessible path between platforms; nearest Darien/South Norwalk), got: ${rowayton?.explanation}`,
);

// Every station in mta-ada-details.json must have its MTA text applied verbatim
// in the snapshot — locks the PARTIAL enrichment so a regeneration can't drop it.
const details = JSON.parse(readFileSync("src/catalog/mta-rail-data/mta-ada-details.json", "utf8")) as { details: Record<string, string> };
for (const [code, text] of Object.entries(details.details)) {
  const s = byCode.get(code);
  if (!s) fail.push(`mta-ada-details has ${code} but it's absent from station-ada.json`);
  else if (s.explanation !== text) fail.push(`${code} ${s.name}: explanation is not MTA's detail text`);
  else pass++;
}
assert(Object.keys(details.details).length >= 18, `expected 18+ MTA detail entries, got ${Object.keys(details.details).length}`);

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
