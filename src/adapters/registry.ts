import type { Adapter } from "../types.js";
import { createMtaAdapter, MTA_NYCT_CONFIG } from "./mta/index.js";
import { createBartAdapter, BART_CONFIG } from "./bart/index.js";
import { createMbtaAdapter, MBTA_CONFIG } from "./mbta/index.js";
import { createWmataAdapter, WMATA_CONFIG } from "./wmata/index.js";
import { createTflAdapter, TFL_CONFIG } from "./tfl/index.js";
import { createCtaAdapter, CTA_CONFIG } from "./cta/index.js";
import { createTmbAdapter, TMB_CONFIG } from "./tmb/index.js";
import { createMtaRailAdapter, LIRR_CONFIG, MNR_CONFIG } from "./mta-rail/index.js";

// Binds a systemId to a constructed adapter. As generic adapters (GTFS-RT, REST,
// SIRI) land, most systems will be built from catalog config here instead of a
// hand-written branch.
const BUILDERS: Record<string, () => Adapter> = {
  "mta-nyct": () => createMtaAdapter(MTA_NYCT_CONFIG),
  "bart-bay-area": () => createBartAdapter(BART_CONFIG),
  "mbta-boston": () => createMbtaAdapter(MBTA_CONFIG),
  "wmata-dc": () => createWmataAdapter(WMATA_CONFIG),
  "tfl-london": () => createTflAdapter(TFL_CONFIG),
  "cta-chicago": () => createCtaAdapter(CTA_CONFIG),
  "tmb-barcelona": () => createTmbAdapter(TMB_CONFIG),
  // One adapter, two systems: LIRR and Metro-North share one feed pair,
  // each instance filtering by railroad (see src/adapters/mta-rail).
  "mta-lirr": () => createMtaRailAdapter(LIRR_CONFIG),
  "mta-mnr": () => createMtaRailAdapter(MNR_CONFIG),
};

export function getAdapter(systemId: string): Adapter {
  const build = BUILDERS[systemId];
  if (!build) {
    throw new Error(
      `No adapter bound for system "${systemId}". Known: ${Object.keys(BUILDERS).join(", ") || "(none)"}`,
    );
  }
  return build();
}

export function knownSystemIds(): string[] {
  return Object.keys(BUILDERS);
}
