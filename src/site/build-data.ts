import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { getSystem } from "../catalog/systems.js";
import { stationModelsFor } from "../catalog/station-models.js";
import {
  allElevators,
  chainDisplayName,
  chainDownIntervals,
  coveredStationIds,
  mergeIntervals,
  totalDurationMs,
  type Interval,
} from "../lib/accessibility.js";
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
        .select("id, system_id, station_id, external_id, description, is_active, is_redundant, first_seen")
        .range(from, to),
    "units",
  ),
  fetchAll((from, to) => db.from("stations").select("id, name").range(from, to), "stations"),
  // ALL-time events, not just currently-open ones — the homepage only needs
  // open events, but the per-system detail pages (most/least broken, uptime
  // streaks) need full history. Fetch once, derive both from the same set.
  fetchAll(
    (from, to) =>
      db
        .from("outage_events")
        .select("unit_id, system_id, station_id, is_planned, reason, started_at, ended_at, source_started_at, attributed")
        .range(from, to),
    "outage_events",
  ),
]);

const systems = { data: systemsData };
const units = { data: unitsData };
const stations = { data: stationsData };
const allEvents = eventsData;
const events = { data: allEvents.filter((e) => e.ended_at == null) };

const stationName = new Map((stations.data ?? []).map((s) => [s.id as string, s.name as string]));
const unitById = new Map((units.data ?? []).map((u) => [u.id as string, u]));

const now = Date.now();
const daysSince = (iso: string): number => Math.max(0, Math.floor((now - Date.parse(iso)) / 86_400_000));

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
      // Short label for the split-flap board's fixed 13-char column —
      // defaults to shortName, overridable when that alone isn't clearest.
      boardLabel: catalogEntry?.boardLabel ?? (s.short_name as string),
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

// --- Per-system detail pages (site/systems/{id}.json): most/least broken
// stations & units, single points of failure. Needs the FULL event history
// (allEvents), not just the currently-open ones the homepage summary uses.
const eventsBySystem = new Map<string, typeof allEvents>();
for (const e of allEvents) {
  const list = eventsBySystem.get(e.system_id as string) ?? [];
  list.push(e);
  eventsBySystem.set(e.system_id as string, list);
}
const unitsBySystem = new Map<string, NonNullable<typeof units.data>>();
for (const u of units.data ?? []) {
  const list = unitsBySystem.get(u.system_id as string) ?? [];
  list.push(u);
  unitsBySystem.set(u.system_id as string, list);
}
const latestEnd = (evts: typeof allEvents): string | null =>
  evts.reduce<string | null>((max, e) => {
    const ended = e.ended_at as string | null;
    return ended && (!max || ended > max) ? ended : max;
  }, null);

// Total wall-clock time a station was actually inaccessible, given its
// blackout events (outages on non-redundant units). Merges overlapping
// windows rather than summing durations independently — a station with two
// non-redundant elevators both down for the same 3 days was inaccessible
// for 3 days, not 6. An open event (ended_at null) counts through to now.
function mergedDowntimeMs(evts: typeof allEvents): number {
  const intervals = evts
    .map((e) => ({
      // Prefer the feed-reported start (may predate us) over when we first
      // observed it — same precedence as every other duration calc in this
      // file. Without this, any outage older than LiftWatch's own monitoring
      // collapses to "since we started watching," not its true start.
      start: Date.parse(((e.source_started_at as string | null) ?? (e.started_at as string))),
      end: e.ended_at ? Date.parse(e.ended_at as string) : now,
    }))
    .sort((a, b) => a.start - b.start);
  let total = 0;
  let curStart = -Infinity;
  let curEnd = -Infinity;
  for (const { start, end } of intervals) {
    if (start > curEnd) {
      if (curEnd > curStart) total += curEnd - curStart;
      curStart = start;
      curEnd = end;
    } else {
      curEnd = Math.max(curEnd, end);
    }
  }
  if (curEnd > curStart) total += curEnd - curStart;
  return total;
}

function buildSystemDetail(systemId: string) {
  const systemEvents = eventsBySystem.get(systemId) ?? [];
  // NOT filtered to is_active — a unit mid capital-replacement (e.g. MTA's
  // EL132/EL133 at 161 St-Yankee Stadium) can be marked is_active: false in
  // the feed while still having a real, ongoing outage. Excluding it here
  // silently dropped it from every board below except "Currently Broken
  // Elevators" (which reads events directly, not through this list).
  const systemUnits = unitsBySystem.get(systemId) ?? [];

  // --- Curated multi-chain stations (see station-models.ts) ---
  // A physical station can have more than one INDEPENDENT access chain
  // (161 St-Yankee Stadium: the 4 and the B/D each depend on their own,
  // non-redundant elevators — fixing one tells you nothing about the
  // other). Modeled stations are tracked per-CHAIN below instead of as one
  // flat whole-station count; un-modeled stations keep the simple
  // per-unit is_redundant approach unchanged.
  const models = stationModelsFor(systemId); // bare stationExternalId -> chains
  // Include every feed id a model covers (a merged station like Penn 164+318 or
  // Fulton 628+624 lists both under coveredStationExternalIds) so the flat
  // per-station fallback skips ALL of them, never double-counting an alias.
  const modeledStationIds = new Set(
    [...models.values()].flat().flatMap((m) => coveredStationIds(m)).map((bare) => `${systemId}:${bare}`),
  );

  const eventsByElevatorExtId = new Map<string, typeof allEvents>();
  for (const e of systemEvents) {
    const extId = unitById.get(e.unit_id as string)?.external_id as string | undefined;
    if (!extId) continue;
    const list = eventsByElevatorExtId.get(extId) ?? [];
    list.push(e);
    eventsByElevatorExtId.set(extId, list);
  }
  function elevatorDownIntervals(externalId: string): Interval[] {
    const evts = eventsByElevatorExtId.get(externalId) ?? [];
    return mergeIntervals(
      evts.map((e) => ({
        start: Date.parse((e.source_started_at as string | null) ?? (e.started_at as string)),
        end: e.ended_at ? Date.parse(e.ended_at as string) : now,
      })),
    );
  }

  // Elevator -> chain-qualified display suffix (e.g. " (4)"), only when it
  // belongs to exactly ONE chain at its station. A shared elevator across
  // multiple chains (161 St's EL131, the street-to-mezzanine prerequisite
  // for both the 4 and the B/D) keeps the bare station name instead, since
  // it doesn't specifically belong to one line.
  const chainSuffixByElevator = new Map<string, string>();
  for (const chains of models.values()) {
    const memberCount = new Map<string, number>();
    for (const model of chains) {
      for (const el of allElevators(model)) memberCount.set(el.externalId, (memberCount.get(el.externalId) ?? 0) + 1);
    }
    for (const model of chains) {
      if (!model.chainLabel) continue;
      for (const el of allElevators(model)) {
        if (memberCount.get(el.externalId) === 1) chainSuffixByElevator.set(el.externalId, model.chainLabel);
      }
    }
  }
  // A merged station's covered feed ids (Fulton's "624" = physically Cortlandt
  // St) should all display under the canonical station's name, so a broken
  // elevator on the Cortlandt side reads "Fulton St (R/W)" — matching the
  // blackout board — not "Cortlandt St (R/W)".
  const canonicalNameBySid = new Map<string, string>();
  for (const chains of models.values()) {
    for (const model of chains) {
      const canonical = stationName.get(`${systemId}:${model.stationExternalId}`);
      if (canonical) for (const covered of coveredStationIds(model)) canonicalNameBySid.set(`${systemId}:${covered}`, canonical);
    }
  }
  function displayStationName(sid: string | null | undefined, externalId: string | undefined): string {
    const base = (sid && (canonicalNameBySid.get(sid) ?? stationName.get(sid))) ?? "Unknown";
    const suffix = externalId ? chainSuffixByElevator.get(externalId) : undefined;
    return suffix ? `${base}${suffix}` : base;
  }

  // Currently broken elevators (live snapshot) — every open outage right
  // now, not an all-time ranking. Unlike the other boards, this isn't
  // capped to a top-10; it's meant to answer "what's broken right now?"
  // for someone checking this specific system.
  const currentlyBroken = systemEvents
    .filter((e) => e.ended_at == null)
    .map((e) => {
      const unit = unitById.get(e.unit_id as string);
      const since = (e.source_started_at as string | null) ?? (e.started_at as string);
      const sid = (e.station_id as string | null) ?? (unit?.station_id as string | null);
      return {
        station: displayStationName(sid, unit?.external_id as string | undefined),
        unit: (unit?.description as string) || (unit?.external_id as string) || "?",
        days: daysSince(since),
        planned: e.is_planned as boolean,
        soleAccess: unit?.is_redundant === false,
        // MTA (so far) marks a unit is_active: false while it's mid
        // capital-replacement rather than just "broken" — flag that
        // distinction so a 600+ day outage doesn't read as neglect.
        note: unit?.is_active === false ? "This elevator is likely being replaced." : undefined,
      };
    })
    .sort((a, b) => b.days - a.days);

  // Accessibility blackouts (shame) — ranked by TOTAL TIME a station (or
  // curated chain) was actually inaccessible (overlapping blackouts merged,
  // not summed), not by how many separate outages caused it.
  const blackoutEntries: { name: string; hours: number }[] = [];
  // Longest step-free streak (honor) — days since the last blackout ended,
  // 0 if currently blacked out.
  const streakEntries: { name: string; days: number; blackedOutNow: boolean }[] = [];

  for (const [bare, chains] of models) {
    const dbStationId = `${systemId}:${bare}`;
    const stName = stationName.get(dbStationId) ?? bare;
    for (const model of chains) {
      const downIntervalsByElevator = new Map<string, Interval[]>();
      for (const el of allElevators(model)) downIntervalsByElevator.set(el.externalId, elevatorDownIntervals(el.externalId));
      const chainIntervals = chainDownIntervals(model, downIntervalsByElevator);
      const label = chainDisplayName(stName, model);

      const hours = totalDurationMs(chainIntervals) / 3_600_000;
      if (hours > 0) blackoutEntries.push({ name: label, hours });

      const blackedOutNow = chainIntervals.some((iv) => iv.end === now);
      const latestChainEnd = chainIntervals.reduce((max, iv) => Math.max(max, iv.end), -Infinity);
      const chainFirstSeen = allElevators(model)
        .map((el) => unitById.get(`${systemId}:${el.externalId}`)?.first_seen as string | undefined)
        .filter((v): v is string => !!v)
        .reduce<string | undefined>((min, v) => (!min || v < min ? v : min), undefined);
      const since = blackedOutNow
        ? now
        : latestChainEnd > -Infinity
          ? latestChainEnd
          : (chainFirstSeen ? Date.parse(chainFirstSeen) : now);
      streakEntries.push({ name: label, days: blackedOutNow ? 0 : Math.max(0, Math.floor((now - since) / 86_400_000)), blackedOutNow });
    }
  }

  // Un-modeled stations: the simple flat approach, unchanged — only outages
  // on non-redundant (sole step-free access) units count as a "blackout";
  // a redundant unit's outage never severs access on its own. Stations with
  // a curated chain above are excluded here to avoid double-counting them.
  const blackoutEventsByStation = new Map<string, typeof allEvents>();
  for (const e of systemEvents) {
    const unit = unitById.get(e.unit_id as string);
    if (unit?.is_redundant !== false) continue;
    const sid = (e.station_id as string | null) ?? (unit.station_id as string | null);
    if (!sid || modeledStationIds.has(sid)) continue;
    const list = blackoutEventsByStation.get(sid) ?? [];
    list.push(e);
    blackoutEventsByStation.set(sid, list);
  }
  for (const [sid, evts] of blackoutEventsByStation) {
    const hours = mergedDowntimeMs(evts) / 3_600_000;
    if (hours > 0) blackoutEntries.push({ name: stationName.get(sid) ?? "Unknown", hours });
  }

  const firstSeenByStation = new Map<string, string>();
  for (const u of systemUnits) {
    const sid = u.station_id as string | null;
    if (!sid || modeledStationIds.has(sid)) continue;
    const fs = u.first_seen as string;
    const cur = firstSeenByStation.get(sid);
    if (!cur || fs < cur) firstSeenByStation.set(sid, fs);
  }
  for (const sid of firstSeenByStation.keys()) {
    const blackouts = blackoutEventsByStation.get(sid) ?? [];
    const blackedOutNow = blackouts.some((e) => e.ended_at == null);
    const since = blackedOutNow ? null : (latestEnd(blackouts) ?? firstSeenByStation.get(sid)!);
    streakEntries.push({
      name: stationName.get(sid) ?? "Unknown",
      days: blackedOutNow ? 0 : daysSince(since!),
      blackedOutNow,
    });
  }

  const accessibilityBlackouts = blackoutEntries.sort((a, b) => b.hours - a.hours).slice(0, 10);
  const stepFreeStreak = streakEntries.sort((a, b) => b.days - a.days).slice(0, 10);

  // Most broken units (shame) — all-time outage count.
  const unitOutageCount = new Map<string, number>();
  for (const e of systemEvents) unitOutageCount.set(e.unit_id as string, (unitOutageCount.get(e.unit_id as string) ?? 0) + 1);
  const mostBrokenUnits = systemUnits
    .map((u) => ({
      unit: (u.description as string) || (u.external_id as string),
      station: displayStationName(u.station_id as string | null, u.external_id as string | undefined),
      count: unitOutageCount.get(u.id as string) ?? 0,
    }))
    .filter((u) => u.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Uptime streak (honor).
  const eventsByUnit = new Map<string, typeof allEvents>();
  for (const e of systemEvents) {
    const list = eventsByUnit.get(e.unit_id as string) ?? [];
    list.push(e);
    eventsByUnit.set(e.unit_id as string, list);
  }
  const uptimeStreak = systemUnits
    .map((u) => {
      const unitEvents = eventsByUnit.get(u.id as string) ?? [];
      const downNow = unitEvents.some((e) => e.ended_at == null);
      const since = downNow ? null : (latestEnd(unitEvents) ?? (u.first_seen as string));
      return {
        unit: (u.description as string) || (u.external_id as string),
        station: displayStationName(u.station_id as string | null, u.external_id as string | undefined),
        days: downNow ? 0 : daysSince(since!),
        downNow,
      };
    })
    .sort((a, b) => b.days - a.days)
    .slice(0, 10);

  // Single points of failure (structural) — no event history needed at all,
  // computable from the equipment feed alone (see SPEC.md's accessibility
  // leaderboard section).
  const spofCountByStation = new Map<string, number>();
  for (const u of systemUnits) {
    if (u.is_redundant !== false) continue;
    const sid = u.station_id as string | null;
    if (!sid) continue;
    spofCountByStation.set(sid, (spofCountByStation.get(sid) ?? 0) + 1);
  }
  const singlePointsOfFailure = [...spofCountByStation.entries()]
    .map(([sid, count]) => ({ name: stationName.get(sid) ?? "Unknown", count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  return { currentlyBroken, accessibilityBlackouts, stepFreeStreak, mostBrokenUnits, uptimeStreak, singlePointsOfFailure };
}

mkdirSync("site/systems", { recursive: true });
for (const s of systemRows) {
  const detail = buildSystemDetail(s.id as string);
  writeFileSync(
    `site/systems/${s.id}.json`,
    JSON.stringify(
      { id: s.id, name: s.name, label: s.label, generatedAt: new Date(now).toISOString(), ...detail },
      null,
      2,
    ),
  );
}

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
console.log(`site/systems/*.json written — ${systemRows.length} per-system detail pages.`);
