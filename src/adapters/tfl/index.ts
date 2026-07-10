import type { Adapter, NormalizedOutage, NormalizedRead, NormalizedStation, NormalizedUnit } from "../../types.js";
import { nowUtcIso } from "../../lib/time.js";
import type { TflCatalogLift, TflCatalogStation, TflLiftDisruptionRaw } from "./raw.js";
// STATIC json imports — runtime-relative readFileSync paths break inside the
// bundled Netlify function (see station-models.ts's note; live-confirmed 502).
import stationsJson from "../../catalog/tfl-data/stations.json" with { type: "json" };
import liftsJson from "../../catalog/tfl-data/lifts.json" with { type: "json" };

// TfL (London) — the richest source yet: a REAL per-lift inventory (569
// lifts, stable LiftUniqueId matching the live disruption feed exactly) with
// redundancy derived from TfL's own published topology (two lifts sharing an
// identical (FromAreas, ToAreas) route are genuinely redundant — verified
// against real counter-examples; "same station" alone is NOT sufficient,
// e.g. Kingsbury's two lifts share an origin but serve different platforms).
// This is the first system where GTFS-Pathways-tier redundancy (SPEC.md's
// "pathways" precedence level) is real data, not aspirational.
//
// No confirmed live URL exists for the topology CSVs (downloaded manually
// from TfL's open data pages), so this adapter reads a bundled, versioned
// snapshot (src/catalog/tfl-data/*.json, built by scripts/tfl-import.mjs) —
// refresh periodically by hand, same pattern as BART's curated station
// models. Only the live Disruptions/Lifts/v2 endpoint is polled in real
// time; it needs no API key and has no structured start-date field, so
// (like BART) we rely on our own polling to timestamp outage events.

export interface TflConfig {
  systemId: string;
  disruptionsUrl: string;
}

export const TFL_CONFIG: TflConfig = {
  systemId: "tfl-london",
  disruptionsUrl: "https://api.tfl.gov.uk/Disruptions/Lifts/v2",
};

function loadCatalog() {
  const stations = stationsJson as TflCatalogStation[];
  const lifts = liftsJson as TflCatalogLift[];
  return { stations, lifts };
}

// No structured cause field in the live feed — only free text. Long-scheduled
// capital works read as planned; the common "faulty lift" / staffing-outage
// phrasing (the vast majority of live entries) defaults to unplanned.
const PLANNED_MESSAGE = /\b(planned|upgrade|engineering work|modernisation|modernization|refurbishment)\b/i;

async function fetchDisruptions(url: string): Promise<TflLiftDisruptionRaw[]> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`TfL feed ${url.split("?")[0]} returned HTTP ${res.status}`);
  return (await res.json()) as TflLiftDisruptionRaw[];
}

export function createTflAdapter(config: TflConfig = TFL_CONFIG): Adapter {
  return {
    systemId: config.systemId,

    async fetch(): Promise<NormalizedRead> {
      const { stations: catStations, lifts: catLifts } = loadCatalog();
      const disruptions = await fetchDisruptions(config.disruptionsUrl);

      const stations: NormalizedStation[] = catStations.map((s) => ({
        externalId: s.id,
        name: s.name,
        latitude: s.lat ?? undefined,
        longitude: s.lon ?? undefined,
      }));

      const liftByStation = new Map<string, number>();
      for (const l of catLifts) liftByStation.set(l.stationId, (liftByStation.get(l.stationId) ?? 0) + 1);
      const stationById = new Map(catStations.map((s) => [s.id, s]));
      const liftById = new Map(catLifts.map((l) => [l.id, l]));

      // Full inventory is known statically (unlike WMATA) — every lift is a
      // unit, redundancy comes straight from the precomputed topology group.
      const units: NormalizedUnit[] = catLifts.map((l) => ({
        externalId: l.id,
        unitType: "elevator",
        stationExternalId: l.stationId,
        stationName: stationById.get(l.stationId)?.name ?? l.stationId,
        description: l.friendlyName ?? undefined,
        isAda: true,
        isRedundant: l.isRedundant,
        redundancySource: "pathways", // derived from TfL's published route topology, not curated by hand
        isActive: true,
        latitude: stationById.get(l.stationId)?.lat ?? undefined,
        longitude: stationById.get(l.stationId)?.lon ?? undefined,
      }));

      const outages: NormalizedOutage[] = [];
      for (const d of disruptions) {
        const stationName = stationById.get(d.stationUniqueId)?.name ?? d.stationUniqueId;
        for (const liftId of d.disruptedLiftUniqueIds) {
          // A disruption can list a lift id not in our static snapshot (a
          // new/renamed lift since the topology was last refreshed) — still
          // report the outage; ingest's orphan-unit path covers it.
          const known = liftById.has(liftId);
          outages.push({
            unitExternalId: liftId,
            unitType: "elevator",
            stationExternalId: known ? d.stationUniqueId : undefined,
            stationName,
            isPlanned: PLANNED_MESSAGE.test(d.message ?? ""),
            isUpcoming: false,
            reason: d.message || undefined,
          });
        }
      }

      return {
        systemId: config.systemId,
        fetchedAt: nowUtcIso(),
        units,
        outages,
        upcoming: [],
        stations,
      };
    },
  };
}
