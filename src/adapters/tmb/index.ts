import type { Adapter, NormalizedOutage, NormalizedRead, NormalizedUnit } from "../../types.js";
import { nowUtcIso, msToUtcIso } from "../../lib/time.js";
import type { TmbAlertRaw, TmbAlertsResponse, TmbCatalogUnit } from "./raw.js";
// STATIC json import — runtime-relative readFileSync paths break inside the
// bundled Netlify function (see station-models.ts's note; live-confirmed 502).
import unitsJson from "../../catalog/tmb-data/units.json" with { type: "json" };

// TMB (Barcelona) — a real per-elevator inventory (src/catalog/tmb-data,
// built by scripts/tmb-import.mjs from the documented "transit" API) combined
// with a LIVE outage feed that is NOT documented anywhere in
// developer.tmb.cat's published API docs. It's the exact undocumented
// endpoint that powers the traffic-light elevator-status widget on TMB's own
// website — found by inspecting real network traffic from a station page
// (https://www.tmb.cat/en/barcelona/metro/-/lineametro/L2/estacion/210), not
// from any developer-portal documentation. It authenticates with the same
// app_id/app_key issued for the documented "transit" API (live-verified).
// Per TMB's own announcement, this elevator-status system currently covers
// only conventional lines (L1-L5, L11) — L9/L10/FM (automatic lines) aren't
// wired to it yet, so alerts for those lines won't appear regardless of any
// real outage.
//
// Effect taxonomy (live-verified 2026-07-05, 10 active alerts sampled): PP8 =
// "Ascensors fora de servei" (elevators out of service) — the only code
// LiftWatch ingests. PP9 = escalators (out of scope, same elevators-only
// convention as every other system in this project). PP1/PP2/PP7 = service/
// access disruptions unrelated to elevators specifically.
//
// No confirmed live URL returns the WHOLE network's elevator inventory in
// one call (only per-station), so — same pattern as TfL's bundled topology —
// the inventory is a versioned snapshot, refreshed by re-running
// scripts/tmb-import.mjs by hand. Only the alerts endpoint is polled live.
//
// Redundancy is NOT modeled yet: unlike TfL (where exact FromAreas/ToAreas
// route matches are a verified signal), we have no confirmed per-direction
// topology for TMB — units default to "assumed" (see src/types.ts).

export interface TmbConfig {
  systemId: string;
  alertsUrl: string;
  appId?: string;
  appKey?: string;
}

export const TMB_CONFIG: TmbConfig = {
  systemId: "tmb-barcelona",
  alertsUrl: "https://api.tmb.cat/v1/alerts/metro/channels/WEB",
  appId: process.env.TMB_APP_ID || undefined,
  appKey: process.env.TMB_APP_KEY || undefined,
};

function loadCatalog(): TmbCatalogUnit[] {
  return unitsJson as TmbCatalogUnit[];
}

// The only elevator-outage effect code in the live taxonomy (verified
// 2026-07-05): PP8. Everything else (PP9 escalators, PP1/PP2/PP7 service/
// access disruptions) is out of scope for an elevator-only tracker.
const ELEVATOR_EFFECT_CODE = "PP8";

// Every live-verified alert (10/10, 2026-07-05) carries cause_code
// "CONSTRUCTION" regardless of apparent cause — same lesson as CTA's
// FullDescription trap: that field is not trustworthy for planned/unplanned
// classification. Classify against the English publication text instead,
// same approach as CTA/TfL.
const PLANNED_TEXT = /\b(maintenance|planned|scheduled|upgrade|improvement|refurbishment|renovation)\b/i;

async function fetchAlerts(config: TmbConfig): Promise<TmbAlertRaw[]> {
  if (!config.appId || !config.appKey) {
    throw new Error("TMB_APP_ID / TMB_APP_KEY are not set — TMB has no unauthenticated tier (developer.tmb.cat).");
  }
  const url = `${config.alertsUrl}?app_id=${config.appId}&app_key=${config.appKey}`;
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`TMB alerts feed returned HTTP ${res.status}`);
  const data = (await res.json()) as TmbAlertsResponse;
  return data.data?.alerts ?? [];
}

export function createTmbAdapter(config: TmbConfig = TMB_CONFIG): Adapter {
  return {
    systemId: config.systemId,

    async fetch(): Promise<NormalizedRead> {
      const catalog = loadCatalog();
      const alerts = await fetchAlerts(config);
      const elevatorAlerts = alerts.filter((a) => a.categories.effect_code === ELEVATOR_EFFECT_CODE);

      // Full inventory is known statically (like TfL) — every elevator access
      // unit is a unit. Redundancy isn't modeled yet (see file header).
      const units: NormalizedUnit[] = catalog.map((u) => ({
        externalId: u.id,
        unitType: "elevator",
        stationExternalId: u.stationGroupId,
        stationName: u.stationName,
        description: u.entranceName,
        isAda: true,
        isActive: true,
        latitude: u.latitude ?? undefined,
        longitude: u.longitude ?? undefined,
      }));

      const byCodiAcces = new Map<string, TmbCatalogUnit[]>();
      const byStationName = new Map<string, TmbCatalogUnit[]>();
      for (const u of catalog) {
        const accesList = byCodiAcces.get(u.codiAcces) ?? [];
        accesList.push(u);
        byCodiAcces.set(u.codiAcces, accesList);

        const nameKey = u.stationName.trim().toUpperCase();
        const nameList = byStationName.get(nameKey) ?? [];
        nameList.push(u);
        byStationName.set(nameKey, nameList);
      }

      const now = Date.now();
      const outages: NormalizedOutage[] = [];
      const upcoming: NormalizedOutage[] = [];

      for (const a of elevatorAlerts) {
        const dates = a.disruption_dates[0];
        const pub = a.publications[0];
        const startIso = msToUtcIso(dates?.begin_date);
        const endIso = msToUtcIso(dates?.end_date);
        const isUpcoming = startIso ? Date.parse(startIso) > now : false;
        const isPlanned = PLANNED_TEXT.test(pub?.textEn ?? "");
        const reason = pub?.textEn || pub?.headerEn || undefined;

        for (const e of a.entities) {
          const entranceCode = e.entrance_code;
          const stationUnits = byStationName.get(e.station_name.trim().toUpperCase()) ?? [];
          let matched: TmbCatalogUnit[] = [];
          let attributed = true;

          if (!entranceCode || entranceCode === "ALL") {
            // Station-wide effect: the FEED itself says every elevator at the
            // station is affected — expanding to all its real units repeats
            // the agency's own claim, not a guess of ours. attributed=false
            // because it's still a station-level statement, not per-unit.
            matched = stationUnits;
            attributed = false;
          } else {
            matched = byCodiAcces.get(entranceCode) ?? [];
            if (matched.length === 0 && stationUnits.length > 0) {
              // Entrance code our catalog snapshot doesn't recognize (drift
              // since the last tmb-import run). The outage is real but WHICH
              // elevator(s) it hits is unknown — emit ONE synthetic unit at
              // the station rather than blaming every elevator there: a
              // wrong guess corrupts per-elevator stats (same never-guess
              // rule as BART's -UNSPECIFIED units).
              const outage: NormalizedOutage = {
                unitExternalId: `TMB-${e.station_code}-${entranceCode}`,
                unitType: "elevator",
                stationExternalId: stationUnits[0]!.stationGroupId,
                stationName: stationUnits[0]!.stationName,
                isPlanned,
                isUpcoming,
                reason: `${reason ?? "Elevator out of service"} (entrance ${entranceCode} not in catalog snapshot — unattributed, conservative)`,
                sourceStartedAt: startIso,
                estimatedReturn: endIso,
                attributed: false,
              };
              (isUpcoming ? upcoming : outages).push(outage);
              continue;
            }
          }

          if (matched.length === 0) {
            // Nothing in our catalog matches this station at all — still
            // report the outage so ingest's orphan-unit path can catch it,
            // rather than silently dropping a real, live elevator outage.
            const outage: NormalizedOutage = {
              unitExternalId: `TMB-${e.station_code}-${entranceCode ?? "UNKNOWN"}`,
              unitType: "elevator",
              stationName: e.station_name,
              isPlanned,
              isUpcoming,
              reason,
              sourceStartedAt: startIso,
              estimatedReturn: endIso,
              attributed: false,
            };
            (isUpcoming ? upcoming : outages).push(outage);
            continue;
          }

          for (const u of matched) {
            const outage: NormalizedOutage = {
              unitExternalId: u.id,
              unitType: "elevator",
              stationExternalId: u.stationGroupId,
              stationName: u.stationName,
              isPlanned,
              isUpcoming,
              reason,
              sourceStartedAt: startIso,
              estimatedReturn: endIso,
              attributed,
            };
            (isUpcoming ? upcoming : outages).push(outage);
          }
        }
      }

      return {
        systemId: config.systemId,
        fetchedAt: nowUtcIso(),
        units,
        outages,
        upcoming,
      };
    },
  };
}
