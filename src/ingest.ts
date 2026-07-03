import type { SupabaseClient } from "@supabase/supabase-js";
import { REDUNDANCY_PRECEDENCE, type NormalizedRead, type NormalizedUnit, type RedundancySource } from "./types.js";
import type { SystemCatalogEntry } from "./catalog/systems.js";
import { overridesFor, type RedundancyOverride } from "./catalog/redundancy-overrides.js";
import { nowUtcIso } from "./lib/time.js";

export interface IngestResult {
  unitsSeen: number;
  outagesOpen: number;
  eventsOpened: number;
  eventsClosed: number;
  flagsRaised: number;
}

const unitId = (systemId: string, ext: string) => `${systemId}:${ext}`;
const stationId = (systemId: string, ext: string) => `${systemId}:${ext}`;

function fail(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

interface Resolved {
  value: boolean;
  source: RedundancySource;
  note: string | null;
  changed: boolean; // differs from stored value/source
  flag?: { curatedValue: boolean; incomingValue: boolean; incomingSource: RedundancySource };
}

// Decide a unit's redundancy from the best available signal, respecting stored
// precedence. A human-curated override (from the versioned overrides file) wins
// outright; any curated value is never overwritten by re-polling, and a real
// (non-'assumed') signal that contradicts it produces a flag for human review.
function resolveRedundancy(
  u: NormalizedUnit,
  stationElevatorCount: number,
  existing: { value: boolean | null; source: RedundancySource } | undefined,
  override: RedundancyOverride | undefined,
  baseline: "assumed" | "confirmed-none",
): Resolved {
  let incoming: { value: boolean; source: RedundancySource };
  if (u.redundancySource) {
    incoming = { value: u.isRedundant ?? false, source: u.redundancySource };
  } else if (stationElevatorCount === 1) {
    incoming = { value: false, source: "single_elevator" };
  } else {
    incoming = { value: false, source: "assumed" }; // policy: assume non-redundant
  }

  // Curated override (versioned file) is authoritative; re-asserted every poll.
  if (override) {
    const contradicts = incoming.source !== "assumed" && incoming.value !== override.isRedundant;
    const changed = !existing || existing.value !== override.isRedundant || existing.source !== "curated";
    return {
      value: override.isRedundant,
      source: "curated",
      note: override.note,
      changed,
      flag: contradicts
        ? { curatedValue: override.isRedundant, incomingValue: incoming.value, incomingSource: incoming.source }
        : undefined,
    };
  }

  // System baseline: when redundancy is fully curated, no model = confirmed
  // non-redundant (upgrades the 'assumed' default to 'curated').
  if (baseline === "confirmed-none" && incoming.source === "assumed") {
    const changed = !existing || existing.value !== false || existing.source !== "curated";
    return {
      value: false,
      source: "curated",
      note: "Confirmed non-redundant — not among this system's curated redundant stations.",
      changed,
    };
  }

  if (!existing) return { value: incoming.value, source: incoming.source, note: null, changed: true };

  if (existing.source === "curated") {
    const contradicts = incoming.source !== "assumed" && incoming.value !== existing.value;
    return {
      value: existing.value ?? false,
      source: "curated",
      note: null,
      changed: false,
      flag: contradicts
        ? { curatedValue: existing.value ?? false, incomingValue: incoming.value, incomingSource: incoming.source }
        : undefined,
    };
  }

  if (REDUNDANCY_PRECEDENCE[incoming.source] >= REDUNDANCY_PRECEDENCE[existing.source]) {
    return {
      value: incoming.value,
      source: incoming.source,
      note: null,
      changed: incoming.value !== existing.value || incoming.source !== existing.source,
    };
  }
  return { value: existing.value ?? false, source: existing.source, note: null, changed: false };
}

// Turns one normalized read into archive writes: upsert system/stations/units
// (with redundancy precedence), then open / refresh / close outage events.
export async function ingest(
  db: SupabaseClient,
  system: SystemCatalogEntry,
  read: NormalizedRead,
): Promise<IngestResult> {
  const now = read.fetchedAt || nowUtcIso();

  const run = await db
    .from("poll_runs")
    .insert({ system_id: system.id, started_at: now, status: "running" })
    .select("id")
    .single();
  fail("insert poll_run", run.error);
  const runId = run.data!.id as number;

  try {
    // 1. System.
    fail(
      "upsert system",
      (
        await db.from("systems").upsert({
          id: system.id,
          name: system.name,
          short_name: system.shortName,
          city: system.city,
          metro_area: system.metroArea,
          country: system.country,
          country_code: system.countryCode,
          continent: system.continent,
          timezone: system.timezone,
          adapter: system.adapter,
          data_quality: system.dataQuality,
        })
      ).error,
    );

    // 2. Stations (deduped from inventory; geo inherits system geo for now).
    const stationsById = new Map<string, Record<string, unknown>>();
    const elevatorCountByStation = new Map<string, number>();
    for (const u of read.units) {
      elevatorCountByStation.set(
        u.stationExternalId,
        (elevatorCountByStation.get(u.stationExternalId) ?? 0) + 1,
      );
      const id = stationId(system.id, u.stationExternalId);
      if (!stationsById.has(id)) {
        stationsById.set(id, {
          id,
          system_id: system.id,
          name: u.stationName,
          name_native: u.stationNameNative ?? null,
          borough: u.borough ?? null,
          metro_area: system.metroArea,
          country: system.country,
          continent: system.continent,
          gtfs_stop_id: u.gtfsStopId ?? null,
          latitude: u.latitude ?? null,
          longitude: u.longitude ?? null,
        });
      }
    }
    if (stationsById.size) {
      fail(
        "upsert stations",
        (await db.from("stations").upsert([...stationsById.values()], { onConflict: "id" })).error,
      );
    }

    // 3. Redundancy: read stored state so precedence + curated protection apply.
    const existingUnits = await db
      .from("units")
      .select("id, is_redundant, redundancy_source")
      .eq("system_id", system.id);
    fail("select existing units", existingUnits.error);
    const storedRedundancy = new Map<string, { value: boolean | null; source: RedundancySource }>(
      (existingUnits.data ?? []).map((r) => [
        r.id as string,
        { value: r.is_redundant as boolean | null, source: r.redundancy_source as RedundancySource },
      ]),
    );

    // 4. Units (redundancy resolved to the winning source; curated overrides win).
    const overrides = overridesFor(system.id);
    const knownUnitIds = new Set<string>();
    const changedRedundancy: string[] = [];
    const flags: { unitId: string; curatedValue: boolean; incomingValue: boolean; incomingSource: RedundancySource }[] = [];
    const unitRows = read.units.map((u) => {
      const id = unitId(system.id, u.externalId);
      knownUnitIds.add(id);
      const r = resolveRedundancy(
        u,
        elevatorCountByStation.get(u.stationExternalId) ?? 0,
        storedRedundancy.get(id),
        overrides.get(u.externalId),
        system.redundancyBaseline ?? "assumed",
      );
      if (r.changed) changedRedundancy.push(id);
      if (r.flag) flags.push({ unitId: id, ...r.flag });
      return {
        id,
        system_id: system.id,
        station_id: stationId(system.id, u.stationExternalId),
        external_id: u.externalId,
        unit_type: u.unitType,
        description: u.description ?? null,
        lines: u.lines ?? null,
        is_ada: u.isAda,
        is_redundant: r.value,
        redundancy_source: r.source,
        redundancy_note: r.note,
        segment: u.segment ?? null,
        is_active: u.isActive,
        last_seen: now,
      };
    });
    if (unitRows.length) {
      fail("upsert units", (await db.from("units").upsert(unitRows, { onConflict: "id" })).error);
    }
    if (changedRedundancy.length) {
      fail(
        "stamp redundancy",
        (await db.from("units").update({ redundancy_updated_at: now }).in("id", changedRedundancy)).error,
      );
    }

    // Outages can reference equipment absent from inventory (feeds drift).
    const orphanUnits = new Map<string, Record<string, unknown>>();
    for (const o of read.outages) {
      const id = unitId(system.id, o.unitExternalId);
      if (knownUnitIds.has(id) || orphanUnits.has(id)) continue;
      orphanUnits.set(id, {
        id,
        system_id: system.id,
        station_id: o.stationExternalId ? stationId(system.id, o.stationExternalId) : null,
        external_id: o.unitExternalId,
        unit_type: o.unitType,
        description: o.reason ?? null,
        is_ada: false,
        is_active: true,
        last_seen: now,
      });
    }
    if (orphanUnits.size) {
      fail(
        "upsert orphan units",
        (await db.from("units").upsert([...orphanUnits.values()], { onConflict: "id" })).error,
      );
      for (const id of orphanUnits.keys()) knownUnitIds.add(id);
    }

    // 5. Redundancy contradiction flags (one open flag per unit).
    let flagsRaised = 0;
    if (flags.length) {
      const openFlags = await db
        .from("redundancy_flags")
        .select("unit_id")
        .eq("system_id", system.id)
        .is("resolved_at", null)
        .in("unit_id", flags.map((f) => f.unitId));
      fail("select open flags", openFlags.error);
      const alreadyOpen = new Set((openFlags.data ?? []).map((r) => r.unit_id as string));
      const newFlags = flags
        .filter((f) => !alreadyOpen.has(f.unitId))
        .map((f) => ({
          unit_id: f.unitId,
          system_id: system.id,
          curated_value: f.curatedValue,
          incoming_value: f.incomingValue,
          incoming_source: f.incomingSource,
        }));
      if (newFlags.length) {
        fail("insert flags", (await db.from("redundancy_flags").insert(newFlags)).error);
        flagsRaised = newFlags.length;
      }
    }

    // 6. Event derivation.
    const open = await db
      .from("outage_events")
      .select("id, unit_id")
      .eq("system_id", system.id)
      .is("ended_at", null);
    fail("select open events", open.error);
    const openByUnit = new Map<string, number>((open.data ?? []).map((r) => [r.unit_id as string, r.id as number]));

    const currentlyOut = new Set<string>();
    let eventsOpened = 0;
    for (const o of read.outages) {
      const uId = unitId(system.id, o.unitExternalId);
      currentlyOut.add(uId);
      const existing = openByUnit.get(uId);
      if (existing === undefined) {
        fail(
          "open event",
          (
            await db.from("outage_events").insert({
              unit_id: uId,
              system_id: system.id,
              station_id: o.stationExternalId ? stationId(system.id, o.stationExternalId) : null,
              started_at: now,
              is_planned: o.isPlanned,
              attributed: o.attributed ?? null,
              reason: o.reason ?? null,
              source_started_at: o.sourceStartedAt ?? null,
              estimated_return: o.estimatedReturn ?? null,
            })
          ).error,
        );
        eventsOpened++;
      } else {
        fail(
          "refresh event",
          (
            await db
              .from("outage_events")
              .update({
                is_planned: o.isPlanned,
                reason: o.reason ?? null,
                estimated_return: o.estimatedReturn ?? null,
                updated_at: now,
              })
              .eq("id", existing)
          ).error,
        );
      }
    }

    let eventsClosed = 0;
    for (const [uId, eventId] of openByUnit) {
      if (currentlyOut.has(uId)) continue;
      fail(
        "close event",
        (await db.from("outage_events").update({ ended_at: now, updated_at: now }).eq("id", eventId)).error,
      );
      eventsClosed++;
    }

    const result: IngestResult = {
      unitsSeen: unitRows.length,
      outagesOpen: read.outages.length,
      eventsOpened,
      eventsClosed,
      flagsRaised,
    };

    fail(
      "finish poll_run",
      (
        await db
          .from("poll_runs")
          .update({
            finished_at: nowUtcIso(),
            status: "success",
            units_seen: result.unitsSeen,
            outages_open: result.outagesOpen,
            events_opened: result.eventsOpened,
            events_closed: result.eventsClosed,
            flags_raised: result.flagsRaised,
          })
          .eq("id", runId)
      ).error,
    );

    return result;
  } catch (err) {
    await db
      .from("poll_runs")
      .update({ finished_at: nowUtcIso(), status: "error", error: String(err) })
      .eq("id", runId);
    throw err;
  }
}
