// WMATA LocationDescription → level-pair vocabulary. The ONE parser shared by
// the chain generator (scripts/wmata-pathways.mts, static observed-units gate)
// and the live adapter (attribution + fail-safe) — they must never drift: the
// generator promises "every observed location at a modeled station maps onto
// exactly one segment", and the adapter relies on that promise at poll time.
//
// Live-verified vocabulary (observed-units.json, 2026-07-13):
//   "Elevator between street and mezzanine"            → street-mezz
//   "Elevator between mezzanine and platform"          → mezz-plat
//   "Elevator between street and platform to X"        → street-plat
//   "Elevator between mezzanine to grade/street"       → street-mezz
//   "Elevator - south entry pavilion" (Silver Line)    → street-mezz
//   "Garage elevator" / "Garage #2 elevator" / "Garage"→ garage
//   "Elevator between street, mezzanine, and platform" → multi (3-level shaft)
//   "Elevator between pedestrian bridge and mezzanine" → null (outside ladder)
//   "Elevator between bike trail and mezzanine"        → null (outside ladder)
//   "Elevator between street, and upper platform"      → null (split platform)

export type WmataLocationPair = "garage" | "street-mezz" | "mezz-plat" | "street-plat" | "multi" | null;

export function parseWmataLocation(loc: string): WmataLocationPair {
  const s = loc.toLowerCase().replace(/[,.]/g, " ").replace(/\s+/g, " ").trim();
  if (/garage|parking/.test(s)) return "garage";
  if (/entry pavilion/.test(s)) return "street-mezz"; // Silver Line entrance buildings
  if (/pedestrian bridge|bike trail|upper|lower/.test(s)) return null; // outside the standard ladder
  const street = /street|grade/.test(s);
  const mezz = /mezzanine/.test(s);
  const plat = /platform/.test(s);
  if (street && mezz && plat) return "multi";
  if (street && mezz) return "street-mezz";
  if (mezz && plat) return "mezz-plat";
  if (street && plat) return "street-plat";
  return null;
}

/** Segment ids (as minted by the generator: segId(from, to)) a parsed pair may
 * legally land on. "mezz-plat" and "street-plat" both accept the combined
 * Street/Mezzanine→Platform rung — the live feed describes that hop either way. */
export function segmentIdsForPair(pair: WmataLocationPair): string[] {
  switch (pair) {
    case "street-mezz": return ["street-mezzanine", "street-mezzanine-mezzanine"];
    case "mezz-plat": return ["mezzanine-platform", "street-mezzanine-platform"];
    case "street-plat": return ["street-platform", "street-mezzanine-platform"];
    default: return [];
  }
}
