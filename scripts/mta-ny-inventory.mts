// Refresh the MTA elevator GROUND-TRUTH inventory from New York State's open
// data portal (data.ny.gov dataset 94fv-bak7 — "MTA Elevators and Escalators").
// This is an official MTA per-equipment inventory, RICHER than the live
// nyct_ene feed our models derive from: it carries `redundant_elevator` + the
// specific backup elevators, `elevator_direction_serviced`, per-level access
// flags, and a rider-facing `alternative_route`. Added as a ground-truth
// cross-check source 2026-07-16 (Bryce). Refresh: `npm run mta:ny-inventory`.
//
// IMPORTANT redundancy-definition nuance (documented so a future cross-check
// doesn't false-flag): data.ny.gov's `redundant_elevator` boolean means "is
// this unit fully replaced by ONE other elevator on the same span" — STRICTER
// than our chain model's SEGMENT-level redundancy. E.g. 14 St-6 Av EL609/EL610
// are marked "-" here, yet each one's `alternative_route` names the other as
// the L-platform backup — so they DO back each other up on their shared
// mezzanine→platform segment (our REDUNDANCY_EXCEPTIONS override, human-
// verified, is corroborated by this field, not contradicted by the boolean).

import { writeFileSync } from "node:fs";

const URL =
  "https://data.ny.gov/resource/94fv-bak7.json?$limit=5000&$where=elevator_or_escalator='Elevator'";

const KEEP = [
  "equipment_code", "station_name", "station_description", "station_complex_mrn",
  "subway_line", "borough", "ada_compliant", "service_status_code", "service_status",
  "elevator_direction_serviced", "elevator_order",
  "elevator_mezzanine_1_access", "elevator_mezzanine_2_access", "elevator_platform_access",
  "redundant_elevator", "redundant_elevator_access", "redundant_elevator_platform",
  "redundant_elevator_mezzanine", "alternative_route", "notes",
  "original_installation_date", "latest_installation_date",
] as const;

const res = await fetch(URL, { headers: { Accept: "application/json" } });
if (!res.ok) throw new Error(`data.ny.gov ${res.status}`);
const raw = (await res.json()) as Record<string, string>[];

const rows = raw
  .map((r) => Object.fromEntries(KEEP.filter((k) => r[k] != null).map((k) => [k, r[k]])))
  .sort((a, b) => String(a.equipment_code).localeCompare(String(b.equipment_code)));

const out = {
  note:
    "MTA elevator ground-truth inventory from data.ny.gov dataset 94fv-bak7. " +
    "Refresh with `npm run mta:ny-inventory`. See scripts/mta-ny-inventory.mts for the " +
    "redundant_elevator definition nuance vs our segment-level redundancy.",
  source: "https://data.ny.gov/resource/94fv-bak7.json",
  elevatorCount: rows.length,
  elevators: rows,
};

writeFileSync("src/catalog/mta-data/ny-elevator-inventory.json", JSON.stringify(out, null, 1) + "\n", "utf8");
console.log(`wrote ${rows.length} elevators to src/catalog/mta-data/ny-elevator-inventory.json`);
const red = rows.filter((r) => r.redundant_elevator === "+").length;
console.log(`  redundant "+": ${red} · non-redundant "-": ${rows.filter((r) => r.redundant_elevator === "-").length}`);
