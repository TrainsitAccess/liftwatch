// Refresh MTA's own STATION-LEVEL ADA accessibility declaration — a DIFFERENT
// question from live elevator outages. Per MTA's own display guidance
// (src/catalog/mta-data/MTA-DISPLAY-GUIDE.md): a station's `ada` value is
// 0 = not accessible, 1 = fully accessible, 2 = partially accessible (usually
// one direction/line only) — this is about the STATION'S DESIGN, not whether
// today's elevator happens to be broken.
//
// TWO source datasets, joined by complex_id (which for MTA equals our
// stationExternalId — station_id(system, ext) uses stationcomplexid, see
// src/adapters/mta/index.ts):
//   - data.ny.gov 4ta5-wz5s "MTA Subway Station Complexes" — ~32 multi-line
//     INTERCHANGE complexes, each with MTA's OWN authored `ada_notes` prose
//     naming every line and its status ("N Q R W accessible; L accessible;
//     4 5 6 not accessible"). This is the richest, most rider-facing text
//     available — used verbatim when present.
//   - data.ny.gov 39hk-dx4f "MTA Subway Stations" — one row per line at every
//     station (covers ALL 445 complexes, including the ~413 single-line ones
//     the complexes dataset omits because there's nothing to roll up). Has
//     `ada`, `ada_northbound`/`ada_southbound`, direction labels, and
//     sometimes its own `ada_notes` (e.g. "Uptown only").
//
// For a single-line complex not in the interchange dataset, we SYNTHESIZE an
// explanation from the line/route/direction fields when MTA doesn't supply
// ada_notes directly — always naming the line and direction, per Bryce's
// instruction (2026-07-16): never just say "partially accessible", say what
// that means, which lines, which directions.

import { writeFileSync } from "node:fs";

const COMPLEXES_URL = "https://data.ny.gov/resource/4ta5-wz5s.json?$limit=1000";
const STATIONS_URL = "https://data.ny.gov/resource/39hk-dx4f.json?$limit=1000";

interface ComplexRow { complex_id: string; complex_name: string; ada: string; ada_notes?: string }
interface StationRow {
  complex_id: string; stop_name: string; line: string; daytime_routes: string;
  ada: string; ada_northbound: string; ada_southbound: string;
  north_direction_label: string; south_direction_label: string; ada_notes?: string;
}

async function getJson<T>(url: string): Promise<T[]> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return (await res.json()) as T[];
}

const [complexes, stations] = await Promise.all([
  getJson<ComplexRow>(COMPLEXES_URL),
  getJson<StationRow>(STATIONS_URL),
]);

const complexById = new Map(complexes.map((c) => [String(c.complex_id), c]));

const byComplex = new Map<string, StationRow[]>();
for (const r of stations) {
  const id = String(r.complex_id);
  (byComplex.get(id) ?? byComplex.set(id, []).get(id)!).push(r);
}

// Build one rich, line-and-direction-explicit sentence for a single line row.
function lineExplanation(r: StationRow): string {
  const routes = r.daytime_routes?.trim() || r.line;
  if (r.ada === "1") return `${r.line} [${routes}]: accessible.`;
  if (r.ada === "0") return `${r.line} [${routes}]: not accessible.`;
  // ada === "2": partial. Prefer MTA's own notes; else name the accessible
  // direction explicitly using MTA's own direction labels.
  if (r.ada_notes) return `${r.line} [${routes}]: ${r.ada_notes}.`;
  const north = r.ada_northbound === "1";
  const south = r.ada_southbound === "1";
  const okDir = north ? r.north_direction_label : south ? r.south_direction_label : null;
  return okDir
    ? `${r.line} [${routes}]: accessible toward ${okDir} only.`
    : `${r.line} [${routes}]: partially accessible (direction unspecified by MTA).`;
}

type Entry = {
  complexId: string;
  name: string;
  ada: number; // 0 | 1 | 2
  explanation: string | null; // null only when fully accessible (ada 1) with nothing notable to add
  lines: { line: string; routes: string; ada: number; explanation: string }[];
};

const entries: Entry[] = [];
for (const [complexId, rows] of byComplex) {
  const lines = rows.map((r) => ({
    line: r.line,
    routes: r.daytime_routes?.trim() || r.line,
    ada: Number(r.ada),
    explanation: lineExplanation(r),
  }));
  const name = rows[0]!.stop_name;
  const interchange = complexById.get(complexId);

  // Complex-level ada: prefer the interchange dataset's own rollup; else derive
  // (all lines accessible -> 1; all inaccessible -> 0; mixed -> 2) from rows.
  const allOne = lines.every((l) => l.ada === 1);
  const allZero = lines.every((l) => l.ada === 0);
  const derivedAda = allOne ? 1 : allZero ? 0 : 2;
  const ada = interchange ? Number(interchange.ada) : derivedAda;

  let explanation: string | null = null;
  if (ada !== 1) {
    explanation = interchange?.ada_notes
      ? `${interchange.ada_notes}.`
      : lines.filter((l) => l.ada !== 1).map((l) => l.explanation).join(" ");
  }

  entries.push({ complexId, name, ada, explanation, lines });
}

entries.sort((a, b) => a.complexId.localeCompare(b.complexId, undefined, { numeric: true }));

const out = {
  note:
    "MTA's own STATION-LEVEL ADA accessibility declaration (design-time, not live " +
    "outage status) — see src/catalog/mta-data/MTA-DISPLAY-GUIDE.md. Sources: " +
    "data.ny.gov 4ta5-wz5s (interchange complexes, MTA-authored ada_notes) + " +
    "39hk-dx4f (per-line rows, all complexes). Refresh: npm run mta:station-ada. " +
    "ada: 0=not accessible, 1=fully accessible, 2=partially accessible.",
  complexCount: entries.length,
  stations: entries,
};

writeFileSync("src/catalog/mta-data/mta-station-ada.json", JSON.stringify(out, null, 1) + "\n", "utf8");
const notFully = entries.filter((e) => e.ada !== 1).length;
console.log(`wrote ${entries.length} MTA complexes to src/catalog/mta-data/mta-station-ada.json`);
console.log(`  fully accessible: ${entries.length - notFully} · partial/none: ${notFully}`);
