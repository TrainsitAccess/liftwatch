import type { Adapter, NormalizedOutage, NormalizedRead, NormalizedStation, NormalizedUnit } from "../../types.js";
import { nowUtcIso, msToUtcIso } from "../../lib/time.js";
import { allElevators, elevatorRedundant, type StationModel } from "../../lib/accessibility.js";
import { stationModelsFor } from "../../catalog/station-models.js";
import type { RailEeStatusResponse, RailInfrastructureResponse } from "./raw.js";

// MTA commuter railroads — LIRR and Metro-North share ONE feed pair at
// backend-unified.mylirr.org (the backend of MTA's own elevator-escalator-
// status page and the unified TrainTime app), so one adapter serves both
// systems, each instance filtering by `railroad`:
//   /eestatus            per-unit inventory AND live status in one call
//                        (working units listed too — complete denominator)
//   /infrastructure      station catalog: code -> name/coords/branch/railroad
// UNDOCUMENTED endpoints, found by inspecting the status page's own network
// traffic (same risk tier and method as TMB's alerts feed — see SPEC.md).
// They answer without headers, but the API family versions via
// Accept-Version (other routes 301 without it), so we send it to be safe.
//
// Feed quirks (live-verified 2026-07-06, see src/adapters/mta-rail/raw.ts):
// - unitId is only unique per station and collides across unit types
//   (Jamaica: elevator 761 AND escalator 761) -> externalId = "CODE-unitId".
// - LIRR units: "Working"/"Not Working", lastUpdated null -> our own polling
//   timestamps outages (BART/TfL precedent).
// - MNR units: lowercase + "long term outage", lastUpdated = epoch seconds
//   of last status change -> used as sourceStartedAt (validated against New
//   Rochelle 206E's announced planned closure; GCT NE-4 backdates to 2023).
// - "long term outage" status <-> MTA's announced planned work -> isPlanned.
// - No per-unit ADA/redundancy/estimated-return fields exist. Redundancy is
//   left to curation (station models) / ingest inference; units in this
//   accessibility feed are treated as accessible-path units (isAda: true).
// - Grand Central is three records: GCT (LIRR Madison), 0NY (MNR Terminal),
//   and _GC (railroad "BOTH" — the app's combined entry, no units) which is
//   excluded from both systems.
// - Penn Station: LIRR unit NYK-861 ("P34", 34 St/7 Av to LIRR concourse) is
//   physically the SAME elevator as the subway feed's EL34X (nonNYCT=Y).
//   Both systems track it deliberately — each system's accessibility truth
//   stays self-contained; the one-unit overlap in the homepage aggregate is
//   accepted and documented (see SPEC.md).

export interface MtaRailConfig {
  systemId: string;
  railroad: "LIRR" | "MNR";
  eestatusUrl: string;
  infrastructureUrl: string;
}

const EESTATUS_URL = "https://backend-unified.mylirr.org/eestatus";
const INFRASTRUCTURE_URL = "https://backend-unified.mylirr.org/infrastructure?language=en";

export const LIRR_CONFIG: MtaRailConfig = {
  systemId: "mta-lirr",
  railroad: "LIRR",
  eestatusUrl: EESTATUS_URL,
  infrastructureUrl: INFRASTRUCTURE_URL,
};

export const MNR_CONFIG: MtaRailConfig = {
  systemId: "mta-mnr",
  railroad: "MNR",
  eestatusUrl: EESTATUS_URL,
  infrastructureUrl: INFRASTRUCTURE_URL,
};

const WORKING = /^working$/i; // exact match, case-insensitive (two upstream casings)
const LONG_TERM = /long term/i;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "Accept-Version": "3.0" },
    signal: AbortSignal.timeout(30_000), // a hung feed must not hang the poll
  });
  if (!res.ok) throw new Error(`MTA rail feed ${url.split("?")[0]} returned HTTP ${res.status}`);
  return (await res.json()) as T;
}

// Pure feed->NormalizedRead mapper, exported so check:rail can exercise every
// quirk offline against a fixture (no network in CI) — same pattern as the
// chain generator's self-check being re-runnable via check:mta.
export function normalizeRail(
  eestatus: RailEeStatusResponse,
  infrastructure: RailInfrastructureResponse,
  config: MtaRailConfig,
  fetchedAt: string,
): NormalizedRead {
  const allStations = infrastructure.stations ?? [];
  const allCodes = new Set(allStations.map((s) => s.code));
  // "BOTH" (the combined Grand Central app entry) belongs to neither system;
  // the real stations are GCT (LIRR Madison) and 0NY (MNR Terminal).
  const railStations = allStations.filter((s) => s.railroad === config.railroad);
  const byCode = new Map(railStations.map((s) => [s.code, s]));

  // Complete station layer (names + coords for every station on the railroad,
  // including the elevator-less majority — ramps/level boarding), like
  // WMATA's jStations. branch ("Montauk", "Hudson", ...) rides in the
  // borough slot: it is the railroad's own regional grouping.
  const stations: NormalizedStation[] = railStations.map((s) => ({
    externalId: s.code,
    name: s.name,
    borough: s.branch || undefined,
    latitude: Number.isFinite(s.latitude) ? s.latitude : undefined,
    longitude: Number.isFinite(s.longitude) ? s.longitude : undefined,
    gtfsStopId: s.gtfs_stop_id != null ? String(s.gtfs_stop_id) : undefined,
  }));

  // Curated station models (src/catalog/mta-rail-models.ts, human-verified):
  // a modeled unit carries its model-DERIVED redundancy as curated, the same
  // way BART's modeled stations do. A unit can sit in SEVERAL chains (a
  // shared street elevator like Penn's P34) — it is redundant only if its
  // own outage severs NO chain, the same aggregation the MTA subway
  // self-check uses. Un-modeled units stay undefined (ingest applies
  // single_elevator/assumed).
  const models = stationModelsFor(config.systemId);
  const chainsByElevator = new Map<string, StationModel[]>();
  for (const chains of models.values()) {
    for (const model of chains) {
      for (const el of allElevators(model)) {
        const list = chainsByElevator.get(el.externalId) ?? [];
        list.push(model);
        chainsByElevator.set(el.externalId, list);
      }
    }
  }

  const units: NormalizedUnit[] = [];
  const outages: NormalizedOutage[] = [];
  for (const [code, entry] of Object.entries(eestatus)) {
    const station = byCode.get(code);
    if (!station) {
      // The other railroad's station — or a code missing from infrastructure
      // entirely (never observed; would mean silent unit loss, so warn).
      if (!allCodes.has(code)) {
        console.warn(`  ⚠ ${config.systemId}: eestatus station code "${code}" not in infrastructure — units skipped`);
      }
      continue;
    }
    for (const u of entry.elevators ?? []) {
      // Elevators only — entry.escalators is intentionally ignored
      // (unit_type reserves escalators but they aren't ingested).
      const externalId = `${code}-${(u.unitId ?? "").trim()}`;
      const memberOf = chainsByElevator.get(externalId);
      units.push({
        externalId,
        unitType: "elevator",
        stationExternalId: code,
        stationName: station.name,
        borough: station.branch || undefined,
        description: u.location || undefined,
        isAda: true,
        ...(memberOf
          ? {
              isRedundant: memberOf.every((m) => elevatorRedundant(m, externalId)),
              redundancySource: "curated" as const,
            }
          : {}),
        isActive: true,
        latitude: Number.isFinite(station.latitude) ? station.latitude : undefined,
        longitude: Number.isFinite(station.longitude) ? station.longitude : undefined,
      });
      const status = (u.status ?? "").trim();
      if (!WORKING.test(status)) {
        outages.push({
          unitExternalId: externalId,
          unitType: "elevator",
          stationExternalId: code,
          stationName: station.name,
          isPlanned: LONG_TERM.test(status),
          isUpcoming: false,
          reason: status || "Out of service",
          // MNR: epoch seconds of the last status change = when it went out
          // (validated). LIRR: always null -> our polling timestamps it.
          sourceStartedAt: typeof u.lastUpdated === "number" ? msToUtcIso(u.lastUpdated * 1000) : undefined,
        });
      }
    }
  }

  return {
    systemId: config.systemId,
    fetchedAt,
    units,
    outages,
    upcoming: [], // no scheduled-outage feed; camsys alerts enrichment is deferred
    stations,
  };
}

export function createMtaRailAdapter(config: MtaRailConfig): Adapter {
  return {
    systemId: config.systemId,

    async fetch(): Promise<NormalizedRead> {
      const [eestatus, infrastructure] = await Promise.all([
        fetchJson<RailEeStatusResponse>(config.eestatusUrl),
        fetchJson<RailInfrastructureResponse>(config.infrastructureUrl),
      ]);
      return normalizeRail(eestatus, infrastructure, config, nowUtcIso());
    },
  };
}
