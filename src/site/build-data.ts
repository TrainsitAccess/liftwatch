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

// PostgREST caps a single response at 1000 rows by default — a plain
// `.select()` silently TRUNCATES past that (no error), which stayed
// invisible while the archive was small. `units` and `stations` (both
// unbounded, growing with every system + poll) crossed 1000 rows the day
// TMB was added, live-verified: the truncated result dropped TMB's units
// entirely (inserted last) and left 11 stations unnamed. Page through with
// `.range()` until a page returns fewer rows than requested — applied to
// every table read here, not just the ones over 1000 today, since
// `outage_events` (currently open outages) will cross it too as more
// systems are added. Each call site builds its own query in a factory so
// filters (e.g. `outage_events`'s `.is("ended_at", null)`) just work,
// without fighting Supabase's chained query-builder generics.
const PAGE_SIZE = 1000;
async function fetchAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${label}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

const [systemsData, unitsData, stationsData, eventsData] = await Promise.all([
  fetchAll(
    (from, to) => db.from("systems").select("id, short_name, city, metro_area, data_quality").range(from, to),
    "systems",
  ),
  fetchAll(
    (from, to) =>
      db
        .from("units")
        .select("id, system_id, station_id, external_id, description, is_active, is_redundant")
        .range(from, to),
    "units",
  ),
  fetchAll((from, to) => db.from("stations").select("id, name").range(from, to), "stations"),
  fetchAll(
    (from, to) =>
      db
        .from("outage_events")
        .select("unit_id, system_id, station_id, is_planned, reason, started_at, source_started_at, attributed")
        .is("ended_at", null)
        .range(from, to),
    "outage_events",
  ),
]);

const systems = { data: systemsData };
const units = { data: unitsData };
const stations = { data: stationsData };
const events = { data: eventsData };

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
    // WMATA) has no LIVE denominator. pctDown/activeUnits are null only when
    // fleetSource is "none" (no staticFleetReference either); when a static
    // reference exists they're populated from it (fleetSource: "static") and
    // must be rendered with disclosure everywhere they're used, including in
    // any aggregate that sums across systems.
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
      // Long-form label for the leaderboard/screen-reader text — defaults to
      // "{shortName} ({city})", overridable per catalog entry (see systems.ts).
      label: catalogEntry?.displayLabel ?? `${s.short_name} (${s.city})`,
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

// The aggregate "N of M monitored" figure is the site's most prominent
// number — it must carry the same live-vs-static disclosure as every
// per-system row, so a static reference blended into "M" is never silently
// presented as a live monitored count.
const staticUnitsInTotal = systemRows
  .filter((s) => s.fleetSource === "static")
  .reduce((n, s) => n + (s.activeUnits ?? 0), 0);

const data = {
  generatedAt: new Date(now).toISOString(),
  totals: {
    systems: systemRows.length,
    activeUnits: systemRows.reduce((n, s) => n + (s.activeUnits ?? 0), 0),
    // Of the total above, how many come from a static (non-live) reference —
    // 0 when every system's fleet count is live. Site renders a "*" + note on
    // the aggregate sentence whenever this is nonzero.
    staticUnitsInTotal,
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
