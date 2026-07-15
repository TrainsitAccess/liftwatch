// Snapshot MBTA's non-elevator accessibility facilities (RAMP, mini-high
// platform, portable boarding lift, wheelchair lift) — the same
// `facilities?filter[type]=...` roster src/adapters/mbta/index.ts already
// fetches every poll for the "other accessibility equipment" outage layer,
// but that layer only ever surfaces a facility when it BREAKS. The full
// roster (which stations HAVE a ramp, permanently) was never captured for
// cross-referencing against the actual accessibility models — see CLAUDE.md's
// "STANDING RULE" (2026-07-15) and /liftwatch-station-review.
//
// This is a reference snapshot for the human review pass, NOT auto-wired
// into any model — a ramp still needs a judgment call about which SEGMENT
// it actually covers before it becomes `stepFreeAlternative: true` (same bar
// as any other locked ramp/detour policy in CLAUDE.md).
//
// Usage: npx tsx scripts/mbta-ramps.mts

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const API_BASE = "https://api-v3.mbta.com";
const TYPES = ["RAMP", "ELEVATED_SUBPLATFORM", "FULLY_ELEVATED_PLATFORM", "PORTABLE_BOARDING_LIFT"];

interface FacilityRaw {
  id: string;
  attributes: { type: string; long_name?: string; short_name?: string };
  relationships: { stop: { data: { id: string } | null } };
}
interface StopIncluded {
  id: string;
  attributes: { name: string; municipality?: string | null };
}
interface JsonApiResponse {
  data: FacilityRaw[];
  included?: StopIncluded[];
  links?: { next?: string };
}

async function fetchAllPages(url: string): Promise<{ data: FacilityRaw[]; included: StopIncluded[] }> {
  let next: string | undefined = url;
  const data: FacilityRaw[] = [];
  const included: StopIncluded[] = [];
  let guard = 0;
  while (next && guard++ < 20) {
    const res = await fetch(next, { headers: { accept: "application/vnd.api+json" } });
    if (!res.ok) throw new Error(`MBTA facilities feed returned HTTP ${res.status}`);
    const page = (await res.json()) as JsonApiResponse;
    data.push(...page.data);
    if (page.included) included.push(...page.included);
    next = page.links?.next;
  }
  return { data, included };
}

const url = `${API_BASE}/facilities?filter%5Btype%5D=${TYPES.join(",")}&sort=id&page%5Blimit%5D=500&include=stop`;
const { data, included } = await fetchAllPages(url);
const stopById = new Map(included.map((s) => [s.id, s]));

const facilities = data.map((f) => {
  const stopId = f.relationships.stop.data?.id ?? f.id;
  const stop = stopById.get(stopId);
  return {
    facilityId: f.id,
    facilityType: f.attributes.type,
    stationExternalId: stopId,
    stationName: stop?.attributes.name ?? stopId,
    municipality: stop?.attributes.municipality ?? undefined,
    description: f.attributes.long_name || f.attributes.short_name || undefined,
  };
});

const byType: Record<string, number> = {};
for (const f of facilities) byType[f.facilityType] = (byType[f.facilityType] ?? 0) + 1;

const out = {
  generatedAt: new Date(0).toISOString(), // stamped below with a real value at write time
  note:
    "MBTA's own facility inventory for non-elevator accessibility equipment (RAMP, mini-high/subplatform, portable boarding lift) — a permanent roster, not an outage feed. Reference snapshot for /liftwatch-station-review; ramps are not auto-applied to any model.",
  countsByType: byType,
  facilities,
};
out.generatedAt = new Date().toISOString();

const outPath = fileURLToPath(new URL("../src/catalog/mbta-data/ramps.json", import.meta.url));
writeFileSync(outPath, JSON.stringify(out, null, 1) + "\n");
console.log(`Wrote ${facilities.length} facilities (${JSON.stringify(byType)}) -> src/catalog/mbta-data/ramps.json`);
