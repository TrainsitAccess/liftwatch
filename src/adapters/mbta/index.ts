import type { Adapter, NormalizedOutage, NormalizedRead, NormalizedUnit } from "../../types.js";
import { nowUtcIso } from "../../lib/time.js";
import type {
  MbtaAlertRaw,
  MbtaFacilityRaw,
  MbtaJsonApiResponse,
  MbtaStopIncluded,
} from "./raw.js";

// MBTA (Boston) — JSON:API, genuinely per-elevator, and unlike MTA/BART its
// alert timestamps are already ISO-8601 with a UTC offset (no local-time
// parsing needed). No explicit redundancy field, so redundancy falls through
// to the existing precedence engine (single_elevator / assumed) same as any
// system without curation. Facility `properties` sometimes include
// "alternate-service-text" naming a backup elevator in prose — a candidate
// for future curation, not auto-parsed (same policy as BART's planned RSS).

export interface MbtaConfig {
  systemId: string;
  apiBase: string;
  apiKey?: string;
}

export const MBTA_CONFIG: MbtaConfig = {
  systemId: "mbta-boston",
  apiBase: "https://api-v3.mbta.com",
  apiKey: process.env.MBTA_API_KEY || undefined,
};

// "MAINTENANCE"/"CONSTRUCTION" read as scheduled work; everything else
// (UNKNOWN_CAUSE, mechanical failure causes, etc.) is treated as unplanned.
const PLANNED_CAUSES = new Set(["MAINTENANCE", "CONSTRUCTION"]);

async function fetchJsonApi<T>(url: string, apiKey: string | undefined): Promise<MbtaJsonApiResponse<T>> {
  const headers: Record<string, string> = { accept: "application/vnd.api+json" };
  if (apiKey) headers["x-api-key"] = apiKey;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`MBTA feed ${url.split("?")[0]} returned HTTP ${res.status}`);
  return (await res.json()) as MbtaJsonApiResponse<T>;
}

// Paginate defensively via the JSON:API `links.next` URL, even though today's
// volumes (237 elevators, a handful of open alerts) fit on one page.
async function fetchAllPages<T>(url: string, apiKey: string | undefined): Promise<MbtaJsonApiResponse<T>> {
  let next: string | undefined = url;
  const data: T[] = [];
  const included: MbtaStopIncluded[] = [];
  let guard = 0;
  while (next && guard++ < 20) {
    const page: MbtaJsonApiResponse<T> = await fetchJsonApi<T>(next, apiKey);
    data.push(...page.data);
    if (page.included) included.push(...page.included);
    next = page.links?.next;
  }
  return { data, included };
}

const toIso = (v: string | null | undefined): string | undefined => {
  if (!v) return undefined;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
};

export function createMbtaAdapter(config: MbtaConfig = MBTA_CONFIG): Adapter {
  // sort=id is required for pagination correctness: JSON:API offset pagination
  // across independent requests is only stable with an explicit deterministic
  // sort. Without it, two page fetches can return overlapping/missing rows
  // under real load — observed in CI (30 duplicate ids, ~30 elevators silently
  // dropped) even though a quick manual re-check moments later looked clean.
  const facilitiesUrl = `${config.apiBase}/facilities?filter%5Btype%5D=ELEVATOR&sort=id&page%5Blimit%5D=200&include=stop`;
  const alertsUrl = `${config.apiBase}/alerts?filter%5Bactivity%5D=USING_WHEELCHAIR&sort=id&page%5Blimit%5D=200`;

  return {
    systemId: config.systemId,

    async fetch(): Promise<NormalizedRead> {
      const [facilitiesRes, alertsRes] = await Promise.all([
        fetchAllPages<MbtaFacilityRaw>(facilitiesUrl, config.apiKey),
        fetchAllPages<MbtaAlertRaw>(alertsUrl, config.apiKey),
      ]);

      const stopById = new Map((facilitiesRes.included ?? []).map((s) => [s.id, s]));

      const units: NormalizedUnit[] = facilitiesRes.data.map((f) => {
        const stopId = f.relationships.stop.data?.id ?? f.id;
        const stop = stopById.get(stopId);
        return {
          externalId: f.id,
          unitType: "elevator",
          stationExternalId: stopId,
          stationName: stop?.attributes.name ?? stopId,
          borough: stop?.attributes.municipality ?? undefined,
          description: f.attributes.long_name || f.attributes.short_name,
          isAda: true,
          isActive: true,
          latitude: stop?.attributes.latitude ?? f.attributes.latitude ?? undefined,
          longitude: stop?.attributes.longitude ?? f.attributes.longitude ?? undefined,
        };
      });
      const knownFacilityIds = new Set(units.map((u) => u.externalId));

      const current: NormalizedOutage[] = [];
      const upcoming: NormalizedOutage[] = [];
      const now = Date.now();
      const seenFacility = new Set<string>();

      for (const a of alertsRes.data) {
        // Do NOT gate on `effect`: MBTA files the same real elevator outage under
        // several effect labels. ELEVATOR_CLOSURE, ACCESS_ISSUE, and FACILITY_ISSUE
        // have all been observed live for elevators-out — e.g. Kendall/MIT 777
        // "unavailable due to maintenance" arrives as ACCESS_ISSUE, and Lynn
        // 929/930 likewise. The reliable filter is the facility-type join below:
        // informed_entity facilities are kept only when the ELEVATOR-filtered
        // facilities feed confirms they're elevators, so escalators (e.g.
        // FACILITY_ISSUE 143) and mini-high platforms (e.g. ACCESS_ISSUE
        // subplat-*) are excluded regardless of what effect MBTA tagged.
        const period = a.attributes.active_period[0];
        const startsInFuture = period?.start ? Date.parse(period.start) > now : false;

        // One alert can list many informed_entity rows (per stop/route) that
        // all reference the same facility — dedupe to unique facility ids.
        const facilityIds = new Set(
          a.attributes.informed_entity.map((e) => e.facility).filter((f): f is string => !!f && knownFacilityIds.has(f)),
        );
        for (const facilityId of facilityIds) {
          if (seenFacility.has(facilityId)) continue; // one open outage per unit
          seenFacility.add(facilityId);
          const unit = units.find((u) => u.externalId === facilityId);
          const outage: NormalizedOutage = {
            unitExternalId: facilityId,
            unitType: "elevator",
            stationExternalId: unit?.stationExternalId,
            stationName: unit?.stationName ?? facilityId,
            isPlanned: PLANNED_CAUSES.has(a.attributes.cause),
            isUpcoming: startsInFuture,
            reason: a.attributes.header || a.attributes.description || undefined,
            sourceStartedAt: toIso(period?.start),
            estimatedReturn: toIso(period?.end),
          };
          (startsInFuture ? upcoming : current).push(outage);
        }
      }

      return {
        systemId: config.systemId,
        fetchedAt: nowUtcIso(),
        units,
        outages: current,
        upcoming,
      };
    },
  };
}
