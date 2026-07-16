import type { SupabaseClient } from "@supabase/supabase-js";
import { getSystem } from "../catalog/systems.js";
import { stationModelsFor } from "../catalog/station-models.js";
import {
  allElevators,
  chainDisplayName,
  chainDownIntervals,
  coveredStationIds,
  mergeIntervals,
  stationAccessible,
  totalDurationMs,
  type Interval,
  type StationModel,
} from "../lib/accessibility.js";
import nyInventory from "../catalog/mta-data/ny-elevator-inventory.json" with { type: "json" };
import mtaStationAda from "../catalog/mta-data/mta-station-ada.json" with { type: "json" };

// MTA's OWN per-elevator text, keyed by equipment code (= our MTA external
// ids), from the data.ny.gov inventory (94fv-bak7; see
// scripts/mta-ny-inventory.mts):
//  • `alternative_route` — rider-facing reroute ("if this elevator is out, do
//    X"), surfaced verbatim when the elevator is out. It assumes only THIS
//    elevator is out (as MTA's signage does), so it's shown as MTA's guidance.
//  • `notes` — MTA's own description of what the elevator connects; we prefer
//    it over our feed-derived description when it's equivalent or richer.
const mtaReroute = new Map<string, string>();
const mtaNote = new Map<string, string>();
for (const e of (nyInventory as { elevators: { equipment_code: string; alternative_route?: string; notes?: string }[] }).elevators) {
  if (e.alternative_route) mtaReroute.set(e.equipment_code, e.alternative_route);
  if (e.notes) mtaNote.set(e.equipment_code, e.notes);
}

// Data-quality artifacts in the inventory's `notes` (internal maintenance text,
// duplicate-equipment bookkeeping) that must never replace our description.
const MTA_NOTE_JUNK = /\b(unlink|withdraw|out of service|duplicate|superced|do not use|EQ\d{4,})\b/i;

// Bryce (2026-07-16): use MTA's own elevator description when it essentially
// says the same thing as ours or is richer; keep ours when MTA's is junk,
// missing, or dramatically terser (ours richer). Capitalize MTA's (its text is
// lowercase) for display consistency.
function preferMtaNote(ours: string | null | undefined, code: string | undefined): string | null {
  const our = (ours ?? "").trim();
  const mta = code ? mtaNote.get(code)?.trim() : undefined;
  if (!mta || MTA_NOTE_JUNK.test(mta)) return our || null;
  if (our && our.length > mta.length * 1.3) return our; // ours materially richer
  return mta.charAt(0).toUpperCase() + mta.slice(1);
}

// Snapshot the archive into the site's data payloads. Server-side (service
// key) so the site itself needs no credentials. Two callers share this ONE
// code path (same seam pattern as src/pollSystem.ts):
//   - the CLI (src/site/build-data.ts, `npm run site:data`) writes the
//     payloads to site/*.json for local preview and the push-time deploy
//     fallback;
//   - the Netlify scheduled poller (netlify/functions/poll.mts)
//     writes them to Netlify Blobs after every poll, so the LIVE site's data
//     refreshes every poll cycle WITHOUT a rebuild/redeploy (a build-hook-
//     per-poll design would have burned ~288 build-minutes/day at a 5-min
//     cadence — ~9x the free tier — just to swap a 17 KB JSON file).
// Keep archive-shaping logic here, not in either caller.

export interface SiteData {
  data: Record<string, unknown>; // the homepage payload (data.json)
  systemDetails: { id: string; detail: Record<string, unknown> }[]; // systems/{id}.json
}

// Rider-facing labels for non-elevator equipment types (the
// other-equipment layer). Kept here so the site renders a clean category, not a
// raw enum. Unknown types fall back to a title-cased version.
const ACCESS_TYPE_LABELS: Record<string, string> = {
  elevated_subplatform: "Mini-high platform",
  fully_elevated_platform: "Raised platform",
  portable_boarding_lift: "Portable lift",
  ramp: "Ramp",
};
function equipmentTypeLabelFallback(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function buildSiteData(db: SupabaseClient): Promise<SiteData> {
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

// Schema-tolerant, like the ingest side: needs_review is a later column
// addition. Probe once and include it in the select only if it exists, so the
// site build keeps working before the DDL is applied (the "Needs review" board
// is just empty until then).
const hasNeedsReview = !(await db.from("outage_events").select("needs_review").limit(1)).error;
const eventCols =
  "unit_id, system_id, station_id, is_planned, reason, started_at, ended_at, source_started_at, estimated_return, attributed" +
  (hasNeedsReview ? ", needs_review" : "");

const [systemsData, unitsData, stationsData, eventsData, upcomingData] = await Promise.all([
  fetchAll(
    (from, to) => db.from("systems").select("id, short_name, city, metro_area, data_quality").range(from, to),
    "systems",
  ),
  fetchAll(
    (from, to) =>
      db
        .from("units")
        .select("id, system_id, station_id, external_id, description, is_active, is_redundant, redundancy_source, first_seen, unit_type, segment")
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
        .select(eventCols)
        .range(from, to),
    "outage_events",
  ),
  // Scheduled future work (snapshot table, wiped per poll) — feeds the new
  // "scheduled work" departure board.
  fetchAll(
    (from, to) =>
      db
        .from("upcoming_outages")
        .select("system_id, station_id, unit_external_id, reason, is_planned, source_started_at, estimated_return")
        .range(from, to),
    "upcoming_outages",
  ),
]);

const systems = { data: systemsData };
const units = { data: unitsData };
const stations = { data: stationsData };
// The dynamic (schema-tolerant) select above erases supabase-js's row typing;
// restore it with an explicit row shape (needs_review optional — absent before
// the DDL is applied).
interface EventRow {
  unit_id: string;
  system_id: string;
  station_id: string | null;
  is_planned: boolean;
  reason: string | null;
  started_at: string;
  ended_at: string | null;
  source_started_at: string | null;
  estimated_return: string | null;
  attributed: boolean | null;
  needs_review?: boolean;
}
const allEvents = eventsData as unknown as EventRow[];
const events = { data: allEvents.filter((e) => e.ended_at == null) };

// Offline events — units whose status became UNKNOWN (vanished from an
// inventory-complete feed; see ingest 4.5). The table is a later schema
// addition applied by hand, so degrade to empty until it exists.
type OfflineRow = { unit_id: string; system_id: string; station_id: string | null; started_at: string; ended_at: string | null };
let offlineData: OfflineRow[] = [];
try {
  offlineData = await fetchAll<OfflineRow>(
    (from, to) =>
      db.from("offline_events").select("unit_id, system_id, station_id, started_at, ended_at").range(from, to),
    "offline_events",
  );
} catch (err) {
  if (/offline_events/.test(String(err))) {
    console.warn("offline_events table missing — offline boards empty (apply the db/schema.sql addition)");
  } else {
    throw err;
  }
}
const openOfflineBySystem = new Map<string, number>();
for (const o of offlineData) {
  if (o.ended_at == null) openOfflineBySystem.set(o.system_id, (openOfflineBySystem.get(o.system_id) ?? 0) + 1);
}

// Other-equipment events — NON-ELEVATOR other-equipment outages (mini-high
// platforms, portable lifts, ramps; see ingest 6.5). A SEPARATE layer, never
// mixed into elevator inventory/%/leaderboards. Also a hand-applied later
// schema addition, so degrade to empty until the table exists.
type OtherEquipmentRow = {
  system_id: string;
  station_id: string | null;
  facility_external_id: string;
  facility_type: string;
  description: string | null;
  started_at: string;
  ended_at: string | null;
  is_planned: boolean;
  reason: string | null;
  source_started_at: string | null;
  estimated_return: string | null;
};
let otherEquipmentData: OtherEquipmentRow[] = [];
try {
  otherEquipmentData = await fetchAll<OtherEquipmentRow>(
    (from, to) =>
      db
        .from("other_equipment_events")
        .select(
          "system_id, station_id, facility_external_id, facility_type, description, started_at, ended_at, is_planned, reason, source_started_at, estimated_return",
        )
        .range(from, to),
    "other_equipment_events",
  );
} catch (err) {
  if (/other_equipment_events/.test(String(err))) {
    console.warn("other_equipment_events table missing — other-equipment boards empty (apply the db/schema.sql addition)");
  } else {
    throw err;
  }
}
const openAccessBySystem = new Map<string, number>();
for (const a of otherEquipmentData) {
  if (a.ended_at == null) openAccessBySystem.set(a.system_id, (openAccessBySystem.get(a.system_id) ?? 0) + 1);
}

const stationName = new Map((stations.data ?? []).map((s) => [s.id as string, s.name as string]));
const unitById = new Map((units.data ?? []).map((u) => [u.id as string, u]));

// Systems withheld from the public site (SystemCatalogEntry.hidden) — their
// adapter/catalog/archive stay intact, but they appear nowhere on the site:
// not the systems board, per-system pages, longest-outages, or aggregate
// totals. Filtered at the source so every downstream reduction excludes them.
const isHidden = (systemId: string): boolean => getSystem(systemId)?.hidden === true;

// The red "SOLE STEP-FREE ACCESS — station currently inaccessible" marker is
// a factual claim, so it requires a REAL non-redundancy signal (curated /
// explicit / pathways / single_elevator). The 'assumed' policy default also
// stores is_redundant=false, but that is a conservative unknown, not a
// confirmed fact — marking every outage on a no-redundancy-signal system
// (TMB, WMATA, CTA, un-curated LIRR/MNR stations) as a station blackout
// over-claims. Blackout/streak boards keep the conservative history-based
// logic (their legends describe it as derived); only the per-unit markers
// and the structural single-points-of-failure board demand confirmation.
type UnitRow = NonNullable<typeof units.data>[number];
const confirmedSoleAccess = (u: UnitRow | undefined): boolean =>
  u?.is_redundant === false && u?.redundancy_source !== "assumed";

const now = Date.now();
const daysSince = (iso: string): number => Math.max(0, Math.floor((now - Date.parse(iso)) / 86_400_000));

const openBySystem = new Map<string, number>();
const unplannedBySystem = new Map<string, number>();
for (const e of events.data ?? []) {
  openBySystem.set(e.system_id, (openBySystem.get(e.system_id) ?? 0) + 1);
  if (!e.is_planned) unplannedBySystem.set(e.system_id, (unplannedBySystem.get(e.system_id) ?? 0) + 1);
}

const systemRows = (systems.data ?? [])
  .filter((s) => !isHidden(s.id as string)) // withheld systems never reach the site
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

    const downUnplanned = unplannedBySystem.get(s.id) ?? 0;
    return {
      id: s.id,
      name: s.short_name as string,
      city: s.city as string,
      // Long-form label — defaults to "{shortName} ({city})", overridable
      // per catalog entry (see systems.ts).
      label: catalogEntry?.displayLabel ?? `${s.short_name} (${s.city})`,
      // Short label for the board's name column — defaults to shortName,
      // overridable when that alone isn't clearest.
      boardLabel: catalogEntry?.boardLabel ?? (s.short_name as string),
      dataQuality: s.data_quality as string,
      inventoryComplete,
      fleetSource,
      activeUnits: fleetTotal,
      down,
      downUnplanned,
      downPlanned: down - downUnplanned,
      offline: openOfflineBySystem.get(s.id) ?? 0,
      pctDown: fleetTotal ? Math.round((down / fleetTotal) * 1000) / 10 : null,
      pctUnplanned: fleetTotal ? Math.round((downUnplanned / fleetTotal) * 1000) / 10 : null,
      staticFleetAsOf: staticFleet?.asOfDate ?? null,
      staticFleetSource: staticFleet?.source ?? null,
    };
  })
  // Ranked by the UNPLANNED share (the spec's intent — breakdowns, not
  // scheduled maintenance, are the shame metric; planned work shows in its
  // own column). Null denominators sort last, as before.
  .sort((a, b) => (b.pctUnplanned ?? -1) - (a.pctUnplanned ?? -1));

const allOpenOutages = (events.data ?? [])
  .filter((e) => !isHidden(e.system_id as string))
  .map((e) => {
    const unit = unitById.get(e.unit_id as string);
    const since = e.source_started_at ?? e.started_at;
    const days = Math.max(0, Math.floor((now - Date.parse(since as string)) / 86_400_000));
    return {
      system: (systems.data ?? []).find((s) => s.id === e.system_id)?.short_name ?? e.system_id,
      systemId: e.system_id as string,
      station: stationName.get((e.station_id ?? unit?.station_id) as string) ?? "Unknown",
      unit: (unit?.external_id as string) ?? "?",
      unitDesc: preferMtaNote((unit?.description as string | null) ?? null, unit?.external_id as string | undefined),
      soleAccess: confirmedSoleAccess(unit),
      reroute: (unit?.external_id && mtaReroute.get(unit.external_id as string)) ?? null,
      planned: e.is_planned as boolean,
      reason: (e.reason as string | null) ?? null,
      estimatedReturn: (e.estimated_return as string | null) ?? null,
      since: since as string,
      // Agency-local IANA zone: a departure board shows station time, not
      // the viewer's.
      tz: getSystem(e.system_id as string)?.timezone ?? null,
      days,
    };
  })
  .sort((a, b) => b.days - a.days);

// Split the flagship board by cause. Unplanned breakdowns are the spec's shame
// metric, so they get their own board — a wall of multi-year planned capital
// replacements (161 St, Jamaica-179 …) was burying the longest genuine
// breakdown at the bottom. Planned closures still matter (they can strand a
// station's sole step-free elevator for months or years), so they keep a board
// of their own rather than being dropped. `longestOutages` (combined top-10) is
// retained for the ticker and back-compat.
const longestUnplanned = allOpenOutages.filter((o) => !o.planned).slice(0, 10);
const longestPlanned = allOpenOutages.filter((o) => o.planned).slice(0, 10);
const outageRows = allOpenOutages.slice(0, 10);

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
  // A unit permanently RETIRED (superseded by a re-model, e.g. BART's old
  // per-station placeholder units after 2026-07-08's real per-elevator
  // curation) is different from a temporarily-inactive-but-relevant one like
  // MTA's capital replacement above — the distinguishing signal is an OPEN
  // event: MTA's case needs one to justify staying visible; a truly retired
  // unit has none. Exclude is_active:false units with no open event from the
  // all-time/structural boards below (SPOF, most-broken, uptime streak) so a
  // retired placeholder can't crowd out the real units that replaced it or
  // claim a fake honor-board "streak" — but keep any is_active:false unit
  // that DOES have an open event, preserving the MTA behavior exactly.
  const openUnitIds = new Set(systemEvents.filter((e) => e.ended_at == null).map((e) => e.unit_id as string));
  const isRetired = (u: (typeof systemUnits)[number]) => u.is_active === false && !openUnitIds.has(u.id as string);

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
  const chainsList: StationModel[] = [...models.values()].flat();

  // External ids of every unit currently out in this system — drives the
  // live chain evaluations below (backup routes, station access board).
  const openExtIds = new Set<string>();
  for (const e of systemEvents) {
    if (e.ended_at != null) continue;
    const ext = unitById.get(e.unit_id as string)?.external_id as string | undefined;
    if (ext) openExtIds.add(ext);
  }

  // Offline units in this system: currently unknowable (open offline event)
  // plus the recent log. An offline unit is neither up nor down — the access
  // board shows UNKNOWN, and it can't earn an uptime streak while unwatched.
  const systemOffline = offlineData.filter((o) => o.system_id === systemId);
  const offlineOpenUnitIds = new Set(systemOffline.filter((o) => o.ended_at == null).map((o) => o.unit_id));
  const offlineExtIds = new Set<string>();
  for (const uId of offlineOpenUnitIds) {
    const ext = unitById.get(uId)?.external_id as string | undefined;
    if (ext) offlineExtIds.add(ext);
  }

  // For one currently-broken elevator: what its outage means, computed from
  // the curated chains — which access routes it SEVERS right now (given
  // everything else that's down), which still-working elevators BACK IT UP
  // on its own segments, whether a non-elevator step-free path covers it,
  // plus the chains' rider-facing notes (detours, garage-only elevators…).
  function accessImpactFor(extId: string) {
    const memberChains = chainsList.filter((m) => allElevators(m).some((el) => el.externalId === extId));
    if (!memberChains.length) return null;
    const severs: string[] = [];
    const backups = new Set<string>();
    let rampAlternative = false;
    const notes = new Set<string>();
    for (const m of memberChains) {
      const ids = new Set(allElevators(m).map((el) => el.externalId));
      const down = new Set([...openExtIds].filter((id) => ids.has(id)));
      const stName = stationName.get(`${systemId}:${m.stationExternalId}`) ?? m.stationExternalId;
      if (!stationAccessible(m, down)) severs.push(chainDisplayName(stName, m));
      for (const seg of m.segments) {
        if (!seg.elevators.some((el) => el.externalId === extId)) continue;
        if (seg.stepFreeAlternative) rampAlternative = true;
        for (const el of seg.elevators) {
          if (el.externalId !== extId && !openExtIds.has(el.externalId)) backups.add(el.label);
        }
      }
      if (m.note) notes.add(m.note);
    }
    return { severs, backups: [...backups], rampAlternative, notes: [...notes] };
  }

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
      const ext = unit?.external_id as string | undefined;
      const since = (e.source_started_at as string | null) ?? (e.started_at as string);
      const sid = (e.station_id as string | null) ?? (unit?.station_id as string | null);
      const impact = ext ? accessImpactFor(ext) : null;
      return {
        station: displayStationName(sid, ext),
        unitId: ext ?? "?",
        unit: preferMtaNote((unit?.description as string) ?? null, ext) || ext || "?",
        days: daysSince(since),
        since,
        planned: e.is_planned as boolean,
        reason: (e.reason as string | null) ?? null,
        estimatedReturn: (e.estimated_return as string | null) ?? null,
        soleAccess: confirmedSoleAccess(unit),
        // Live chain impact (curated stations only): routes severed right
        // now, working backups on this elevator's own segments, ramp
        // coverage, and the chains' rider-facing notes.
        severs: impact?.severs ?? [],
        backups: impact?.backups ?? [],
        rampAlternative: impact?.rampAlternative ?? false,
        chainNotes: impact?.notes ?? [],
        // MTA's own rider-facing reroute for THIS elevator (data.ny.gov), shown
        // verbatim when it's out; null for non-MTA / unlisted elevators.
        reroute: (ext && mtaReroute.get(ext)) ?? null,
        // MTA (so far) marks a unit is_active: false while it's mid
        // capital-replacement rather than just "broken" — flag that
        // distinction so a 600+ day outage doesn't read as neglect.
        note: unit?.is_active === false ? "This elevator is likely being replaced." : undefined,
      };
    })
    .sort((a, b) => b.days - a.days);

  // --- Offline board: currently unknowable units first, then the recent
  // restored log (an offline spell is archived like an outage).
  const offlineLog = systemOffline
    .sort((a, b) => (b.ended_at ?? "~").localeCompare(a.ended_at ?? "~") || b.started_at.localeCompare(a.started_at))
    .slice(0, 25)
    .map((o) => {
      const unit = unitById.get(o.unit_id);
      return {
        unitId: (unit?.external_id as string) ?? "?",
        unit: (unit?.description as string) || (unit?.external_id as string) || "?",
        station: displayStationName((o.station_id ?? (unit?.station_id as string | null)) as string | null, unit?.external_id as string | undefined),
        since: o.started_at,
        days: daysSince(o.started_at),
        restored: o.ended_at,
        durationHours: o.ended_at ? Math.round((Date.parse(o.ended_at) - Date.parse(o.started_at)) / 3_600_000) : null,
      };
    })
    .sort((a, b) => (a.restored === null && b.restored === null ? b.since.localeCompare(a.since) : a.restored === null ? -1 : b.restored === null ? 1 : b.restored.localeCompare(a.restored)));

  // --- Other accessibility equipment board: NON-ELEVATOR accessibility equipment out of
  // service (mini-high platforms, portable lifts, ramps). A separate "before
  // you go" signal, archived like outages; NEVER counted in elevator metrics.
  // Current (still out) first, then the recent resolved log.
  const systemAccess = otherEquipmentData.filter((a) => a.system_id === systemId);
  const otherEquipment = systemAccess
    .map((a) => ({
      facilityId: a.facility_external_id,
      type: a.facility_type,
      typeLabel: ACCESS_TYPE_LABELS[a.facility_type] ?? a.facility_type,
      facility: a.description || equipmentTypeLabelFallback(a.facility_type),
      station: (a.station_id && stationName.get(a.station_id)) || a.description || "Unknown",
      planned: a.is_planned,
      reason: a.reason,
      since: (a.source_started_at ?? a.started_at) as string,
      days: daysSince((a.source_started_at ?? a.started_at) as string),
      estimatedReturn: a.estimated_return,
      restored: a.ended_at,
      durationHours: a.ended_at ? Math.round((Date.parse(a.ended_at) - Date.parse(a.started_at)) / 3_600_000) : null,
    }))
    // Currently-out first (restored === null), then most-recently-restored.
    .sort((a, b) =>
      a.restored === null && b.restored === null
        ? b.since.localeCompare(a.since)
        : a.restored === null
          ? -1
          : b.restored === null
            ? 1
            : (b.restored as string).localeCompare(a.restored as string),
    )
    .slice(0, 25);

  // --- Station access board (live) ---
  // Modeled chains with a relevant outage right now: still accessible via a
  // backup ("REDUCED") or actually severed ("NO ACCESS"). Un-modeled
  // stations join only via a confirmed sole-access unit being down (the
  // same source-gated rule as the ▮ marker). Chains with nothing down are
  // summarized by count, not listed.
  const stationAccess: { name: string; state: "reduced" | "no_access" | "unknown"; downUnits: string[]; offlineUnits: string[]; note: string | null }[] = [];

  // FAIL-SAFE for modeled stations (WMATA precedent, but generic): an OPEN,
  // flagged (needs_review) elevator outage at a modeled station whose unit id
  // matches NO chain elevator there means the model is behind the real world —
  // a new unit the observed-name binding hasn't absorbed yet, or an outage the
  // adapter couldn't place (BART's -UNSPECIFIED). Never let the station read
  // clean:
  //   - if the adapter placed it on a SEGMENT (units.segment), it counts as one
  //     more distinct down elevator on that segment — slots within a segment
  //     are interchangeable, so marking any not-yet-down slot is exact math;
  //   - if even the segment is unknown, every chain at the station reads
  //     UNKNOWN ("can't verify before you go") — an elevator is out somewhere
  //     in the station's access path and no chain may claim to be verified.
  const unplacedByStation = new Map<string, { extId: string; segment: string | null }[]>();
  for (const e of systemEvents) {
    if (e.ended_at != null || !(e.needs_review as boolean | undefined)) continue;
    const unit = unitById.get(e.unit_id as string);
    if (((unit?.unit_type as string | undefined) ?? "elevator") !== "elevator") continue;
    const sid = (e.station_id as string | null) ?? (unit?.station_id as string | null);
    if (!sid || !modeledStationIds.has(sid)) continue;
    const extId = unit?.external_id as string | undefined;
    if (!extId || chainsList.some((m) => allElevators(m).some((el) => el.externalId === extId))) continue;
    (unplacedByStation.get(sid) ?? unplacedByStation.set(sid, []).get(sid)!).push({
      extId,
      segment: (unit?.segment as string | null) ?? null,
    });
  }

  let chainsTotal = 0;
  for (const [bare, chains] of models) {
    const stName = stationName.get(`${systemId}:${bare}`) ?? bare;
    for (const model of chains) {
      chainsTotal++;
      const ids = new Set(allElevators(model).map((el) => el.externalId));
      const down = [...openExtIds].filter((id) => ids.has(id));
      const offline = [...offlineExtIds].filter((id) => ids.has(id));
      const unplaced = coveredStationIds(model).flatMap((b) => unplacedByStation.get(`${systemId}:${b}`) ?? []);
      // Segment-placed unplaced outages become synthetic extra down members
      // (one distinct not-yet-down slot each); segmentless ones taint the
      // whole chain as UNKNOWN. A segment id belonging to a SIBLING chain
      // only affects that chain, not this one.
      const extraDown: string[] = [];
      let unknownUnplaced = false;
      for (const u of unplaced) {
        const seg = u.segment ? model.segments.find((s) => s.id === u.segment) : undefined;
        if (seg) {
          const free = seg.elevators.find((el) => !down.includes(el.externalId) && !extraDown.includes(el.externalId));
          if (free) extraDown.push(free.externalId);
        } else if (!u.segment) {
          unknownUnplaced = true;
        }
      }
      if (!down.length && !offline.length && !extraDown.length && !unknownUnplaced) continue;
      // Severed beats everything; otherwise an offline member or an unplaced
      // outage makes the route UNKNOWN — neither up nor down, so the route's
      // real state can't be verified before you go.
      const effDown = [...down, ...extraDown];
      const state: "reduced" | "no_access" | "unknown" = effDown.length
        ? stationAccessible(model, new Set(effDown))
          ? offline.length || unknownUnplaced ? "unknown" : "reduced"
          : "no_access"
        : "unknown";
      const shownUnplaced = unplaced
        .filter((u) => !u.segment || model.segments.some((s) => s.id === u.segment))
        .map((u) => u.extId);
      stationAccess.push({
        name: chainDisplayName(stName, model),
        state,
        downUnits: [...down, ...shownUnplaced],
        offlineUnits: offline,
        note: model.note ?? null,
      });
    }
  }
  for (const e of systemEvents) {
    if (e.ended_at != null) continue;
    const unit = unitById.get(e.unit_id as string);
    const sid = (e.station_id as string | null) ?? (unit?.station_id as string | null);
    if (!sid || modeledStationIds.has(sid)) continue;
    if (!confirmedSoleAccess(unit)) continue;
    stationAccess.push({
      name: stationName.get(sid) ?? "Unknown",
      state: "no_access",
      downUnits: [unit?.external_id as string],
      offlineUnits: [],
      // Un-modeled stations get an honest generic note (their full elevator
      // layout isn't broken into legs yet) instead of a blank.
      note: "This elevator is the station's only step-free access (confirmed), and it is out of service — the station has no step-free route. This station's full elevator layout is not yet modeled leg by leg.",
    });
  }
  // Un-modeled stations where a confirmed SOLE-ACCESS unit is offline: the
  // station's accessibility itself is unknowable right now.
  for (const uId of offlineOpenUnitIds) {
    const unit = unitById.get(uId);
    const sid = unit?.station_id as string | null;
    if (!sid || modeledStationIds.has(sid)) continue;
    if (!confirmedSoleAccess(unit)) continue;
    stationAccess.push({
      name: stationName.get(sid) ?? "Unknown",
      state: "unknown",
      downUnits: [],
      offlineUnits: [unit?.external_id as string],
      note: "This elevator is the station's only step-free access (confirmed), and it is not reporting — its condition can't be verified before you go. This station's full elevator layout is not yet modeled leg by leg.",
    });
  }
  const stateRank = { no_access: 0, unknown: 1, reduced: 2 };
  stationAccess.sort((a, b) => stateRank[a.state] - stateRank[b.state] || a.name.localeCompare(b.name));

  // --- Scheduled work board (from the upcoming_outages snapshot) ---
  const scheduledWork = upcomingData
    .filter((u) => u.system_id === systemId)
    .map((u) => ({
      unitId: (u.unit_external_id as string) ?? "?",
      station: stationName.get(u.station_id as string) ?? "—",
      starts: (u.source_started_at as string | null) ?? null,
      until: (u.estimated_return as string | null) ?? null,
      reason: (u.reason as string | null) ?? null,
    }))
    .sort((a, b) => (a.starts ?? "9999").localeCompare(b.starts ?? "9999"))
    .slice(0, 40);

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
    .filter((u) => !isRetired(u))
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
    // An offline unit can't earn an honor streak — nobody can verify it's up.
    // A retired unit can't either — it's not a real tracked elevator anymore.
    .filter((u) => !offlineOpenUnitIds.has(u.id as string) && !isRetired(u))
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
  // leaderboard section). "Structural" is a confirmed-fact claim, so
  // 'assumed' units don't qualify (see confirmedSoleAccess above) — a
  // system with no redundancy signal shows an empty board, not every
  // elevator it owns.
  const spofCountByStation = new Map<string, number>();
  for (const u of systemUnits) {
    if (isRetired(u)) continue;
    if (!confirmedSoleAccess(u)) continue;
    const sid = u.station_id as string | null;
    if (!sid) continue;
    spofCountByStation.set(sid, (spofCountByStation.get(sid) ?? 0) + 1);
  }
  const singlePointsOfFailure = [...spofCountByStation.entries()]
    .map(([sid, count]) => ({ name: stationName.get(sid) ?? "Unknown", count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // MTA's own STATION-LEVEL ADA accessibility declaration (design-time, not
  // live outage status — see MTA-DISPLAY-GUIDE.md / mta-station-ada.json).
  // MTA-only; restricted to complexes our archive actually tracks elevators
  // at (grounds the board in real, monitored stations, not the full network).
  // Bryce (2026-07-16): never show a bare "partial" — always name the lines
  // and directions, which mta-station-ada.json's `explanation` already does.
  let stationAccessibility: {
    complexId: string; name: string; ada: number; adaLabel: string; explanation: string;
  }[] = [];
  if (systemId === "mta-nyct") {
    const trackedComplexIds = new Set(
      systemUnits.map((u) => (u.station_id as string | null)?.split(":")[1]).filter(Boolean),
    );
    const adaEntries = (mtaStationAda as { stations: { complexId: string; name: string; ada: number; explanation: string | null }[] }).stations;
    stationAccessibility = adaEntries
      .filter((s) => s.ada !== 1 && trackedComplexIds.has(s.complexId))
      .map((s) => ({
        complexId: s.complexId,
        name: s.name,
        ada: s.ada,
        adaLabel: s.ada === 0 ? "Not accessible" : "Partially accessible",
        explanation: s.explanation ?? "",
      }))
      .sort((a, b) => a.ada - b.ada || a.name.localeCompare(b.name));
  }

  // "Needs review" — currently-open outages we couldn't confidently place onto
  // a specific known elevator (needs_review). The universal human-flag surface.
  const needsReview = systemEvents
    .filter((e) => e.ended_at == null && e.needs_review === true)
    .map((e) => {
      const unit = unitById.get(e.unit_id as string);
      const ext = unit?.external_id as string | undefined;
      const since = (e.source_started_at as string | null) ?? (e.started_at as string);
      const sid = (e.station_id as string | null) ?? (unit?.station_id as string | null);
      return {
        station: displayStationName(sid, ext),
        unitId: ext ?? "?",
        reason: (e.reason as string | null) ?? null,
        since,
        days: daysSince(since),
      };
    })
    .sort((a, b) => b.days - a.days);

  return {
    currentlyBroken,
    stationAccessibility,
    needsReview: { current: needsReview.length, rows: needsReview },
    offline: { current: offlineLog.filter((o) => o.restored === null).length, log: offlineLog },
    otherEquipment: { current: otherEquipment.filter((a) => a.restored === null).length, log: otherEquipment },
    stationAccess: { rows: stationAccess, chainsModeled: chainsTotal },
    scheduledWork,
    accessibilityBlackouts,
    stepFreeStreak,
    mostBrokenUnits,
    uptimeStreak,
    singlePointsOfFailure,
  };
}

const systemDetails = systemRows.map((s) => ({
  id: s.id as string,
  detail: {
    id: s.id,
    name: s.name,
    label: s.label,
    // Agency-local IANA zone — the board renders times in station time.
    timezone: getSystem(s.id as string)?.timezone ?? null,
    generatedAt: new Date(now).toISOString(),
    ...buildSystemDetail(s.id as string),
  } as Record<string, unknown>,
}));

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
    downUnplanned: systemRows.reduce((n, s) => n + s.downUnplanned, 0),
    offline: systemRows.reduce((n, s) => n + s.offline, 0),
  },
  systems: systemRows,
  longestOutages: outageRows,
  longestUnplanned,
  longestPlanned,
};

return { data, systemDetails };
}
