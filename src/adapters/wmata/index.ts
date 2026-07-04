import type { Adapter, NormalizedOutage, NormalizedRead, NormalizedStation, NormalizedUnit } from "../../types.js";
import { nowUtcIso, parseIsoLocalToUtcIso } from "../../lib/time.js";
import type { WmataIncidentsResponse, WmataStationsResponse } from "./raw.js";

// WMATA (Washington DC Metro) — per-elevator outage ids (UnitName "A14X01",
// stable, prefix = StationCode) but NO full-inventory feed: the API only lists
// broken units, and GTFS pathways use synthetic node ids with no crosswalk to
// UnitNames (live-verified: 0 matches). So units are DISCOVERED as they break
// (catalog inventoryComplete: false — suppresses %-down and the
// single_elevator redundancy inference). The station list IS complete (102
// codes incl. transfer pairs like A01/C01 Metro Center, with coords), so it's
// emitted via NormalizedRead.stations. No unauthenticated tier — requires
// WMATA_API_KEY (free Default Tier).

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

      // Discovered inventory: each currently-broken elevator becomes a unit.
      // Station name comes from jStations (incident StationName is decorated
      // with entrance detail); fall back to the incident text before the comma.
      const units: NormalizedUnit[] = elevatorIncidents.map((i) => {
        const station = stationByCode.get(i.StationCode);
        return {
          externalId: i.UnitName,
          unitType: "elevator",
          stationExternalId: i.StationCode,
          stationName: station?.Name ?? i.StationName.split(",")[0]!.trim(),
          borough: station?.Address?.City || undefined,
          description: i.LocationDescription || undefined,
          isAda: true,
          isActive: true,
          latitude: station && Number.isFinite(station.Lat) ? station.Lat : undefined,
          longitude: station && Number.isFinite(station.Lon) ? station.Lon : undefined,
        };
      });

      const outages: NormalizedOutage[] = elevatorIncidents.map((i) => {
        const station = stationByCode.get(i.StationCode);
        return {
          unitExternalId: i.UnitName,
          unitType: "elevator",
          stationExternalId: i.StationCode,
          stationName: station?.Name ?? i.StationName.split(",")[0]!.trim(),
          isPlanned: PLANNED_SYMPTOM.test(i.SymptomDescription ?? ""),
          isUpcoming: false,
          reason: i.SymptomDescription || undefined,
          sourceStartedAt: parseIsoLocalToUtcIso(i.DateOutOfServ, WMATA_ZONE),
          estimatedReturn: parseIsoLocalToUtcIso(i.EstimatedReturnToService, WMATA_ZONE),
        };
      });

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
