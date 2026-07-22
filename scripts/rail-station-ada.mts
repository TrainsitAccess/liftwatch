// Snapshot MTA's own STATION-LEVEL ADA accessibility declaration for the
// COMMUTER RAILROADS (LIRR + Metro-North) — the railroad analog to the subway's
// mta-station-ada.json. Like the subway board, this is a DESIGN-TIME question
// (is the station step-free by design?), NOT whether today's elevator is broken.
//
// Source: data.ny.gov `wxmd-5cpm` ("MTA Rail Stations") — one row per LIRR/MNR
// station with an `accessibility` value of FULL / PARTIAL / NONE, plus `code`
// (the station code), `station_name`, `branch`, and direction titles. Verified
// 2026-07-22: 126 LIRR + 112 MNR rows; the `code` field joins CLEANLY to our
// rail models' `stationExternalId` for BOTH railroads (0 codes missing), so no
// crosswalk is needed — the adapter's station codes ARE these codes.
//
// LIMITATION vs the subway: wxmd-5cpm carries no per-line/per-direction ADA
// breakdown (the railroads are single-line, and the dataset has one flag per
// station), so a PARTIAL station's explanation is station-level — it says
// partial means only part of the station is step-free but cannot name WHICH
// platform, because MTA's dataset doesn't. (The subway's 39hk-dx4f has
// ada_northbound/southbound; this dataset does not.)
//
// Refresh: npm run rail:station-ada.

import { writeFileSync } from "node:fs";

const URL = "https://data.ny.gov/resource/wxmd-5cpm.json?$limit=1000";

interface Row {
  railroad: "LIRR" | "MNR";
  code: string;
  station_name: string;
  branch?: string;
  accessibility: "FULL" | "PARTIAL" | "NONE";
}

const res = await fetch(URL, { headers: { Accept: "application/json" } });
if (!res.ok) throw new Error(`${URL} -> ${res.status}`);
const rows = (await res.json()) as Row[];

// FULL -> 1 (fully), PARTIAL -> 2 (partially), NONE -> 0 (not accessible):
// the SAME 0/1/2 scheme as the subway's mta-station-ada.json (see
// MTA-DISPLAY-GUIDE.md), so both boards share one render path + one convention.
const ADA: Record<Row["accessibility"], number> = { FULL: 1, PARTIAL: 2, NONE: 0 };

function explain(r: Row): string | null {
  if (r.accessibility === "FULL") return null; // fully accessible -> quiet (no noise)
  const line = r.branch ? `${r.branch} Line ` : "";
  if (r.accessibility === "NONE") {
    return `Not accessible — MTA rates this ${line}station as having no step-free access to the platforms.`;
  }
  // PARTIAL — honest station-level statement; MTA's dataset carries no
  // per-platform/direction breakdown for the railroads.
  return `Partially accessible — only part of this ${line}station is step-free (e.g. one platform or entrance); MTA's accessibility dataset doesn't specify which.`;
}

type Entry = { code: string; name: string; branch: string | null; ada: number; explanation: string | null };

const railroads: Record<string, { systemId: string; stationCount: number; stations: Entry[] }> = {
  "mta-lirr": { systemId: "mta-lirr", stationCount: 0, stations: [] },
  "mta-mnr": { systemId: "mta-mnr", stationCount: 0, stations: [] },
};
const SYSTEM_OF: Record<Row["railroad"], string> = { LIRR: "mta-lirr", MNR: "mta-mnr" };

for (const r of rows) {
  const systemId = SYSTEM_OF[r.railroad];
  if (!systemId) continue;
  railroads[systemId]!.stations.push({
    code: r.code,
    name: r.station_name,
    branch: r.branch ?? null,
    ada: ADA[r.accessibility],
    explanation: explain(r),
  });
}

for (const rr of Object.values(railroads)) {
  rr.stations.sort((a, b) => a.name.localeCompare(b.name));
  rr.stationCount = rr.stations.length;
}

const out = {
  note:
    "MTA's own STATION-LEVEL ADA accessibility declaration for the commuter " +
    "railroads (design-time, not live outage status) — the railroad analog to " +
    "mta-station-ada.json. Source: data.ny.gov wxmd-5cpm (MTA Rail Stations). " +
    "Refresh: npm run rail:station-ada. Join key = `code` == our rail " +
    "stationExternalId (clean for both railroads). ada: 0=not accessible, " +
    "1=fully accessible, 2=partially accessible. wxmd-5cpm has no per-direction " +
    "ADA field, so PARTIAL explanations are station-level.",
  source: "https://data.ny.gov/resource/wxmd-5cpm.json",
  railroads,
};

writeFileSync("src/catalog/mta-rail-data/station-ada.json", JSON.stringify(out, null, 1) + "\n", "utf8");
for (const [sys, rr] of Object.entries(railroads)) {
  const notFully = rr.stations.filter((s) => s.ada !== 1).length;
  console.log(`${sys}: ${rr.stationCount} stations · fully accessible ${rr.stationCount - notFully} · partial/none ${notFully}`);
}
console.log("wrote src/catalog/mta-rail-data/station-ada.json");
