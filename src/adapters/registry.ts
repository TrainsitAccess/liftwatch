import type { Adapter } from "../types.js";
import { createMtaAdapter, MTA_NYCT_CONFIG } from "./mta/index.js";
import { createBartAdapter, BART_CONFIG } from "./bart/index.js";

// Binds a systemId to a constructed adapter. As generic adapters (GTFS-RT, REST,
// SIRI) land, most systems will be built from catalog config here instead of a
// hand-written branch.
const BUILDERS: Record<string, () => Adapter> = {
  "mta-nyct": () => createMtaAdapter(MTA_NYCT_CONFIG),
  "bart-bay-area": () => createBartAdapter(BART_CONFIG),
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
