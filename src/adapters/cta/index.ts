import type { Adapter, NormalizedOutage, NormalizedRead, NormalizedUnit } from "../../types.js";
import { nowUtcIso, parseIsoLocalToUtcIso } from "../../lib/time.js";
import type { CtaAlertRaw, CtaAlertsResponse, CtaServiceRaw } from "./raw.js";

// CTA (Chicago) — Customer Alerts API (alerts.aspx), no API key needed. Like
// WMATA, this only reports elevators that are CURRENTLY broken — there is no
// full elevator inventory feed (CTA's GTFS is a standard 10-table schedule
// feed, no pathways/levels extension), so units are discovered as they break
// (inventoryComplete: false, same mechanism as WMATA). Unlike WMATA there is
// no per-elevator id at all — only a station-level identifier — so each
// "unit" here is a whole station's elevator access, same modeling tier as
// BART's un-modeled stations. A station with two simultaneous elevator
// alerts would collide onto one unit; not observed live, documented as a
// known limitation (see SPEC.md).

export interface CtaConfig {
  systemId: string;
  alertsUrl: string;
}

export const CTA_CONFIG: CtaConfig = {
  systemId: "cta-chicago",
  alertsUrl: "http://lapi.transitchicago.com/api/1.0/alerts.aspx?outputType=JSON&accessibility=true",
};

const CTA_ZONE = "America/Chicago";

// Classify against Headline + ShortDescription ONLY. FullDescription carries
// a boilerplate "...repair and upgrade elevators" footer link on nearly every
// alert (verified live: matching against it flagged 9 of 13 real outages as
// planned, when only 2 genuinely were) — a false-positive trap.
const PLANNED_TEXT = /\b(upgrad|planned|construction|rehabilitat|moderniz|renovat)/i;

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function cdata(v: { "#cdata-section"?: string } | string | undefined): string {
  if (!v) return "";
  return typeof v === "string" ? v : (v["#cdata-section"] ?? "");
}

async function fetchAlerts(url: string): Promise<CtaAlertRaw[]> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`CTA feed ${url.split("?")[0]} returned HTTP ${res.status}`);
  const data = (await res.json()) as CtaAlertsResponse;
  return data.CTAAlerts.Alert ?? [];
}

export function createCtaAdapter(config: CtaConfig = CTA_CONFIG): Adapter {
  return {
    systemId: config.systemId,

    async fetch(): Promise<NormalizedRead> {
      const alerts = await fetchAlerts(config.alertsUrl);
      const elevatorAlerts = alerts.filter((a) => a.Impact === "Elevator Status");

      const now = Date.now();
      const units = new Map<string, NormalizedUnit>();
      const outages: NormalizedOutage[] = [];
      const upcoming: NormalizedOutage[] = [];

      for (const a of elevatorAlerts) {
        const services = asArray<CtaServiceRaw>(a.ImpactedService?.Service);
        const station = services.find((s) => s.ServiceType === "T");
        if (!station) continue; // no station in this alert — nothing to attribute the outage to

        const unitExternalId = station.ServiceId;
        if (!units.has(unitExternalId)) {
          units.set(unitExternalId, {
            externalId: unitExternalId,
            unitType: "elevator",
            stationExternalId: unitExternalId,
            stationName: station.ServiceName,
            isAda: true,
            isActive: true,
          });
        }

        const startIso = parseIsoLocalToUtcIso(a.EventStart, CTA_ZONE);
        const isUpcoming = startIso ? Date.parse(startIso) > now : false;

        const outage: NormalizedOutage = {
          unitExternalId,
          unitType: "elevator",
          stationExternalId: unitExternalId,
          stationName: station.ServiceName,
          isPlanned: PLANNED_TEXT.test(`${a.Headline} ${a.ShortDescription}`),
          isUpcoming,
          reason: a.ShortDescription || cdata(a.FullDescription) || undefined,
          sourceStartedAt: startIso,
          estimatedReturn: parseIsoLocalToUtcIso(a.EventEnd, CTA_ZONE),
        };
        (isUpcoming ? upcoming : outages).push(outage);
      }

      return {
        systemId: config.systemId,
        fetchedAt: nowUtcIso(),
        units: [...units.values()],
        outages,
        upcoming,
      };
    },
  };
}
