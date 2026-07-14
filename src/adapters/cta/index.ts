import { DateTime } from "luxon";
import type { Adapter, NormalizedOutage, NormalizedRead, NormalizedUnit } from "../../types.js";
import { nowUtcIso, parseIsoLocalToUtcIso } from "../../lib/time.js";
import { parseCtaElevatorIdentity } from "./location.js";
import type { CtaAlertRaw, CtaAlertsResponse, CtaServiceRaw } from "./raw.js";

// CTA (Chicago) — Customer Alerts API (alerts.aspx), no API key needed. Like
// WMATA, this only reports elevators that are CURRENTLY broken — there is no
// full elevator inventory feed (CTA's GTFS is a standard 10-table schedule
// feed, no pathways/levels extension; re-verified 2026-07-13 that no agency
// per-station elevator roster exists anywhere — the ASAP plan's tables are
// graphical), so units are discovered as they break (inventoryComplete:
// false, same mechanism as WMATA).
//
// PER-ELEVATOR IDENTITY FROM ALERT TEXT (2026-07-14): CTA's feed has no
// elevator ids, but its alert prose names each elevator by a persistent
// location identity ("The Harlem-bound platform elevator at Pulaski", "The
// elevator to/from street at Ashland") — the same phrase recurs for the same
// physical elevator across outages (verified against the full archive
// corpus). parseCtaElevatorIdentity (location.ts) turns that into a stable
// slug, so an identified alert gets a REAL per-elevator unit id
// ("40030-HARLEM-BOUND") with genuine MTTR/chronic-offender stats. A vague
// alert ("The elevator at Central") falls back to the BARE station id — the
// exact pre-2026-07-14 unit id, so existing archive history continues
// unbroken and nothing is ever guessed. NO redundancy or chain claims are
// made (no inventory signal exists); redundancy stays assumed.
// Two simultaneous alerts for the SAME identified elevator still merge (see
// mergeSameUnitAlerts); different elevators at one station are now distinct
// units — the old whole-station lumping (Pulaski, both platforms,
// 2026-07-10) is gone for identified alerts.

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

// CTA splits an alert's information across fields: the HEADLINE alone carries
// the entrance detail ("Elevator at Lake (Washington/Randolph Entrance)
// Temporarily Out-of-Service") while ShortDescription alone carries the cause
// ("...temporarily out-of-service due to upgrades"). Using either one drops
// real rider-facing detail — live-verified 2026-07-10 when the Lake alert's
// entrance went missing from the archive — so the reason is both, joined.
function combinedReason(a: CtaAlertRaw): string | undefined {
  const parts = [a.Headline, a.ShortDescription].map((s) => (s ?? "").trim()).filter(Boolean);
  return parts.join(" — ") || cdata(a.FullDescription) || undefined;
}

// Most CTA elevator alerts have no structured EventEnd; the return estimate
// lives only in FullDescription prose: "The elevator is currently estimated
// to return to service on Friday, July 31st, 2026. (Note: date subject to
// change)." Parse exactly that phrasing (weekday optional, ordinal suffixes
// stripped), Chicago wall-clock; anything else stays undefined. This is a
// date EXTRACTION from prose, not a classification — the FullDescription
// planned-text trap (boilerplate footer) doesn't apply because the footer
// carries no dates.
function returnEstimateFromProse(text: string): string | undefined {
  const m = /estimated to return to service on\s+(?:[A-Za-z]+,\s+)?([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i.exec(text);
  if (!m) return undefined;
  const dt = DateTime.fromFormat(`${m[1]} ${m[2]} ${m[3]}`, "LLLL d yyyy", { zone: CTA_ZONE });
  return dt.isValid ? (dt.toUTC().toISO() ?? undefined) : undefined;
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

        // Identified alert → stable per-elevator id; vague alert → the bare
        // station id (identical to the pre-identity unit id — history continues).
        const reasonText = combinedReason(a) ?? "";
        const slug = parseCtaElevatorIdentity(reasonText);
        const unitExternalId = slug ? `${station.ServiceId}-${slug}` : station.ServiceId;
        if (!units.has(unitExternalId)) {
          units.set(unitExternalId, {
            externalId: unitExternalId,
            unitType: "elevator",
            stationExternalId: station.ServiceId,
            stationName: station.ServiceName,
            description: (a.ShortDescription ?? "").trim() || undefined,
            isAda: true,
            isActive: true,
          });
        }

        const startIso = parseIsoLocalToUtcIso(a.EventStart, CTA_ZONE);
        const isUpcoming = startIso ? Date.parse(startIso) > now : false;

        const outage: NormalizedOutage = {
          unitExternalId,
          unitType: "elevator",
          stationExternalId: station.ServiceId,
          stationName: station.ServiceName,
          isPlanned: PLANNED_TEXT.test(`${a.Headline} ${a.ShortDescription}`),
          isUpcoming,
          reason: reasonText || undefined,
          sourceStartedAt: startIso,
          estimatedReturn:
            parseIsoLocalToUtcIso(a.EventEnd, CTA_ZONE) ?? returnEstimateFromProse(cdata(a.FullDescription)),
        };
        (isUpcoming ? upcoming : outages).push(outage);
      }

      return {
        systemId: config.systemId,
        fetchedAt: nowUtcIso(),
        units: [...units.values()],
        outages: mergeSameUnitAlerts(outages),
        upcoming: mergeSameUnitAlerts(upcoming),
      };
    },
  };
}

// Two simultaneous alerts can resolve to the SAME unit — an exact-duplicate
// alert of one elevator (live-observed 2026-07-10 at Pulaski), or two vague
// alerts sharing a station's fallback id. Ingest keeps one open event per
// unit, so without merging every alert after the first silently vanishes.
// Merge same-unit alerts into ONE outage that keeps every distinct reason
// visible. (Since the 2026-07-14 identity upgrade, DIFFERENT identified
// elevators at one station are distinct units and no longer merge — the old
// whole-station lumping is gone.) Conservative merge rules:
//   - reasons: deduped verbatim, joined with " · " (riders see both outages);
//   - isPlanned: only if EVERY alert is planned — a mix means at least one
//     real breakdown, which must stay in the unplanned rankings;
//   - sourceStartedAt: earliest (the station's elevator trouble began then);
//   - estimatedReturn: latest, and only when every alert has one (the station
//     isn't fully restored until the last elevator returns; a missing
//     estimate anywhere makes the whole thing unknown).
function mergeSameUnitAlerts(list: NormalizedOutage[]): NormalizedOutage[] {
  const byUnit = new Map<string, NormalizedOutage[]>();
  for (const o of list) {
    const group = byUnit.get(o.unitExternalId) ?? [];
    group.push(o);
    byUnit.set(o.unitExternalId, group);
  }
  return [...byUnit.values()].map((group) => {
    if (group.length === 1) return group[0]!;
    const reasons = [...new Set(group.map((o) => o.reason).filter(Boolean))];
    const starts = group.map((o) => o.sourceStartedAt).filter((s): s is string => !!s);
    const returns = group.map((o) => o.estimatedReturn);
    return {
      ...group[0]!,
      isPlanned: group.every((o) => o.isPlanned),
      reason: reasons.length ? reasons.join(" · ") : undefined,
      sourceStartedAt: starts.length ? starts.sort()[0] : undefined,
      estimatedReturn: returns.every((r): r is string => !!r) ? returns.sort().at(-1) : undefined,
    };
  });
}
