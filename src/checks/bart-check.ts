// Offline asserting regression + independent ground-truth audit for the BART
// curated models. Two layers in one (see MODELING-PLAYBOOK.md Part V):
//   (1) SELF-CHECK — model hygiene + the adapter's attribution crosswalk.
//   (2) INDEPENDENT AUDIT — reconcile every modeled elevator against the ADA
//       settlement's per-elevator inventory (bart-data/settlement-elevator-
//       inventory.json), which is derived from BART's OWN asset ids, not from
//       our model's assumptions. Catches a fabricated/typo id or a station
//       mis-key the self-check can't see.
// Reads only committed JSON + code — no network, no keys. Run: npm run check:bart
import { readFileSync } from "node:fs";
import { stationModelsFor } from "../catalog/station-models.js";
import { allElevators, attributeOutageAcrossChains, elevatorRedundant, platformDefaultElevator, type StationModel } from "../lib/accessibility.js";

const inv = JSON.parse(
  readFileSync(new URL("../catalog/bart-data/settlement-elevator-inventory.json", import.meta.url), "utf8"),
) as { elevators: { id: string; abbr: string; func: string }[] };

const invById = new Map(inv.elevators.map((e) => [e.id, e]));
const models = stationModelsFor("bart-bay-area");
const chains: StationModel[] = [...models.values()].flat();

let failures = 0;
const ok = (cond: boolean, msg: string): void => {
  if (!cond) failures++;
  console.log(`    ${cond ? "PASS" : "FAIL"}  ${msg}`);
};

const isRealAssetId = (id: string) => /^[A-Z][0-9]{2}-[0-9]+$/.test(id);

// Elevators deliberately kept on descriptive ids: the settlement has no clean
// match (garages excluded from its 87 station elevators; Millbrae's Caltrain/
// plaza access; a pedestrian tunnel/arena bridge). Documented in
// bart-station-models.ts's header + bart-ada-settlement.md.
const KNOWN_INVENTED = new Set<string>([
  "MLBR-CALTRAIN-NB", "MLBR-EAST-PLAZA", "MLBR-GARAGE", "MLBR-WEST-PLAZA",
  "DALY-TUNNEL", "COLS-ARENA", "WDUB-GAR-N1", "WDUB-GAR-N2", "WDUB-GAR-S1", "WDUB-GAR-S2",
]);

console.log("\n  Ground-truth reconciliation (every real-asset-id elevator exists in the ADA-settlement inventory, right station):");
let realCount = 0;
for (const m of chains) {
  const abbr = m.stationExternalId;
  for (const e of allElevators(m)) {
    const id = e.externalId;
    if (isRealAssetId(id)) {
      realCount++;
      const inv1 = invById.get(id);
      if (!inv1) ok(false, `${id} (${abbr}): real-format id NOT in settlement inventory (possible typo/fabrication)`);
      else if (inv1.abbr !== abbr) ok(false, `${id}: settlement places it at ${inv1.abbr}, model at ${abbr}`);
    } else if (!KNOWN_INVENTED.has(id)) {
      ok(false, `${id} (${abbr}): non-asset-format id that is NOT a documented invented remnant`);
    }
  }
}
ok(realCount >= 85, `${realCount} elevators carry real BART asset ids (expected ~87)`);

console.log("\n  Invented-remnant registry (each documented id still exists; each documented station reachable):");
for (const id of KNOWN_INVENTED) {
  ok(chains.some((m) => allElevators(m).some((e) => e.externalId === id)), `documented invented id still present: ${id}`);
}

console.log("\n  Model hygiene:");
ok(chains.every((m) => m.systemId === "bart-bay-area"), "every model is bart-bay-area");
ok(chains.every((m) => m.segments.length > 0 && m.segments.every((s) => s.elevators.length > 0)), "no empty segments");
{
  // an elevator id may repeat within a station (shared prerequisite across
  // chains) but must never appear under two different stations.
  const stationsById = new Map<string, Set<string>>();
  for (const m of chains) for (const e of allElevators(m)) {
    (stationsById.get(e.externalId) ?? stationsById.set(e.externalId, new Set()).get(e.externalId)!).add(m.stationExternalId);
  }
  const cross = [...stationsById].filter(([, s]) => s.size > 1);
  ok(cross.length === 0, `no elevator id spans two stations${cross.length ? " (" + cross.map(([id]) => id).join(", ") + ")" : ""}`);
}

console.log("\n  Attribution crosswalk (matchHints resolve to the right real id — regression for the 2026-07-20 re-source):");
{
  const rich = models.get("RICH") ?? [];
  const plat = platformDefaultElevator(rich);
  ok(plat?.elevatorExternalId === "R60-51", "RICH bare 'Station' advisory → platform default R60-51 (real id)");
  const powl = models.get("POWL") ?? [];
  ok(platformDefaultElevator(powl)?.elevatorExternalId === "M30-55", "POWL platform default → M30-55 (real id)");
  const embr = models.get("EMBR") ?? [];
  const streetAttr = attributeOutageAcrossChains("Street Elevator (Market and Drumm)", embr);
  ok(streetAttr?.elevatorExternalId === "M16-62", "EMBR 'street' advisory → street elevator M16-62 (real id)");
  const platAttr = attributeOutageAcrossChains("Platform Elevator", embr);
  ok(platAttr?.elevatorExternalId === "M16-63", "EMBR 'platform' advisory → platform elevator M16-63 (real id)");
}

console.log("\n  Redundancy sanity (derived, not hand-set — a real signal must back each redundant station):");
{
  const redundantStations = [...models].filter(([, ch]) =>
    ch.some((m) => allElevators(m).some((e) => elevatorRedundant(m, e.externalId))),
  ).map(([abbr]) => abbr);
  // These are the stations whose curated structure yields single-fault tolerance;
  // each was confirmed against BART's own outage-options page (bart.gov/.../accessible).
  ok(redundantStations.length >= 8, `${redundantStations.length} stations derive redundancy (all page-confirmed): ${redundantStations.sort().join(", ")}`);
}

if (failures) {
  console.error(`\n  ${failures} CHECK(S) FAILED\n`);
  process.exit(1);
}
console.log("\n  all checks passed\n");
