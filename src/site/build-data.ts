import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { getSystem } from "../catalog/systems.js";
import { getSupabase } from "../lib/supabase.js";

// Snapshot the archive into site/data.json for the static site. Server-side
// (service key) so the site itself needs no credentials. Run: npm run site:data

const db = getSupabase();
if (!db) {
  console.error("No SUPABASE_* env configured — fill in .env first.");
  process.exit(1);
}

const [systems, units, stations, events] = await Promise.all([
  db.from("systems").select("id, short_name, city, metro_area, data_quality"),
  db.from("units").select("id, system_id, station_id, external_id, description, is_active, is_redundant"),
  db.from("stations").select("id, name"),
  db
    .from("outage_events")
    .select("unit_id, system_id, station_id, is_planned, reason, started_at, source_started_at, attributed")
    .is("ended_at", null),
]);
for (const [label, r] of Object.entries({ systems, units, stations, events })) {
  if (r.error) throw new Error(`${label}: ${r.error.message}`);
}

const stationName = new Map((stations.data ?? []).map((s) => [s.id as string, s.name as string]));
const unitById = new Map((units.data ?? []).map((u) => [u.id as string, u]));

const now = Date.now();
const openBySystem = new Map<string, number>();
const unplannedBySystem = new Map<string, number>();
for (const e of events.data ?? []) {
  openBySystem.set(e.system_id, (openBySystem.get(e.system_id) ?? 0) + 1);
  if (!e.is_planned) unplannedBySystem.set(e.system_id, (unplannedBySystem.get(e.system_id) ?? 0) + 1);
}

const systemRows = (systems.data ?? [])
  .map((s) => {
    // A system with an incomplete inventory (feed lists broken units only —
    // WMATA) has no honest denominator: pctDown/activeUnits become null.
    const catalogEntry = getSystem(s.id as string);
    const inventoryComplete = catalogEntry?.inventoryComplete !== false;
    const active = (units.data ?? []).filter((u) => u.system_id === s.id && u.is_active).length;
    const down = openBySystem.get(s.id) ?? 0;
    const staticFleet = catalogEntry?.staticFleetReference;

    // Denominator: a live active-unit count when the inventory is complete;
    // otherwise the agency's published static total, if one exists. Either
    // way pctDown participates in ranking — fleetSource records which kind of
    // denominator produced it, so the site can mark static ones distinctly
    // (asterisk + source/date) rather than presenting them as equally live.
    const fleetSource: "live" | "static" | "none" = inventoryComplete
      ? "live"
      : staticFleet
        ? "static"
        : "none";
    const fleetTotal = inventoryComplete ? active : (staticFleet?.totalUnits ?? null);

    return {
      id: s.id,
      name: s.short_name as string,
      city: s.city as string,
      dataQuality: s.data_quality as string,
      inventoryComplete,
      fleetSource,
      activeUnits: fleetTotal,
      down,
      downUnplanned: unplannedBySystem.get(s.id) ?? 0,
      pctDown: fleetTotal ? Math.round((down / fleetTotal) * 1000) / 10 : null,
      staticFleetAsOf: staticFleet?.asOfDate ?? null,
      staticFleetSource: staticFleet?.source ?? null,
    };
  })
  .sort((a, b) => (b.pctDown ?? -1) - (a.pctDown ?? -1));

const outageRows = (events.data ?? [])
  .map((e) => {
    const unit = unitById.get(e.unit_id as string);
    const since = e.source_started_at ?? e.started_at;
    const days = Math.max(0, Math.floor((now - Date.parse(since as string)) / 86_400_000));
    return {
      system: (systems.data ?? []).find((s) => s.id === e.system_id)?.short_name ?? e.system_id,
      station: stationName.get((e.station_id ?? unit?.station_id) as string) ?? "Unknown",
      unit: (unit?.external_id as string) ?? "?",
      soleAccess: unit?.is_redundant === false,
      planned: e.is_planned as boolean,
      days,
    };
  })
  .sort((a, b) => b.days - a.days)
  .slice(0, 10);

const data = {
  generatedAt: new Date(now).toISOString(),
  totals: {
    systems: systemRows.length,
    activeUnits: systemRows.reduce((n, s) => n + (s.activeUnits ?? 0), 0),
    down: systemRows.reduce((n, s) => n + s.down, 0),
  },
  systems: systemRows,
  longestOutages: outageRows,
};

mkdirSync("site", { recursive: true });
writeFileSync("site/data.json", JSON.stringify(data, null, 2));
console.log(
  `site/data.json written — ${data.totals.down}/${data.totals.activeUnits} down across ${data.totals.systems} systems, ${outageRows.length} longest-outage rows.`,
);
