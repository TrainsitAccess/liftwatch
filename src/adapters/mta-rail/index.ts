import type { Adapter, NormalizedOutage, NormalizedRead, NormalizedStation, NormalizedUnit } from "../../types.js";
import { nowUtcIso, msToUtcIso } from "../../lib/time.js";
import { allElevators, elevatorRedundant, type StationModel } from "../../lib/accessibility.js";
import { MTA_RAIL_STATION_MODELS } from "../../catalog/mta-rail-models.js";
// Static json import, NOT readFileSync — the Netlify function bundler inlines
// the whole import graph (see station-models.ts for the live-confirmed 502).
import railChainsJson from "../../catalog/mta-rail-data/chains.json" with { type: "json" };
import type { CamsysAlertsResponse, RailEeStatusResponse, RailInfrastructureResponse } from "./raw.js";

// Auto-generated chain models (scripts/rail-chains.mts) for the simple
// stations the hand walk-through never covered. Ground-truth-gated against the
// hand-curated models at generation time, but still MACHINE-derived from feed
// text — so their redundancy enters ingest as `serving_text` ("inferred from
// what each elevator serves"), NOT `curated`. Precedence keeps them below any
// human signal: a future hand curation wins outright, and a contradiction
// with an already-curated DB value raises a redundancy_flag instead of
// clobbering. The generator guarantees the two model sets share no station
// and no elevator.
const RAIL_GENERATED_MODELS = (railChainsJson as { models: StationModel[] }).models;

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
  // camsys service-alert feed for this railroad — enrichment only (optional;
  // a fetch failure never fails the poll). LIRR and MNR have separate feeds.
  alertsUrl: string;
  // agency_id as it appears in the camsys informed_entity — "LI" for the LIRR
  // (NOT "LIRR"), "MNR" for Metro-North. Used to reject an alert entity that
  // belongs to the other railroad, a second guard on top of the railroad-
  // scoped stop crosswalk (gtfs_stop_id collides across the two railroads).
  agencyId: "LI" | "MNR";
}

const EESTATUS_URL = "https://backend-unified.mylirr.org/eestatus";
const INFRASTRUCTURE_URL = "https://backend-unified.mylirr.org/infrastructure?language=en";
const ALERTS_BASE = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds";

export const LIRR_CONFIG: MtaRailConfig = {
  systemId: "mta-lirr",
  railroad: "LIRR",
  eestatusUrl: EESTATUS_URL,
  infrastructureUrl: INFRASTRUCTURE_URL,
  alertsUrl: `${ALERTS_BASE}/camsys%2Flirr-alerts.json`,
  agencyId: "LI",
};

export const MNR_CONFIG: MtaRailConfig = {
  systemId: "mta-mnr",
  railroad: "MNR",
  eestatusUrl: EESTATUS_URL,
  infrastructureUrl: INFRASTRUCTURE_URL,
  alertsUrl: `${ALERTS_BASE}/camsys%2Fmnr-alerts.json`,
  agencyId: "MNR",
};

const WORKING = /^working$/i; // exact match, case-insensitive (two upstream casings)
const LONG_TERM = /long term/i;

// --- camsys alert enrichment helpers ----------------------------------------
// A camsys alert names a STATION (stop_id) and describes the elevator in free
// text — never a unitId. We enrich an eestatus outage from it ONLY when the
// match is unambiguous, mirroring the project's established attribution rule
// (BART / attributeOutage: exactly one candidate → attribute; else never
// guess). All enrichment is ADDITIVE — it may upgrade an outage to planned and
// attach a real reason + scheduled return, but NEVER downgrades planned→
// unplanned (that would hide a real outage from the unplanned-ranked boards).

const ALERT_MENTIONS_ELEVATOR = /\belevators?\b/i;
// Planned-work vocabulary. Only these flip an outage to planned; a matched
// alert that reads like an emergency still gets its reason/return attached but
// stays unplanned (safe direction — never hides a live breakdown).
const ALERT_PLANNED = /\b(planned|scheduled|upgrade|replac|moderniz|modernis|rehabilitat|renovat|refurbish|improvement|capital|maintenance)\b/i;

const enText = (t: { translation?: { text: string; language: string }[] } | undefined): string =>
  (t?.translation ?? []).find((x) => x.language === "en")?.text ?? "";

// Track numbers referenced in a free-text string: "Tracks 2 & 4" -> {2,4},
// "(Track 4)" -> {4}. Ranges keep their endpoints only; good enough for the
// set-intersection this feeds. Empty set => no track signal.
function tracksIn(text: string): Set<string> {
  const out = new Set<string>();
  const re = /\btracks?\s+([0-9]+(?:\s*(?:,|&|and|to|-)\s*[0-9]+)*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    for (const n of m[1]!.match(/[0-9]+/g) ?? []) out.add(n);
  }
  return out;
}

const intersects = (a: Set<string>, b: Set<string>): boolean => [...a].some((x) => b.has(x));

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
  alerts: CamsysAlertsResponse,
  config: MtaRailConfig,
  fetchedAt: string,
  nowEpochMs: number = Date.parse(fetchedAt),
): NormalizedRead {
  const allStations = infrastructure.stations ?? [];
  const allCodes = new Set(allStations.map((s) => s.code));
  // "BOTH" (the combined Grand Central app entry) belongs to neither system;
  // the real stations are GCT (LIRR Madison) and 0NY (MNR Terminal).
  const railStations = allStations.filter((s) => s.railroad === config.railroad);
  const byCode = new Map(railStations.map((s) => [s.code, s]));
  // camsys stop_id -> station code, scoped to THIS railroad: gtfs_stop_id
  // collides across LIRR/MNR (verified: 64 cross-railroad collisions) but is
  // unique within one railroad, so this crosswalk is only safe railroad-scoped.
  const codeByGtfsStopId = new Map<string, string>();
  for (const s of railStations) {
    if (s.gtfs_stop_id != null) codeByGtfsStopId.set(String(s.gtfs_stop_id), s.code);
  }

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

  // Station models drive per-unit redundancy, in two tiers:
  //   - HAND-CURATED models (src/catalog/mta-rail-models.ts, human-verified)
  //     carry model-derived redundancy as `curated`, the BART pattern.
  //   - GENERATED models (rail chain generator, ground-truth-gated but
  //     machine-derived from feed text) carry theirs as `serving_text` — an
  //     honest tier below every human signal.
  // A unit can sit in SEVERAL chains (a shared street elevator like Penn's
  // P34) — it is redundant only if its own outage severs NO chain, the same
  // aggregation the MTA subway self-check uses. The generator guarantees no
  // elevator appears in both tiers. Un-modeled units stay undefined (ingest
  // applies single_elevator/assumed).
  const buildChainIndex = (models: StationModel[]): Map<string, StationModel[]> => {
    const byElevator = new Map<string, StationModel[]>();
    for (const model of models.filter((m) => m.systemId === config.systemId)) {
      for (const el of allElevators(model)) {
        const list = byElevator.get(el.externalId) ?? [];
        list.push(model);
        byElevator.set(el.externalId, list);
      }
    }
    return byElevator;
  };
  const curatedChainsByElevator = buildChainIndex(MTA_RAIL_STATION_MODELS);
  const generatedChainsByElevator = buildChainIndex(RAIL_GENERATED_MODELS);

  const units: NormalizedUnit[] = [];
  const outages: NormalizedOutage[] = [];
  // Out-of-service elevators per station, with the tracks named in their
  // location text — the candidate pool the camsys enrichment attributes into.
  const outagesByStation = new Map<string, { outage: NormalizedOutage; tracks: Set<string> }[]>();
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
      const curatedOf = curatedChainsByElevator.get(externalId);
      const generatedOf = generatedChainsByElevator.get(externalId);
      units.push({
        externalId,
        unitType: "elevator",
        stationExternalId: code,
        stationName: station.name,
        borough: station.branch || undefined,
        description: u.location || undefined,
        isAda: true,
        ...(curatedOf
          ? {
              isRedundant: curatedOf.every((m) => elevatorRedundant(m, externalId)),
              redundancySource: "curated" as const,
            }
          : generatedOf
            ? {
                isRedundant: generatedOf.every((m) => elevatorRedundant(m, externalId)),
                redundancySource: "serving_text" as const,
              }
            : {}),
        isActive: true,
        latitude: Number.isFinite(station.latitude) ? station.latitude : undefined,
        longitude: Number.isFinite(station.longitude) ? station.longitude : undefined,
      });
      const status = (u.status ?? "").trim();
      if (!WORKING.test(status)) {
        const outage: NormalizedOutage = {
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
        };
        outages.push(outage);
        const list = outagesByStation.get(code) ?? [];
        list.push({ outage, tracks: tracksIn(u.location ?? "") });
        outagesByStation.set(code, list);
      }
    }
  }

  enrichWithAlerts(alerts, outagesByStation, codeByGtfsStopId, config.agencyId, nowEpochMs);

  return {
    systemId: config.systemId,
    fetchedAt,
    units,
    outages,
    upcoming: [], // no scheduled-outage feed (camsys carries planned notices, applied as enrichment above)
    stations,
  };
}

// Enrich the already-built outages from the camsys alert feed, IN PLACE.
// For each currently-active alert that mentions an elevator and resolves to a
// station on this railroad, attribute it to at most ONE out-of-service
// elevator there (unique track match, or the sole out-of-service elevator if
// the alert names no track) — never guessing when 0 or >1 candidates fit.
// Additive only: attaches a human reason + scheduled return + (if the alert
// reads as planned) upgrades isPlanned; never downgrades.
function enrichWithAlerts(
  alerts: CamsysAlertsResponse,
  outagesByStation: Map<string, { outage: NormalizedOutage; tracks: Set<string> }[]>,
  codeByGtfsStopId: Map<string, string>,
  expectedAgency: string,
  nowEpochMs: number,
): void {
  const nowS = Math.floor(nowEpochMs / 1000);
  for (const entity of alerts.entity ?? []) {
    const alert = entity.alert;
    if (!alert) continue;
    const header = enText(alert.header_text);
    const description = enText(alert.description_text);
    const text = `${header}\n${description}`;
    if (!ALERT_MENTIONS_ELEVATOR.test(text)) continue;

    // Only alerts whose active window covers now (skip stale/future notices).
    const period = (alert.active_period ?? []).find(
      (p) => (p.start == null || p.start <= nowS) && (p.end == null || p.end >= nowS),
    );
    if (!period) continue;

    const alertTracks = tracksIn(text);
    const planned = ALERT_PLANNED.test(text);
    const reason = header || description || undefined;
    const estimatedReturn = typeof period.end === "number" ? msToUtcIso(period.end * 1000) : undefined;
    const sourceStartedAt = typeof period.start === "number" ? msToUtcIso(period.start * 1000) : undefined;

    // Resolve the alert to this railroad's stations (stop_id crosswalk).
    // Reject any entity tagged for the other railroad — gtfs_stop_id collides
    // across LIRR/MNR, so an unfiltered crosswalk could map a sibling
    // railroad's stop onto a same-numbered station here.
    const stationCodes = new Set<string>();
    for (const ie of alert.informed_entity ?? []) {
      if (ie.agency_id && ie.agency_id !== expectedAgency) continue;
      const code = ie.stop_id != null ? codeByGtfsStopId.get(String(ie.stop_id)) : undefined;
      if (code) stationCodes.add(code);
    }

    for (const code of stationCodes) {
      const downHere = outagesByStation.get(code);
      if (!downHere?.length) continue;
      // Candidates: out-of-service elevators implicated by the alert's tracks.
      // No track in the alert (or none in the elevator text) => the whole
      // station is implicated, so every out-of-service elevator is a
      // candidate — attributes only if there's exactly one.
      const candidates =
        alertTracks.size > 0
          ? downHere.filter((o) => o.tracks.size > 0 && intersects(o.tracks, alertTracks))
          : downHere;
      if (candidates.length !== 1) continue; // 0 or >1 => ambiguous, never guess
      const { outage } = candidates[0]!;
      if (planned) outage.isPlanned = true; // additive: upgrade only, never downgrade
      if (reason) outage.reason = reason;
      if (estimatedReturn) outage.estimatedReturn = estimatedReturn;
      if (!outage.sourceStartedAt && sourceStartedAt) outage.sourceStartedAt = sourceStartedAt;
    }
  }
}

export function createMtaRailAdapter(config: MtaRailConfig): Adapter {
  return {
    systemId: config.systemId,

    async fetch(): Promise<NormalizedRead> {
      const [eestatus, infrastructure, alerts] = await Promise.all([
        fetchJson<RailEeStatusResponse>(config.eestatusUrl),
        fetchJson<RailInfrastructureResponse>(config.infrastructureUrl),
        // Enrichment feed: a failure here must not fail the poll — the
        // eestatus outages are complete on their own; alerts only refine
        // planned/unplanned + reason. Degrade to no enrichment.
        fetchJson<CamsysAlertsResponse>(config.alertsUrl).catch((err) => {
          console.warn(`  ⚠ ${config.systemId}: camsys alerts fetch failed (${err instanceof Error ? err.message : err}) — proceeding without enrichment`);
          return { entity: [] } as CamsysAlertsResponse;
        }),
      ]);
      return normalizeRail(eestatus, infrastructure, alerts, config, nowUtcIso());
    },
  };
}
