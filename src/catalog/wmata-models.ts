// HAND-CURATED WMATA station models — the curated tier the auto-generator
// (scripts/wmata-pathways.mts) deliberately can't produce. These stations sit
// in wmata-data/chains-excluded.json because their live-feed observations
// exceed or can't map onto the GTFS pathways topology (the observed-units
// gate), NOT because their structure is unclear — a human confirmed each one.
//
// Elevator externalIds here are REAL live-feed UnitNames wherever the unit has
// ever appeared in the Incidents feed (observed-units.json); a unit that has
// never broken since archiving began keeps its synthetic GTFS slot id
// (WMATA-<node>) until its real UnitName is first observed.
//
// Curated models must NOT overlap the generated set — a station is in one tier
// or the other (`check:wmata` asserts no station id appears in both).

import type { StationModel } from "../lib/accessibility.js";

const SYSTEM = "wmata-dc";

export const WMATA_STATION_MODELS: StationModel[] = [
  // Rockville (A14) — excluded by the observed-units gate because its two
  // pedestrian-bridge elevators (A14X01/A14X02, live-observed "Elevator between
  // pedestrian bridge and mezzanine") are absent from the GTFS pathways graph.
  // Human-confirmed (Bryce, 2026-07-13): Rockville DOES have two elevators
  // between the pedestrian bridge and the mezzanine — they back each other up
  // on that leg. The mezzanine is at street grade (both GTFS entrances reach it
  // by walkway), so the core street→platform chain needs only the platform
  // elevator; the bridge is a separate secondary entrance over the tracks,
  // modeled as its own chain (same pattern as BART Warm Springs' bridge chain).
  {
    systemId: SYSTEM,
    stationExternalId: "A14",
    note: "Mezzanine is at street grade; the single mezzanine→platform elevator is the only step-free path to trains (no backup). Topology from WMATA GTFS pathways; bridge pair human-confirmed 2026-07-13.",
    segments: [
      {
        id: "mezzanine-platform",
        label: "Mezzanine to platform",
        elevators: [{ externalId: "WMATA-A14_ELE", label: "Rockville elevator (mezzanine to platform)" }],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "A14",
    chainLabel: " (pedestrian bridge)",
    note: "The pedestrian bridge over the tracks is a secondary entrance served by two elevators that back each other up on the bridge↔mezzanine leg (human-confirmed 2026-07-13; both live-observed in the Incidents feed).",
    segments: [
      {
        id: "bridge-mezzanine",
        label: "Pedestrian bridge to mezzanine",
        elevators: [
          { externalId: "A14X01", label: "Rockville elevator A14X01 (pedestrian bridge to mezzanine)" },
          { externalId: "A14X02", label: "Rockville elevator A14X02 (pedestrian bridge to mezzanine)" },
        ],
      },
    ],
  },
];
