import type { Adapter, NormalizedOutage, NormalizedOtherEquipment, NormalizedRead, NormalizedUnit } from "../../types.js";
import { nowUtcIso } from "../../lib/time.js";
import { attributeOutageAcrossChains, elevatorRedundant, platformDefaultElevator } from "../../lib/accessibility.js";
import { stationModelsFor } from "../../catalog/station-models.js";
import { matchBartOtherEquipment } from "../../catalog/bart-other-equipment.js";
import { fetchPlannedAdvisories } from "./planned-rss.js";
import type { BartBsaRaw, BartElevResponse, BartStationRaw, BartStnResponse, BartText } from "./raw.js";

// BART exposes no structured per-elevator status. The real-time `cmd=elev`
// advisory is a free-text, STATION-level sentence ("2 elevators out: MLBR:
// Station; RICH: Station"); data_quality best_effort. Stations with a curated
// model (station-models.ts) expand into per-elevator units and advisories are
// attributed via matchHints (specific elevator > segment-only > unspecified —
// never a guess). Un-modeled stations stay one station-level unit. Its GTFS has
// no pathways.txt, so redundancy is all curation. The planned-advisories RSS
// (per-elevator, prose) feeds `upcoming` — see planned-rss.ts; its fetch is
// best-effort (a failure degrades to no scheduled work, never a failed poll,
// same posture as the LIRR/MNR camsys alert enrichment).

export interface BartConfig {
  systemId: string;
  apiBase: string;
  apiKey: string;
}

export const BART_CONFIG: BartConfig = {
  systemId: "bart-bay-area",
  apiBase: "https://api.bart.gov/api",
  // BART's officially published public key; override via env if desired.
  apiKey: process.env.BART_API_KEY || "MW9S-E7SL-26DU-VV8V",
};

const cdataText = (v: BartText | undefined): string =>
  typeof v === "string" ? v : (v?.["#cdata-section"] ?? "");

const num = (v: string | undefined): number | undefined => {
  const n = v === undefined ? NaN : Number.parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
};

const asArray = <T>(v: T | T[] | undefined): T[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];

// Pull station codes out of the advisory sentence: tokens like "MLBR:" followed
// by a short description, kept only if the code is a real station abbreviation.
// A station may appear MULTIPLE times (two elevators out at one station) — all
// entries are preserved; only exact duplicates (same station + same text) dedupe.
function parseAffected(text: string, validAbbrs: Set<string>): { abbr: string; desc: string }[] {
  const affected: { abbr: string; desc: string }[] = [];
  const seen = new Set<string>();
  const re = /([A-Z0-9]{2,4}):\s*([^;]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const abbr = m[1]!.toUpperCase();
    const desc = m[2]!.trim();
    const key = `${abbr}|${desc}`;
    if (validAbbrs.has(abbr) && !seen.has(key)) {
      seen.add(key);
      affected.push({ abbr, desc });
    }
  }
  return affected;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(30_000), // a hung feed must not hang the poll
  });
  // Redact the query string in errors — it carries the API key, and error text
  // is persisted to poll_runs.error.
  if (!res.ok) throw new Error(`BART feed ${url.split("?")[0]} returned HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function createBartAdapter(config: BartConfig = BART_CONFIG): Adapter {
  const stnsUrl = `${config.apiBase}/stn.aspx?cmd=stns&key=${config.apiKey}&json=y`;
  const elevUrl = `${config.apiBase}/bsa.aspx?cmd=elev&key=${config.apiKey}&json=y`;

  return {
    systemId: config.systemId,

    async fetch(): Promise<NormalizedRead> {
      const [stnsRes, elevRes] = await Promise.all([
        fetchJson<BartStnResponse>(stnsUrl),
        fetchJson<BartElevResponse>(elevUrl),
      ]);
      // Planned-advisories RSS, best-effort AFTER the required feeds: needs
      // the station list for name matching, and its failure must never fail
      // the poll (scheduled work degrades to empty; the outage archive is the
      // part that matters).
      const advisories = await fetchPlannedAdvisories(
        (stnsRes.root?.stations?.station ?? []).map((s) => ({ abbr: s.abbr, name: s.name })),
        stationModelsFor(config.systemId),
      ).catch((err) => {
        console.warn(`  ⚠ BART planned-advisories RSS failed (scheduled work will be empty): ${err instanceof Error ? err.message : err}`);
        return [];
      });

      const stations: BartStationRaw[] = stnsRes.root?.stations?.station ?? [];
      const stationByAbbr = new Map(stations.map((s) => [s.abbr.toUpperCase(), s]));
      const models = stationModelsFor(config.systemId);

      // Modeled stations expand into per-elevator units (with segment + derived
      // redundancy); un-modeled stations stay a single station-level unit. A
      // station can have MULTIPLE independent chains (StationModel.chainLabel)
      // — loop all of them, deduping any elevator shared across chains (e.g. a
      // common entrance) so it's emitted once. No BART station uses multiple
      // chains today, but this keeps the adapter correct if one ever does.
      const units: NormalizedUnit[] = [];
      for (const s of stations) {
        const abbr = s.abbr.toUpperCase();
        const lat = num(s.gtfs_latitude);
        const lon = num(s.gtfs_longitude);
        const stationModels = models.get(abbr) ?? [];
        if (stationModels.length > 0) {
          const seenElevatorIds = new Set<string>();
          for (const model of stationModels) {
            for (const seg of model.segments) {
              for (const e of seg.elevators) {
                if (seenElevatorIds.has(e.externalId)) continue;
                seenElevatorIds.add(e.externalId);
                units.push({
                  externalId: e.externalId,
                  unitType: "elevator",
                  stationExternalId: abbr,
                  stationName: s.name,
                  borough: s.city,
                  description: e.label,
                  segment: seg.id,
                  isAda: true,
                  isRedundant: elevatorRedundant(model, e.externalId),
                  redundancySource: "curated",
                  isActive: true,
                  latitude: lat,
                  longitude: lon,
                });
              }
            }
          }
        } else {
          units.push({
            externalId: abbr,
            unitType: "elevator",
            stationExternalId: abbr,
            stationName: s.name,
            borough: s.city,
            description: "Station elevator access (BART reports at station level)",
            isAda: true,
            isRedundant: false,
            redundancySource: "assumed", // -> confirmed non-redundant via baseline
            isActive: true,
            latitude: lat,
            longitude: lon,
          });
        }
      }

      // Concatenate all elevator advisories, then extract affected stations.
      const advisoryText = asArray<BartBsaRaw>(elevRes.root?.bsa)
        .filter((b) => (b.type ?? "").toUpperCase() === "ELEVATOR")
        .map((b) => cdataText(b.description))
        .join("; ");
      const affected = parseAffected(advisoryText, new Set(stationByAbbr.keys()));

      const outages: NormalizedOutage[] = [];
      const otherEquipment: NormalizedOtherEquipment[] = [];
      for (const { abbr, desc } of affected) {
        const stationName = stationByAbbr.get(abbr)?.name ?? abbr;

        // Other accessibility equipment (curated, NON-elevator — e.g.
        // Coliseum's parking-lot wheelchair lift) is routed to its own
        // walled-off layer and never enters the elevator inventory. Checked
        // BEFORE elevator attribution; a unique hint match wins.
        const equip = matchBartOtherEquipment(abbr, desc);
        if (equip) {
          otherEquipment.push({
            facilityExternalId: equip.facilityExternalId,
            facilityType: equip.facilityType,
            stationExternalId: abbr,
            stationName,
            description: equip.description,
            isPlanned: false,
            isUpcoming: false,
            reason: desc || "Out of service",
          });
          continue;
        }

        // BART's advisory is one free-text sentence per station, not per chain
        // — a multi-chain station (e.g. per-direction platforms) needs EVERY
        // chain's hints tried, not just the first. attributeOutageAcrossChains
        // only returns a result when exactly ONE chain's hints matched at all
        // — two chains matching (or zero) is exactly as ambiguous as two
        // elevators within one chain, so it correctly falls through to the
        // conservative station-level case below rather than guessing.
        const stationModels = models.get(abbr) ?? [];
        const base = {
          unitType: "elevator" as const,
          stationExternalId: abbr,
          stationName,
          isPlanned: false, // real-time advisory = unplanned; planned RSS deferred
          isUpcoming: false,
        };
        if (stationModels.length > 0) {
          const attr = attributeOutageAcrossChains(desc, stationModels);
          if (attr?.elevatorExternalId) {
            // Uniquely named elevator — full attribution.
            outages.push({ ...base, unitExternalId: attr.elevatorExternalId, segmentId: attr.segmentId, attributed: true, reason: desc || "Elevator out of service" });
            continue;
          }
          if (attr) {
            // Segment identified but elevator ambiguous — never guess a specific
            // unit (it would corrupt per-elevator stats). Flag for review.
            outages.push({ ...base, unitExternalId: `${abbr}-${attr.segmentId.toUpperCase()}-UNSPECIFIED`, segmentId: attr.segmentId, attributed: false, needsReview: true, reason: `${desc || "Elevator out of service"} (elevator within ${attr.segmentId} — ambiguous, conservative)` });
            continue;
          }
          // No matchHint caught direction/segment text — i.e. "simply the
          // station elevator". BART policy (Bryce, 2026-07-12): default to the
          // PLATFORM elevator, but ONLY when the station has exactly one (a
          // per-direction station has several, so this returns null and we stay
          // conservative below — never guessing which platform).
          const plat = platformDefaultElevator(stationModels);
          if (plat?.elevatorExternalId) {
            const cleanDesc = (desc || "Elevator out of service").replace(/^[\s\-–—/]+/, "").trim();
            // A platform default at a station that ALSO has auxiliary chains
            // (Coliseum) is a GUESS that could actually be an auxiliary elevator
            // whose advisory wording we haven't confirmed — flag for review. At
            // a station with no auxiliaries (Richmond, Powell) it's unambiguous.
            const hasAux = stationModels.some((m) => m.auxiliary);
            outages.push({ ...base, unitExternalId: plat.elevatorExternalId, segmentId: plat.segmentId, attributed: true, needsReview: hasAux || undefined, reason: `${cleanDesc} (station-level advisory → platform elevator${hasAux ? "; unconfirmed — station has other equipment" : ""})` });
            continue;
          }
          // Genuinely ambiguous (matched >1 chain, or >1 platform elevator) ->
          // unspecified elevator at station. Flag for review.
          outages.push({ ...base, unitExternalId: `${abbr}-UNSPECIFIED`, attributed: false, needsReview: true, reason: `${desc || "Elevator out of service"} (unspecified elevator — conservative)` });
          continue;
        }
        outages.push({ ...base, unitExternalId: abbr, attributed: false, needsReview: true, reason: desc || "Elevator out of service" });
      }

      // Live-outage planned upgrade, EXACT-match only: when a planned
      // advisory attributed to a specific elevator is active right now AND a
      // live outage attributed to that SAME elevator exists, mark it planned
      // and attach the scheduled return. Additive only (never downgrades) —
      // and deliberately narrow: a bare "Station" live advisory yields
      // ABBR-UNSPECIFIED, which never equals a specific elevator id, so no
      // upgrade happens on ambiguity (assuming "the only live outage must be
      // the planned one" would be a guess — cmd=elev's coverage of planned
      // closures is unverified).
      const now = nowUtcIso();
      for (const o of outages) {
        const adv = advisories.find(
          (a) => a.attributed && a.unitExternalId === o.unitExternalId && a.startUtc && a.endUtc && a.startUtc <= now && now <= a.endUtc,
        );
        if (adv) {
          o.isPlanned = true;
          o.estimatedReturn = o.estimatedReturn ?? adv.endUtc;
        }
      }

      const upcoming: NormalizedOutage[] = advisories.map((a) => ({
        unitExternalId: a.unitExternalId,
        unitType: "elevator" as const,
        stationExternalId: a.stationAbbr,
        stationName: a.stationName,
        isPlanned: true,
        isUpcoming: true,
        attributed: a.attributed,
        segmentId: a.segmentId,
        reason: a.reason,
        sourceStartedAt: a.startUtc,
        estimatedReturn: a.endUtc,
      }));

      return {
        systemId: config.systemId,
        fetchedAt: nowUtcIso(),
        units,
        outages,
        upcoming,
        otherEquipment,
      };
    },
  };
}
