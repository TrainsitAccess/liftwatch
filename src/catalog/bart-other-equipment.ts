// Curated BART "other accessibility equipment" — NON-elevator step-free
// equipment (a wheelchair lift, etc.) that BART reports in its cmd=elev
// advisory but which must NOT enter the elevator inventory/leaderboards. The
// BART adapter checks a station's advisory text against these matchHints BEFORE
// elevator attribution; a match emits a NormalizedOtherEquipment into the
// walled-off other-equipment layer instead of an elevator outage.
//
// BART, unlike MBTA, has no per-facility feed — the only signal is the free
// advisory text, so this is curated by hand (same never-guess discipline as
// the elevator matchHints). Today it is just Coliseum's parking-lot wheelchair
// lift, split out of the elevator model on Bryce's instruction (2026-07-12).

import type { OtherEquipmentType } from "../types.js";

export interface BartOtherEquipment {
  stationExternalId: string;
  facilityExternalId: string;
  facilityType: OtherEquipmentType;
  description: string;
  matchHints: string[]; // lowercase substrings matched against the advisory desc
}

export const BART_OTHER_EQUIPMENT: BartOtherEquipment[] = [
  {
    stationExternalId: "COLS",
    facilityExternalId: "COLS-PARKING-LIFT",
    facilityType: "wheelchair_lift",
    description: "Coliseum station-to-parking wheelchair lift (step-free street alternative: Snell St / 69th St / San Leandro Blvd)",
    matchHints: ["parking"],
  },
];

/** The other-equipment items for a station, if any. */
export function bartOtherEquipmentFor(stationExternalId: string): BartOtherEquipment[] {
  return BART_OTHER_EQUIPMENT.filter((e) => e.stationExternalId === stationExternalId.toUpperCase());
}

/** Match an advisory desc to a station's other-equipment item (unique hit only). */
export function matchBartOtherEquipment(stationExternalId: string, desc: string): BartOtherEquipment | null {
  const d = desc.toLowerCase();
  const hits = bartOtherEquipmentFor(stationExternalId).filter((e) => e.matchHints.some((h) => d.includes(h)));
  return hits.length === 1 ? hits[0]! : null;
}
