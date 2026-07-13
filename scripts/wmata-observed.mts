// Snapshot every WMATA elevator UnitName ever OBSERVED — from the Supabase
// archive (units discovered as they broke) merged with the current live
// Incidents feed — into src/catalog/wmata-data/observed-units.json.
//
// Why this exists: WMATA's GTFS pathways graph UNDERCOUNTS elevators at some
// stations (live-verified 2026-07-13: Forest Glen B09 has one mode-5 component
// but three real UnitNames "between mezzanine and platform" — an elevator BANK
// drawn as one pathway; Mt Vernon Sq E01 has two platform elevators vs one in
// GTFS; Rockville A14's two pedestrian-bridge elevators are absent entirely).
// A station modeled from an undercounted graph could read ACCESSIBLE while a
// real, unmapped elevator is the one that broke — the under-warn this project
// never tolerates. scripts/wmata-pathways.mts consumes this snapshot as a
// cross-check gate: any modeled station whose observed units exceed or cannot
// map onto its GTFS segments is excluded to chains-excluded.json instead.
//
// The snapshot only ever GROWS (units are observed when they break; absence
// from today's feed means working, not gone) — the merge keeps every previously
// committed entry. Garage/parking elevators are tracked per the universal
// policy (every elevator an agency reports is tracked) but are never chain
// members unless the agency or a human confirms the route.
//
// Usage: npx tsx scripts/wmata-observed.mts   (needs .env: WMATA_API_KEY;
//        SUPABASE_URL + SUPABASE_SERVICE_KEY optional — live-only merge without)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { getSupabase } from "../src/lib/supabase.js";

const outPath = fileURLToPath(new URL("../src/catalog/wmata-data/observed-units.json", import.meta.url));

interface Observed { unitName: string; stationCode: string; stationName?: string; location: string; firstObserved: string }
const byName = new Map<string, Observed>();

// 1) previously committed snapshot (never lose an observation)
if (existsSync(outPath)) {
  const prev = JSON.parse(readFileSync(outPath, "utf8")) as { units: Observed[] };
  for (const u of prev.units) byName.set(u.unitName, u);
}

// 2) the archive (every unit ingest ever discovered)
const db = getSupabase();
if (db) {
  const { data, error } = await db
    .from("units")
    .select("external_id, station_id, description, first_seen")
    .eq("system_id", "wmata-dc")
    .order("external_id");
  if (error) throw new Error(`archive query failed: ${error.message}`);
  for (const u of data) {
    const stationCode = (u.station_id ?? "").replace(/^wmata-dc:/, "");
    if (!byName.has(u.external_id)) {
      byName.set(u.external_id, {
        unitName: u.external_id,
        stationCode,
        location: (u.description ?? "").trim(),
        firstObserved: u.first_seen ?? new Date().toISOString(),
      });
    }
  }
} else {
  console.warn("no SUPABASE_* creds — merging live feed into the existing snapshot only");
}

// 3) the live feed (catches units broken right now that predate the archive)
const apiKey = process.env.WMATA_API_KEY;
if (!apiKey) throw new Error("WMATA_API_KEY is not set");
const res = await fetch("https://api.wmata.com/Incidents.svc/json/ElevatorIncidents", {
  headers: { accept: "application/json", api_key: apiKey },
  signal: AbortSignal.timeout(30_000),
});
if (!res.ok) throw new Error(`Incidents feed HTTP ${res.status}`);
const incidents = ((await res.json()) as { ElevatorIncidents?: { UnitType?: string; UnitName: string; StationCode: string; StationName?: string; LocationDescription?: string }[] }).ElevatorIncidents ?? [];
for (const i of incidents) {
  if ((i.UnitType ?? "").toUpperCase() !== "ELEVATOR") continue;
  if (!byName.has(i.UnitName)) {
    byName.set(i.UnitName, {
      unitName: i.UnitName,
      stationCode: i.StationCode,
      stationName: i.StationName,
      location: (i.LocationDescription ?? "").trim(),
      firstObserved: new Date().toISOString(),
    });
  }
}

const units = [...byName.values()].sort((a, b) => a.unitName.localeCompare(b.unitName));
writeFileSync(outPath, JSON.stringify({
  updatedAt: new Date().toISOString(),
  note: "Every WMATA elevator UnitName ever observed (archive + live feed). Grows only. Consumed by scripts/wmata-pathways.mts as an undercount/vocabulary gate.",
  units,
}, null, 2) + "\n");
const garage = units.filter((u) => /garage|parking/i.test(u.location)).length;
console.log(`observed-units.json: ${units.length} units (${garage} garage/parking) across ${new Set(units.map((u) => u.stationCode)).size} stations`);
