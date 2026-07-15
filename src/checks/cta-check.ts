// Offline asserting regression for CTA's text-identity per-elevator build.
// Reads only committed JSON + code — no network, no DB.
//
// The core invariant: src/catalog/cta-data/observed-units.json records every
// alert text ever observed and the unit id it parsed to. Re-parsing every
// recorded text MUST reproduce its recorded unit id — a parser tweak that
// re-slugs history would silently fork the archive (one physical elevator's
// outages split across two unit ids), so it fails loudly here instead.
// Run: npm run check:cta

import { readFileSync } from "node:fs";
import { parseCtaElevatorIdentity } from "../adapters/cta/location.js";

const observed = JSON.parse(
  readFileSync(new URL("../catalog/cta-data/observed-units.json", import.meta.url), "utf8"),
) as { units: { unitId: string; stationId: string; texts: string[] }[] };

let failures = 0;
const ok = (cond: boolean, msg: string): void => {
  if (!cond) failures++;
  console.log(`    ${cond ? "PASS" : "FAIL"}  ${msg}`);
};

console.log("\n  Vocabulary contract (every observed text re-parses to its recorded unit id):");
let contractChecked = 0;
for (const u of observed.units) {
  for (const t of u.texts) {
    const slug = parseCtaElevatorIdentity(t);
    const id = slug ? `${u.stationId}-${slug}` : u.stationId;
    if (id !== u.unitId) ok(false, `"${t.slice(0, 90)}" → ${id}, recorded ${u.unitId}`);
    else contractChecked++;
  }
}
ok(contractChecked > 0, `${contractChecked} observed texts re-parse to their recorded unit ids`);

console.log("\n  Identity extraction (the live-observed traps, hardcoded):");
const p = parseCtaElevatorIdentity;
ok(p("The Harlem-bound platform elevator at Pulaski (Green Line) is temporarily out-of-service.") === "HARLEM-BOUND",
  "direction: Harlem-bound platform elevator → HARLEM-BOUND");
ok(p("The Harlem- bound platform elevator at Pulaski (Green Line) is temporarily out-of-service.") === "HARLEM-BOUND",
  "hyphen-space explosion collapses to the same id");
ok(p("The Harlem-bound elevator at King Drive (Green Line) is temporarily out-of-service.") === "HARLEM-BOUND",
  "missing 'platform' word still collapses to the same id");
ok(p("The 95th-bound and Loop-bound platform elevator at Wilson (Red, Purple Lines) is temporarily out-of-service.") === "95TH-LOOP-BOUND",
  "multi-direction island elevator: both directions, sorted");
ok(p("The 95th- and- Loop- bound platform elevator at Wilson (Red, Purple Lines) is temporarily out-of-service.") === "95TH-LOOP-BOUND",
  "fully-exploded multi-direction variant collapses to the same id");
ok(p("The 95th- and- Loop bound platform elevator at Howard (Red, Purple, Yellow Lines) is temporarily out-of-service.") === "95TH-LOOP-BOUND",
  "half-exploded variant collapses to the same id");
ok(p("The Loop- and 63rd-bound platform elevator at Morgan (Green, Pink Lines) is temporarily out-of-service.") === "63RD-LOOP-BOUND",
  "reversed multi-direction order (second direction named first) collapses to the same canonical id");
ok(p("Western Kimball-bound Platform Elevator Out of Service — The Kimball-bound platform elevator at Western Brown Line stn is temporarily out of service.") === "KIMBALL-BOUND",
  "station name in the headline ('Western') never leaks into the id");
ok(p("The elevator to/from street and elevators needed to access the Harlem-bound platforms at California (Green Line) is temporarily out-of-service.") === "STREET",
  "consequence clause ('elevators needed to access the Harlem-bound platforms') never leaks a direction");
ok(p("The elevator to/from street at California (Green Line) is temporarily out-of-service.") === "STREET",
  "…and the simple phrasing of the same elevator matches it");
ok(p("The elevator to/from 23rd street at Cermak-McCormick Place (Green Line) is temporarily out-of-service.") === "23RD-STREET",
  "a NAMED street is a distinct identity from the generic street leg");
ok(p("Elevator at Jackson Temporarily Out-of-Service — The elevator to/from platform at the Adams-Jackson entrance to Jackson (Red Line) is temporarily out-of-service.") === "ADAMS-JACKSON-PLATFORM",
  "entrance qualifier + leg");
ok(p("Elevator at Lake (Washington/Randolph Entrance) Temporarily Out-of-Service — The elevator to/from platform at Lake (Red Line) is temporarily out-of-service due to upgrades.") === "WASHINGTON-RANDOLPH-PLATFORM",
  "entrance carried only by the HEADLINE is still captured");
ok(p("The transfer tunnel elevator at Roosevelt (Red, Orange and Green Lines) is temporarily out-of-service.") === "TRANSFER-TUNNEL",
  "transfer tunnel");
ok(p("The Brown Line platform elevator at Washington/Wells is temporarily out-of-service.") === "BROWN-LINE-PLATFORM",
  "line-qualified platform at a transfer station");
ok(p("The South Terminal elevator to/from platform at 95th/Dan Ryan (Red Line) is temporarily out-of-service.") === "SOUTH-TERMINAL-PLATFORM",
  "named terminal + leg");
ok(p("The elevator to/from bus terminal and garage at Cumberland (Blue Line) is temporarily out-of-service.") === "BUS-TERMINAL-GARAGE",
  "compound leg (bus terminal and garage)");
ok(p("The elevator at Central (Green Line) is temporarily out-of-service.") === null,
  "vague text → null (adapter falls back to the bare station id — history continuity)");
ok(p("Elevator at Loyola Temporarily Out-of-Service — The elevator at Loyola ( Red Line) is temporarily out-of-service.") === null,
  "vague text with headline → still null");

console.log("\n  Distinctness (different elevators must never share an id):");
ok(p("The Kimball-bound platform elevator at Montrose (Brown Line) is temporarily out-of-service.") !==
   p("The Loop- bound platform elevator at Montrose (Brown Line) is temporarily out-of-service."),
  "Montrose Kimball-bound ≠ Loop-bound");
ok(p("The elevator to/from bus terminal and garage at Cumberland (Blue Line) is temporarily out-of-service.") !==
   p("The elevator to/from platform at Cumberland (Blue Line) is temporarily out-of-service."),
  "Cumberland garage leg ≠ platform leg");

console.log("\n  Snapshot hygiene:");
ok(observed.units.every((u) => u.unitId === u.stationId || u.unitId.startsWith(`${u.stationId}-`)),
  "every unit id is the station id or a station-prefixed identity");
ok(observed.units.every((u) => !/\bTHE\b/.test(u.unitId)), "no article artifacts in ids");
{
  const ids = observed.units.map((u) => u.unitId);
  ok(new Set(ids).size === ids.length, "no duplicate unit ids in the snapshot");
}

if (failures) {
  console.error(`\n  ${failures} CHECK(S) FAILED\n`);
  process.exit(1);
}
console.log("\n  all checks passed\n");
