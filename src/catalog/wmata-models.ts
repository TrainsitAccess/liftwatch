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
        elevators: [{ externalId: "A14X03", label: "Rockville elevator (mezzanine to platform)" }],
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
        elevators: [{ externalId: "B02N02", label: "Judiciary Sq elevator (street to opposite-direction platform)" }],
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
        elevators: [{ externalId: "C14X01", label: "Eisenhower Ave elevator (street/mezzanine to opposite-direction platform)" }],
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
        elevators: [{ externalId: "E08X02", label: "Hyattsville Crossing North elevator (street/mezzanine to platform)" }],
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
        elevators: [{ externalId: "E08X01", label: "Hyattsville Crossing South elevator (street/mezzanine to platform)" }],
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
        elevators: [{ externalId: "A03N01", label: "Dupont Circle elevator (street to mezzanine)" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the opposite direction 1 platform",
        elevators: [{ externalId: "A03N02", label: "Dupont Circle elevator (mezzanine to opposite direction 1 platform)" }],
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
        elevators: [{ externalId: "A03N01", label: "Dupont Circle elevator (street to mezzanine)" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the opposite direction 2 platform",
        elevators: [{ externalId: "A03N03", label: "Dupont Circle elevator (mezzanine to opposite direction 2 platform)" }],
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
        elevators: [{ externalId: "C02E01", label: "McPherson Sq elevator (street to mezzanine)" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the opposite direction 1 platform",
        elevators: [{ externalId: "C02E02", label: "McPherson Sq elevator (mezzanine to opposite direction 1 platform)" }],
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
        elevators: [{ externalId: "C02E01", label: "McPherson Sq elevator (street to mezzanine)" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the opposite direction 2 platform",
        elevators: [{ externalId: "C02E03", label: "McPherson Sq elevator (mezzanine to opposite direction 2 platform)" }],
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
        elevators: [{ externalId: "C03W01", label: "Farragut West elevator (street to mezzanine)" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the opposite direction 1 platform",
        elevators: [{ externalId: "C03W02", label: "Farragut West elevator (mezzanine to opposite direction 1 platform)" }],
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
        elevators: [{ externalId: "C03W01", label: "Farragut West elevator (street to mezzanine)" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the opposite direction 2 platform",
        elevators: [{ externalId: "C03W03", label: "Farragut West elevator (mezzanine to opposite direction 2 platform)" }],
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
        elevators: [{ externalId: "C08X02", label: "Pentagon City elevator (mezzanine to opposite direction 1 platform)" }],
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
        elevators: [{ externalId: "C08X03", label: "Pentagon City elevator (mezzanine to opposite direction 2 platform)" }],
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
        elevators: [{ externalId: "C09X01", label: "Crystal City elevator (street to mezzanine)" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the opposite direction 1 platform",
        elevators: [{ externalId: "C09X02", label: "Crystal City elevator (mezzanine to opposite direction 1 platform)" }],
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
        elevators: [{ externalId: "C09X01", label: "Crystal City elevator (street to mezzanine)" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the opposite direction 2 platform",
        elevators: [{ externalId: "C09X03", label: "Crystal City elevator (mezzanine to opposite direction 2 platform)" }],
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
        elevators: [{ externalId: "D11X01", label: "Cheverly elevator (street to mezzanine)" }],
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
        elevators: [{ externalId: "D11X01", label: "Cheverly elevator (street to mezzanine)" }],
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
        elevators: [{ externalId: "K02X01", label: "Clarendon elevator (street to mezzanine)" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the opposite direction 1 platform",
        elevators: [{ externalId: "K02X02", label: "Clarendon elevator (mezzanine to opposite direction 1 platform)" }],
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
        elevators: [{ externalId: "K02X01", label: "Clarendon elevator (street to mezzanine)" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the opposite direction 2 platform",
        elevators: [{ externalId: "K02X03", label: "Clarendon elevator (mezzanine to opposite direction 2 platform)" }],
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
        elevators: [{ externalId: "K03X01", label: "Virginia Sq-GMU elevator (street to mezzanine)" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the opposite direction 1 platform",
        elevators: [{ externalId: "K03X02", label: "Virginia Sq-GMU elevator (mezzanine to opposite direction 1 platform)" }],
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
        elevators: [{ externalId: "K03X01", label: "Virginia Sq-GMU elevator (street to mezzanine)" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to the opposite direction 2 platform",
        elevators: [{ externalId: "K03X03", label: "Virginia Sq-GMU elevator (mezzanine to opposite direction 2 platform)" }],
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
        elevators: [{ externalId: "A04X01", label: "Woodley Park elevator (street to mezzanine/intermediate passageway)" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine/intermediate passageway to platform",
        elevators: [{ externalId: "A04X02", label: "Woodley Park elevator (mezzanine/intermediate passageway to platform)" }],
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
        elevators: [{ externalId: "A05X01", label: "Cleveland Park elevator (street to mezzanine/intermediate passageway)" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine/intermediate passageway to platform",
        elevators: [{ externalId: "A05X02", label: "Cleveland Park elevator (mezzanine/intermediate passageway to platform)" }],
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
        elevators: [{ externalId: "A06X01", label: "Van Ness-UDC elevator (street to mezzanine/intermediate passageway)" }],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine/intermediate passageway to platform",
        elevators: [{ externalId: "A06X02", label: "Van Ness-UDC elevator (mezzanine/intermediate passageway to platform)" }],
      },
    ],
  },
  // Friendship Heights (A08, Red Line) — spot-checked via
  // /liftwatch-wmata-spot-check 2026-07-17. The GTFS auto-model (chains.json)
  // undercounted this station on TWO axes at once: it drew a plain 2×2 (2
  // street elevators, 2 platform elevators, symmetric), assuming one
  // connected mezzanine. WMATA's own Rider Tools page
  // (wmata.com/ridertools/station/friendship-heights/info, "7 of 7 elevators
  // running", confirmed live by Bryce's screenshot + independently
  // re-fetched in-session 2026-07-17) shows the real structure is
  // asymmetric and the two entrances are separate:
  //   Jenifer Street Entrance (north): 4× street↔mezzanine + 1× mezzanine↔platform
  //   Western Avenue Entrance (south): 1× street↔mezzanine + 1× mezzanine↔platform
  // Bryce confirmed the two mezzanines are NOT connected to each other
  // without going through a platform — same "separate entrance, no
  // cross-redundancy assumed" shape as Navy Yard (F05), but here compounded
  // with a genuine redundant BANK on the Jenifer Street leg (GTFS drew that
  // leg as 1 elevator; it's really 4 — the Forest Glen/Rosslyn undercount
  // pattern) that the plain Navy Yard-style pairing doesn't have. Encoded as
  // a 4-clause CNF (same paired-segment pattern as F05/Jackson-Red/Stamford)
  // of (any Jenifer St. elevator AND the Jenifer St. platform elevator) OR
  // (the Western Ave. street elevator AND the Western Ave. platform
  // elevator) — each clause folds in all 4 Jenifer St. street elevators as
  // an OR-group wherever that leg is referenced. All ids synthetic — WMATA's
  // page names entrances but not individual unit numbers; promote to real
  // UnitNames on first live observation. Approved by Bryce via
  // /liftwatch-wmata-spot-check 2026-07-17 (confidence 8/10 — Bryce-
  // confirmed separate-mezzanine fact + WMATA's own official elevator count,
  // same tier as Gallery Place/Forest Glen/Navy Yard: structure confirmed,
  // ids not yet observed live).
  {
    systemId: SYSTEM,
    stationExternalId: "A08",
    note: "Two independent step-free routes to the platform: the Jenifer Street Entrance (any one of four street elevators to the mezzanine, then the mezzanine elevator to the platform) or the Western Avenue Entrance (one street elevator to the mezzanine, then one elevator to the platform). The station stays step-free as long as at least one full route is working. The Jenifer Street route can absorb any single (or multiple) street-elevator outage there, but still depends on its one mezzanine-to-platform elevator; the Western Avenue route has no backup on either leg.",
    internalNote: "Source: WMATA's official Rider Tools station page (wmata.com/ridertools/station/friendship-heights/info), \"7 of 7 elevators running\" — Jenifer Street Entrance: 4× street↔mezzanine + 1× mezzanine↔platform; Western Avenue Entrance: 1× street↔mezzanine + 1× mezzanine↔platform. Confirmed via Bryce's screenshot and independently re-fetched live 2026-07-17. Corrects the GTFS-pathways auto-model (chains.json), which (a) undercounted the Jenifer Street leg as 1 elevator instead of 4, and (b) assumed one connected mezzanine spanning both entrances — Bryce confirmed 2026-07-17 the two mezzanines are separate. Excluded from the generator via CURATED_SPLIT_MEZZANINE in scripts/wmata-pathways.mts. All 7 ids synthetic (A08S01..5, A08N01..2); no UnitNames observed live yet. Physical locations from Bryce (2026-07-17): the Jenifer St. (south) entrance's bank includes a street elevator on the WEST side of Wisconsin Ave, just south of Jenifer St NW, connected to the bus yard/bay (38.95851818379839, -77.08495378033165 -> A08S01); the Western Ave. (north) entrance's street elevator is at the north end near the DC/MD line, embedded in the mall on the EAST side of Wisconsin Ave (38.960275908452, -77.08526194769317 -> A08N01). Coordinates confirm Western Ave = NORTH entrance / Jenifer St = SOUTH (the Western-Ave street elevator sits ~200 m north of the Jenifer St one). Bryce confirmed all four Jenifer St. street elevators are clustered next to each other, so the same coordinate applies to JEN_ELE1..4 (approximate for 2..4). The two mezzanine->platform elevators sit at opposite far ends of the single island platform, each toward the center of its own mezzanine: A08S05 at the SOUTH end (Jenifer St. mezzanine), A08N02 at the NORTH end (Western Ave. mezzanine) -- confirming the two mezzanines are physically separated along the platform, consistent with the split-mezzanine CNF encoding. All 7 elevators now carry a recorded location (street elevators by coordinate, platform elevators by landing description). Approved via /liftwatch-wmata-spot-check 2026-07-17 (confidence 8/10).",
    segments: [
      { id: "cnf-street-street", label: "Step-free guard: a Jenifer Street or Western Avenue STREET elevator", elevators: [
        { externalId: "A08S01", label: "Friendship Heights elevator — Jenifer Street Entrance, street to mezzanine (1 of 4) — west side of Wisconsin Ave, slightly south of the Jenifer St NW & Wisconsin Ave intersection, connected to the bus yard/bay (38.95851818379839, -77.08495378033165)" },
        { externalId: "A08S02", label: "Friendship Heights elevator — Jenifer Street Entrance, street to mezzanine (2 of 4) — west side of Wisconsin Ave by the bus yard/bay, clustered with the other Jenifer St. street elevators (approx. 38.95851818379839, -77.08495378033165)" },
        { externalId: "A08S03", label: "Friendship Heights elevator — Jenifer Street Entrance, street to mezzanine (3 of 4) — west side of Wisconsin Ave by the bus yard/bay, clustered with the other Jenifer St. street elevators (approx. 38.95851818379839, -77.08495378033165)" },
        { externalId: "A08S04", label: "Friendship Heights elevator — Jenifer Street Entrance, street to mezzanine (4 of 4) — west side of Wisconsin Ave by the bus yard/bay, clustered with the other Jenifer St. street elevators (approx. 38.95851818379839, -77.08495378033165)" },
        { externalId: "A08N01", label: "Friendship Heights elevator — Western Avenue Entrance, street to mezzanine — north end (nearer the DC/MD line), embedded into the mall on the east side of Wisconsin Ave (38.960275908452, -77.08526194769317)" },
      ] },
      { id: "cnf-street-plat", label: "Step-free guard: a Jenifer Street STREET or Western Avenue PLATFORM elevator", elevators: [
        { externalId: "A08S01", label: "Friendship Heights elevator — Jenifer Street Entrance, street to mezzanine (1 of 4) — west side of Wisconsin Ave, slightly south of the Jenifer St NW & Wisconsin Ave intersection, connected to the bus yard/bay (38.95851818379839, -77.08495378033165)" },
        { externalId: "A08S02", label: "Friendship Heights elevator — Jenifer Street Entrance, street to mezzanine (2 of 4) — west side of Wisconsin Ave by the bus yard/bay, clustered with the other Jenifer St. street elevators (approx. 38.95851818379839, -77.08495378033165)" },
        { externalId: "A08S03", label: "Friendship Heights elevator — Jenifer Street Entrance, street to mezzanine (3 of 4) — west side of Wisconsin Ave by the bus yard/bay, clustered with the other Jenifer St. street elevators (approx. 38.95851818379839, -77.08495378033165)" },
        { externalId: "A08S04", label: "Friendship Heights elevator — Jenifer Street Entrance, street to mezzanine (4 of 4) — west side of Wisconsin Ave by the bus yard/bay, clustered with the other Jenifer St. street elevators (approx. 38.95851818379839, -77.08495378033165)" },
        { externalId: "A08N02", label: "Friendship Heights elevator — Western Avenue Entrance, mezzanine to platform — at the NORTH far end of the island platform, toward the center of the Western Ave. (north) mezzanine" },
      ] },
      { id: "cnf-plat-street", label: "Step-free guard: the Jenifer Street PLATFORM or a Western Avenue STREET elevator", elevators: [
        { externalId: "A08S05", label: "Friendship Heights elevator — Jenifer Street Entrance, mezzanine to platform — at the SOUTH far end of the island platform, toward the center of the Jenifer St. (south) mezzanine" },
        { externalId: "A08N01", label: "Friendship Heights elevator — Western Avenue Entrance, street to mezzanine — north end (nearer the DC/MD line), embedded into the mall on the east side of Wisconsin Ave (38.960275908452, -77.08526194769317)" },
      ] },
      { id: "cnf-plat-plat", label: "Step-free guard: a Jenifer Street or Western Avenue PLATFORM elevator", elevators: [
        { externalId: "A08S05", label: "Friendship Heights elevator — Jenifer Street Entrance, mezzanine to platform — at the SOUTH far end of the island platform, toward the center of the Jenifer St. (south) mezzanine" },
        { externalId: "A08N02", label: "Friendship Heights elevator — Western Avenue Entrance, mezzanine to platform — at the NORTH far end of the island platform, toward the center of the Western Ave. (north) mezzanine" },
      ] },
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
        elevators: [{ externalId: "D13X02", label: "New Carrollton elevator (street/mezzanine to nw mezzanine)" }],
      },
      {
        id: "mezzanine-platform",
        label: "NW mezzanine to platform",
        elevators: [{ externalId: "D13X01", label: "New Carrollton elevator (nw mezzanine to platform)" }],
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
        elevators: [{ externalId: "F10X02", label: "Suitland elevator (pedestrian bridge to street/mezzanine)" }],
      },
      {
        id: "mezzanine-platform",
        label: "Street/mezzanine to platform",
        elevators: [{ externalId: "F10X01", label: "Suitland elevator (street/mezzanine to platform)" }],
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
        elevators: [{ externalId: "J03X01", label: "Franconia-Springfield elevator (street to mezzanine)" }],
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
          { externalId: "B09X01", label: "Forest Glen elevator (mezzanine to platform)" },
          { externalId: "B09X02", label: "Forest Glen elevator (mezzanine to platform)" },
          { externalId: "B09X03", label: "Forest Glen elevator (mezzanine to platform)" },
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
          { externalId: "E01X03", label: "Mt Vernon Sq elevator (street to mezzanine) — northwest corner of 7th & M St NW, inside the Convention Center" },
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
  // NoMa-Gallaudet U (B35, Red Line) — excluded by the observed-units gate as
  // an "observed-unmappable": the live unit B35N02 ("Elevator between bike
  // trail and mezzanine") maps to 0 segments in the station's GTFS levels,
  // which excluded the WHOLE station from auto-generation, not just that one
  // elevator. NoMa-Gallaudet U sits next to the Metropolitan Branch Trail
  // (a bike trail along the tracks) -- B35N02 is a real, separate secondary
  // entrance from that trail, not part of the core street route, so it's
  // modeled as its own AUXILIARY chain (same pattern as BART Coliseum's
  // parking-lot elevator). Bryce corrected the core route (2026-07-16): it
  // is a REDUNDANT PAIR, not a single elevator -- two platform<->mezzanine
  // elevators in the center of the platform, on opposite sides of each
  // other (mirrors Morgan Blvd's arrangement exactly). Neither has ever
  // appeared individually in a live outage, so both get synthetic
  // placeholder ids. Approved by Bryce via /liftwatch-station-review
  // 2026-07-16 (confidence 8/10 -- core pair confirmed directly by Bryce
  // including physical locations; auxiliary chain inferred from the
  // station's known adjacency to the bike trail).
  {
    systemId: SYSTEM,
    stationExternalId: "B35",
    note: "Mezzanine to platform: 2 elevators, in the center of the platform on opposite sides of each other — either one keeps this route step-free. Only if both are out of service does this station lose step-free access.",
    internalNote: "GTFS models only 1 elevator (WMATA-B35_ELE) but Bryce confirmed 2026-07-16 this is a redundant pair, both in the center of the platform on opposite sides -- same arrangement as Morgan Blvd (G04). Neither has ever appeared individually in a live outage; both are synthetic placeholder ids. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 8/10). DISCREPANCY TO WATCH (2026-07-16): WMATA's own materials say this station has only 1 elevator between mezzanine and platform, contradicting Bryce's certainty that there are 2. Possible but unlikely explanation: one may be a replacement/rebuild not yet reflected in WMATA's count. Watch observed-units.json / any future WMATA document for a 2nd distinct unit id on this segment -- that would confirm the pair; continued silence (only ever 1 id ever observed here) would support WMATA's single-elevator count instead. Do not resolve this discrepancy unilaterally -- surface it back to Bryce if new evidence appears either way.",
    segments: [
      {
        id: "mezzanine-platform",
        label: "Mezzanine to platform",
        elevators: [
          { externalId: "WMATA-B35_ELE1", label: "NoMa-Gallaudet U elevator (mezzanine to platform) — center of platform" },
          { externalId: "WMATA-B35_ELE2", label: "NoMa-Gallaudet U elevator (mezzanine to platform) — center of platform, opposite side" },
        ],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "B35",
    chainLabel: " (bike trail)",
    auxiliary: true,
    note: "The Metropolitan Branch Trail (bike trail) entrance to the mezzanine: one elevator, no backup. This is a secondary entrance, not required for ordinary street access.",
    internalNote: "Real, live-observed id (B35N02, \"Elevator between bike trail and mezzanine\") -- maps to 0 segments in the station's GTFS levels, which is what excluded the whole station from auto-generation. Modeled as an auxiliary chain (same pattern as BART Coliseum's parking-lot elevator), auxiliary: true so it's excluded from platformDefaultElevator. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 8/10).",
    segments: [
      {
        id: "bike-trail-mezzanine",
        label: "Bike trail to mezzanine",
        elevators: [{ externalId: "B35N02", label: "NoMa-Gallaudet U bike trail to mezzanine elevator" }],
      },
    ],
  },
  // Downtown Largo (G05, Blue/Silver terminus) — excluded by the
  // observed-units gate as an "observed-unmappable": live unit G05X01
  // ("Elevator between street and mezzanine") didn't cleanly match either
  // GTFS edge (Street<->Street/Mezzanine, Street/Mezzanine<->Platform),
  // which excluded the whole station. Bryce walked the FULL layout
  // 2026-07-16 -- 6 elevators total, only 2 of which gate core
  // accessibility:
  //   - CORE: mezzanine<->platform, a redundant pair on opposite sides of
  //     the platform (both synthetic -- neither individually observed).
  //   - The mezzanine itself needs NO elevator at all -- it's at street
  //     level via the Harry Truman Drive entrance, so there is no
  //     street<->mezzanine segment in the core chain.
  //   - 4 more elevators are auxiliary secondary entrances, none required
  //     for core accessibility (confirmed by Bryce: "every single elevator
  //     other than one platform elevator could be out, and it would still
  //     be usable"): 1 from the North Garage to mezzanine (synthetic), 2
  //     redundant elevators from the South Garage to mezzanine (both
  //     synthetic), and 1 from Grand Boulevard to mezzanine -- this last
  //     one is the real, live-observed G05X01 (Bryce confirmed the mapping
  //     2026-07-16).
  // Approved by Bryce via /liftwatch-station-review 2026-07-16 (confidence
  // 9/10 -- full layout confirmed directly by Bryce).
  {
    systemId: SYSTEM,
    stationExternalId: "G05",
    note: "Mezzanine to platform: 2 elevators, on opposite sides of the platform — either one keeps this route step-free. The mezzanine itself needs no elevator at all; it's reachable at street level via the Harry Truman Drive entrance. Only if both platform elevators are out of service does this station lose step-free access.",
    internalNote: "GTFS models this as a 2-segment chain (street<->mezzanine, mezzanine<->platform), but Bryce confirmed 2026-07-16 the mezzanine is at street level via Harry Truman Drive -- no elevator gates that leg at all, so it's omitted from the core chain entirely (informational only, in the public note). The mezzanine<->platform leg is a redundant pair, both synthetic (never individually observed), on opposite sides of the platform. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 9/10).",
    segments: [
      {
        id: "mezzanine-platform",
        label: "Mezzanine to platform",
        elevators: [
          { externalId: "G05X02", label: "Downtown Largo elevator (mezzanine to platform) — one side of platform" },
          { externalId: "G05X03", label: "Downtown Largo elevator (mezzanine to platform) — opposite side of platform" },
        ],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "G05",
    chainLabel: " (North Garage)",
    auxiliary: true,
    note: "North Garage entrance to the mezzanine: one elevator, no backup. This is a secondary entrance, not required for ordinary station access — the mezzanine is also reachable step-free via the Harry Truman Drive street entrance.",
    internalNote: "Never yet observed live; synthetic placeholder id. Auxiliary secondary entrance, confirmed by Bryce 2026-07-16 not to be required for core accessibility. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 9/10).",
    segments: [
      { id: "north-garage-mezzanine", label: "North Garage to mezzanine", elevators: [{ externalId: "G05X04", label: "Downtown Largo North Garage to mezzanine elevator" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "G05",
    chainLabel: " (South Garage)",
    auxiliary: true,
    note: "South Garage entrance to the mezzanine: 2 elevators, either one keeps this entrance step-free. This is a secondary entrance, not required for ordinary station access — the mezzanine is also reachable step-free via the Harry Truman Drive street entrance.",
    internalNote: "Neither ever observed live; both synthetic placeholder ids. Confirmed by Bryce 2026-07-16 as a redundant pair (either elevator gets you to the mezzanine). Auxiliary secondary entrance, not required for core accessibility. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 9/10).",
    segments: [
      {
        id: "south-garage-mezzanine",
        label: "South Garage to mezzanine",
        elevators: [
          { externalId: "G05X06", label: "Downtown Largo South Garage to mezzanine elevator" },
          { externalId: "G05X07", label: "Downtown Largo South Garage to mezzanine elevator" },
        ],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "G05",
    chainLabel: " (Grand Boulevard)",
    auxiliary: true,
    note: "Grand Boulevard entrance to the mezzanine: one elevator, no backup. This is a secondary entrance, not required for ordinary station access — the mezzanine is also reachable step-free via the Harry Truman Drive street entrance.",
    internalNote: "Real, live-observed id (G05X01, \"Elevator between street and mezzanine\") -- this is the unit that originally excluded the whole station from auto-generation (didn't cleanly match either GTFS edge). Bryce confirmed 2026-07-16 this is the Grand Boulevard entrance elevator. Auxiliary, not required for core accessibility. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 9/10).",
    segments: [
      { id: "grand-blvd-mezzanine", label: "Grand Boulevard to mezzanine", elevators: [{ externalId: "G05X01", label: "Downtown Largo Grand Boulevard to mezzanine elevator" }] },
    ],
  },
  // Potomac Yard (C11, Blue/Yellow, opened 2023) — excluded by the
  // side-platforms gate: the 2 GTFS-modeled platform elevators serve
  // disjoint directions (per-direction, not redundant), and the station is
  // new enough that nothing has ever appeared in the live feed yet. Bryce
  // walked the full layout 2026-07-16, correcting GTFS's undercount on
  // BOTH legs:
  //   - 3 street entrances (North Pavilion, South Pavilion, Potomac Greens),
  //     each with its OWN redundant pair of elevators (next to each other) —
  //     GTFS only modeled 1 per entrance. All 3 entrances reach the same
  //     shared mezzanine, so this is a 6-way OR shared prerequisite.
  //   - Each of the 2 platforms (side platforms, per direction) has its own
  //     redundant pair of elevators, located together on the far north side
  //     of that platform — GTFS only modeled 1 per platform. Directions:
  //     one platform toward Downtown Largo, one toward Mount Vernon Sq
  //     (station signage numbers them "7" and "8" respectively, but Bryce
  //     is not certain those numbers mean anything in WMATA's own unit-id
  //     scheme, so they're not used as part of the external id).
  // All 10 elevators are synthetic (station too new to have had a live
  // outage yet); the first live outage at each will name its direction
  // directly, letting each synthetic id be promoted to a real one.
  // Approved by Bryce via /liftwatch-station-review 2026-07-16 (confidence
  // 9/10 -- full layout confirmed directly by Bryce).
  {
    systemId: SYSTEM,
    stationExternalId: "C11",
    chainLabel: " (Downtown Largo-bound)",
    note: "Street to the Downtown Largo-bound platform: 3 entrances (North Pavilion, South Pavilion, Potomac Greens), each with 2 elevators — any one keeps street access step-free — then 2 more elevators to the platform, either one of which keeps that leg step-free. The station stays step-free on this route as long as at least one street-entrance elevator and at least one platform elevator are working.",
    internalNote: "Shared street-to-mezzanine prerequisite (6-way OR across 3 entrances x 2 elevators each) feeding a per-direction platform leg (2-way OR, both elevators together on the platform's far north side) -- WMATA shared-prerequisite shape (same pattern as Grand/CTA, Mt Vernon Sq/WMATA). All 10 station elevators are synthetic; station opened 2023 and has had no live outage yet. Station signage labels this platform's elevators \"7\"; Bryce is not certain that number maps onto WMATA's own unit-id scheme. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 9/10).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine",
        elevators: [
          { externalId: "WMATA-C11_NPAV_ELV1", label: "Potomac Yard North Pavilion entrance elevator — never yet observed live, synthetic id" },
          { externalId: "WMATA-C11_NPAV_ELV2", label: "Potomac Yard North Pavilion entrance elevator — never yet observed live, synthetic id" },
          { externalId: "WMATA-C11_SPAV_ELV1", label: "Potomac Yard South Pavilion entrance elevator — never yet observed live, synthetic id" },
          { externalId: "WMATA-C11_SPAV_ELV2", label: "Potomac Yard South Pavilion entrance elevator — never yet observed live, synthetic id" },
          { externalId: "WMATA-C11_PG_ELV1", label: "Potomac Yard Potomac Greens entrance elevator — never yet observed live, synthetic id" },
          { externalId: "WMATA-C11_PG_ELV2", label: "Potomac Yard Potomac Greens entrance elevator — never yet observed live, synthetic id" },
        ],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to Downtown Largo-bound platform",
        elevators: [
          { externalId: "WMATA-C11_LARGO_ELV1", label: "Potomac Yard Downtown Largo-bound platform elevator (far north side, station-signed \"7\") — never yet observed live, synthetic id" },
          { externalId: "WMATA-C11_LARGO_ELV2", label: "Potomac Yard Downtown Largo-bound platform elevator (far north side, station-signed \"7\") — never yet observed live, synthetic id" },
        ],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "C11",
    chainLabel: " (Mount Vernon Sq-bound)",
    note: "Street to the Mount Vernon Sq-bound platform: 3 entrances (North Pavilion, South Pavilion, Potomac Greens), each with 2 elevators — any one keeps street access step-free — then 2 more elevators to the platform, either one of which keeps that leg step-free. The station stays step-free on this route as long as at least one street-entrance elevator and at least one platform elevator are working.",
    internalNote: "Shares the street-to-mezzanine prerequisite with the Downtown Largo-bound chain (same physical units, same synthetic ids in both chains -- an outage on one severs BOTH directions, which is the real structure). Per-direction platform leg is its own redundant pair (far north side of this platform). Station signage labels this platform's elevators \"8\"; Bryce is not certain that number maps onto WMATA's own unit-id scheme. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 9/10).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine",
        elevators: [
          { externalId: "WMATA-C11_NPAV_ELV1", label: "Potomac Yard North Pavilion entrance elevator — never yet observed live, synthetic id" },
          { externalId: "WMATA-C11_NPAV_ELV2", label: "Potomac Yard North Pavilion entrance elevator — never yet observed live, synthetic id" },
          { externalId: "WMATA-C11_SPAV_ELV1", label: "Potomac Yard South Pavilion entrance elevator — never yet observed live, synthetic id" },
          { externalId: "WMATA-C11_SPAV_ELV2", label: "Potomac Yard South Pavilion entrance elevator — never yet observed live, synthetic id" },
          { externalId: "WMATA-C11_PG_ELV1", label: "Potomac Yard Potomac Greens entrance elevator — never yet observed live, synthetic id" },
          { externalId: "WMATA-C11_PG_ELV2", label: "Potomac Yard Potomac Greens entrance elevator — never yet observed live, synthetic id" },
        ],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to Mount Vernon Sq-bound platform",
        elevators: [
          { externalId: "WMATA-C11_MTVERNON_ELV1", label: "Potomac Yard Mount Vernon Sq-bound platform elevator (far north side, station-signed \"8\") — never yet observed live, synthetic id" },
          { externalId: "WMATA-C11_MTVERNON_ELV2", label: "Potomac Yard Mount Vernon Sq-bound platform elevator (far north side, station-signed \"8\") — never yet observed live, synthetic id" },
        ],
      },
    ],
  },
  // West Falls Church (K06, Orange Line terminus) — excluded by the
  // side-platforms gate: 2 GTFS elevators both mislabeled "Platform" on
  // both ends (a known WMATA stops.txt quirk seen elsewhere), serving
  // disjoint per-direction platform legs, plus a 3rd Street<->Mezzanine
  // edge, plus a real live-observed garage elevator. Bryce confirmed the
  // full layout 2026-07-16: the mezzanine needs NO elevator at all for
  // core access -- it's reachable at grade via the I-66/Leesburg Pike
  // median entrance (same shape as Downtown Largo's Harry Truman Drive
  // entrance) -- so the core chains are just the 2 per-direction platform
  // elevators, no street segment. The bus bay elevator (GTFS's ELE3) and
  // both garage elevators are auxiliary, none required for core access;
  // Bryce doesn't know if the 2 garage elevators back each other up, so
  // they're modeled as 2 SEPARATE single-elevator auxiliary chains rather
  // than assumed redundant. Approved by Bryce via /liftwatch-station-review
  // 2026-07-16 (confidence 7/10 -- core mezzanine/platform structure
  // confirmed directly; the 2 platform elevators' directions are unknown,
  // cosmetic only).
  {
    systemId: SYSTEM,
    stationExternalId: "K06",
    chainLabel: " (Platform 1)",
    note: "Mezzanine to this platform: one elevator, no backup. If it is out of service, this route is not step-free. The mezzanine itself needs no elevator at all — it's reachable at grade via the I-66/Leesburg Pike median entrance.",
    internalNote: "GTFS unit K06X01, mislabeled \"Platform\" on both ends (a known WMATA stops.txt quirk) -- structurally a mezzanine<->platform elevator serving one direction, never yet observed live, synthetic id. Direction (e.g. toward Vienna vs. New Carrollton) unconfirmed. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 7/10).",
    segments: [
      { id: "mezzanine-platform", label: "Mezzanine to platform", elevators: [{ externalId: "K06X01", label: "West Falls Church platform elevator (direction unconfirmed)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "K06",
    chainLabel: " (Platform 2)",
    note: "Mezzanine to this platform: one elevator, no backup. If it is out of service, this route is not step-free. The mezzanine itself needs no elevator at all — it's reachable at grade via the I-66/Leesburg Pike median entrance.",
    internalNote: "GTFS unit K06X02, mislabeled \"Platform\" on both ends (a known WMATA stops.txt quirk) -- structurally a mezzanine<->platform elevator serving the opposite direction from Platform 1, never yet observed live, synthetic id. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 7/10).",
    segments: [
      { id: "mezzanine-platform", label: "Mezzanine to platform", elevators: [{ externalId: "K06X02", label: "West Falls Church platform elevator (direction unconfirmed)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "K06",
    chainLabel: " (bus bay)",
    auxiliary: true,
    note: "Bus bay entrance to the mezzanine: one elevator, no backup. This is a secondary entrance, not required for ordinary station access — the mezzanine is also reachable step-free via the I-66/Leesburg Pike median entrance.",
    internalNote: "GTFS unit K06X03 (Street<->Mezzanine), never yet observed live, synthetic id. Bryce confirmed 2026-07-16 this is the bus bay entrance and is not required for core accessibility. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 7/10).",
    segments: [
      { id: "bus-bay-mezzanine", label: "Bus bay to mezzanine", elevators: [{ externalId: "K06X03", label: "West Falls Church bus bay to mezzanine elevator" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "K06",
    chainLabel: " (garage 1)",
    auxiliary: true,
    note: "Garage entrance to the mezzanine: one elevator, no backup. This is a secondary entrance, not required for ordinary station access.",
    internalNote: "Real, live-observed id (K06X04, \"Garage elevator\"). Bryce confirmed 2026-07-16 neither garage elevator is mandatory for core access; he doesn't know if the 2 garage elevators back each other up, so modeled as 2 SEPARATE single-elevator chains rather than assumed redundant. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 7/10).",
    segments: [
      { id: "garage-mezzanine", label: "Garage to mezzanine", elevators: [{ externalId: "K06X04", label: "West Falls Church garage elevator" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "K06",
    chainLabel: " (garage 2)",
    auxiliary: true,
    note: "Garage entrance to the mezzanine: one elevator, no backup. This is a secondary entrance, not required for ordinary station access.",
    internalNote: "Never yet observed live; synthetic placeholder id for the 2nd garage elevator Bryce confirmed exists. Not assumed redundant with the other garage elevator (K06X04) -- modeled as its own separate chain. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 7/10).",
    segments: [
      { id: "garage-mezzanine", label: "Garage to mezzanine", elevators: [{ externalId: "K06X05", label: "West Falls Church garage elevator (2nd unit)" }] },
    ],
  },
  // Fort Totten (B06_E06, Red/Green/Yellow interchange) — excluded by the
  // multi-level-shaft gate: the one GTFS-modeled elevator spans 3 named
  // levels (Street/Mezzanine, Lower Platform, Upper Platform), and the
  // auto-generator couldn't tell whether it's a genuine single shaft
  // reaching all 3 or a naming quirk hiding 2+ separate elevators. Bryce
  // confirmed 2026-07-16: it really is ONE elevator, one continuous shaft,
  // reaching all 3 levels (both the Red Line level and the Green/Yellow
  // platforms) — no other elevator is needed anywhere in the station, and
  // this one is reachable without any other elevator (i.e. it's the
  // station's sole point of step-free access, top to bottom). Approved by
  // Bryce via /liftwatch-station-review 2026-07-16 (confidence 9/10 --
  // confirmed directly).
  {
    systemId: SYSTEM,
    stationExternalId: "B06_E06",
    note: "One elevator serves the entire station — street/mezzanine, the Red Line level, and the Green/Yellow Line level — with no backup. If it is out of service, no part of this station is step-free.",
    internalNote: "GTFS models one elevator (B06X01) spanning 3 named levels (Street/Mezzanine, Lower Platform, Upper Platform); auto-generator couldn't confirm whether it's a genuine single shaft or a naming quirk hiding multiple elevators. Bryce confirmed 2026-07-16 it's genuinely one continuous shaft serving all 3 levels, sole access for the whole station. Never yet observed live; synthetic placeholder id. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 9/10).",
    segments: [
      { id: "street-mezzanine-platform", label: "Street/mezzanine to platform (all levels)", elevators: [{ externalId: "B06X01", label: "Fort Totten elevator (serves all 3 levels: street/mezzanine, Red Line, Green/Yellow)" }] },
    ],
  },
  // Smithsonian (D02, Blue/Orange/Silver) — excluded by the multi-level-shaft
  // gate: WMATA-D02_S_ELE1 spans all 3 named levels (Street, Mezzanine,
  // Platform) in one shaft. Live feed resolves this cleanly: D02S01
  // ("Elevator between street, mezzanine, and platform to New Carrollton/
  // Largo Town Center") is that one continuous elevator, sole access for
  // the New Carrollton/Largo-bound platform. D02S02 ("Elevator between
  // mezzanine and platform to Vienna/Franconia-Springfield") only covers
  // mezzanine<->platform for the OPPOSITE direction, so that direction
  // needs D02S01 as a shared street<->mezzanine prerequisite PLUS D02S02
  // for mezzanine<->platform (Grand/Mt Vernon Sq shared-prerequisite
  // shape). Bryce confirmed this reading 2026-07-16 (confidence 9/10 --
  // both elevator ids are real and the live text names both directions
  // directly).
  {
    systemId: SYSTEM,
    stationExternalId: "D02",
    chainLabel: " (New Carrollton/Largo-bound)",
    note: "Street to the New Carrollton/Largo Town Center-bound platform: one continuous elevator, no backup. If it is out of service, this route is not step-free.",
    internalNote: "Real, live-observed id D02S01 (\"Elevator between street, mezzanine, and platform to New Carrollton/Largo Town Center\") -- one continuous shaft spanning all 3 levels for this direction. Confirmed by Bryce 2026-07-16 (confidence 9/10).",
    segments: [
      { id: "street-mezzanine-platform", label: "Street to platform (all levels)", elevators: [{ externalId: "D02S01", label: "Smithsonian elevator (street to New Carrollton/Largo-bound platform, all levels) — street entrance at the northwest corner of 12th St & Independence Ave SW (38.887765272151604, -77.02853785398135)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "D02",
    chainLabel: " (Vienna/Franconia-Springfield-bound)",
    note: "Street to the Vienna/Franconia-Springfield-bound platform takes two elevators in a row (street to mezzanine, then mezzanine to this platform) — both must be working, and neither has a backup. If either elevator is out of service, this route is not step-free.",
    internalNote: "Shares the street<->mezzanine prerequisite with the New Carrollton/Largo-bound chain (same physical unit D02S01, same real id in both chains -- an outage on it severs BOTH directions, which is the real structure). Mezzanine<->platform leg is the real, live-observed D02S02 (\"Elevator between mezzanine and platform to Vienna/Franconia-Springfield\"). Confirmed by Bryce 2026-07-16 (confidence 9/10).",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine", elevators: [{ externalId: "D02S01", label: "Smithsonian elevator (street to New Carrollton/Largo-bound platform, all levels) — street entrance at the northwest corner of 12th St & Independence Ave SW (38.887765272151604, -77.02853785398135)" }] },
      { id: "mezzanine-platform", label: "Mezzanine to Vienna/Franconia-Springfield-bound platform", elevators: [{ externalId: "D02S02", label: "Smithsonian elevator (mezzanine to Vienna/Franconia-Springfield-bound platform)" }] },
    ],
  },
  // Ballston-MU (K04, Orange/Silver) — excluded by the multi-level-shaft
  // gate: WMATA-K04_N_EL spans all 3 named levels (Street, Mezzanine,
  // Platform). Bryce walked the full layout 2026-07-16 -- 5 elevators,
  // all currently running:
  //   - SW corner of Fairfax Dr & Stuart St (38.88208521293941,
  //     -77.11211144204533): 2 redundant elevators, next to each other,
  //     street<->mezzanine.
  //   - NW corner of Fairfax Dr & Stuart St: 2 elevators, next to each
  //     other. One goes just to the mezzanine (street<->mezzanine only).
  //     The other continues all the way to the Vienna-bound platform
  //     (street<->mezzanine<->platform, one shaft) -- and is the ONLY
  //     access to that platform.
  //   - A 5th, separate elevator goes from the mezzanine to the New
  //     Carrollton-bound platform -- the ONLY way to reach that platform.
  // Modeled as a shared street<->mezzanine prerequisite (4-way OR across
  // both corners) feeding 2 independent per-direction platform legs, same
  // shape as Grand/Mt Vernon Sq/Smithsonian. Bryce mapped the 3
  // already-observed live units onto this structure: K04X04/K04X05 (both
  // worded "to New Carrollton", identical) = the SW-corner redundant pair;
  // K04X03 ("to Vienna") = the NW "just to mezzanine" elevator. NEITHER the
  // NW platform-continuing elevator nor the New Carrollton-platform
  // elevator has ever been individually observed, so both stay synthetic.
  // INTERNAL CAVEAT: this id mapping is Bryce's best read, not confirmed
  // against a fresh, unambiguous alert naming a platform directly -- watch
  // future live alerts at this station for wording that contradicts this
  // mapping (e.g. an alert on K04X03/X04/X05 that mentions a platform, or
  // a new unit id that doesn't fit this structure) and revisit if so.
  // Approved by Bryce via /liftwatch-station-review 2026-07-16 (confidence
  // 6/10 -- full structure confirmed directly, but the observed-id mapping
  // specifically is inferential, not a smoking-gun alert).
  {
    systemId: SYSTEM,
    stationExternalId: "K04",
    chainLabel: " (Vienna-bound)",
    note: "Street to the Vienna-bound platform: 2 street entrances (southwest and northwest corners of Fairfax Dr & Stuart St) reach the mezzanine — any one of 4 elevators keeps street access step-free — then one elevator continues to the platform, no backup. If all street entrances are down, or the platform elevator is out of service, this route is not step-free.",
    internalNote: "Shared street<->mezzanine prerequisite: SW corner pair (K04X04, K04X05, real, 38.88208521293941/-77.11211144204533) + NW corner \"just to mezzanine\" elevator (K04X03, real) + NW corner platform-continuing elevator (WMATA-K04_N_EL, synthetic -- also serves as the mezzanine<->platform leg below, since it's one continuous shaft). Mezzanine<->Vienna-bound platform leg: WMATA-K04_N_EL only, sole access. CAVEAT: Bryce's id mapping for K04X03/X04/X05 is inferential (none of their alert texts mention a platform) -- watch future alerts for contradicting wording. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 6/10).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine",
        elevators: [
          { externalId: "K04X04", label: "Ballston-MU SW corner elevator (street to mezzanine) — SW corner of Fairfax Dr & Stuart St (38.88208521293941, -77.11211144204533)" },
          { externalId: "K04X05", label: "Ballston-MU SW corner elevator (street to mezzanine) — SW corner of Fairfax Dr & Stuart St (38.88208521293941, -77.11211144204533)" },
          { externalId: "K04X03", label: "Ballston-MU NW corner elevator (street to mezzanine only) — NW corner of Fairfax Dr & Stuart St" },
          { externalId: "WMATA-K04_N_EL", label: "Ballston-MU NW corner elevator (street to mezzanine to Vienna-bound platform, one shaft) — NW corner of Fairfax Dr & Stuart St, never yet observed live, synthetic id" },
        ],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to Vienna-bound platform",
        elevators: [{ externalId: "WMATA-K04_N_EL", label: "Ballston-MU NW corner elevator (street to mezzanine to Vienna-bound platform, one shaft) — NW corner of Fairfax Dr & Stuart St, never yet observed live, synthetic id" }],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "K04",
    chainLabel: " (New Carrollton-bound)",
    note: "Street to the New Carrollton-bound platform: 2 street entrances (southwest and northwest corners of Fairfax Dr & Stuart St) reach the mezzanine — any one of 4 elevators keeps street access step-free — then one elevator continues to the platform, no backup. If all street entrances are down, or the platform elevator is out of service, this route is not step-free.",
    internalNote: "Shares the street<->mezzanine prerequisite with the Vienna-bound chain (same 4 physical units, same ids in both chains -- an outage on any single one only reduces the OR group, doesn't sever access unless all 4 are down). Mezzanine<->New Carrollton-bound platform leg: a 5th, separate elevator, never yet observed live, synthetic id, sole access. CAVEAT: Bryce's id mapping for K04X03/X04/X05 (in the shared prerequisite) is inferential -- watch future alerts for contradicting wording. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 6/10).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine",
        elevators: [
          { externalId: "K04X04", label: "Ballston-MU SW corner elevator (street to mezzanine) — SW corner of Fairfax Dr & Stuart St (38.88208521293941, -77.11211144204533)" },
          { externalId: "K04X05", label: "Ballston-MU SW corner elevator (street to mezzanine) — SW corner of Fairfax Dr & Stuart St (38.88208521293941, -77.11211144204533)" },
          { externalId: "K04X03", label: "Ballston-MU NW corner elevator (street to mezzanine only) — NW corner of Fairfax Dr & Stuart St" },
          { externalId: "WMATA-K04_N_EL", label: "Ballston-MU NW corner elevator (street to mezzanine to Vienna-bound platform, one shaft) — NW corner of Fairfax Dr & Stuart St, never yet observed live, synthetic id" },
        ],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to New Carrollton-bound platform",
        elevators: [{ externalId: "WMATA-K04_MZ_ELE1", label: "Ballston-MU mezzanine to New Carrollton-bound platform elevator — never yet observed live, synthetic id" }],
      },
    ],
  },
  // Metro Center (A01_C01, Red/Blue/Orange/Silver interchange) — excluded
  // by the non-standard-levels gate: the Red Line's upper platform doubles
  // as the station's mezzanine (WMATA's combined level name "Lower
  // Mezzanine/Upper Platform"), stacked directly above the Blue/Orange/
  // Silver lower platform. Bryce confirmed the full structure 2026-07-16,
  // and pasted WMATA's own 3 official elevator descriptions, which resolve
  // everything cleanly:
  //   1. "Elevator between street and mezzanine" -- street to the upper
  //      level, which is physically the SHADY GROVE-BOUND Red Line
  //      platform (real, live-observed as C01N01).
  //   2. "Elevator between upper platform to Shady Grove and lower
  //      platform for Blue/Orange Lines" -- connects the Shady-Grove end
  //      of the upper level down to the shared lower Blue/Orange/Silver
  //      platform (never yet individually observed, synthetic).
  //   3. "Elevator between upper platform to Glenmont and lower platform
  //      for Blue/Orange Lines" -- connects the Glenmont end of the upper
  //      level down to the SAME shared lower platform (never yet
  //      individually observed, synthetic).
  // The two ends of the upper (Red Line) platform are NOT directly
  // walkable to each other -- the only way from the Shady-Grove end to the
  // Glenmont end is down to the lower platform and back up via the other
  // elevator. So: Shady Grove-bound Red Line needs only elevator 1 (sole
  // access). Blue/Orange/Silver needs elevator 1 then EITHER elevator 2 OR
  // elevator 3 (both reach the same lower platform -- a real redundant OR).
  // Glenmont-bound Red Line needs elevator 1, THEN BOTH elevator 2 AND
  // elevator 3 in series (down via one, back up via the other -- no
  // redundancy, and no shortcut). Approved by Bryce via
  // /liftwatch-station-review 2026-07-16 (confidence 9/10 -- WMATA's own
  // wording resolves the structure directly; only the exact GTFS N_ELE2 vs
  // S_ELE1 physical-id-to-description mapping is an arbitrary guess, noted
  // internally).
  {
    systemId: SYSTEM,
    stationExternalId: "A01_C01",
    chainLabel: " (Shady Grove-bound Red Line)",
    note: "Street to the Shady Grove-bound Red Line platform: one elevator, no backup. The mezzanine and this platform are the same level. If that elevator is out of service, this route is not step-free.",
    internalNote: "Real, live-observed id C01N01 (\"Elevator between street and mezzanine\") -- WMATA's own wording, confirmed by Bryce 2026-07-16 to land directly on the Shady Grove-bound platform (the upper level doubles as the mezzanine). Human-approved via /liftwatch-station-review 2026-07-16 (confidence 9/10).",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine/Shady Grove-bound platform", elevators: [{ externalId: "C01N01", label: "Metro Center elevator (street to mezzanine, WMATA: \"Elevator between street and mezzanine\")" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "A01_C01",
    chainLabel: " (Blue/Orange/Silver)",
    note: "Street to the Blue/Orange/Silver platform: one elevator to the upper level, then one of two elevators down to the platform — either one keeps this leg step-free. The station stays step-free on this route as long as the street elevator and at least one of the two down elevators are working.",
    internalNote: "Shares the street<->mezzanine prerequisite with the Shady Grove-bound chain (C01N01). Lower-platform leg is a 2-way OR of WMATA's other two elevators, both landing on the same shared Blue/Orange/Silver platform: \"Elevator between upper platform to Shady Grove and lower platform for Blue/Orange Lines\" and \"Elevator between upper platform to Glenmont and lower platform for Blue/Orange Lines\" -- neither individually observed live, both synthetic. GTFS's N_ELE2/S_ELE1 id-to-description mapping is an arbitrary guess (doesn't affect correctness, both are in the OR group regardless). Confirmed by Bryce 2026-07-16 (confidence 9/10).",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine", elevators: [{ externalId: "C01N01", label: "Metro Center elevator (street to mezzanine, WMATA: \"Elevator between street and mezzanine\")" }] },
      {
        id: "mezzanine-lower-platform",
        label: "Upper level to Blue/Orange/Silver platform",
        elevators: [
          { externalId: "C01N02", label: "Metro Center elevator (WMATA: \"Elevator between upper platform to Shady Grove and lower platform for Blue/Orange Lines\")" },
          { externalId: "C01N03", label: "Metro Center elevator (WMATA: \"Elevator between upper platform to Glenmont and lower platform for Blue/Orange Lines\")" },
        ],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "A01_C01",
    chainLabel: " (Glenmont-bound Red Line)",
    note: "Street to the Glenmont-bound Red Line platform takes 3 elevators in a row: street to the upper level, down to the Blue/Orange/Silver platform, then back up to the Glenmont-bound platform on the opposite end. All 3 must be working, and none has a backup — the two ends of the upper platform aren't directly connected. If any one of the 3 is out of service, this route is not step-free.",
    internalNote: "Shares the street<->mezzanine prerequisite (C01N01) and both of the upper<->lower elevators with the other two chains, but here BOTH are required in series (down via one, back up via the other), not an OR -- the two ends of the upper Red Line platform aren't walkable to each other, confirmed by Bryce 2026-07-16. Confidence 9/10.",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine", elevators: [{ externalId: "C01N01", label: "Metro Center elevator (street to mezzanine, WMATA: \"Elevator between street and mezzanine\")" }] },
      { id: "mezzanine-lower-platform", label: "Upper level (Shady Grove end) down to Blue/Orange/Silver platform", elevators: [{ externalId: "C01N02", label: "Metro Center elevator (WMATA: \"Elevator between upper platform to Shady Grove and lower platform for Blue/Orange Lines\")" }] },
      { id: "lower-platform-glenmont", label: "Blue/Orange/Silver platform back up to Glenmont-bound platform", elevators: [{ externalId: "C01N03", label: "Metro Center elevator (WMATA: \"Elevator between upper platform to Glenmont and lower platform for Blue/Orange Lines\")" }] },
    ],
  },
  // Gallery Place-Chinatown (B01_F01, Red/Green/Yellow interchange) —
  // excluded by the non-standard-levels gate: same "Lower Mezzanine/Upper
  // Platform" + "Lower Platform" pattern as Metro Center -- the Red Line
  // platform doubles as the mezzanine, stacked above the Green/Yellow
  // platform. Structurally a MIRROR of Metro Center (street surfaces at
  // the Glenmont-bound end here, not the Shady Grove-bound end), confirmed
  // by Bryce 2026-07-16 from WMATA's own live-observed elevator wording:
  //   - B01E02: "Elevator between street and platform to Glenmont" --
  //     street straight to the Glenmont-bound platform. Bryce corrected
  //     this to a REDUNDANT PAIR: 2 elevators, both embedded into Capital
  //     One Arena, facing the National Portrait Gallery
  //     (38.898045155641995, -77.02177530236538) -- only B01E02 has
  //     appeared live so far, the 2nd is synthetic.
  //   - B01E03: "Elevator between platform for Green/Yellow lines and
  //     platform to Glenmont" -- Glenmont-upper down to the shared
  //     Green/Yellow lower platform.
  //   - B01E04: "Elevator between platform for Green/Yellow lines and
  //     platform to Shady Grove" -- Green/Yellow lower back up to the
  //     Shady Grove-bound upper platform.
  // The two ends of the upper Red Line platform aren't directly walkable
  // to each other (same as Metro Center), so: Glenmont-bound Red Line
  // needs only the street pair (redundant). Green/Yellow needs the street
  // pair then B01E03 (no redundancy on that leg). Shady Grove-bound Red
  // Line needs the street pair, then B01E03, then B01E04 in series (no
  // redundancy, no shortcut). Approved by Bryce via
  // /liftwatch-station-review 2026-07-16 (confidence 8/10).
  {
    systemId: SYSTEM,
    stationExternalId: "B01_F01",
    chainLabel: " (Glenmont-bound Red Line)",
    note: "Street to the Glenmont-bound Red Line platform: 2 elevators, embedded into Capital One Arena facing the National Portrait Gallery — either one keeps this route step-free. Only if both are out of service does this station lose step-free access on this route.",
    internalNote: "Real, live-observed id B01E02 (\"Elevator between street and platform to Glenmont\") + a 2nd, never yet observed synthetic id -- both at Capital One Arena facing the National Portrait Gallery (38.898045155641995, -77.02177530236538), per Bryce 2026-07-16. The upper level here doubles as the mezzanine, mirroring Metro Center's structure but with street surfacing at the Glenmont end instead of Shady Grove. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 8/10).",
    segments: [
      {
        id: "street-glenmont-platform",
        label: "Street to Glenmont-bound platform",
        elevators: [
          { externalId: "B01E02", label: "Gallery Place elevator (street to Glenmont-bound platform) — Capital One Arena, facing the National Portrait Gallery (38.898045155641995, -77.02177530236538)" },
          { externalId: "B01E01", label: "Gallery Place elevator (street to Glenmont-bound platform) — Capital One Arena, facing the National Portrait Gallery" },
        ],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "B01_F01",
    chainLabel: " (Green/Yellow)",
    note: "Street to the Green/Yellow platform takes two elevators in a row (street to the Glenmont-bound platform, then down to the Green/Yellow platform) — the first leg has a backup, the second does not. If both street elevators are out, or the 2nd elevator is out of service, this route is not step-free.",
    internalNote: "Shares the redundant street<->Glenmont-platform pair (B01E02 + synthetic) with the Glenmont-bound chain. Second leg is the real, live-observed B01E03 (\"Elevator between platform for Green/Yellow lines and platform to Glenmont\"), sole access -- no other path down from street that doesn't go through the Glenmont-bound platform first. Confirmed by Bryce 2026-07-16 (confidence 8/10).",
    segments: [
      {
        id: "street-glenmont-platform",
        label: "Street to Glenmont-bound platform",
        elevators: [
          { externalId: "B01E02", label: "Gallery Place elevator (street to Glenmont-bound platform) — Capital One Arena, facing the National Portrait Gallery (38.898045155641995, -77.02177530236538)" },
          { externalId: "B01E01", label: "Gallery Place elevator (street to Glenmont-bound platform) — Capital One Arena, facing the National Portrait Gallery" },
        ],
      },
      { id: "glenmont-lower-platform", label: "Glenmont-bound platform down to Green/Yellow platform", elevators: [{ externalId: "B01E03", label: "Gallery Place elevator (Glenmont-bound platform to Green/Yellow platform)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "B01_F01",
    chainLabel: " (Shady Grove-bound Red Line)",
    note: "Street to the Shady Grove-bound Red Line platform takes 3 elevators in a row: street to the Glenmont-bound platform, down to the Green/Yellow platform, then back up to the Shady Grove-bound platform on the opposite end. All 3 must be working (though the first leg has a backup) — the two ends of the upper platform aren't directly connected. If both street elevators are out, or either of the other two is out of service, this route is not step-free.",
    internalNote: "Shares the redundant street<->Glenmont-platform pair and the Glenmont<->Green/Yellow elevator (B01E03) with the other two chains, plus a 3rd leg: the real, live-observed B01E04 (\"Elevator between platform for Green/Yellow lines and platform to Shady Grove\"), sole access. Mirrors Metro Center's Glenmont-bound chain shape. Confirmed by Bryce 2026-07-16 (confidence 8/10).",
    segments: [
      {
        id: "street-glenmont-platform",
        label: "Street to Glenmont-bound platform",
        elevators: [
          { externalId: "B01E02", label: "Gallery Place elevator (street to Glenmont-bound platform) — Capital One Arena, facing the National Portrait Gallery (38.898045155641995, -77.02177530236538)" },
          { externalId: "B01E01", label: "Gallery Place elevator (street to Glenmont-bound platform) — Capital One Arena, facing the National Portrait Gallery" },
        ],
      },
      { id: "glenmont-lower-platform", label: "Glenmont-bound platform down to Green/Yellow platform", elevators: [{ externalId: "B01E03", label: "Gallery Place elevator (Glenmont-bound platform to Green/Yellow platform)" }] },
      { id: "lower-platform-shady-grove", label: "Green/Yellow platform back up to Shady Grove-bound platform", elevators: [{ externalId: "B01E04", label: "Gallery Place elevator (Green/Yellow platform to Shady Grove-bound platform)" }] },
    ],
  },
  // Rosslyn (C05, Blue/Orange/Silver) — excluded by the non-standard-levels
  // gate: "Mezzanine/Upper Platform" + "Lower Platform" (plus Street).
  // Rosslyn is a 2-level station due to the flyover junction just west of
  // it -- both levels serve the same 3 lines (Blue/Orange/Silver), just
  // opposite directions. Bryce confirmed the full layout 2026-07-16:
  //   - 3 REDUNDANT elevators, street<->upper platform, on the east side
  //     of North Moore St & Wilson Blvd (38.896181305462086,
  //     -77.07135426023925) -- GTFS only modeled 1 street<->upper edge,
  //     but all 3 have appeared live, identically worded (same
  //     undercount shape as Forest Glen's bank). Upper platform serves
  //     EASTBOUND trains: Orange to New Carrollton, Silver, Blue to Largo.
  //   - A 4th elevator connects upper<->lower platform. The lower
  //     platform serves the SAME 3 lines in the OPPOSITE (westbound)
  //     direction. Never yet individually observed, synthetic id (GTFS's
  //     C05W04, mislabeled "Platform" on both ends).
  // Approved by Bryce via /liftwatch-station-review 2026-07-16 (confidence
  // 9/10 -- full layout confirmed directly, including physical location).
  {
    systemId: SYSTEM,
    stationExternalId: "C05",
    chainLabel: " (eastbound: New Carrollton/Largo)",
    note: "Street to the eastbound platform (Orange to New Carrollton, Silver, Blue to Largo): 3 elevators, on the east side of North Moore St & Wilson Blvd — any one keeps this route step-free. Only if all 3 are out of service does this station lose step-free access on this route.",
    internalNote: "3 real, live-observed units (C05E01, C05E02, C05E03), all worded \"Elevator between street, and upper platform\" -- east side of North Moore St & Wilson Blvd (38.896181305462086, -77.07135426023925), per Bryce 2026-07-16. GTFS only modeled 1 edge here; a genuine redundant bank, same undercount shape as Forest Glen. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 9/10).",
    segments: [
      {
        id: "street-upper-platform",
        label: "Street to upper (eastbound) platform",
        elevators: [
          { externalId: "C05E01", label: "Rosslyn elevator (street to eastbound platform) — east side of North Moore St & Wilson Blvd (38.896181305462086, -77.07135426023925)" },
          { externalId: "C05E02", label: "Rosslyn elevator (street to eastbound platform) — east side of North Moore St & Wilson Blvd (38.896181305462086, -77.07135426023925)" },
          { externalId: "C05E03", label: "Rosslyn elevator (street to eastbound platform) — east side of North Moore St & Wilson Blvd (38.896181305462086, -77.07135426023925)" },
        ],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "C05",
    chainLabel: " (westbound)",
    note: "Street to the westbound platform (same 3 lines, opposite direction) takes 2 legs: the street entrance (3 elevators, any one works) then one elevator down to the lower platform, which has no backup. If all 3 street elevators are out, or the lower-platform elevator is out of service, this route is not step-free.",
    internalNote: "Shares the redundant street<->upper-platform bank (C05E01/02/03) with the eastbound chain. Upper<->lower leg is GTFS's C05W04 (mislabeled \"Platform\" on both ends), never yet individually observed, synthetic id, sole access. Confirmed by Bryce 2026-07-16 (confidence 9/10).",
    segments: [
      {
        id: "street-upper-platform",
        label: "Street to upper platform",
        elevators: [
          { externalId: "C05E01", label: "Rosslyn elevator (street to eastbound platform) — east side of North Moore St & Wilson Blvd (38.896181305462086, -77.07135426023925)" },
          { externalId: "C05E02", label: "Rosslyn elevator (street to eastbound platform) — east side of North Moore St & Wilson Blvd (38.896181305462086, -77.07135426023925)" },
          { externalId: "C05E03", label: "Rosslyn elevator (street to eastbound platform) — east side of North Moore St & Wilson Blvd (38.896181305462086, -77.07135426023925)" },
        ],
      },
      { id: "upper-lower-platform", label: "Upper platform down to lower (westbound) platform", elevators: [{ externalId: "C05W04", label: "Rosslyn elevator (upper to lower/westbound platform)" }] },
    ],
  },
  // Pentagon (C07, Blue/Yellow) — excluded by the non-standard-levels
  // gate: "Mezzanine/Upper Platform" + "Lower Platform" (plus Street),
  // same combined-level pattern as Rosslyn/Metro Center/Gallery Place.
  // Bryce pasted WMATA's own elevator descriptions 2026-07-16, which
  // resolve to 5 elevators total, only 3 of which are core rail access:
  //   - 2 redundant elevators, "Elevator between the bus bay and the
  //     mezzanine" -- the station's actual street-equivalent entrance
  //     (Pentagon Transit Center's bus bay), reaching the
  //     mezzanine/upper-platform level.
  //   - 1 elevator, "Elevator between upper and lower platforms" -- sole
  //     access between the two train platform levels (opposite
  //     directions of Blue/Yellow).
  // The other 2, "Elevator between the lower bus platform and the upper
  // platform" (a redundant pair), are PURELY a bus-to-bus connection
  // within the transit center -- Bryce confirmed both ends are bus
  // platforms, unrelated to the Metro rail platforms despite the
  // "upper platform" wording. Tracked as their own auxiliary chain (never
  // required for train access), per the universal-inclusion policy (every
  // elevator an agency reports gets tracked, but only enters a core chain
  // when confirmed to be part of the route). None of the 5 have ever been
  // individually observed live. Approved by Bryce via
  // /liftwatch-station-review 2026-07-16 (confidence 8/10 -- structure
  // confirmed directly from WMATA's own descriptions).
  {
    systemId: SYSTEM,
    stationExternalId: "C07",
    chainLabel: " (upper platform)",
    note: "Street to the upper platform: 2 elevators, either one keeps this route step-free. Only if both are out of service does this station lose step-free access on this route.",
    internalNote: "GTFS's WMATA-C07_E_ELE (Street<->Mezzanine/Upper Platform) is, per Bryce 2026-07-16, actually 2 redundant elevators (WMATA's own wording: \"Elevator between the bus bay and the mezzanine\") -- Pentagon Transit Center's bus bay is the station's real street-equivalent entrance. Neither individually observed live, both synthetic ids. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 8/10).",
    segments: [
      {
        id: "bus-bay-mezzanine",
        label: "Street to mezzanine/upper platform",
        elevators: [
          { externalId: "C07N01", label: "Pentagon elevator (bus bay to mezzanine, WMATA: \"Elevator between the bus bay and the mezzanine\")" },
          { externalId: "C07N02", label: "Pentagon elevator (bus bay to mezzanine, WMATA: \"Elevator between the bus bay and the mezzanine\")" },
        ],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "C07",
    chainLabel: " (lower platform)",
    note: "Street to the lower platform takes two legs: the street entrance (2 elevators, either works) then one elevator down to the lower platform, which has no backup. If both street elevators are out, or the lower-platform elevator is out of service, this route is not step-free.",
    internalNote: "Shares the redundant bus-bay<->mezzanine pair with the upper-platform chain. Second leg is GTFS's C07N03 (Mezzanine/Upper Platform<->Lower Platform), WMATA's own wording \"Elevator between upper and lower platforms\" -- sole access, never yet observed live, synthetic id. Confirmed by Bryce 2026-07-16 (confidence 8/10).",
    segments: [
      {
        id: "bus-bay-mezzanine",
        label: "Street to mezzanine/upper platform",
        elevators: [
          { externalId: "C07N01", label: "Pentagon elevator (bus bay to mezzanine, WMATA: \"Elevator between the bus bay and the mezzanine\")" },
          { externalId: "C07N02", label: "Pentagon elevator (bus bay to mezzanine, WMATA: \"Elevator between the bus bay and the mezzanine\")" },
        ],
      },
      { id: "upper-lower-platform", label: "Upper platform down to lower platform", elevators: [{ externalId: "C07N03", label: "Pentagon elevator (upper to lower platform, WMATA: \"Elevator between upper and lower platforms\")" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "C07",
    chainLabel: " (bus-to-bus)",
    auxiliary: true,
    note: "A separate elevator connection between two bus platforms at the Pentagon Transit Center — 2 elevators, either one works. This is for bus-to-bus transfers only; it does not connect to the Metro train platforms and is not required for station access.",
    internalNote: "WMATA's own wording: \"Elevator between the lower bus platform and the upper platform\" -- despite the \"upper platform\" phrasing, Bryce confirmed 2026-07-16 both ends are BUS platforms within the transit center, unrelated to the train's upper/lower rail platforms. Tracked per the universal-inclusion policy (every agency-reported elevator is tracked) but kept out of the core rail chains since it's genuinely not part of the route. Neither individually observed live, both synthetic ids. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 8/10).",
    segments: [
      {
        id: "bus-platform-to-bus-platform",
        label: "Lower bus platform to upper bus platform",
        elevators: [
          { externalId: "C07E04", label: "Pentagon bus-to-bus elevator (WMATA: \"Elevator between the lower bus platform and the upper platform\")" },
          { externalId: "C07E05", label: "Pentagon bus-to-bus elevator (WMATA: \"Elevator between the lower bus platform and the upper platform\")" },
        ],
      },
    ],
  },
  // Huntington (C15, Yellow Line terminus) — excluded by the
  // non-standard-levels gate: 4 named levels (North Mezzanine, Platform,
  // Street/Mezzanine, South Mezzanine). Bryce shared WMATA's own
  // entrance/elevator listing 2026-07-16, which resolves the structure:
  //   - Huntington Ave. Entrance: 1 elevator, mezzanine<->platform.
  //   - South Kings Hwy Entrance: 1 INCLINATOR (an inclined lift, tracked
  //     the same as a vertical elevator here), mezzanine<->platform.
  //     Confirmed by Bryce: reaches the SAME platform as the Huntington
  //     Ave elevator -- a real redundant pair.
  //   - North Kings Hwy Entrance (Garage #1, real C15S01) and North Kings
  //     Hwy Garage (Garage #2, real C15S03): confirmed AUXILIARY/parking
  //     only, not required to reach the platform.
  // Neither the Huntington Ave elevator nor the South Kings Hwy inclinator
  // has ever appeared individually in a live outage (only the 2 garage
  // units have) -- both core-chain members stay synthetic. Approved by
  // Bryce via /liftwatch-station-review 2026-07-16 (confidence 8/10 --
  // structure confirmed directly from WMATA's own entrance listing).
  {
    systemId: SYSTEM,
    stationExternalId: "C15",
    note: "Mezzanine to platform: 2 elevators (one at the Huntington Ave. entrance, one an inclinator at the South Kings Hwy entrance) — either one keeps this route step-free. Only if both are out of service does this station lose step-free access.",
    internalNote: "WMATA's own entrance listing (Bryce, 2026-07-16): Huntington Ave. Entrance has an ordinary elevator, South Kings Hwy Entrance has an inclinator (inclined lift) -- both mezzanine<->platform, confirmed to reach the same platform (real redundant pair). Bryce confirmed the Huntington Ave. mezzanine is at street level -- no separate street<->mezzanine elevator needed there. Neither the mezzanine<->platform elevator nor the inclinator has ever appeared individually in a live outage; both synthetic ids. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 8/10).",
    segments: [
      {
        id: "mezzanine-platform",
        label: "Mezzanine to platform",
        elevators: [
          { externalId: "WMATA-C15_N_ELE1", label: "Huntington elevator (Huntington Ave. entrance, mezzanine to platform) — by the parking lot off Huntington Ave (38.7946865611983, -77.07520784819755), never yet observed live, synthetic id" },
          { externalId: "WMATA-C15_S_ELE2", label: "Huntington inclinator (South Kings Hwy entrance, mezzanine to platform) — never yet observed live, synthetic id" },
        ],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "C15",
    chainLabel: " (North Kings Hwy Entrance)",
    note: "North Kings Hwy entrance to the platform takes two elevators in a row (an elevator, despite being named \"Garage #1,\" up to the mezzanine, then the South Kings Hwy inclinator down to the platform) — both must be working, and neither has a backup. If either is out of service, this route is not step-free.",
    internalNote: "CORRECTED 2026-07-16 (Bryce): \"Garage #1 elevator\" (real, live-observed C15S01) is NOT parking-only -- it's the required street<->mezzanine elevator for the North Kings Hwy Entrance. From that mezzanine, only the South Kings Hwy inclinator (WMATA-C15_S_ELE2) continues to the platform -- NOT the Huntington Ave elevator, confirmed by Bryce. So this is its own entrance-specific chain, not an auxiliary one. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 8/10).",
    segments: [
      { id: "street-mezzanine", label: "North Kings Hwy Entrance to mezzanine", elevators: [{ externalId: "C15S01", label: "Huntington North Kings Hwy Entrance elevator (\"Garage #1\", street to mezzanine) — next to the parking lot off Kings Hwy (38.79255576071115, -77.07582151181714)" }] },
      { id: "mezzanine-platform", label: "Mezzanine to platform (via inclinator)", elevators: [{ externalId: "WMATA-C15_S_ELE2", label: "Huntington inclinator (South Kings Hwy entrance, mezzanine to platform) — never yet observed live, synthetic id" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "C15",
    chainLabel: " (North Kings Hwy Garage)",
    auxiliary: true,
    note: "North Kings Hwy Garage elevator: one elevator, no backup. This is parking-garage access only, not required for ordinary station access.",
    internalNote: "Real, live-observed id C15S03 (\"Garage #2 elevator\"). Confirmed by Bryce 2026-07-16 as auxiliary/parking only. Not assumed redundant with Garage #1 (different named entrance/structure). Human-approved via /liftwatch-station-review 2026-07-16 (confidence 8/10).",
    segments: [
      { id: "garage-mezzanine", label: "Garage to mezzanine", elevators: [{ externalId: "C15S03", label: "Huntington North Kings Hwy Garage elevator (Garage #2)" }] },
    ],
  },
  // L'Enfant Plaza (D03_F03, Green/Yellow + Blue/Orange/Silver
  // interchange) — excluded by the non-standard-levels gate. Bryce
  // confirmed the full layout 2026-07-16: 3 platforms total -- a CENTER
  // island platform for Blue/Orange/Silver, and TWO SIDE platforms for
  // Green/Yellow (one per direction) -- plus WMATA's own 4 elevator
  // descriptions, all real/live-observed, which match the initial reading
  // exactly:
  //   7th St/Maryland Ave./Smithsonian Museums Entrance/VRE trains:
  //     - F03N01: "Elevator between street and mezzanine"
  //     - F03N02: "Elevator between mezzanine and platform to Branch
  //       Ave/Huntington" (one Green/Yellow side platform)
  //     - F03N03: "Elevator between mezzanine and platform to
  //       Greenbelt/Mt. Vernon Sq" (the other Green/Yellow side platform)
  //   9th & D St (L'Enfant Plaza Entrance):
  //     - D03W04: "Elevator between mezzanine/upper platform to Branch
  //       Ave/Huntington and lower platform for Blue/Orange Lines" -- the
  //       ONLY connector down to the center Blue/Orange/Silver platform,
  //       reachable only via the Branch Ave/Huntington side.
  // No redundancy anywhere -- every leg is sole access, and the two
  // Green/Yellow side platforms aren't directly connected to each other.
  // Approved by Bryce via /liftwatch-station-review 2026-07-16 (confidence
  // 9/10 -- all 4 ids real/live-observed, structure confirmed directly).
  {
    systemId: SYSTEM,
    stationExternalId: "D03_F03",
    chainLabel: " (Green/Yellow: Branch Ave/Huntington-bound)",
    note: "Street to the Branch Ave/Huntington-bound Green/Yellow platform takes two elevators in a row (street to mezzanine, then mezzanine to this platform) — both must be working, and neither has a backup. If either elevator is out of service, this route is not step-free.",
    internalNote: "Real, live-observed ids: F03N01 (\"Elevator between street and mezzanine\") + F03N02 (\"Elevator between mezzanine and platform to Branch Ave/Huntington\"). Confirmed by Bryce 2026-07-16 (confidence 9/10).",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine", elevators: [{ externalId: "F03N01", label: "L'Enfant Plaza elevator (street to mezzanine, 7th St/Maryland Ave./Smithsonian Museums Entrance)" }] },
      { id: "mezzanine-platform", label: "Mezzanine to Branch Ave/Huntington-bound platform", elevators: [{ externalId: "F03N02", label: "L'Enfant Plaza elevator (mezzanine to Branch Ave/Huntington-bound platform)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "D03_F03",
    chainLabel: " (Green/Yellow: Greenbelt/Mt Vernon Sq-bound)",
    note: "Street to the Greenbelt/Mt. Vernon Sq-bound Green/Yellow platform takes two elevators in a row (street to mezzanine, then mezzanine to this platform) — both must be working, and neither has a backup. If either elevator is out of service, this route is not step-free.",
    internalNote: "Shares the street<->mezzanine prerequisite (F03N01) with the Branch Ave/Huntington-bound chain. Real, live-observed id F03N03 (\"Elevator between mezzanine and platform to Greenbelt/Mt. Vernon Sq\"), sole access. Confirmed by Bryce 2026-07-16 (confidence 9/10).",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine", elevators: [{ externalId: "F03N01", label: "L'Enfant Plaza elevator (street to mezzanine, 7th St/Maryland Ave./Smithsonian Museums Entrance)" }] },
      { id: "mezzanine-platform", label: "Mezzanine to Greenbelt/Mt. Vernon Sq-bound platform", elevators: [{ externalId: "F03N03", label: "L'Enfant Plaza elevator (mezzanine to Greenbelt/Mt. Vernon Sq-bound platform)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "D03_F03",
    chainLabel: " (Blue/Orange/Silver)",
    note: "Street to the center Blue/Orange/Silver platform takes three elevators in a row (street to mezzanine, mezzanine to the Branch Ave/Huntington-bound Green/Yellow platform, then down to the Blue/Orange/Silver platform) — all three must be working, and none has a backup. If any one of the three is out of service, this route is not step-free.",
    internalNote: "Shares the street<->mezzanine prerequisite (F03N01) and the Branch Ave/Huntington-bound leg (F03N02) with that chain, plus a 3rd leg: the real, live-observed D03W04 (\"Elevator between mezzanine/upper platform to Branch Ave/Huntington and lower platform for Blue/Orange Lines,\" listed under WMATA's \"9th & D St (L'Enfant Plaza Entrance)\" heading) -- the ONLY connector down to the center platform, reachable only via the Branch Ave/Huntington side (the two Green/Yellow side platforms aren't directly connected). Confirmed by Bryce 2026-07-16 (confidence 9/10).",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine", elevators: [{ externalId: "F03N01", label: "L'Enfant Plaza elevator (street to mezzanine, 7th St/Maryland Ave./Smithsonian Museums Entrance)" }] },
      { id: "mezzanine-upper-platform", label: "Mezzanine to Branch Ave/Huntington-bound platform", elevators: [{ externalId: "F03N02", label: "L'Enfant Plaza elevator (mezzanine to Branch Ave/Huntington-bound platform)" }] },
      { id: "upper-lower-platform", label: "Branch Ave/Huntington-bound platform down to Blue/Orange/Silver platform", elevators: [{ externalId: "D03W04", label: "L'Enfant Plaza elevator (Branch Ave/Huntington platform to Blue/Orange/Silver platform, 9th & D St entrance)" }] },
    ],
  },
  // U St (E03, Green/Yellow) — excluded by the non-standard-levels gate:
  // "East/West Mezzanine" combined level name, both GTFS edges suffixed
  // "_W" with nothing for an east side. Bryce confirmed 2026-07-16: just 2
  // elevators total, a straight series with no redundancy -- street to
  // mezzanine (embedded in the building at 38.91682122969772,
  // -77.02897751998267 on U St's south side), then mezzanine to the
  // center (island) platform. No east-side elevator exists. Approved by
  // Bryce via /liftwatch-station-review 2026-07-16 (confidence 9/10 --
  // confirmed directly).
  {
    systemId: SYSTEM,
    stationExternalId: "E03",
    note: "Street to platform takes two elevators in a row (street to mezzanine, then mezzanine to the platform) — both must be working, and neither has a backup. If either elevator is out of service, this route is not step-free.",
    internalNote: "GTFS's 'East/West Mezzanine' combined level name and both edges suffixed '_W' suggested a possible east-side elevator, but Bryce confirmed 2026-07-16 there are only 2 elevators total, no east side. Neither has ever been observed live; both synthetic ids. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 9/10).",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine", elevators: [{ externalId: "E03W01", label: "U St elevator (street to mezzanine) — embedded in the building at 38.91682122969772, -77.02897751998267, U St's south side" }] },
      { id: "mezzanine-platform", label: "Mezzanine to platform", elevators: [{ externalId: "E03W02", label: "U St elevator (mezzanine to center platform)" }] },
    ],
  },
  // Navy Yard-Ballpark (F05, Green Line) — excluded by the
  // non-standard-levels gate: 2 identical GTFS pairs (Street/West
  // Mezzanine<->Mezzanine/Intermediate Passageway, Mezzanine/Intermediate
  // Passageway<->Platform), matching a real, live-observed East/West
  // entrance pair with identical wording on both sides. Bryce confirmed
  // 2026-07-16: both the Navy Yard Entrance (east) and Navy Yard West
  // Entrance routes lead to the SAME platform -- a genuine REDUNDANT PAIR
  // OF 2-IN-SERIES CHAINS, same shape as CTA's Jackson-Red
  // (Adams-Jackson/Jackson-Van Buren). The station is accessible as long
  // as EITHER side's full 2-elevator route is working; encoded as the same
  // 4-clause CNF pattern (Stamford/Jackson-Red paired-segment shape) rather
  // than an approximation. Whether the two sides share one intermediate
  // mezzanine or have separate ones is still unconfirmed (Bryce is
  // checking) but doesn't change this encoding's correctness -- it only
  // asserts (streetE AND platformE) OR (streetW AND platformW), never a
  // cross-side combination. All 4 ids are real, live-observed. Approved by
  // Bryce via /liftwatch-station-review 2026-07-16 (confidence 8/10).
  {
    systemId: SYSTEM,
    stationExternalId: "F05",
    note: "Two independent step-free routes to the platform: the Navy Yard Entrance (street elevator then platform elevator) or the Navy Yard West Entrance (street elevator then platform elevator). The station stays step-free as long as both elevators on at least one of the two routes are working — no single elevator outage removes step-free access.",
    internalNote: "Redundant pair of 2-in-series chains, one per entrance, encoded as a 4-clause CNF (paired-segment / Stamford/Jackson-Red pattern) of (streetE AND platformE) OR (streetW AND platformW). All 4 ids real, live-observed: F05E01/F05E02 (Navy Yard Entrance, street+platform), F05W01/F05W02 (Navy Yard West Entrance, street+platform). Confirmed by Bryce 2026-07-16 both routes lead to the same platform. Bryce confirmed the two mezzanines are NOT connected (does not affect this encoding -- it never assumes a cross-side combination). Human-approved via /liftwatch-station-review 2026-07-16 (confidence 8/10).",
    segments: [
      { id: "cnf-street-street", label: "Step-free guard: a Navy Yard or Navy Yard West STREET elevator", elevators: [
        { externalId: "F05E01", label: "Navy Yard Entrance street-to-mezzanine elevator — northwest corner of M St & New Jersey Ave SE (38.876637543869336, -77.00470868944808)" },
        { externalId: "F05W01", label: "Navy Yard West Entrance street-to-mezzanine elevator — embedded in a building facing the sidewalk on Half St SE, across from the ballpark bullpen (38.876056299972035, -77.00727462190551)" },
      ] },
      { id: "cnf-street-plat", label: "Step-free guard: Navy Yard street or Navy Yard West platform elevator", elevators: [
        { externalId: "F05E01", label: "Navy Yard Entrance street-to-mezzanine elevator — northwest corner of M St & New Jersey Ave SE (38.876637543869336, -77.00470868944808)" },
        { externalId: "F05W02", label: "Navy Yard West Entrance mezzanine-to-platform elevator" },
      ] },
      { id: "cnf-plat-street", label: "Step-free guard: Navy Yard platform or Navy Yard West street elevator", elevators: [
        { externalId: "F05E02", label: "Navy Yard Entrance mezzanine-to-platform elevator" },
        { externalId: "F05W01", label: "Navy Yard West Entrance street-to-mezzanine elevator — embedded in a building facing the sidewalk on Half St SE, across from the ballpark bullpen (38.876056299972035, -77.00727462190551)" },
      ] },
      { id: "cnf-plat-plat", label: "Step-free guard: a Navy Yard or Navy Yard West PLATFORM elevator", elevators: [
        { externalId: "F05E02", label: "Navy Yard Entrance mezzanine-to-platform elevator" },
        { externalId: "F05W02", label: "Navy Yard West Entrance mezzanine-to-platform elevator" },
      ] },
    ],
  },
  // Greenbelt (E10, Green Line terminus) — excluded by the
  // unorderable-levels gate: the one GTFS edge (E10X01) reads
  // "Street/Mezzanine" on both ends, so the generator couldn't tell which
  // direction it goes. Bryce confirmed 2026-07-16: just one elevator,
  // mezzanine to platform, sole access. Approved by Bryce via
  // /liftwatch-station-review 2026-07-16 (confidence 9/10 — confirmed
  // directly).
  {
    systemId: SYSTEM,
    stationExternalId: "E10",
    note: "Mezzanine to platform: one elevator, no backup. If it is out of service, this route is not step-free.",
    internalNote: "GTFS's E10X01 reads 'Street/Mezzanine' on both ends (unorderable-levels gate), but Bryce confirmed 2026-07-16 it's simply one elevator, mezzanine to platform, sole access. Never yet observed live; synthetic placeholder id. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 9/10).",
    segments: [
      { id: "mezzanine-platform", label: "Mezzanine to platform", elevators: [{ externalId: "E10X01", label: "Greenbelt elevator (mezzanine to platform)" }] },
    ],
  },
  // Innovation Center (N09, Silver Line, opened 2022) — excluded by the
  // unorderable-levels gate. Bryce confirmed 2026-07-16: 4 elevators total.
  // 2 are mezzanine<->platform (GTFS only modeled 1 -- another undercount,
  // same shape as Forest Glen/Mt Vernon Sq/Rosslyn), confirmed redundant --
  // shipping this core chain now. The other 2, labeled "South Entry
  // Pavilion" in GTFS (also undercounted -- GTFS lists only 1), have an
  // UNCONFIRMED role -- Bryce doesn't yet know what they connect (a street
  // entrance is the obvious guess, matching WMATA's naming convention
  // elsewhere, but not asserted here). Deliberately left OUT of this model
  // rather than guessed; they remain ordinary un-curated tracked units
  // (assumed redundancy) until their role is confirmed. Approved by Bryce
  // via /liftwatch-station-review 2026-07-16 (confidence 7/10 for the
  // shipped core; the South Entry Pavilion piece is a followup).
  {
    systemId: SYSTEM,
    stationExternalId: "N09",
    note: "Street to mezzanine: step-free even without an elevator — a pedestrian bridge from Innovation Ave, on the north side, needs no elevator at all. The South Entry Pavilion elevators (southwest corner of Sunrise Valley Dr & Carta Way) are a second way in, over a separate pedestrian bridge, but aren't required. Mezzanine to platform: 2 elevators, either one keeps this route step-free. Only if both platform elevators are out of service does this station lose step-free access.",
    internalNote: "GTFS models only 1 mezzanine<->platform elevator but Bryce confirmed 2026-07-16 there are 2, a redundant pair -- same undercount shape as Forest Glen/Mt Vernon Sq/Rosslyn. Neither individually observed live (new station, opened 2022); both synthetic ids. South Entry Pavilion (2 elevators, also undercounted in GTFS -- lists only 1) confirmed by Bryce 2026-07-16 as street elevators: connect a pedestrian bridge crossing the highway directly to the mezzanine, at the SW corner of Sunrise Valley Dr & Carta Way (38.960235044168805, -77.41716048322571). Even with both South elevators down, the station stays reachable via a SEPARATE, elevator-free pedestrian bridge from the mezzanine north across the highway to an entrance on Innovation Ave (38.96210371098253, -77.41685815258685) -- so this leg is stepFreeAlternative regardless of the South elevators' status. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 8/10).",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine",
        stepFreeAlternative: true,
        elevators: [
          { externalId: "N09X03", label: "Innovation Center South Entry Pavilion elevator (pedestrian bridge to mezzanine) — SW corner of Sunrise Valley Dr & Carta Way (38.960235044168805, -77.41716048322571)" },
          { externalId: "N09X04", label: "Innovation Center South Entry Pavilion elevator (pedestrian bridge to mezzanine) — SW corner of Sunrise Valley Dr & Carta Way (38.960235044168805, -77.41716048322571)" },
        ],
      },
      {
        id: "mezzanine-platform",
        label: "Mezzanine to platform",
        elevators: [
          { externalId: "N09X01", label: "Innovation Center elevator (mezzanine to platform)" },
          { externalId: "N09X02", label: "Innovation Center elevator (mezzanine to platform)" },
        ],
      },
    ],
  },
  // Farragut North (A02, Red Line) — excluded by the corrupt-levels gate:
  // GTFS's level_id pointed at another station's levels, and the 2 listed
  // edges (WMATA-A02_S_ELE1/ELE2, both Mezzanine<->Platform) looked like a
  // possible redundant pair but couldn't be trusted. Bryce confirmed
  // 2026-07-16 the real structure is a straight 2-elevator series, no
  // redundancy: street to mezzanine (embedded in a building, east side of
  // Connecticut Ave, between L St and K St NW), then mezzanine to
  // platform. Confirms the corruption flag was pointing at genuinely bad
  // data, not just a naming quirk — GTFS's 2 platform-leg edges don't
  // reflect reality at all. Approved by Bryce via /liftwatch-station-review
  // 2026-07-16 (confidence 9/10 — confirmed directly).
  {
    systemId: SYSTEM,
    stationExternalId: "A02",
    note: "Street to platform takes two elevators in a row (street to mezzanine, then mezzanine to platform) — both must be working, and neither has a backup. If either elevator is out of service, this route is not step-free.",
    internalNote: "GTFS's corrupt level data listed 2 Mezzanine<->Platform edges that looked like a possible redundant pair, but Bryce confirmed 2026-07-16 the real structure is a plain 2-elevator series with no redundancy at all -- the GTFS edges don't reflect reality. Neither elevator has ever been observed live; both synthetic ids. Human-approved via /liftwatch-station-review 2026-07-16 (confidence 9/10).",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine", elevators: [{ externalId: "A02S01", label: "Farragut North elevator (street to mezzanine) — embedded in a building, east side of Connecticut Ave between L St & K St NW (38.90302988015644, -77.03933989074207)" }] },
      { id: "mezzanine-platform", label: "Mezzanine to platform", elevators: [{ externalId: "A02S02", label: "Farragut North elevator (mezzanine to platform)" }] },
    ],
  },
  // ── Grade-separated stations: two entrances on opposite sides of a highway
  // or rail corridor, each with its own street elevator, sharing one
  // mezzanine/concourse→platform elevator. GTFS treats the two street
  // elevators as a redundant street→mezzanine pair, but they are NOT backups
  // for each other: a rider cannot cross between the entrances step-free at
  // street level, so one street elevator failing strands riders on that side.
  // Modeled per-entrance (no cross-redundancy) so a single outage warns
  // correctly; the note discloses that the far entrance is still usable IF the
  // rider can reach the other side. Moved out of the auto-generated tier by
  // CURATED_GRADE_SEPARATED in scripts/wmata-pathways.mts. Audited + approved
  // 2026-07-17 (see wmata-data/COVERAGE-AUDIT.md); confidence 8/10 — geometry
  // confirmed for Spring Hill & McLean via Wikipedia, identical corridor design.
  {
    systemId: SYSTEM,
    stationExternalId: "N01",
    chainLabel: " (south entrance)",
    note: "Reaching the platform from the south entrance takes two elevators in a row — a street-to-mezzanine elevator at this entrance, then a shared mezzanine-to-platform elevator — and neither has a backup. If this entrance's street elevator is out of service, this entrance is not step-free. The station's north-side entrance has its own street elevator, but it is on the far side of Route 123 (Chain Bridge Road) with no step-free way to cross at the station, so it is not a backup for this one — you could still reach the platform through it only if you can get to the other side. If the shared mezzanine-to-platform elevator is out of service, neither entrance is step-free.",
    internalNote: "Per-entrance remodel of a grade-separated station whose GTFS-derived street→mezzanine redundancy is false (the two entrances are across Route 123 (Chain Bridge Road), unreachable from each other step-free at street level). Structure: this entrance's sole street→mezzanine elevator + the shared mezzanine→platform elevator (WMATA-N01_MZ_ELE, repeated in the other entrance's chain). Street elevator never observed live, synthetic id. Audited + human-approved 2026-07-17 via /liftwatch-station-review (see wmata-data/COVERAGE-AUDIT.md); confidence 8/10.",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine (south entrance)", elevators: [{ externalId: "WMATA-N01_S_PAV_ELE", label: "McLean south entrance elevator (street to mezzanine) — never yet observed live, synthetic id" }] },
      { id: "mezzanine-platform", label: "Mezzanine to platform (shared)", elevators: [{ externalId: "WMATA-N01_MZ_ELE", label: "McLean shared elevator (mezzanine to platform) — never yet observed live, synthetic id" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "N01",
    chainLabel: " (north entrance)",
    note: "Reaching the platform from the north entrance takes two elevators in a row — a street-to-mezzanine elevator at this entrance, then a shared mezzanine-to-platform elevator — and neither has a backup. If this entrance's street elevator is out of service, this entrance is not step-free. The station's south-side entrance has its own street elevator, but it is on the far side of Route 123 (Chain Bridge Road) with no step-free way to cross at the station, so it is not a backup for this one — you could still reach the platform through it only if you can get to the other side. If the shared mezzanine-to-platform elevator is out of service, neither entrance is step-free.",
    internalNote: "Per-entrance remodel of a grade-separated station whose GTFS-derived street→mezzanine redundancy is false (the two entrances are across Route 123 (Chain Bridge Road), unreachable from each other step-free at street level). Structure: this entrance's sole street→mezzanine elevator + the shared mezzanine→platform elevator (WMATA-N01_MZ_ELE, repeated in the other entrance's chain). Street elevator id is a real observed UnitName. This entrance's side is inferred by elimination (a median station has exactly two opposite pavilions; the other elevator is the confirmed south pavilion). Audited + human-approved 2026-07-17 via /liftwatch-station-review (see wmata-data/COVERAGE-AUDIT.md); confidence 8/10.",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine (north entrance)", elevators: [{ externalId: "N01X01", label: "McLean north entrance elevator (street to mezzanine)" }] },
      { id: "mezzanine-platform", label: "Mezzanine to platform (shared)", elevators: [{ externalId: "WMATA-N01_MZ_ELE", label: "McLean shared elevator (mezzanine to platform) — never yet observed live, synthetic id" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "N02",
    chainLabel: " (one entrance)",
    note: "Reaching the platform from one entrance takes two elevators in a row — a street-to-mezzanine elevator at this entrance, then a shared mezzanine-to-platform elevator — and neither has a backup. If this entrance's street elevator is out of service, this entrance is not step-free. The station's the other entrance has its own street elevator, but it is on the far side of the highway (Route 123) with no step-free way to cross at the station, so it is not a backup for this one — you could still reach the platform through it only if you can get to the other side. If the shared mezzanine-to-platform elevator is out of service, neither entrance is step-free.",
    internalNote: "Per-entrance remodel of a grade-separated station whose GTFS-derived street→mezzanine redundancy is false (the two entrances are across the highway (Route 123), unreachable from each other step-free at street level). Structure: this entrance's sole street→mezzanine elevator + the shared mezzanine→platform elevator (WMATA-N02_MZ_ELV, repeated in the other entrance's chain). Street elevator id is a real observed UnitName. Audited + human-approved 2026-07-17 via /liftwatch-station-review (see wmata-data/COVERAGE-AUDIT.md); confidence 8/10.",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine (one entrance)", elevators: [{ externalId: "N02X02", label: "Tysons one entrance elevator (street to mezzanine)" }] },
      { id: "mezzanine-platform", label: "Mezzanine to platform (shared)", elevators: [{ externalId: "WMATA-N02_MZ_ELV", label: "Tysons shared elevator (mezzanine to platform) — never yet observed live, synthetic id" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "N02",
    chainLabel: " (the other entrance)",
    note: "Reaching the platform from the other entrance takes two elevators in a row — a street-to-mezzanine elevator at this entrance, then a shared mezzanine-to-platform elevator — and neither has a backup. If this entrance's street elevator is out of service, this entrance is not step-free. The station's one entrance has its own street elevator, but it is on the far side of the highway (Route 123) with no step-free way to cross at the station, so it is not a backup for this one — you could still reach the platform through it only if you can get to the other side. If the shared mezzanine-to-platform elevator is out of service, neither entrance is step-free.",
    internalNote: "Per-entrance remodel of a grade-separated station whose GTFS-derived street→mezzanine redundancy is false (the two entrances are across the highway (Route 123), unreachable from each other step-free at street level). Structure: this entrance's sole street→mezzanine elevator + the shared mezzanine→platform elevator (WMATA-N02_MZ_ELV, repeated in the other entrance's chain). Street elevator id is a real observed UnitName. Audited + human-approved 2026-07-17 via /liftwatch-station-review (see wmata-data/COVERAGE-AUDIT.md); confidence 8/10.",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine (the other entrance)", elevators: [{ externalId: "N02X03", label: "Tysons the other entrance elevator (street to mezzanine)" }] },
      { id: "mezzanine-platform", label: "Mezzanine to platform (shared)", elevators: [{ externalId: "WMATA-N02_MZ_ELV", label: "Tysons shared elevator (mezzanine to platform) — never yet observed live, synthetic id" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "N03",
    chainLabel: " (south entrance)",
    note: "Reaching the platform from the south entrance takes two elevators in a row — a street-to-mezzanine elevator at this entrance, then a shared mezzanine-to-platform elevator — and neither has a backup. If this entrance's street elevator is out of service, this entrance is not step-free. The station's north-side entrance has its own street elevator, but it is on the far side of Route 7 (Leesburg Pike) with no step-free way to cross at the station, so it is not a backup for this one — you could still reach the platform through it only if you can get to the other side. If the shared mezzanine-to-platform elevator is out of service, neither entrance is step-free.",
    internalNote: "Per-entrance remodel of a grade-separated station whose GTFS-derived street→mezzanine redundancy is false (the two entrances are across Route 7 (Leesburg Pike), unreachable from each other step-free at street level). Structure: this entrance's sole street→mezzanine elevator + the shared mezzanine→platform elevator (WMATA-N03_MZ_ELE, repeated in the other entrance's chain). Street elevator never observed live, synthetic id. Audited + human-approved 2026-07-17 via /liftwatch-station-review (see wmata-data/COVERAGE-AUDIT.md); confidence 8/10.",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine (south entrance)", elevators: [{ externalId: "WMATA-N03_S_PAV_ELE", label: "Greensboro south entrance elevator (street to mezzanine) — never yet observed live, synthetic id" }] },
      { id: "mezzanine-platform", label: "Mezzanine to platform (shared)", elevators: [{ externalId: "WMATA-N03_MZ_ELE", label: "Greensboro shared elevator (mezzanine to platform) — never yet observed live, synthetic id" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "N03",
    chainLabel: " (north entrance)",
    note: "Reaching the platform from the north entrance takes two elevators in a row — a street-to-mezzanine elevator at this entrance, then a shared mezzanine-to-platform elevator — and neither has a backup. If this entrance's street elevator is out of service, this entrance is not step-free. The station's south-side entrance has its own street elevator, but it is on the far side of Route 7 (Leesburg Pike) with no step-free way to cross at the station, so it is not a backup for this one — you could still reach the platform through it only if you can get to the other side. If the shared mezzanine-to-platform elevator is out of service, neither entrance is step-free.",
    internalNote: "Per-entrance remodel of a grade-separated station whose GTFS-derived street→mezzanine redundancy is false (the two entrances are across Route 7 (Leesburg Pike), unreachable from each other step-free at street level). Structure: this entrance's sole street→mezzanine elevator + the shared mezzanine→platform elevator (WMATA-N03_MZ_ELE, repeated in the other entrance's chain). Street elevator id is a real observed UnitName. This entrance's side is inferred by elimination (a median station has exactly two opposite pavilions; the other elevator is the confirmed south pavilion). Audited + human-approved 2026-07-17 via /liftwatch-station-review (see wmata-data/COVERAGE-AUDIT.md); confidence 8/10.",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine (north entrance)", elevators: [{ externalId: "N03X02", label: "Greensboro north entrance elevator (street to mezzanine)" }] },
      { id: "mezzanine-platform", label: "Mezzanine to platform (shared)", elevators: [{ externalId: "WMATA-N03_MZ_ELE", label: "Greensboro shared elevator (mezzanine to platform) — never yet observed live, synthetic id" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "N04",
    chainLabel: " (south entrance)",
    note: "Reaching the platform from the south entrance takes two elevators in a row — a street-to-mezzanine elevator at this entrance, then a shared mezzanine-to-platform elevator — and neither has a backup. If this entrance's street elevator is out of service, this entrance is not step-free. The station's north-side entrance has its own street elevator, but it is on the far side of Route 7 (Leesburg Pike) with no step-free way to cross at the station, so it is not a backup for this one — you could still reach the platform through it only if you can get to the other side. If the shared mezzanine-to-platform elevator is out of service, neither entrance is step-free.",
    internalNote: "Per-entrance remodel of a grade-separated station whose GTFS-derived street→mezzanine redundancy is false (the two entrances are across Route 7 (Leesburg Pike), unreachable from each other step-free at street level). Structure: this entrance's sole street→mezzanine elevator + the shared mezzanine→platform elevator (WMATA-N04_MZ_ELV, repeated in the other entrance's chain). Street elevator never observed live, synthetic id. Audited + human-approved 2026-07-17 via /liftwatch-station-review (see wmata-data/COVERAGE-AUDIT.md); confidence 8/10.",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine (south entrance)", elevators: [{ externalId: "WMATA-N04_S_PAV_ELE", label: "Spring Hill south entrance elevator (street to mezzanine) — never yet observed live, synthetic id" }] },
      { id: "mezzanine-platform", label: "Mezzanine to platform (shared)", elevators: [{ externalId: "WMATA-N04_MZ_ELV", label: "Spring Hill shared elevator (mezzanine to platform) — never yet observed live, synthetic id" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "N04",
    chainLabel: " (north entrance)",
    note: "Reaching the platform from the north entrance takes two elevators in a row — a street-to-mezzanine elevator at this entrance, then a shared mezzanine-to-platform elevator — and neither has a backup. If this entrance's street elevator is out of service, this entrance is not step-free. The station's south-side entrance has its own street elevator, but it is on the far side of Route 7 (Leesburg Pike) with no step-free way to cross at the station, so it is not a backup for this one — you could still reach the platform through it only if you can get to the other side. If the shared mezzanine-to-platform elevator is out of service, neither entrance is step-free.",
    internalNote: "Per-entrance remodel of a grade-separated station whose GTFS-derived street→mezzanine redundancy is false (the two entrances are across Route 7 (Leesburg Pike), unreachable from each other step-free at street level). Structure: this entrance's sole street→mezzanine elevator + the shared mezzanine→platform elevator (WMATA-N04_MZ_ELV, repeated in the other entrance's chain). Street elevator never observed live, synthetic id. Audited + human-approved 2026-07-17 via /liftwatch-station-review (see wmata-data/COVERAGE-AUDIT.md); confidence 8/10.",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine (north entrance)", elevators: [{ externalId: "WMATA-N04_N_PAV_EL", label: "Spring Hill north entrance elevator (street to mezzanine) — never yet observed live, synthetic id" }] },
      { id: "mezzanine-platform", label: "Mezzanine to platform (shared)", elevators: [{ externalId: "WMATA-N04_MZ_ELV", label: "Spring Hill shared elevator (mezzanine to platform) — never yet observed live, synthetic id" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "N07",
    chainLabel: " (north entrance)",
    note: "Reaching the platform from the north entrance takes two elevators in a row — a street-to-mezzanine elevator at this entrance, then a shared mezzanine-to-platform elevator — and neither has a backup. If this entrance's street elevator is out of service, this entrance is not step-free. The station's south-side entrance has its own street elevator, but it is on the far side of the Dulles Toll Road corridor with no step-free way to cross at the station, so it is not a backup for this one — you could still reach the platform through it only if you can get to the other side. If the shared mezzanine-to-platform elevator is out of service, neither entrance is step-free.",
    internalNote: "Per-entrance remodel of a grade-separated station whose GTFS-derived street→mezzanine redundancy is false (the two entrances are across the Dulles Toll Road corridor, unreachable from each other step-free at street level). Structure: this entrance's sole street→mezzanine elevator + the shared mezzanine→platform elevator (WMATA-N07_MZ_ELE, repeated in the other entrance's chain). Street elevator never observed live, synthetic id. Audited + human-approved 2026-07-17 via /liftwatch-station-review (see wmata-data/COVERAGE-AUDIT.md); confidence 8/10.",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine (north entrance)", elevators: [{ externalId: "WMATA-N07_N_PAV_ELV", label: "Reston Town Center north entrance elevator (street to mezzanine) — never yet observed live, synthetic id" }] },
      { id: "mezzanine-platform", label: "Mezzanine to platform (shared)", elevators: [{ externalId: "WMATA-N07_MZ_ELE", label: "Reston Town Center shared elevator (mezzanine to platform) — never yet observed live, synthetic id" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "N07",
    chainLabel: " (south entrance)",
    note: "Reaching the platform from the south entrance takes two elevators in a row — a street-to-mezzanine elevator at this entrance, then a shared mezzanine-to-platform elevator — and neither has a backup. If this entrance's street elevator is out of service, this entrance is not step-free. The station's north-side entrance has its own street elevator, but it is on the far side of the Dulles Toll Road corridor with no step-free way to cross at the station, so it is not a backup for this one — you could still reach the platform through it only if you can get to the other side. If the shared mezzanine-to-platform elevator is out of service, neither entrance is step-free.",
    internalNote: "Per-entrance remodel of a grade-separated station whose GTFS-derived street→mezzanine redundancy is false (the two entrances are across the Dulles Toll Road corridor, unreachable from each other step-free at street level). Structure: this entrance's sole street→mezzanine elevator + the shared mezzanine→platform elevator (WMATA-N07_MZ_ELE, repeated in the other entrance's chain). Street elevator never observed live, synthetic id. Audited + human-approved 2026-07-17 via /liftwatch-station-review (see wmata-data/COVERAGE-AUDIT.md); confidence 8/10.",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine (south entrance)", elevators: [{ externalId: "WMATA-N07_S_PAV_ELE", label: "Reston Town Center south entrance elevator (street to mezzanine) — never yet observed live, synthetic id" }] },
      { id: "mezzanine-platform", label: "Mezzanine to platform (shared)", elevators: [{ externalId: "WMATA-N07_MZ_ELE", label: "Reston Town Center shared elevator (mezzanine to platform) — never yet observed live, synthetic id" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "N08",
    chainLabel: " (south entrance)",
    note: "Reaching the platform from the south entrance takes two elevators in a row — a street-to-mezzanine elevator at this entrance, then a shared mezzanine-to-platform elevator — and neither has a backup. If this entrance's street elevator is out of service, this entrance is not step-free. The station's north-side entrance has its own street elevator, but it is on the far side of the Dulles Toll Road corridor with no step-free way to cross at the station, so it is not a backup for this one — you could still reach the platform through it only if you can get to the other side. If the shared mezzanine-to-platform elevator is out of service, neither entrance is step-free.",
    internalNote: "Per-entrance remodel of a grade-separated station whose GTFS-derived street→mezzanine redundancy is false (the two entrances are across the Dulles Toll Road corridor, unreachable from each other step-free at street level). Structure: this entrance's sole street→mezzanine elevator + the shared mezzanine→platform elevator (WMATA-N08_MZ_ELV, repeated in the other entrance's chain). Street elevator never observed live, synthetic id. Audited + human-approved 2026-07-17 via /liftwatch-station-review (see wmata-data/COVERAGE-AUDIT.md); confidence 8/10.",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine (south entrance)", elevators: [{ externalId: "WMATA-N08_S_PAV_ELV", label: "Herndon south entrance elevator (street to mezzanine) — never yet observed live, synthetic id" }] },
      { id: "mezzanine-platform", label: "Mezzanine to platform (shared)", elevators: [{ externalId: "WMATA-N08_MZ_ELV", label: "Herndon shared elevator (mezzanine to platform) — never yet observed live, synthetic id" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "N08",
    chainLabel: " (north entrance)",
    note: "Reaching the platform from the north entrance takes two elevators in a row — a street-to-mezzanine elevator at this entrance, then a shared mezzanine-to-platform elevator — and neither has a backup. If this entrance's street elevator is out of service, this entrance is not step-free. The station's south-side entrance has its own street elevator, but it is on the far side of the Dulles Toll Road corridor with no step-free way to cross at the station, so it is not a backup for this one — you could still reach the platform through it only if you can get to the other side. If the shared mezzanine-to-platform elevator is out of service, neither entrance is step-free.",
    internalNote: "Per-entrance remodel of a grade-separated station whose GTFS-derived street→mezzanine redundancy is false (the two entrances are across the Dulles Toll Road corridor, unreachable from each other step-free at street level). Structure: this entrance's sole street→mezzanine elevator + the shared mezzanine→platform elevator (WMATA-N08_MZ_ELV, repeated in the other entrance's chain). Street elevator never observed live, synthetic id. Audited + human-approved 2026-07-17 via /liftwatch-station-review (see wmata-data/COVERAGE-AUDIT.md); confidence 8/10.",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine (north entrance)", elevators: [{ externalId: "WMATA-N08_N_PAV_ELV", label: "Herndon north entrance elevator (street to mezzanine) — never yet observed live, synthetic id" }] },
      { id: "mezzanine-platform", label: "Mezzanine to platform (shared)", elevators: [{ externalId: "WMATA-N08_MZ_ELV", label: "Herndon shared elevator (mezzanine to platform) — never yet observed live, synthetic id" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "N12",
    chainLabel: " (south entrance)",
    note: "Reaching the platform from the south entrance takes two elevators in a row — a street-to-mezzanine elevator at this entrance, then a shared mezzanine-to-platform elevator — and neither has a backup. If this entrance's street elevator is out of service, this entrance is not step-free. The station's north-side entrance has its own street elevator, but it is on the far side of the Dulles Greenway corridor with no step-free way to cross at the station, so it is not a backup for this one — you could still reach the platform through it only if you can get to the other side. If the shared mezzanine-to-platform elevator is out of service, neither entrance is step-free.",
    internalNote: "Per-entrance remodel of a grade-separated station whose GTFS-derived street→mezzanine redundancy is false (the two entrances are across the Dulles Greenway corridor, unreachable from each other step-free at street level). Structure: this entrance's sole street→mezzanine elevator + the shared mezzanine→platform elevator (WMATA-N12_MZ_ELV, repeated in the other entrance's chain). Street elevator never observed live, synthetic id. Audited + human-approved 2026-07-17 via /liftwatch-station-review (see wmata-data/COVERAGE-AUDIT.md); confidence 8/10.",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine (south entrance)", elevators: [{ externalId: "WMATA-N12_S_PAV_ELV", label: "Ashburn south entrance elevator (street to mezzanine) — never yet observed live, synthetic id" }] },
      { id: "mezzanine-platform", label: "Mezzanine to platform (shared)", elevators: [{ externalId: "WMATA-N12_MZ_ELV", label: "Ashburn shared elevator (mezzanine to platform) — never yet observed live, synthetic id" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "N12",
    chainLabel: " (north entrance)",
    note: "Reaching the platform from the north entrance takes two elevators in a row — a street-to-mezzanine elevator at this entrance, then a shared mezzanine-to-platform elevator — and neither has a backup. If this entrance's street elevator is out of service, this entrance is not step-free. The station's south-side entrance has its own street elevator, but it is on the far side of the Dulles Greenway corridor with no step-free way to cross at the station, so it is not a backup for this one — you could still reach the platform through it only if you can get to the other side. If the shared mezzanine-to-platform elevator is out of service, neither entrance is step-free.",
    internalNote: "Per-entrance remodel of a grade-separated station whose GTFS-derived street→mezzanine redundancy is false (the two entrances are across the Dulles Greenway corridor, unreachable from each other step-free at street level). Structure: this entrance's sole street→mezzanine elevator + the shared mezzanine→platform elevator (WMATA-N12_MZ_ELV, repeated in the other entrance's chain). Street elevator never observed live, synthetic id. Audited + human-approved 2026-07-17 via /liftwatch-station-review (see wmata-data/COVERAGE-AUDIT.md); confidence 8/10.",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine (north entrance)", elevators: [{ externalId: "WMATA-N12_N_PAV_ELV", label: "Ashburn north entrance elevator (street to mezzanine) — never yet observed live, synthetic id" }] },
      { id: "mezzanine-platform", label: "Mezzanine to platform (shared)", elevators: [{ externalId: "WMATA-N12_MZ_ELV", label: "Ashburn shared elevator (mezzanine to platform) — never yet observed live, synthetic id" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "E09",
    chainLabel: " (east entrance)",
    note: "Reaching the platform from the east entrance takes two elevators in a row — a street-to-mezzanine elevator at this entrance, then a shared mezzanine-to-platform elevator — and neither has a backup. If this entrance's street elevator is out of service, this entrance is not step-free. The station's west-side entrance has its own street elevator, but it is on the far side of the railroad tracks with no step-free way to cross at the station, so it is not a backup for this one — you could still reach the platform through it only if you can get to the other side. If the shared mezzanine-to-platform elevator is out of service, neither entrance is step-free.",
    internalNote: "Per-entrance remodel of a grade-separated station whose GTFS-derived street→mezzanine redundancy is false (the two entrances are across the railroad tracks, unreachable from each other step-free at street level). Structure: this entrance's sole street→mezzanine elevator + the shared mezzanine→platform elevator (E09X03, repeated in the other entrance's chain). Street elevator never observed live, synthetic id. Audited + human-approved 2026-07-17 via /liftwatch-station-review (see wmata-data/COVERAGE-AUDIT.md); confidence 8/10.",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine (east entrance)", elevators: [{ externalId: "E09X02", label: "College Park-U of Md east entrance elevator (street to mezzanine)" }] },
      { id: "mezzanine-platform", label: "Mezzanine to platform (shared)", elevators: [{ externalId: "E09X03", label: "College Park-U of Md shared elevator (mezzanine to platform)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "E09",
    chainLabel: " (west entrance)",
    note: "Reaching the platform from the west entrance takes two elevators in a row — a street-to-mezzanine elevator at this entrance, then a shared mezzanine-to-platform elevator — and neither has a backup. If this entrance's street elevator is out of service, this entrance is not step-free. The station's east-side entrance has its own street elevator, but it is on the far side of the railroad tracks with no step-free way to cross at the station, so it is not a backup for this one — you could still reach the platform through it only if you can get to the other side. If the shared mezzanine-to-platform elevator is out of service, neither entrance is step-free.",
    internalNote: "Per-entrance remodel of a grade-separated station whose GTFS-derived street→mezzanine redundancy is false (the two entrances are across the railroad tracks, unreachable from each other step-free at street level). Structure: this entrance's sole street→mezzanine elevator + the shared mezzanine→platform elevator (E09X03, repeated in the other entrance's chain). Street elevator never observed live, synthetic id. Audited + human-approved 2026-07-17 via /liftwatch-station-review (see wmata-data/COVERAGE-AUDIT.md); confidence 8/10.",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine (west entrance)", elevators: [{ externalId: "E09X01", label: "College Park-U of Md west entrance elevator (street to mezzanine)" }] },
      { id: "mezzanine-platform", label: "Mezzanine to platform (shared)", elevators: [{ externalId: "E09X03", label: "College Park-U of Md shared elevator (mezzanine to platform)" }] },
    ],
  },
  // ——— 2026-07-17 auto-tier audit fixes (page-inventory undercounts) ———
  // Four stations where WMATA's own Rider Tools station-page inventory
  // (wmata-data/rider-tools-inventory.json) shows MORE in-station elevators
  // than GTFS drew — the Forest Glen/Rosslyn undercount class, caught from
  // WMATA's page instead of live observation. All ids are REAL page-published
  // UnitNames. All four verified single-mezzanine (no A08 split-mezzanine
  // risk). Excluded from the generator via CURATED_PAGE_UNDERCOUNT; approved
  // by Bryce via /liftwatch-wmata-spot-check 2026-07-17 (see spot-check-log.md).

  // Wiehle-Reston East (N06, Silver Line) — GTFS drew 1+1; WMATA's page shows
  // 2×2: N06X01+N06X02 both "Elevator - south entry pavilion" (street→mezz
  // pair) and N06X03+N06X04 both mezzanine→platform. ONE south pavilion (the
  // station's single entrance side), so one mezzanine — genuine 2×2, unlike
  // A08. Confidence 8/10 (WMATA's own inventory, identical wording per pair).
  {
    systemId: SYSTEM,
    stationExternalId: "N06",
    note: "Two elevators connect the street (south entry pavilion) to the mezzanine — either one keeps this leg open. Two elevators connect the mezzanine to the platform — either one keeps this leg open. No single elevator outage removes step-free access.",
    internalNote: "2026-07-17 auto-tier audit fix (page-inventory undercount): GTFS drew 1+1 (N06X02 street, N06X04 platform, both live-observed); WMATA's Rider Tools page shows 4 in-station elevators — N06X01/N06X02 both 'Elevator - south entry pavilion', N06X03/N06X04 both mezzanine→platform. Single south entry pavilion → one mezzanine → genuine 2×2 redundancy. All 4 ids real (page-published; X02/X04 also live-observed). Source: wmata-data/rider-tools-inventory.json. Approved via /liftwatch-wmata-spot-check 2026-07-17 (confidence 8/10).",
    segments: [
      { id: "street-mezzanine", label: "Street (south entry pavilion) to mezzanine", elevators: [
        { externalId: "N06X01", label: "Wiehle-Reston East elevator N06X01 — south entry pavilion, street to mezzanine" },
        { externalId: "N06X02", label: "Wiehle-Reston East elevator N06X02 — south entry pavilion, street to mezzanine" },
      ] },
      { id: "mezzanine-platform", label: "Mezzanine to platform", elevators: [
        { externalId: "N06X03", label: "Wiehle-Reston East elevator N06X03 — mezzanine to platform" },
        { externalId: "N06X04", label: "Wiehle-Reston East elevator N06X04 — mezzanine to platform" },
      ] },
    ],
  },
  // Loudoun Gateway (N11, Silver Line) — same shape as N06: GTFS drew 1+1;
  // WMATA's page shows N11X03+N11X04 both "Elevator - north entry pavilion"
  // (street→mezz pair) and N11X01+N11X02 both mezzanine→platform. ONE north
  // pavilion → one mezzanine → genuine 2×2. Confidence 8/10.
  {
    systemId: SYSTEM,
    stationExternalId: "N11",
    note: "Two elevators connect the street (north entry pavilion) to the mezzanine — either one keeps this leg open. Two elevators connect the mezzanine to the platform — either one keeps this leg open. No single elevator outage removes step-free access.",
    internalNote: "2026-07-17 auto-tier audit fix (page-inventory undercount): GTFS drew 1+1 (both synthetic); WMATA's Rider Tools page shows 4 in-station elevators — N11X03/N11X04 both 'Elevator - north entry pavilion', N11X01/N11X02 both mezzanine→platform. Single north entry pavilion → one mezzanine → genuine 2×2 redundancy. All 4 ids real (page-published), replacing the synthetics WMATA-N11_N_PAV_ELV / WMATA-N11_MZ_ELV. Source: wmata-data/rider-tools-inventory.json. Approved via /liftwatch-wmata-spot-check 2026-07-17 (confidence 8/10).",
    segments: [
      { id: "street-mezzanine", label: "Street (north entry pavilion) to mezzanine", elevators: [
        { externalId: "N11X03", label: "Loudoun Gateway elevator N11X03 — north entry pavilion, street to mezzanine" },
        { externalId: "N11X04", label: "Loudoun Gateway elevator N11X04 — north entry pavilion, street to mezzanine" },
      ] },
      { id: "mezzanine-platform", label: "Mezzanine to platform", elevators: [
        { externalId: "N11X01", label: "Loudoun Gateway elevator N11X01 — mezzanine to platform" },
        { externalId: "N11X02", label: "Loudoun Gateway elevator N11X02 — mezzanine to platform" },
      ] },
    ],
  },
  // Washington Dulles International Airport (N10, Silver Line) — GTFS drew a
  // 2-elevator mezzanine→platform pair; WMATA's page shows a FOUR-elevator
  // bank (N10X01..N10X04, identical wording, one airport entrance at
  // mezzanine level — no street leg, same as the prior model's assumption).
  // Redundancy direction unchanged (was already redundant); this corrects the
  // elevator count and replaces synthetics with real ids. Confidence 8/10.
  {
    systemId: SYSTEM,
    stationExternalId: "N10",
    note: "Four elevators connect the mezzanine to the platform — any one of them keeps the station step-free. The station is entered from the airport at mezzanine level, so no street elevator is needed. No single elevator outage removes step-free access.",
    internalNote: "2026-07-17 auto-tier audit fix (page-inventory undercount): GTFS drew this mezzanine→platform bank as 2 elevators (both synthetic); WMATA's Rider Tools page shows 4 with identical wording (N10X01..N10X04), one 'Washington Dulles International Airport' entrance group. Replaces synthetics WMATA-N10_MZ_ELV1/2. Source: wmata-data/rider-tools-inventory.json. Approved via /liftwatch-wmata-spot-check 2026-07-17 (confidence 8/10).",
    segments: [
      { id: "mezzanine-platform", label: "Mezzanine to platform", elevators: [
        { externalId: "N10X01", label: "Washington Dulles International Airport elevator N10X01 — mezzanine to platform" },
        { externalId: "N10X02", label: "Washington Dulles International Airport elevator N10X02 — mezzanine to platform" },
        { externalId: "N10X03", label: "Washington Dulles International Airport elevator N10X03 — mezzanine to platform" },
        { externalId: "N10X04", label: "Washington Dulles International Airport elevator N10X04 — mezzanine to platform" },
      ] },
    ],
  },
  // Anacostia (F06, Green Line) — the 2026-07-17 audit found the two platform
  // elevators sit under DIFFERENT named entrances (F06S01 Howard Road, F06N01
  // Kiss & Ride). Bryce confirmed same day: the two mezzanines are NOT
  // connected inside fare control, but a rider CAN walk between the two
  // entrances step-free at street level (~0.3 mi). Under the step-free detour
  // policy (2026-07-10: an elevator-free detour of at most 0.3 mi counts as a
  // step-free alternative, and the walk MUST be disclosed to riders), the two
  // elevators stay mutually redundant — either keeps the station step-free —
  // so the generated redundant-pair structure is correct. But the generated
  // note wrongly implied one connected mezzanine and hid the walk, so this is
  // curated to disclose it. Both mezzanines are at street grade (no
  // street→mezzanine elevator). Contrast the grade-separated stations
  // (E09/Silver Line median), where no step-free crossing exists → genuinely
  // NOT redundant. Confidence 8/10 (Bryce + WMATA page ids + policy).
  {
    systemId: SYSTEM,
    stationExternalId: "F06",
    note: "The station has two street-level entrances — Howard Road and Kiss & Ride — each with its own elevator up to the platform, and the two are not connected past fare control. Either elevator keeps the station step-free: if one is out of service, you can reach the other entrance by a step-free walk of about 0.3 miles at street level. Only if both elevators are out is the station not step-free.",
    internalNote: "2026-07-17 auto-tier audit: the generator drew a redundant mezzanine→platform pair (synthetics WMATA-F06_MZ_ELE_S / WMATA-F06_MZ_ELV_N) assuming one connected mezzanine. WMATA's Rider Tools page shows the pair split across two entrances — F06S01 (Howard Road), F06N01 (Kiss & Ride) — and Bryce confirmed 2026-07-17 the mezzanines are NOT connected but the entrances are mutually reachable step-free (~0.3 mi surface walk). Redundancy preserved under the step-free detour policy (≤0.3 mi, 2026-07-10); the walk is disclosed in the public note as the policy requires. Both mezzanines at street grade (single OR segment, no street leg). Real page ids replace the synthetics. Source: wmata-data/rider-tools-inventory.json. Approved via /liftwatch-wmata-spot-check 2026-07-17 (confidence 8/10).",
    segments: [
      { id: "street-mezzanine-platform", label: "Street-level mezzanine to platform (either entrance)", elevators: [
        { externalId: "F06S01", label: "Anacostia elevator F06S01 — Howard Road entrance, street-level mezzanine to platform" },
        { externalId: "F06N01", label: "Anacostia elevator F06N01 — Kiss & Ride entrance, street-level mezzanine to platform" },
      ] },
    ],
  },
  // Glenmont (B11, Red Line terminus) — the standing open item from the
  // 2026-07-17 coverage audit (§3a "milder" bucket): two street elevators
  // flank Georgia Ave (Rte 97), a signalized SURFACE road. Bryce resolved
  // 2026-07-17: the two entrances ARE mutually reachable at grade, so the
  // street pair is genuinely REDUNDANT (contrast the grade-separated Silver
  // Line median / College Park, where a highway or rail corridor makes the
  // crossing impossible → not redundant). WMATA's page confirms one mezzanine
  // → platform elevator (B11X03), so both street elevators feed a single
  // mezzanine. Real page ids + locations: B11X01 east side at the bus bay/
  // Kiss & Ride, B11X02 west side at the Kiss & Ride (promoted from synthetic
  // WMATA-B11_W_ELE). Structure matches the generated model; curated to carry
  // the real west id, the locations, and a note disclosing the Georgia Ave
  // crossing. Confidence 8/10 (Bryce-confirmed + WMATA page ids).
  {
    systemId: SYSTEM,
    stationExternalId: "B11",
    note: "Two elevators connect the street to the mezzanine — one on each side of Georgia Avenue (the east side at the bus bay/Kiss & Ride, the west side at the Kiss & Ride) — and either one reaches the mezzanine. If one is out of service, you can cross Georgia Avenue at street level and use the other, so no single street-elevator outage removes step-free access. One elevator connects the mezzanine to the platform, and it has no backup — if it is out of service, the station is not step-free.",
    internalNote: "2026-07-17: standing coverage-audit open item resolved. Bryce confirmed the two street entrances flanking Georgia Ave (Rte 97) are mutually reachable at grade → the street→mezzanine pair is genuinely redundant (the milder counterpart to the grade-separated stations, where a highway/rail corridor blocks the crossing). Real page ids: B11X01 (east side at bus bay/Kiss & Ride, live-observed), B11X02 (west side at Kiss & Ride — promoted from synthetic WMATA-B11_W_ELE), B11X03 (sole mezzanine→platform, live-observed). WMATA's Rider Tools page lists one mezz→platform elevator, so both street elevators feed a single mezzanine. Five garage elevators (B11X04..B11X08) stay tracked units, not chain members. Source: wmata-data/rider-tools-inventory.json. Approved via /liftwatch-wmata-spot-check 2026-07-17 (confidence 8/10).",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine (either side of Georgia Ave)", elevators: [
        { externalId: "B11X01", label: "Glenmont elevator B11X01 — street to mezzanine, east side of the station at the bus bay/Kiss & Ride" },
        { externalId: "B11X02", label: "Glenmont elevator B11X02 — street to mezzanine, west side of the station at the Kiss & Ride" },
      ] },
      { id: "mezzanine-platform", label: "Mezzanine to platform", elevators: [
        { externalId: "B11X03", label: "Glenmont elevator B11X03 — mezzanine to platform (inside fare control)" },
      ] },
    ],
  },
  // Wheaton (B10, Red Line) — the 2026-07-17 audit flagged that WMATA's page
  // lists NO in-station street→mezzanine elevator (only B10X01 mezz→platform +
  // four "garage"), yet GTFS drew a street→mezz elevator (synthetic
  // WMATA-B10_E_ELE). Bryce resolved 2026-07-17: the station has TWO entrances,
  // both reaching one at-grade mezzanine, so the street→mezz leg needs no
  // elevator (§3C mezzanine-at-grade, like Rockville/Downtown Largo):
  //   (1) Bus-bay entrance at the SW corner of Reedie Dr & Georgia Ave
  //       (39.03828350424475, -77.05108585814365) — at-grade mezzanine; from
  //       Georgia Ave you go DOWN A RAMP (step-free, no elevator).
  //   (2) Kiss & Ride / Park & Garage entrance facing Reedie Dr
  //       (39.03866500402913, -77.05029943969589) — TWO of the four "garage"
  //       elevators are actually this entrance's access (reverse-Huntington;
  //       which two of B10X02..B10X05, and the other two's locations, unknown).
  // The single mezzanine→platform elevator B10X01 is the only elevator that
  // gates step-free access. The Georgia Ave ramp keeps the street→mezz leg
  // step-free regardless of any elevator, so that leg is omitted (§3C) and the
  // garage-side entrance elevators are additive (never gate). Excluded from the
  // generator via CURATED_MEZZANINE_AT_GRADE; the phantom synthetic
  // WMATA-B10_E_ELE is dropped. Confidence 8/10 (Bryce + WMATA page + coords).
  {
    systemId: SYSTEM,
    stationExternalId: "B10",
    note: "The mezzanine is at street level and reached step-free without an elevator: from the bus-bay entrance at Reedie Drive and Georgia Avenue you go down a ramp, and there is a second entrance from the Kiss & Ride/parking garage. One elevator connects the mezzanine to the platform — it has no backup, so if it is out of service the station is not step-free.",
    internalNote: "2026-07-17 auto-tier audit fix (mezzanine-at-grade): WMATA's Rider Tools page lists no in-station street→mezzanine elevator — only B10X01 (mezzanine→platform) plus four 'garage' elevators (B10X02..B10X05) — but GTFS drew a phantom street→mezz elevator (synthetic WMATA-B10_E_ELE), now dropped. Bryce confirmed 2026-07-17 two entrances to one at-grade mezzanine: (1) bus-bay entrance at the SW corner of Reedie Dr & Georgia Ave (39.03828350424475, -77.05108585814365), reached step-free from Georgia Ave by a RAMP (no elevator); (2) Kiss & Ride/parking garage entrance facing Reedie Dr (39.03866500402913, -77.05029943969589), where TWO of the four 'garage' elevators are actually this entrance's access (which two of B10X02..B10X05 — and the other two's locations — unknown; reverse-Huntington). The ramp keeps the street→mezz leg step-free regardless of elevators, so it is omitted (§3C); B10X01 is the sole gating elevator (real, page-published). Garage-side entrance elevators stay tracked units, not chain members. Source: wmata-data/rider-tools-inventory.json + Bryce coords. Approved via /liftwatch-wmata-spot-check 2026-07-17 (confidence 8/10).",
    segments: [
      { id: "mezzanine-platform", label: "Mezzanine to platform", elevators: [
        { externalId: "B10X01", label: "Wheaton elevator B10X01 — mezzanine to platform (inside fare control)" },
      ] },
    ],
  },
  // King St-Old Town (C13, Blue/Yellow) — the 2026-07-17 audit found WMATA's
  // page lists a THIRD mezzanine→platform elevator (C13S01) beyond the
  // live-validated N-pair the generator modeled. Bryce resolved it same day:
  // the mezzanine is AT STREET LEVEL (no street elevator leg anywhere), and
  // C13S01 is a separate STANDALONE platform→mezzanine elevator slightly
  // south of King Street. All three land on the same single island platform
  // and everything street-side is at grade, so ANY one of the three keeps the
  // station step-free — one 3-way OR segment, full redundancy. All three
  // elevators are inside fare control (paid side), so per Bryce no street
  // coordinates are needed for them. Confidence 9/10 (Bryce + WMATA's own
  // page + the earlier live-validated C13N01→C13N02 reduction).
  {
    systemId: SYSTEM,
    stationExternalId: "C13",
    note: "The mezzanine is at street level, so no elevator is needed between the street and the mezzanine. Three elevators connect the mezzanine to the platform — a pair at the north end and a standalone elevator slightly south of King Street. Any one of them keeps the station step-free; no single elevator outage removes step-free access.",
    internalNote: "2026-07-17 auto-tier audit fix (page-inventory undercount): the generator modeled only the N-pair (C13N01/C13N02, live-validated redundant — C13N01 out correctly reduced via C13N02); WMATA's Rider Tools page lists a third identical mezzanine→platform elevator C13S01. Bryce confirmed 2026-07-17: standalone platform→mezzanine elevator slightly south of King Street; the mezzanine is at street grade; all three elevators are after fare control (paid side — no street coordinates needed per Bryce). Single island platform + everything street-side at grade → one 3-way OR segment. All 3 ids real (N-pair live-observed, S01 page-published). Source: wmata-data/rider-tools-inventory.json. Approved via /liftwatch-wmata-spot-check 2026-07-17 (confidence 9/10).",
    segments: [
      { id: "street-mezzanine-platform", label: "Street-level mezzanine to platform", elevators: [
        { externalId: "C13N01", label: "King St-Old Town elevator C13N01 — street-level mezzanine to platform (north pair, inside fare control)" },
        { externalId: "C13N02", label: "King St-Old Town elevator C13N02 — street-level mezzanine to platform (north pair, inside fare control)" },
        { externalId: "C13S01", label: "King St-Old Town elevator C13S01 — standalone, street-level mezzanine to platform, slightly south of King Street (inside fare control)" },
      ] },
    ],
  },
  // Federal Triangle (D01, Orange/Blue/Silver) — GTFS drew 1+1; WMATA's page
  // shows the mezzanine→platform leg is a REDUNDANT PAIR (D01X02 + D01X03,
  // identical wording) behind the sole street elevator D01X01. The street
  // elevator remains sole-access, so a D01X01 outage still severs the station
  // — only the platform leg gains a backup. Confidence 8/10.
  {
    systemId: SYSTEM,
    stationExternalId: "D01",
    note: "One elevator connects the street to the mezzanine — it has no backup, and if it is out of service the station has no step-free route. Two elevators connect the mezzanine to the platform — either one keeps that leg open.",
    internalNote: "2026-07-17 auto-tier audit fix (page-inventory undercount): GTFS drew 1+1 (D01X01/D01X02, both live-observed); WMATA's Rider Tools page adds D01X03 as a second mezzanine→platform elevator with identical wording — a real redundant pair. Street leg unchanged (D01X01 sole access). Source: wmata-data/rider-tools-inventory.json. Approved via /liftwatch-wmata-spot-check 2026-07-17 (confidence 8/10).",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine", elevators: [
        { externalId: "D01X01", label: "Federal Triangle elevator D01X01 — street to mezzanine" },
      ] },
      { id: "mezzanine-platform", label: "Mezzanine to platform", elevators: [
        { externalId: "D01X02", label: "Federal Triangle elevator D01X02 — mezzanine to platform" },
        { externalId: "D01X03", label: "Federal Triangle elevator D01X03 — mezzanine to platform" },
      ] },
    ],
  },
];
