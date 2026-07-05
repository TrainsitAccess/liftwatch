// One-time (re-run periodically by hand) build of TMB's elevator inventory
// catalog from TWO documented "transit" API endpoints:
//   GET /v1/transit/estacions                                (all station groups)
//   GET /v1/transit/estacions/{codi_grup_estacio}/accessos/fisics  (every physical
//     access unit at that station — elevators, stairs, ramps)
// Neither call needs a station-specific "accessos" code (live-verified
// 2026-07-05: omitting the trailing /{codi_acces} segment returns the whole
// station's accesses at once), so this fetches the ENTIRE network in ~140
// calls rather than one per individual access point.
//
// Same bundled-snapshot pattern as TfL (scripts/tfl-import.mjs): no confirmed
// live URL exists for a single "give me the whole network in one call" REST
// endpoint (only the per-station one), so we snapshot it here rather than
// re-fetching ~140 requests on every 10-minute poll. Only the live alerts
// feed (api.tmb.cat/v1/alerts/metro/channels/WEB) is polled in real time —
// see src/adapters/tmb/index.ts.
//
// Usage: node scripts/tmb-import.mjs
// Requires TMB_APP_ID / TMB_APP_KEY in .env (same credentials as the poller).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvVar(name) {
  const env = readFileSync(join(ROOT, ".env"), "utf8");
  const m = env.match(new RegExp(`^${name}=\\s*(.*)$`, "m"));
  const v = m?.[1]?.trim();
  if (!v) throw new Error(`${name} not set in .env`);
  return v;
}

const APP_ID = loadEnvVar("TMB_APP_ID");
const APP_KEY = loadEnvVar("TMB_APP_KEY");
const BASE = "https://api.tmb.cat/v1/transit";

async function getJson(path) {
  const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}app_id=${APP_ID}&app_key=${APP_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json();
}

// Fetch a batch of promises with limited concurrency (polite to the API).
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

console.log("Fetching all station groups...");
const stationsResp = await getJson("/estacions");
const stations = stationsResp.features.map((f) => f.properties);
console.log(`  ${stations.length} station groups`);

console.log("Fetching physical accesses per station (concurrency 5)...");
const perStation = await mapWithConcurrency(stations, 5, async (s) => {
  try {
    const resp = await getJson(`/estacions/${s.CODI_GRUP_ESTACIO}/accessos/fisics`);
    // Keep geometry paired with properties — the plain properties list alone
    // drops each feature's [lon, lat] coordinate.
    return resp.features.map((f) => ({ ...f.properties, coordinates: f.geometry?.coordinates ?? null }));
  } catch (err) {
    console.warn(`  ⚠ ${s.NOM_ESTACIO} (${s.CODI_GRUP_ESTACIO}): ${err.message}`);
    return [];
  }
});
const allAccesses = perStation.flat();
console.log(`  ${allAccesses.length} physical access units across the network`);

// ID_TIPUS_ACCES: 1 = Escala d'obra (stairs), 3 = Ascensor (elevator), 4 = Rampa.
// LiftWatch is elevators-only (same convention as every other system).
const elevators = allAccesses.filter((a) => a.ID_TIPUS_ACCES === 3);
console.log(`  ${elevators.length} elevators`);

mkdirSync(join(ROOT, "src/catalog/tmb-data"), { recursive: true });

const units = elevators.map((a) => ({
  id: String(a.ID_ACCES_FISIC),
  codiAcces: String(a.CODI_ACCES),
  stationGroupId: String(a.CODI_GRUP_ESTACIO),
  stationName: a.NOM_ESTACIO,
  entranceName: a.NOM_ACCES,
  longitude: a.coordinates?.[0] ?? null,
  latitude: a.coordinates?.[1] ?? null,
}));

writeFileSync(join(ROOT, "src/catalog/tmb-data/units.json"), JSON.stringify(units));
console.log(`\nWrote src/catalog/tmb-data/units.json — ${units.length} elevator units across ${new Set(units.map((u) => u.stationGroupId)).size} stations.`);
