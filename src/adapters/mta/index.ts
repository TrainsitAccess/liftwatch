import type { Adapter, NormalizedOutage, NormalizedRead, NormalizedUnit } from "../../types.js";
import { nowUtcIso, parseZonedToUtcIso } from "../../lib/time.js";
import type { MtaEquipmentRaw, MtaOutageRaw } from "./raw.js";

export interface MtaConfig {
  systemId: string;
  timezone: string;
  baseUrl: string;
  feeds: { current: string; upcoming: string; equipments: string };
}

export const MTA_NYCT_CONFIG: MtaConfig = {
  systemId: "mta-nyct",
  timezone: "America/New_York",
  baseUrl: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds",
  feeds: {
    current: "nyct%2Fnyct_ene.json",
    upcoming: "nyct%2Fnyct_ene_upcoming.json",
    equipments: "nyct%2Fnyct_ene_equipments.json",
  },
};

const isYes = (v: string | undefined): boolean => (v ?? "").trim().toUpperCase() === "Y";

// "Planned" = agency-flagged maintenance, or a reason that reads as scheduled
// work. The reason vocabulary is the REAL signal: live-verified 2026-07-07,
// `ismaintenanceoutage` is "N" on every record in both feeds — including rows
// literally labeled "Maintenance" — so the flag is vestigial (kept in the OR
// in case MTA revives it). Observed reason values: Maintenance, Inspection,
// Capital Replacement, Planned Work (planned) vs Repair, Under Investigation,
// Con Edison Power Issue (unplanned).
const PLANNED_REASON = /planned|capital|scheduled|maintenance|inspection/i;
const isPlanned = (raw: MtaOutageRaw): boolean =>
  isYes(raw.ismaintenanceoutage) || PLANNED_REASON.test(raw.reason ?? "");

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(30_000), // a hung feed must not hang the poll
  });
  if (!res.ok) throw new Error(`MTA feed ${url.split("?")[0]} returned HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function createMtaAdapter(config: MtaConfig = MTA_NYCT_CONFIG): Adapter {
  const url = (feed: string) => `${config.baseUrl}/${feed}`;

  const mapOutage = (
    raw: MtaOutageRaw,
    upcoming: boolean,
    stationIdByEquipment: Map<string, string>,
  ): NormalizedOutage => ({
    unitExternalId: raw.equipment,
    unitType: "elevator",
    stationExternalId: stationIdByEquipment.get(raw.equipment),
    stationName: raw.station,
    isPlanned: isPlanned(raw),
    isUpcoming: upcoming,
    reason: raw.reason || undefined,
    sourceStartedAt: parseZonedToUtcIso(raw.outagedate, config.timezone),
    estimatedReturn: parseZonedToUtcIso(raw.estimatedreturntoservice, config.timezone),
  });

  return {
    systemId: config.systemId,

    async fetch(): Promise<NormalizedRead> {
      const [equipmentRaw, currentRaw, upcomingRaw] = await Promise.all([
        fetchJson<MtaEquipmentRaw[]>(url(config.feeds.equipments)),
        fetchJson<MtaOutageRaw[]>(url(config.feeds.current)),
        fetchJson<MtaOutageRaw[]>(url(config.feeds.upcoming)),
      ]);

      // Elevators only. unit_type is reserved for escalators but not ingested.
      const units: NormalizedUnit[] = equipmentRaw
        .filter((e) => e.equipmenttype === "EL")
        .map((e) => ({
          externalId: e.equipmentno,
          unitType: "elevator",
          stationExternalId: e.stationcomplexid || e.elevatorsgtfsstopid || e.station,
          stationName: e.station,
          borough: e.borough || undefined,
          description: e.shortdescription || e.serving || undefined,
          lines: e.linesservedbyelevator || e.trainno || undefined,
          isAda: isYes(e.ADA),
          // MTA states redundancy explicitly: redundant > 0 means a backup exists.
          isRedundant: typeof e.redundant === "number" ? e.redundant > 0 : undefined,
          redundancySource: typeof e.redundant === "number" ? "explicit" : undefined,
          isActive: isYes(e.isactive),
          gtfsStopId: e.elevatorsgtfsstopid || undefined,
        }));

      const stationIdByEquipment = new Map(units.map((u) => [u.externalId, u.stationExternalId]));

      // The "current" feed MIXES IN future scheduled outages, flagged
      // isupcomingoutage=Y (live-verified 2026-07-07: 27 genuinely-current
      // rows + 35 future maintenance/inspection windows up to two weeks out,
      // every one duplicated verbatim in the upcoming feed — so dropping
      // them here loses nothing). Ingesting them as current opened phantom
      // outage events for elevators that were working fine. One nuance: MTA
      // lags flipping the flag when a window actually starts, so a Y row
      // whose outagedate has already PASSED is treated as current — matching
      // MTA's own status page during an active overnight window.
      const now = Date.now();
      const isFutureScheduled = (o: MtaOutageRaw): boolean => {
        if (!isYes(o.isupcomingoutage)) return false;
        const start = parseZonedToUtcIso(o.outagedate, config.timezone);
        return start === undefined || Date.parse(start) > now;
      };

      const currentOutages = currentRaw
        .filter((o) => o.equipmenttype === "EL" && !isFutureScheduled(o))
        .map((o) => mapOutage(o, false, stationIdByEquipment));

      const upcoming = upcomingRaw
        .filter((o) => o.equipmenttype === "EL")
        .map((o) => mapOutage(o, true, stationIdByEquipment));

      return {
        systemId: config.systemId,
        fetchedAt: nowUtcIso(),
        units,
        outages: currentOutages,
        upcoming,
      };
    },
  };
}
