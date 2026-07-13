import type { Adapter, NormalizedOutage, NormalizedRead, NormalizedStation, NormalizedUnit } from "../../types.js";
import { nowUtcIso, parseIsoLocalToUtcIso } from "../../lib/time.js";
import { stationModelsFor } from "../../catalog/station-models.js";
import { WMATA_STATION_MODELS } from "../../catalog/wmata-models.js";
import { allElevators, elevatorRedundant, type StationModel } from "../../lib/accessibility.js";
import { parseWmataLocation, segmentIdsForPair } from "./location.js";
import type { WmataIncidentsResponse, WmataStationsResponse } from "./raw.js";

// WMATA (Washington DC Metro) — per-elevator outage ids (UnitName "A14X01",
// stable, prefix = StationCode) but NO full-inventory feed: the API only lists
// broken units (catalog inventoryComplete: false — suppresses %-down and the
// single_elevator redundancy inference; staticFleetReference 320 stays the %
// denominator). Units are DISCOVERED as they break — every elevator the agency
// reports is tracked, garage/parking included (universal policy) — but garage
// elevators are never chain members unless the agency or a human confirms the
// route. The station list IS complete (102 codes incl. transfer pairs like
// A01/C01 Metro Center, with coords) → NormalizedRead.stations.
//
// STATION MODELS (2026-07-13): 55 stations carry GTFS-pathways-derived access
// chains (src/catalog/wmata-data/chains.json, scripts/wmata-pathways.mts) plus
// a hand-curated tier (wmata-models.ts, e.g. Rockville's pedestrian-bridge
// pair). Model elevator ids are REAL live UnitNames wherever the unit has ever
// appeared in the feed (observed-units.json binding); a never-observed slot
// keeps a synthetic WMATA-<node> id until its UnitName first shows up. So a
// live outage usually matches its model slot BY ID. For a UnitName the models
// don't know at a modeled station, attribution falls back to the
// LocationDescription level pair ("Elevator between street and mezzanine" →
// that segment, unit.segment) — and if even that can't place it, the outage is
// flagged needsReview and the site treats the station's chains as UNKNOWN
// (never accessible): the fail-safe direction is over-warn. After any such
// discovery, re-run scripts/wmata-observed.mts + scripts/wmata-pathways.mts to
// bind the new UnitName (or auto-exclude the station if it broke the model).
// No unauthenticated tier — requires WMATA_API_KEY (free Default Tier).

export interface WmataConfig {
  systemId: string;
  apiBase: string;
  apiKey?: string;
}

export const WMATA_CONFIG: WmataConfig = {
  systemId: "wmata-dc",
  apiBase: "https://api.wmata.com",
  apiKey: process.env.WMATA_API_KEY || undefined,
};

// SymptomDescription is open-ended; match conservatively. Planned = clearly
// scheduled work; everything else (Service Call, Minor/Major Repair, Other,
// unseen future values) counts as unplanned per the locked policy.
const PLANNED_SYMPTOM = /modernization|preventive maintenance|safety inspection|scheduled|rehabilitation/i;

// Curated-tier ids (wmata-models.ts) get redundancySource "curated"; generated
// chain ids (wmata-data/chains.json) get "pathways".
const CURATED_IDS = new Set(WMATA_STATION_MODELS.flatMap((m) => allElevators(m).map((e) => e.externalId)));

export type WmataAttribution =
  | { kind: "modeled"; segment: string; isRedundant: boolean; source: "curated" | "pathways" }
  | { kind: "garage" }
  | { kind: "fallback-segment"; segment: string } // unknown unit, level pair placed it
  | { kind: "unmappable" } // unknown unit at a modeled station, location unparseable
  | { kind: "unmodeled" }; // station has no models at all

/** Rider/maintainer-facing context appended to the outage reason when the
 * fail-safe fires (BART's "(unspecified elevator — conservative)" precedent).
 * This text rides the outage boards, the needs-review board, AND the ntfy
 * push — it is the actionable "run the WMATA refresh loop" signal, so
 * check:wmata guards it. Empty for every non-fail-safe attribution. */
export function failSafeReasonNote(attr: WmataAttribution): string {
  switch (attr.kind) {
    case "fallback-segment":
      return " (new elevator not yet in the station model — placed by its described location; refresh the WMATA model)";
    case "unmappable":
      return " (unrecognized elevator at a modeled station — access shown as unknown; refresh the WMATA model)";
    default:
      return "";
  }
}

/** Attribute one live incident against the station's models. Pure — offline-testable (check:wmata). */
export function attributeWmataIncident(unitName: string, location: string, chains: StationModel[]): WmataAttribution {
  if (!chains.length) {
    // Un-modeled station — garage units are still recognizable (roster clarity).
    return parseWmataLocation(location) === "garage" ? { kind: "garage" } : { kind: "unmodeled" };
  }
  // (1) direct id match — the common case, thanks to observed-name binding.
  const inChains = chains.filter((c) => allElevators(c).some((e) => e.externalId === unitName));
  if (inChains.length) {
    const segment = inChains[0]!.segments.find((s) => s.elevators.some((e) => e.externalId === unitName))!.id;
    // Multi-chain membership (e.g. a shared prerequisite elevator): redundant
    // only if its outage severs NO chain it belongs to (MTA aggregate rule).
    const isRedundant = inChains.every((c) => elevatorRedundant(c, unitName));
    return { kind: "modeled", segment, isRedundant, source: CURATED_IDS.has(unitName) ? "curated" : "pathways" };
  }
  // (2) unknown UnitName at a modeled station.
  const pair = parseWmataLocation(location);
  if (pair === "garage") return { kind: "garage" };
  const segIds = new Set(segmentIdsForPair(pair));
  const matches = new Set(chains.flatMap((c) => c.segments.filter((s) => segIds.has(s.id)).map((s) => s.id)));
  if (matches.size === 1) return { kind: "fallback-segment", segment: [...matches][0]! };
  return { kind: "unmappable" };
}

const WMATA_ZONE = "America/New_York";

async function fetchJson<T>(url: string, apiKey: string): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json", api_key: apiKey },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`WMATA feed ${url.split("?")[0]} returned HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function createWmataAdapter(config: WmataConfig = WMATA_CONFIG): Adapter {
  return {
    systemId: config.systemId,

    async fetch(): Promise<NormalizedRead> {
      const apiKey = config.apiKey;
      if (!apiKey) {
        throw new Error("WMATA_API_KEY is not set — WMATA has no unauthenticated tier (free key: developer.wmata.com).");
      }

      const [incidentsRes, stationsRes] = await Promise.all([
        fetchJson<WmataIncidentsResponse>(`${config.apiBase}/Incidents.svc/json/ElevatorIncidents`, apiKey),
        fetchJson<WmataStationsResponse>(`${config.apiBase}/Rail.svc/json/jStations`, apiKey),
      ]);

      const stationRaw = stationsRes.Stations ?? [];
      const stationByCode = new Map(stationRaw.map((s) => [s.Code, s]));

      // Complete station layer (102 codes; transfer stations keep separate
      // codes since incidents reference a specific one).
      const stations: NormalizedStation[] = stationRaw.map((s) => ({
        externalId: s.Code,
        name: s.Name,
        borough: s.Address?.City || undefined,
        latitude: Number.isFinite(s.Lat) ? s.Lat : undefined,
        longitude: Number.isFinite(s.Lon) ? s.Lon : undefined,
      }));

      // Despite the endpoint name, the feed mixes ESCALATORs in — filter.
      const elevatorIncidents = (incidentsRes.ElevatorIncidents ?? []).filter(
        (i) => (i.UnitType ?? "").toUpperCase() === "ELEVATOR",
      );

      // Discovered inventory: each currently-broken elevator becomes a unit,
      // attributed against the station models (see header). Station name comes
      // from jStations (incident StationName is decorated with entrance
      // detail); fall back to the incident text before the comma.
      const models = stationModelsFor(config.systemId);
      const units: NormalizedUnit[] = [];
      const outages: NormalizedOutage[] = [];
      for (const i of elevatorIncidents) {
        const station = stationByCode.get(i.StationCode);
        const attr = attributeWmataIncident(i.UnitName, i.LocationDescription ?? "", models.get(i.StationCode) ?? []);
        units.push({
          externalId: i.UnitName,
          unitType: "elevator",
          stationExternalId: i.StationCode,
          stationName: station?.Name ?? i.StationName.split(",")[0]!.trim(),
          borough: station?.Address?.City || undefined,
          description: i.LocationDescription || undefined,
          isAda: true,
          isActive: true,
          // Model-derived redundancy for units bound into a chain; everything
          // else (garage, unknown, un-modeled station) stays undefined →
          // ingest's assumed default (never a guessed claim).
          isRedundant: attr.kind === "modeled" ? attr.isRedundant : undefined,
          redundancySource: attr.kind === "modeled" ? attr.source : undefined,
          segment: attr.kind === "modeled" || attr.kind === "fallback-segment" ? attr.segment : undefined,
          latitude: station && Number.isFinite(station.Lat) ? station.Lat : undefined,
          longitude: station && Number.isFinite(station.Lon) ? station.Lon : undefined,
        });
        const failSafeNote = failSafeReasonNote(attr);
        outages.push({
          unitExternalId: i.UnitName,
          unitType: "elevator",
          stationExternalId: i.StationCode,
          stationName: station?.Name ?? i.StationName.split(",")[0]!.trim(),
          isPlanned: PLANNED_SYMPTOM.test(i.SymptomDescription ?? ""),
          isUpcoming: false,
          // Fail-safe outages carry their own context on the reason itself —
          // it rides the boards and the ntfy push (the refresh-loop signal).
          reason: failSafeNote ? `${i.SymptomDescription || "Out of service"}${failSafeNote}` : i.SymptomDescription || undefined,
          sourceStartedAt: parseIsoLocalToUtcIso(i.DateOutOfServ, WMATA_ZONE),
          estimatedReturn: parseIsoLocalToUtcIso(i.EstimatedReturnToService, WMATA_ZONE),
          attributed: attr.kind === "modeled" ? true : attr.kind === "fallback-segment" || attr.kind === "unmappable" ? false : undefined,
          segmentId: attr.kind === "modeled" || attr.kind === "fallback-segment" ? attr.segment : undefined,
          // Fail-safe flags: a UnitName the models don't know at a MODELED
          // station means the model is behind the real world (new unit, or an
          // undercount the gates missed) — a human + a regeneration run must
          // look. Garage and un-modeled stations are expected, never flagged.
          needsReview: attr.kind === "fallback-segment" || attr.kind === "unmappable" ? true : undefined,
        });
      }

      return {
        systemId: config.systemId,
        fetchedAt: nowUtcIso(),
        units,
        outages,
        upcoming: [], // WMATA exposes no scheduled-outage feed
        stations,
      };
    },
  };
}
