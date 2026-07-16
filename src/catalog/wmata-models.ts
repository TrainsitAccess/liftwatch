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
    note: "The mezzanine is at street level. One elevator connects the mezzanine to the platform, and it has no backup — if it is out of service, the station has no step-free route to trains.",
    internalNote: "Topology from WMATA GTFS pathways (mezzanine-at-grade confirmed by entrance walkway edges); platform elevator not yet observed in the live feed, so its slot id is synthetic. Bridge pair human-confirmed 2026-07-13.",
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
    note: "The pedestrian bridge over the tracks is a secondary entrance. Two elevators connect the bridge to the mezzanine — either one keeps this entrance step-free.",
    internalNote: "Bridge pair absent from the rail GTFS (the observed-units gate excluded A14 from the generator). Human-confirmed 2026-07-13; both units live-observed as A14X01/A14X02.",
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
  // Judiciary Sq (B02, Red Line) — Batch 3, Group 1 (direct street<->platform,
  // per direction, no mezzanine level). Shady Grove-bound elevator observed live
  // (B02N01); opposite direction stays the GTFS synthetic slot.
  {
    systemId: SYSTEM,
    stationExternalId: "B02",
    chainLabel: " (Shady Grove-bound)",
    note: "Street to Shady Grove-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "GTFS roster: side-platforms, disjoint per-direction elevators (no shared prerequisite). Live-observed as B02N01 (\"Elevator between street and platform to Shady Grove\"). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-platform",
        label: "Street to Shady Grove-bound platform",
        elevators: [{ externalId: "B02N01", label: "Judiciary Sq elevator (street to Shady Grove-bound platform)" }],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "B02",
    chainLabel: " (opposite direction)",
    note: "Street to the opposite-direction platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-platform",
        label: "Street to the opposite-direction platform",
        elevators: [{ externalId: "WMATA-B02_NW_ELE2", label: "Judiciary Sq elevator (street to opposite-direction platform) — never yet observed live, synthetic id" }],
      },
    ],
  },
  // Arlington Cemetery (C06, Blue Line) — Batch 3, Group 1 (direct
  // street<->platform, per direction, no mezzanine level). Neither elevator
  // has ever been observed live.
  {
    systemId: SYSTEM,
    stationExternalId: "C06",
    chainLabel: " (East)",
    note: "Street to the East platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-platform",
        label: "Street to the East platform",
        elevators: [{ externalId: "WMATA-C06_E_ELE", label: "Arlington Cemetery East elevator (street to platform) — never yet observed live, synthetic id" }],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "C06",
    chainLabel: " (West)",
    note: "Street to the West platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-platform",
        label: "Street to the West platform",
        elevators: [{ externalId: "WMATA-C06_W_ELE", label: "Arlington Cemetery West elevator (street to platform) — never yet observed live, synthetic id" }],
      },
    ],
  },
  // Ronald Reagan Washington National Airport (C10, Blue/Yellow Lines) —
  // Batch 3, Group 2 (street/mezzanine combined, no separate street-mezz
  // elevator). BOTH directions observed live.
  {
    systemId: SYSTEM,
    stationExternalId: "C10",
    chainLabel: " (Huntington/Franconia-Springfield-bound)",
    note: "Street/mezzanine to the Huntington/Franconia-Springfield-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Live-observed as C10S01 (\"Elevator between mezzanine and platform to Huntington/Franconia-Springfield\"). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-platform",
        label: "Street/mezzanine to the Huntington/Franconia-Springfield-bound platform",
        elevators: [{ externalId: "C10S01", label: "Reagan National Airport elevator C10S01 (street/mezzanine to Huntington/Franconia-Springfield-bound platform)" }],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "C10",
    chainLabel: " (Mt.Vernon Sq/Largo Town Center-bound)",
    note: "Street/mezzanine to the Mt.Vernon Sq/Largo Town Center-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Live-observed as C10S02 (\"Elevator between mezzanine and platform to Mt.Vernon Sq/Largo Town Center\"). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-platform",
        label: "Street/mezzanine to the Mt.Vernon Sq/Largo Town Center-bound platform",
        elevators: [{ externalId: "C10S02", label: "Reagan National Airport elevator C10S02 (street/mezzanine to Mt.Vernon Sq/Largo Town Center-bound platform)" }],
      },
    ],
  },
  // Eisenhower Ave (C14, Yellow Line) — Batch 3, Group 2. Huntington-bound
  // observed live (C14X02); opposite direction stays synthetic.
  {
    systemId: SYSTEM,
    stationExternalId: "C14",
    chainLabel: " (Huntington-bound)",
    note: "Street/mezzanine to Huntington-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Live-observed as C14X02 (\"Elevator between mezzanine and platform to Huntington\"). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-platform",
        label: "Street/mezzanine to Huntington-bound platform",
        elevators: [{ externalId: "C14X02", label: "Eisenhower Ave elevator (street/mezzanine to Huntington-bound platform)" }],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "C14",
    chainLabel: " (opposite direction)",
    note: "Street/mezzanine to the opposite-direction platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-platform",
        label: "Street/mezzanine to the opposite-direction platform",
        elevators: [{ externalId: "WMATA-C14_ELE1", label: "Eisenhower Ave elevator (street/mezzanine to opposite-direction platform) — never yet observed live, synthetic id" }],
      },
    ],
  },
  // West Hyattsville (E07, Green Line) — Batch 3, Group 2. Branch Ave-bound
  // observed live (E07X02); opposite direction stays synthetic.
  {
    systemId: SYSTEM,
    stationExternalId: "E07",
    chainLabel: " (Branch Ave-bound)",
    note: "Street/mezzanine to Branch Ave-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Live-observed as E07X02 (\"Elevator between mezzanine and platform to Branch Ave\"). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-platform",
        label: "Street/mezzanine to Branch Ave-bound platform",
        elevators: [{ externalId: "E07X02", label: "West Hyattsville elevator (street/mezzanine to Branch Ave-bound platform)" }],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "E07",
    chainLabel: " (opposite direction)",
    note: "Street/mezzanine to the opposite-direction platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "PROMOTED 2026-07-16 from synthetic to real id E07X01, sourced from WMATA's own FY2026 Q3 Capital Improvement Program report (\"WMATA FY26 Q3 Capital Improvement Program Project Pages.pdf\", CIP0132 Escalator and Elevator Overhaul Program: \"The West Hyattsville Station E07X01 modernization project was also completed\") — confirms the real unit exists and follows the same station-code + X01/X02 pairing convention already confirmed at Rockville (A14X01/A14X02); never yet observed in a live outage. Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-platform",
        label: "Street/mezzanine to the opposite-direction platform",
        elevators: [{ externalId: "E07X01", label: "West Hyattsville elevator (street/mezzanine to opposite-direction platform)" }],
      },
    ],
  },
  // Hyattsville Crossing (E08, Green Line) — Batch 3, Group 2. Neither
  // elevator has ever been observed live.
  {
    systemId: SYSTEM,
    stationExternalId: "E08",
    chainLabel: " (North)",
    note: "Street/mezzanine to the North platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-platform",
        label: "Street/mezzanine to the North platform",
        elevators: [{ externalId: "WMATA-E08_MZ_N_ELV", label: "Hyattsville Crossing North elevator (street/mezzanine to platform) — never yet observed live, synthetic id" }],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "E08",
    chainLabel: " (South)",
    note: "Street/mezzanine to the South platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-platform",
        label: "Street/mezzanine to the South platform",
        elevators: [{ externalId: "WMATA-E08_MZ_S_ELV", label: "Hyattsville Crossing South elevator (street/mezzanine to platform) — never yet observed live, synthetic id" }],
      },
    ],
  },
  // Dupont Circle (A03, Red Line) — Batch 3, Group 3 (shared street<->mezzanine
  // prerequisite + 2 per-direction mezzanine<->platform legs).
  {
    systemId: SYSTEM,
    stationExternalId: "A03",
    chainLabel: " (opposite direction 1)",
    note: "Street to mezzanine: one elevator, no backup. Mezzanine to the opposite direction 1 platform: one elevator, no backup. If either elevator is out of service, this route is not step-free.",
    internalNote: "Shared street<->mezzanine leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations). Per-direction platform leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine",
        elevators: [{ externalId: "WMATA-A03_N_ELE1", label: "Dupont Circle elevator (street to mezzanine) — never yet observed live, synthetic id" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the opposite direction 1 platform",
        elevators: [{ externalId: "WMATA-A03_N_ELE2", label: "Dupont Circle elevator (mezzanine to opposite direction 1 platform) — never yet observed live, synthetic id" }],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "A03",
    chainLabel: " (opposite direction 2)",
    note: "Street to mezzanine: one elevator, no backup. Mezzanine to the opposite direction 2 platform: one elevator, no backup. If either elevator is out of service, this route is not step-free.",
    internalNote: "Shared street<->mezzanine leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations). Per-direction platform leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine",
        elevators: [{ externalId: "WMATA-A03_N_ELE1", label: "Dupont Circle elevator (street to mezzanine) — never yet observed live, synthetic id" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the opposite direction 2 platform",
        elevators: [{ externalId: "WMATA-A03_N_ELE3", label: "Dupont Circle elevator (mezzanine to opposite direction 2 platform) — never yet observed live, synthetic id" }],
      },
    ],
  },
  // McPherson Sq (C02, Blue, Orange, Silver Lines) — Batch 3, Group 3 (shared street<->mezzanine
  // prerequisite + 2 per-direction mezzanine<->platform legs).
  {
    systemId: SYSTEM,
    stationExternalId: "C02",
    chainLabel: " (opposite direction 1)",
    note: "Street to mezzanine: one elevator, no backup. Mezzanine to the opposite direction 1 platform: one elevator, no backup. If either elevator is out of service, this route is not step-free.",
    internalNote: "Shared street<->mezzanine leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations). Per-direction platform leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine",
        elevators: [{ externalId: "WMATA-C02_E_MZ_ELE", label: "McPherson Sq elevator (street to mezzanine) — never yet observed live, synthetic id" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the opposite direction 1 platform",
        elevators: [{ externalId: "WMATA-C02_E_ELE1", label: "McPherson Sq elevator (mezzanine to opposite direction 1 platform) — never yet observed live, synthetic id" }],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "C02",
    chainLabel: " (opposite direction 2)",
    note: "Street to mezzanine: one elevator, no backup. Mezzanine to the opposite direction 2 platform: one elevator, no backup. If either elevator is out of service, this route is not step-free.",
    internalNote: "Shared street<->mezzanine leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations). Per-direction platform leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine",
        elevators: [{ externalId: "WMATA-C02_E_MZ_ELE", label: "McPherson Sq elevator (street to mezzanine) — never yet observed live, synthetic id" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the opposite direction 2 platform",
        elevators: [{ externalId: "WMATA-C02_E_ELE2", label: "McPherson Sq elevator (mezzanine to opposite direction 2 platform) — never yet observed live, synthetic id" }],
      },
    ],
  },
  // Farragut West (C03, Blue, Orange, Silver Lines) — Batch 3, Group 3 (shared street<->mezzanine
  // prerequisite + 2 per-direction mezzanine<->platform legs).
  {
    systemId: SYSTEM,
    stationExternalId: "C03",
    chainLabel: " (opposite direction 1)",
    note: "Street to mezzanine: one elevator, no backup. Mezzanine to the opposite direction 1 platform: one elevator, no backup. If either elevator is out of service, this route is not step-free.",
    internalNote: "Shared street<->mezzanine leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations). Per-direction platform leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine",
        elevators: [{ externalId: "WMATA-C03_W_MZ_ELE", label: "Farragut West elevator (street to mezzanine) — never yet observed live, synthetic id" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the opposite direction 1 platform",
        elevators: [{ externalId: "WMATA-C03_W_ELE1", label: "Farragut West elevator (mezzanine to opposite direction 1 platform) — never yet observed live, synthetic id" }],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "C03",
    chainLabel: " (opposite direction 2)",
    note: "Street to mezzanine: one elevator, no backup. Mezzanine to the opposite direction 2 platform: one elevator, no backup. If either elevator is out of service, this route is not step-free.",
    internalNote: "Shared street<->mezzanine leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations). Per-direction platform leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine",
        elevators: [{ externalId: "WMATA-C03_W_MZ_ELE", label: "Farragut West elevator (street to mezzanine) — never yet observed live, synthetic id" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the opposite direction 2 platform",
        elevators: [{ externalId: "WMATA-C03_W_ELE2", label: "Farragut West elevator (mezzanine to opposite direction 2 platform) — never yet observed live, synthetic id" }],
      },
    ],
  },
  // Pentagon City (C08, Blue, Yellow Lines) — Batch 3, Group 3 (shared street<->mezzanine
  // prerequisite + 2 per-direction mezzanine<->platform legs).
  {
    systemId: SYSTEM,
    stationExternalId: "C08",
    chainLabel: " (opposite direction 1)",
    note: "Street to mezzanine: one elevator, no backup. Mezzanine to the opposite direction 1 platform: one elevator, no backup. If either elevator is out of service, this route is not step-free.",
    internalNote: "Shared street<->mezzanine leg: Live-observed as C08X01 (\"Elevator between street and mezzanine on west side of Hayes street, at The Fashion Center\"). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations). Per-direction platform leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine",
        elevators: [{ externalId: "C08X01", label: "Pentagon City elevator (street to mezzanine)" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the opposite direction 1 platform",
        elevators: [{ externalId: "WMATA-C08_M_ELE1", label: "Pentagon City elevator (mezzanine to opposite direction 1 platform) — never yet observed live, synthetic id" }],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "C08",
    chainLabel: " (opposite direction 2)",
    note: "Street to mezzanine: one elevator, no backup. Mezzanine to the opposite direction 2 platform: one elevator, no backup. If either elevator is out of service, this route is not step-free.",
    internalNote: "Shared street<->mezzanine leg: Live-observed as C08X01 (\"Elevator between street and mezzanine on west side of Hayes street, at The Fashion Center\"). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations). Per-direction platform leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine",
        elevators: [{ externalId: "C08X01", label: "Pentagon City elevator (street to mezzanine)" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the opposite direction 2 platform",
        elevators: [{ externalId: "WMATA-C08_M_ELE2", label: "Pentagon City elevator (mezzanine to opposite direction 2 platform) — never yet observed live, synthetic id" }],
      },
    ],
  },
  // Crystal City (C09, Blue, Yellow Lines) — Batch 3, Group 3 (shared street<->mezzanine
  // prerequisite + 2 per-direction mezzanine<->platform legs).
  {
    systemId: SYSTEM,
    stationExternalId: "C09",
    chainLabel: " (opposite direction 1)",
    note: "Street to mezzanine: one elevator, no backup. Mezzanine to the opposite direction 1 platform: one elevator, no backup. If either elevator is out of service, this route is not step-free.",
    internalNote: "Shared street<->mezzanine leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations). Per-direction platform leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine",
        elevators: [{ externalId: "WMATA-C09_ELE1", label: "Crystal City elevator (street to mezzanine) — never yet observed live, synthetic id" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the opposite direction 1 platform",
        elevators: [{ externalId: "WMATA-C09_ELE2", label: "Crystal City elevator (mezzanine to opposite direction 1 platform) — never yet observed live, synthetic id" }],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "C09",
    chainLabel: " (opposite direction 2)",
    note: "Street to mezzanine: one elevator, no backup. Mezzanine to the opposite direction 2 platform: one elevator, no backup. If either elevator is out of service, this route is not step-free.",
    internalNote: "Shared street<->mezzanine leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations). Per-direction platform leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine",
        elevators: [{ externalId: "WMATA-C09_ELE1", label: "Crystal City elevator (street to mezzanine) — never yet observed live, synthetic id" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the opposite direction 2 platform",
        elevators: [{ externalId: "WMATA-C09_ELE3", label: "Crystal City elevator (mezzanine to opposite direction 2 platform) — never yet observed live, synthetic id" }],
      },
    ],
  },
  // Cheverly (D11, Orange Line) — Batch 3, Group 3 (shared street<->mezzanine
  // prerequisite + 2 per-direction mezzanine<->platform legs).
  {
    systemId: SYSTEM,
    stationExternalId: "D11",
    chainLabel: " (New Carrollton-bound)",
    note: "Street to mezzanine: one elevator, no backup. Mezzanine to the New Carrollton-bound platform: one elevator, no backup. If either elevator is out of service, this route is not step-free.",
    internalNote: "Shared street<->mezzanine leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations). Per-direction platform leg: Live-observed as D11X02 (\"Elevator between mezzanine and platform to New Carrollton\"). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine",
        elevators: [{ externalId: "WMATA-D11_MZ_ELE1", label: "Cheverly elevator (street to mezzanine) — never yet observed live, synthetic id" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the New Carrollton-bound platform",
        elevators: [{ externalId: "D11X02", label: "Cheverly elevator (mezzanine to New Carrollton-bound platform)" }],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "D11",
    chainLabel: " (Vienna-bound)",
    note: "Street to mezzanine: one elevator, no backup. Mezzanine to the Vienna-bound platform: one elevator, no backup. If either elevator is out of service, this route is not step-free.",
    internalNote: "Shared street<->mezzanine leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations). Per-direction platform leg: Live-observed as D11X03 (\"Elevator between mezzanine and platform Vienna\"). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine",
        elevators: [{ externalId: "WMATA-D11_MZ_ELE1", label: "Cheverly elevator (street to mezzanine) — never yet observed live, synthetic id" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the Vienna-bound platform",
        elevators: [{ externalId: "D11X03", label: "Cheverly elevator (mezzanine to Vienna-bound platform)" }],
      },
    ],
  },
  // Clarendon (K02, Orange, Silver Lines) — Batch 3, Group 3 (shared street<->mezzanine
  // prerequisite + 2 per-direction mezzanine<->platform legs).
  {
    systemId: SYSTEM,
    stationExternalId: "K02",
    chainLabel: " (opposite direction 1)",
    note: "Street to mezzanine: one elevator, no backup. Mezzanine to the opposite direction 1 platform: one elevator, no backup. If either elevator is out of service, this route is not step-free.",
    internalNote: "Shared street<->mezzanine leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations). Per-direction platform leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine",
        elevators: [{ externalId: "WMATA-K02_ELE1", label: "Clarendon elevator (street to mezzanine) — never yet observed live, synthetic id" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the opposite direction 1 platform",
        elevators: [{ externalId: "WMATA-K02_ELE2", label: "Clarendon elevator (mezzanine to opposite direction 1 platform) — never yet observed live, synthetic id" }],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "K02",
    chainLabel: " (opposite direction 2)",
    note: "Street to mezzanine: one elevator, no backup. Mezzanine to the opposite direction 2 platform: one elevator, no backup. If either elevator is out of service, this route is not step-free.",
    internalNote: "Shared street<->mezzanine leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations). Per-direction platform leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine",
        elevators: [{ externalId: "WMATA-K02_ELE1", label: "Clarendon elevator (street to mezzanine) — never yet observed live, synthetic id" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the opposite direction 2 platform",
        elevators: [{ externalId: "WMATA-K02_ELE3", label: "Clarendon elevator (mezzanine to opposite direction 2 platform) — never yet observed live, synthetic id" }],
      },
    ],
  },
  // Virginia Sq-GMU (K03, Orange, Silver Lines) — Batch 3, Group 3 (shared street<->mezzanine
  // prerequisite + 2 per-direction mezzanine<->platform legs).
  {
    systemId: SYSTEM,
    stationExternalId: "K03",
    chainLabel: " (opposite direction 1)",
    note: "Street to mezzanine: one elevator, no backup. Mezzanine to the opposite direction 1 platform: one elevator, no backup. If either elevator is out of service, this route is not step-free.",
    internalNote: "Shared street<->mezzanine leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations). Per-direction platform leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine",
        elevators: [{ externalId: "WMATA-K03_ELE1", label: "Virginia Sq-GMU elevator (street to mezzanine) — never yet observed live, synthetic id" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the opposite direction 1 platform",
        elevators: [{ externalId: "WMATA-K03_ELE2", label: "Virginia Sq-GMU elevator (mezzanine to opposite direction 1 platform) — never yet observed live, synthetic id" }],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "K03",
    chainLabel: " (opposite direction 2)",
    note: "Street to mezzanine: one elevator, no backup. Mezzanine to the opposite direction 2 platform: one elevator, no backup. If either elevator is out of service, this route is not step-free.",
    internalNote: "Shared street<->mezzanine leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations). Per-direction platform leg: Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine",
        elevators: [{ externalId: "WMATA-K03_ELE1", label: "Virginia Sq-GMU elevator (street to mezzanine) — never yet observed live, synthetic id" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the opposite direction 2 platform",
        elevators: [{ externalId: "WMATA-K03_ELE3", label: "Virginia Sq-GMU elevator (mezzanine to opposite direction 2 platform) — never yet observed live, synthetic id" }],
      },
    ],
  },
  // Woodley Park (A04, Red Line) — Batch 3, Group 4 (straight 2-elevator
  // chain, single path — "non-standard-levels" was just unusual level naming,
  // not real topology ambiguity).
  {
    systemId: SYSTEM,
    stationExternalId: "A04",
    note: "Street to mezzanine/intermediate passageway: one elevator, no backup. If that elevator is out of service, this route is not step-free. Mezzanine/intermediate passageway to platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine/intermediate passageway",
        elevators: [{ externalId: "WMATA-A04_N_ELE", label: "Woodley Park elevator (street to mezzanine/intermediate passageway) — never yet observed live, synthetic id" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine/intermediate passageway to platform",
        elevators: [{ externalId: "WMATA-A04_ELE1", label: "Woodley Park elevator (mezzanine/intermediate passageway to platform) — never yet observed live, synthetic id" }],
      },
    ],
  },
  // Cleveland Park (A05, Red Line) — Batch 3, Group 4 (straight 2-elevator
  // chain, single path — "non-standard-levels" was just unusual level naming,
  // not real topology ambiguity).
  {
    systemId: SYSTEM,
    stationExternalId: "A05",
    note: "Street to mezzanine/intermediate passageway: one elevator, no backup. If that elevator is out of service, this route is not step-free. Mezzanine/intermediate passageway to platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine/intermediate passageway",
        elevators: [{ externalId: "WMATA-A05_ELE1", label: "Cleveland Park elevator (street to mezzanine/intermediate passageway) — never yet observed live, synthetic id" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine/intermediate passageway to platform",
        elevators: [{ externalId: "WMATA-A05_ELE2", label: "Cleveland Park elevator (mezzanine/intermediate passageway to platform) — never yet observed live, synthetic id" }],
      },
    ],
  },
  // Van Ness-UDC (A06, Red Line) — Batch 3, Group 4 (straight 2-elevator
  // chain, single path — "non-standard-levels" was just unusual level naming,
  // not real topology ambiguity).
  {
    systemId: SYSTEM,
    stationExternalId: "A06",
    note: "Street to mezzanine/intermediate passageway: one elevator, no backup. If that elevator is out of service, this route is not step-free. Mezzanine/intermediate passageway to platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine/intermediate passageway",
        elevators: [{ externalId: "WMATA-A06_ELE1", label: "Van Ness-UDC elevator (street to mezzanine/intermediate passageway) — never yet observed live, synthetic id" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine/intermediate passageway to platform",
        elevators: [{ externalId: "WMATA-A06_ELE2", label: "Van Ness-UDC elevator (mezzanine/intermediate passageway to platform) — never yet observed live, synthetic id" }],
      },
    ],
  },
  // New Carrollton (D13, Orange Line) — Batch 3, Group 4 (straight 2-elevator
  // chain, single path — "non-standard-levels" was just unusual level naming,
  // not real topology ambiguity).
  {
    systemId: SYSTEM,
    stationExternalId: "D13",
    note: "Street/mezzanine to NW mezzanine: one elevator, no backup. If that elevator is out of service, this route is not step-free. NW mezzanine to platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street/mezzanine to NW mezzanine",
        elevators: [{ externalId: "WMATA-D13_MZ_ELV1", label: "New Carrollton elevator (street/mezzanine to nw mezzanine) — never yet observed live, synthetic id" }],
      },
      {
        id: "mezzanine-platform",
        label: "NW mezzanine to platform",
        elevators: [{ externalId: "WMATA-D13_MZ_ELV2", label: "New Carrollton elevator (nw mezzanine to platform) — never yet observed live, synthetic id" }],
      },
    ],
  },
  // Southern Ave (F08, Green Line) — Batch 3, Group 4 (straight 2-elevator
  // chain, single path — "non-standard-levels" was just unusual level naming,
  // not real topology ambiguity).
  {
    systemId: SYSTEM,
    stationExternalId: "F08",
    note: "Pedestrian bridge to street/mezzanine: one elevator, no backup. If that elevator is out of service, this route is not step-free. Street/mezzanine to platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "bridge-mezzanine",
        label: "Pedestrian bridge to street/mezzanine",
        elevators: [{ externalId: "WMATA-F08_MZ_ELE1", label: "Southern Ave elevator (pedestrian bridge to street/mezzanine) — never yet observed live, synthetic id" }],
      },
      {
        id: "mezzanine-platform",
        label: "Street/mezzanine to platform",
        elevators: [{ externalId: "WMATA-F08_MZ_ELE2", label: "Southern Ave elevator (street/mezzanine to platform) — never yet observed live, synthetic id" }],
      },
    ],
  },
  // Suitland (F10, Green Line) — Batch 3, Group 4 (straight 2-elevator
  // chain, single path — "non-standard-levels" was just unusual level naming,
  // not real topology ambiguity).
  {
    systemId: SYSTEM,
    stationExternalId: "F10",
    note: "Pedestrian bridge to street/mezzanine: one elevator, no backup. If that elevator is out of service, this route is not step-free. Street/mezzanine to platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "bridge-mezzanine",
        label: "Pedestrian bridge to street/mezzanine",
        elevators: [{ externalId: "WMATA-F10_ELE1", label: "Suitland elevator (pedestrian bridge to street/mezzanine) — never yet observed live, synthetic id" }],
      },
      {
        id: "mezzanine-platform",
        label: "Street/mezzanine to platform",
        elevators: [{ externalId: "WMATA-F10_MZ_ELE2", label: "Suitland elevator (street/mezzanine to platform) — never yet observed live, synthetic id" }],
      },
    ],
  },
  // Franconia-Springfield (J03, Blue, Yellow Lines) — Batch 3, Group 4 (straight 2-elevator
  // chain, single path — "non-standard-levels" was just unusual level naming,
  // not real topology ambiguity).
  {
    systemId: SYSTEM,
    stationExternalId: "J03",
    note: "Street to mezzanine: one elevator, no backup. If that elevator is out of service, this route is not step-free. Mezzanine to platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Never yet observed live; synthetic GTFS slot id, promotable to a real UnitName once observed (same pattern as Rockville/A14). Live-observed as J03X02 (\"Elevator between mezzanine and platform\"). Human-approved as Batch 3 via /liftwatch-station-review 2026-07-15 (no redundancy claimed anywhere in this batch — every chain is a straight AND of single-elevator legs, the same shape as WMATA's ~55 already-shipped auto-generated stations).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine",
        elevators: [{ externalId: "WMATA-J03_MZ_ELV1", label: "Franconia-Springfield elevator (street to mezzanine) — never yet observed live, synthetic id" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to platform",
        elevators: [{ externalId: "J03X02", label: "Franconia-Springfield elevator (mezzanine to platform)" }],
      },
    ],
  },
  // Forest Glen (B09, Red Line) — excluded by the observed-units gate as an
  // "observed-undercount": 3 distinct live units (B09X04/X05/X06), all
  // identically described ("Elevator between mezzanine and platform", no
  // direction or segment distinction), vs GTFS's single WMATA-B09_ELE edge.
  // Forest Glen is one of only two WMATA stations (with Wheaton) built with
  // NO stairs or escalators at all — elevator-only access by design, due to
  // its depth — so a true parallel bank of elevators on the one mezzanine
  // <-> platform run is exactly the expected shape, unlike a per-direction
  // split. Bryce confirmed the real total is SIX elevators, all on this same
  // run (2026-07-16) — only 3 have ever individually appeared in a live
  // outage; the other 3 get synthetic placeholder ids, promotable to real
  // UnitNames the first time each is individually observed. Approved by
  // Bryce via /liftwatch-station-review 2026-07-16 (confidence 8/10 — the
  // bank shape was already inferred from the all-elevator/no-stairs fact;
  // the total count of 6 is now Bryce-confirmed directly).
  {
    systemId: SYSTEM,
    stationExternalId: "B09",
    note: "Mezzanine to platform: 6 elevators, any one keeps this route step-free. Only if all 6 are out of service does this station lose step-free access — Forest Glen has no stairs or escalators, so the elevators are the only way to reach the platform at all.",
    internalNote: "GTFS models only 1 elevator (WMATA-B09_ELE) but the live feed has observed 3 distinct units (B09X04, B09X05, B09X06), all identically worded with no direction/segment distinction -- a genuine redundant bank, not a per-direction split. Bryce confirmed the real total is 6 elevators, all on this same mezzanine<->platform run (2026-07-16); the 3 never yet individually observed get synthetic placeholder ids. Forest Glen + Wheaton are WMATA's only all-elevator (no stairs/escalators) stations, consistent with a deliberate redundant bank at this depth. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 8/10).",
    segments: [
      {
        id: "mezzanine-platform",
        label: "Mezzanine to platform",
        elevators: [
          { externalId: "B09X04", label: "Forest Glen elevator (mezzanine to platform)" },
          { externalId: "B09X05", label: "Forest Glen elevator (mezzanine to platform)" },
          { externalId: "B09X06", label: "Forest Glen elevator (mezzanine to platform)" },
          { externalId: "WMATA-B09_ELE2", label: "Forest Glen elevator (mezzanine to platform) — never yet observed live, synthetic id" },
          { externalId: "WMATA-B09_ELE3", label: "Forest Glen elevator (mezzanine to platform) — never yet observed live, synthetic id" },
          { externalId: "WMATA-B09_ELE4", label: "Forest Glen elevator (mezzanine to platform) — never yet observed live, synthetic id" },
        ],
      },
    ],
  },
  // Mt Vernon Sq (E01, Green/Yellow Lines) — excluded by the observed-units
  // gate as an "observed-undercount": 2 distinct live units (E01X04, E01X05)
  // on mezzanine<->platform vs GTFS's single edge; live feed also shows
  // E01X01/E01X02 on street<->mezzanine, both segments identically worded
  // per unit (the same shape already confirmed redundant at Rockville and
  // on BART). WMATA's own quarterly Capital Improvement Program report
  // independently corroborates E01X04 as real (cip-elevator-mentions.md) —
  // a 3rd source alongside GTFS + live observation. Bryce walked the full
  // layout with Claude 2026-07-16 and gave exact physical locations for
  // every elevator (standing rule going forward: always record a given
  // location, not just direction/id):
  //   - Street<->mezzanine: TWO redundant elevators together at the
  //     southwest corner of 7th & M St NW (E01X01, E01X02) PLUS a separate,
  //     SINGLE elevator at the northwest corner of 7th & M St NW, inside the
  //     Convention Center building — never yet observed live, synthetic id.
  //     All three reach the same paid-area mezzanine, so any one keeps this
  //     leg step-free (three-way OR, not per-entrance chains).
  //   - Mezzanine<->platform: TWO elevators, one at the center of the
  //     platform and one on the platform's far south side (E01X04, E01X05;
  //     which id maps to which exact position is not yet confirmed).
  // Approved by Bryce via /liftwatch-station-review 2026-07-16 (confidence
  // 9/10 — both legs confirmed directly by Bryce, including physical
  // locations, not just inferred from wording).
  {
    systemId: SYSTEM,
    stationExternalId: "E01",
    note: "Street to mezzanine: 3 elevators (two together at the southwest corner of 7th & M St NW, one at the northwest corner inside the Convention Center) — any one keeps this leg step-free. Mezzanine to platform: 2 elevators (one center-platform, one on the platform's far south side) — either one keeps this leg step-free. The station stays step-free as long as at least one elevator on each leg is working.",
    internalNote: "GTFS models only 1 mezzanine<->platform edge + 2 street<->mezzanine edges, but the live feed observed 4 real distinct units (E01X01/E01X02 street<->mezz, E01X04/E01X05 mezz<->platform), each pair identically worded -- the same redundant shape as Rockville/BART. WMATA's own FY26 Capital Improvement Program report independently corroborates E01X04 as real (3rd source). Bryce confirmed full layout + exact locations 2026-07-16: street<->mezz is a 2-elevator group at the SW corner of 7th & M St NW plus a separate single elevator at the NW corner inside the Convention Center (never yet observed, synthetic id) -- all three reach the same mezzanine so modeled as one 3-way OR, not per-entrance chains. Mezz<->platform is E01X04 (center of platform) and E01X05 (far south side) -- exact id-to-position mapping not yet confirmed, but the pair itself is. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 9/10).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine",
        elevators: [
          { externalId: "E01X01", label: "Mt Vernon Sq elevator (street to mezzanine) — southwest corner of 7th & M St NW" },
          { externalId: "E01X02", label: "Mt Vernon Sq elevator (street to mezzanine) — southwest corner of 7th & M St NW" },
          { externalId: "WMATA-E01_NW_ELE", label: "Mt Vernon Sq elevator (street to mezzanine) — northwest corner of 7th & M St NW, inside the Convention Center — never yet observed live, synthetic id" },
        ],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to platform",
        elevators: [
          { externalId: "E01X04", label: "Mt Vernon Sq elevator (mezzanine to platform) — center of platform or far south side (exact position unconfirmed)" },
          { externalId: "E01X05", label: "Mt Vernon Sq elevator (mezzanine to platform) — center of platform or far south side (exact position unconfirmed)" },
        ],
      },
    ],
  },
  // Morgan Blvd (G04, Blue Line) — excluded by the observed-units gate as an
  // "observed-undercount": 2 distinct live units (G04X01, G04X02), both on
  // street/mezzanine<->platform, identically worded ("Elevator between
  // mezzanine and platform", no direction/segment distinction) vs GTFS's
  // single edge. Same shape as Forest Glen/Mt Vernon Sq's redundant pairs,
  // but weaker evidence -- Morgan Blvd is an ordinary elevated Blue Line
  // station (2004 Largo extension), not one of WMATA's all-elevator
  // stations, so there's no outside fact backing the redundancy the way
  // Forest Glen had. Bryce confirmed the physical locations (2026-07-16):
  // both elevators are in the center of the platform, on opposite sides of
  // each other. Approved by Bryce via /liftwatch-station-review 2026-07-16
  // (confidence 4/10 -- weakest of this identical-wording family so far,
  // approved on the strength of the wording pattern alone).
  {
    systemId: SYSTEM,
    stationExternalId: "G04",
    note: "Street/mezzanine to platform: 2 elevators, either one keeps this route step-free. Only if both are out of service does this station lose step-free access.",
    internalNote: "GTFS models only 1 elevator (WMATA-G04_MZ_ELV) but the live feed has observed 2 distinct units (G04X01, G04X02), identically worded with no direction/segment distinction -- the same redundant-pair shape as Forest Glen/Mt Vernon Sq, but without a strong outside fact (Morgan Blvd is an ordinary elevated station, not an all-elevator one). Bryce confirmed locations 2026-07-16: both elevators are in the center of the platform, on opposite sides of each other (exact id-to-side mapping not confirmed). Human-approved via /liftwatch-station-review 2026-07-16 (confidence 4/10).",
    segments: [
      {
        id: "street-mezzanine-platform",
        label: "Street/mezzanine to platform",
        elevators: [
          { externalId: "G04X01", label: "Morgan Blvd elevator (street/mezzanine to platform) — center of platform" },
          { externalId: "G04X02", label: "Morgan Blvd elevator (street/mezzanine to platform) — center of platform, opposite side" },
        ],
      },
    ],
  },
];
