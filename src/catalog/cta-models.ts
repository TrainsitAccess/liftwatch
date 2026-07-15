// HAND-CURATED CTA station models — the FIRST curated tier for this system.
// CTA publishes no per-station elevator inventory/roster and no GTFS pathways
// extension (re-verified 2026-07-13), so every station otherwise ships with
// redundancy: assumed regardless of its real layout. These models exist only
// for stations whose structure a human has confirmed from third-party
// research (chicago-L.org), cross-checked against every elevator identity
// CTA's own live feed has ever actually reported (observed-units.json).
//
// SYNTHETIC IDS (CTA-SYNTH-<station>-<slot>): an elevator this station is
// known to have but that has NEVER appeared in a CTA alert (so we have no
// agency-confirmed identity for it) gets a synthetic id that can never
// collide with a real one — real CTA unit ids always start with the numeric
// station id ("41690-23RD-STREET"), synthetic ids never do. Same pattern as
// WMATA's "WMATA-<node>" slots (wmata-models.ts): once the elevator is ever
// observed live with distinct location text (check scripts/cta-observed.mts'
// output, src/catalog/cta-data/observed-units.json, for a new
// "<station>-<slug>" unit), swap the synthetic id here for the real one —
// nothing else about the model needs to change.
//
// VAGUE-ALERT FAIL-SAFE (2026-07-14, first-model requirement): a CTA alert
// with no parseable location detail falls back to the bare station id
// (src/adapters/cta/location.ts / index.ts). Because that bare id never
// matches a synthetic slot here, and the adapter flags such alerts
// needsReview at a modeled station, a vague alert can never silently resolve
// via a redundant pair's OR — it forces the whole chain to read UNKNOWN
// (build-site-data.ts's generic "unplaced outage" fail-safe, same mechanism
// WMATA's "unmappable" kind relies on). This matters because CTA can merge
// two simultaneous vague alerts at one station into a single outage — without
// this fail-safe, a scenario where BOTH elevators of a redundant pair break
// but only one vague alert is reported would silently read as "accessible."

import type { StationModel } from "../lib/accessibility.js";

const SYSTEM = "cta-chicago";

export const CTA_STATION_MODELS: StationModel[] = [
  // Cermak-McCormick Place (Green Line) — rebuilt 2015, ADA from the ground
  // up. One island platform (wide 250ft center section serving both
  // directions, narrowing to single-sided ~175ft north / ~200+ft south, but
  // level and walkable end to end — no elevator needed to cross directions
  // once on the platform). Two elevators "bookend each end" (chicago-L.org):
  // the north end serves the North Cermak main headhouse; the south end
  // serves BOTH the South Cermak and 23rd Street headhouses via a shared
  // ground-level walkway in the paid area (confirmed compatible fare path —
  // this was the open question in the prior curation-todo note). Only the
  // south elevator has ever appeared in CTA's live feed (41690-23RD-STREET);
  // the north elevator's id is synthetic pending its first live appearance.
  // Reviewed with Bryce 2026-07-14 (/liftwatch-station-review, confidence
  // 7/10 on the structure — chicago-L.org is third-party, not CTA's own
  // text): approved to ship now rather than wait for agency confirmation.
  {
    systemId: SYSTEM,
    stationExternalId: "41690",
    note: "Street to platform: 2 elevators (one at each end of the platform) — either one keeps this station step-free. No single elevator outage removes step-free access on this route.",
    internalNote: "Structure from chicago-L.org (station design/history page, fetched 2026-07-14) — third-party, not CTA's own text; only the south/23rd elevator has ever appeared in CTA's live feed. North elevator id (CTA-SYNTH-41690-NORTH) is a synthetic placeholder — promote to its real CTA unit id the first time it appears in observed-units.json, same as a never-observed WMATA GTFS slot. Human-approved to ship without waiting for that observation, 2026-07-14.",
    segments: [
      {
        id: "street-platform",
        label: "Street to platform (either end elevator)",
        elevators: [
          { externalId: "CTA-SYNTH-41690-NORTH", label: "Cermak-McCormick Place north elevator (North Cermak entrance to platform) — never yet observed live, synthetic id" },
          { externalId: "41690-23RD-STREET", label: "Cermak-McCormick Place south elevator (South Cermak / 23rd Street entrances to platform)" },
        ],
      },
    ],
  },

  // Diversey (Brown Line; Purple Line Express rush hours) — elevated station,
  // two SIDE platforms (one per direction, no cross-connection at platform
  // level) reached from a single shared street-level paid fare-control area.
  // chicago-L.org: "dual brick-clad elevator towers", "the elevators to each
  // platform are located outboard of the stairs" — one dedicated elevator per
  // platform, NOT a redundant pair (the shared fare area doesn't help a rider
  // already through the gates whose platform elevator is down). Renovated
  // 2007-08 (Brown Line Capacity Expansion, ADA rebuild). CTA's OWN live alert
  // text confirms the direction-specific model ("The Loop-bound platform
  // elevator at Diversey"); only Loop-bound has appeared so far. Two
  // independent single-elevator chains (per-direction, same pattern as Park
  // Street), neither with a backup. Reviewed with Bryce 2026-07-14
  // (/liftwatch-station-review, confidence 8/10).
  {
    systemId: SYSTEM,
    stationExternalId: "40530",
    chainLabel: " (Loop-bound)",
    note: "Street to the Loop-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Direction-specific model confirmed by CTA's own live alert text ('The Loop-bound platform elevator at Diversey'); side-platform layout from chicago-L.org (fetched 2026-07-14, third-party). Loop-bound elevator observed live 2026-07-09 (40530-LOOP-BOUND). Human-approved 2026-07-14.",
    segments: [
      {
        id: "street-platform",
        label: "Street to Loop-bound platform",
        elevators: [
          { externalId: "40530-LOOP-BOUND", label: "Diversey Loop-bound platform elevator" },
        ],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "40530",
    chainLabel: " (Kimball-bound)",
    note: "Street to the Kimball-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Direction-specific model confirmed by CTA's own live alert text for the opposite direction; side-platform layout from chicago-L.org (fetched 2026-07-14). The Kimball-bound elevator has NEVER appeared in a CTA alert, so its id (CTA-SYNTH-40530-KIMBALL-BOUND) is a synthetic placeholder — promote to the real CTA unit id the first time it appears in observed-units.json (expected 'Kimball-bound', per Montrose's observed phrasing). Human-approved 2026-07-14.",
    segments: [
      {
        id: "street-platform",
        label: "Street to Kimball-bound platform",
        elevators: [
          { externalId: "CTA-SYNTH-40530-KIMBALL-BOUND", label: "Diversey Kimball-bound platform elevator — never yet observed live, synthetic id" },
        ],
      },
    ],
  },
];
