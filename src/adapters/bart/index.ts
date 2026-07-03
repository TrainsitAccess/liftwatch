import type { Adapter, NormalizedOutage, NormalizedRead, NormalizedUnit } from "../../types.js";
import { nowUtcIso } from "../../lib/time.js";
import { attributeOutage, elevatorRedundant } from "../../lib/accessibility.js";
import { stationModelsFor } from "../../catalog/station-models.js";
import type { BartBsaRaw, BartElevResponse, BartStationRaw, BartStnResponse, BartText } from "./raw.js";

// BART exposes no structured per-elevator status. The real-time `cmd=elev`
// advisory is a free-text, STATION-level sentence ("2 elevators out: MLBR:
// Station; RICH: Station"). So BART is modeled as one synthetic "station
// elevator access" unit per station (station list = the denominator), with
// data_quality best_effort. Its GTFS has no pathways.txt, so redundancy can't
// be derived and is left 'assumed'. The planned-advisories RSS (per-elevator,
// prose) is intentionally not parsed here — see SPEC.

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
function parseAffected(text: string, validAbbrs: Set<string>): Map<string, string> {
  const affected = new Map<string, string>();
  const re = /([A-Z0-9]{2,4}):\s*([^;]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const abbr = m[1]!.toUpperCase();
    if (validAbbrs.has(abbr) && !affected.has(abbr)) {
      affected.set(abbr, m[2]!.trim());
    }
  }
  return affected;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`BART feed ${url} returned HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function createBartAdapter(config: BartConfig = BART_CONFIG): Adapter {
  const stnsUrl = `${config.apiBase}/stn.aspx?cmd=stns&key=${config.apiKey}&json=y`;
  const elevUrl = `${config.apiBase}/bsa.aspx?cmd=elev&key=${config.apiKey}&json=y`;

  return {
    id: "bart",
    systemId: config.systemId,

    async fetch(): Promise<NormalizedRead> {
      const [stnsRes, elevRes] = await Promise.all([
        fetchJson<BartStnResponse>(stnsUrl),
        fetchJson<BartElevResponse>(elevUrl),
      ]);

      const stations: BartStationRaw[] = stnsRes.root?.stations?.station ?? [];
      const stationByAbbr = new Map(stations.map((s) => [s.abbr.toUpperCase(), s]));
      const models = stationModelsFor(config.systemId);

      // Modeled stations expand into per-elevator units (with segment + derived
      // redundancy); un-modeled stations stay a single station-level unit.
      const units: NormalizedUnit[] = [];
      for (const s of stations) {
        const abbr = s.abbr.toUpperCase();
        const lat = num(s.gtfs_latitude);
        const lon = num(s.gtfs_longitude);
        const model = models.get(abbr);
        if (model) {
          for (const seg of model.segments) {
            for (const e of seg.elevators) {
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

      const outages: NormalizedOutage[] = [...affected].map(([abbr, desc]) => {
        const stationName = stationByAbbr.get(abbr)?.name ?? abbr;
        const model = models.get(abbr);
        const base = {
          unitType: "elevator" as const,
          stationExternalId: abbr,
          stationName,
          isPlanned: false, // real-time advisory = unplanned; planned RSS deferred
          isUpcoming: false,
        };
        if (model) {
          const attr = attributeOutage(desc, model);
          if (attr) {
            return { ...base, unitExternalId: attr.elevatorExternalId, segmentId: attr.segmentId, attributed: true, reason: desc || "Elevator out of service" };
          }
          // Too vague to attribute -> conservative: unspecified elevator at station.
          return { ...base, unitExternalId: `${abbr}-UNSPECIFIED`, attributed: false, reason: `${desc || "Elevator out of service"} (unspecified elevator — conservative)` };
        }
        return { ...base, unitExternalId: abbr, attributed: false, reason: desc || "Elevator out of service" };
      });

      return {
        systemId: config.systemId,
        fetchedAt: nowUtcIso(),
        units,
        outages,
        upcoming: [],
      };
    },
  };
}
