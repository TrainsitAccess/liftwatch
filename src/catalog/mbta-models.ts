// HAND-CURATED MBTA station models — the curated tier the auto-generator
// (scripts/mbta-chains.mts) deliberately can't produce. These stations sit in
// mbta-data/chains-excluded.json because the generator's landing classifier
// couldn't parse their location text, NOT because their structure is unclear.
//
// The signal used here is MBTA's own per-elevator `alternate-service-text`
// (the same in-feed rider guidance the generator validates against): a mutual,
// SAME-STATION "please use nearby Elevator X" pair is MBTA confirming those two
// elevators back each other up. Only stations whose reciprocal pairs also cover
// the COMPLETE street↔platform path are modeled here — never a station where a
// pair covers just one leg (e.g. Lynn's street↔garage pair leaves the platform
// unaccounted for), which would falsely claim accessibility (over-warn, never
// under-warn). Those, plus the tangled multi-line interchanges (South Station,
// North Station, State, …), await a per-station review pass with Bryce.
//
// Curated models must NOT overlap the generated set — a station is in one tier
// or the other. `check:mbta-chains` asserts no station id appears in both.

import type { StationModel } from "../lib/accessibility.js";

const SYSTEM = "mbta-boston";

export const MBTA_STATION_MODELS: StationModel[] = [
  // Government Center — Green Line at street level; the Blue Line platform sits
  // one level below, reached only by continuing down from the Green Line
  // platform. Two independent destinations (a Blue-pair outage doesn't sever the
  // Green Line), so two per-line chains sharing the street→Green prerequisite.
  {
    systemId: SYSTEM,
    stationExternalId: "place-gover",
    chainLabel: " (Green Line)",
    note: "Street ⇄ Green Line platform via Elevators 720/721 (each backs the other, per MBTA guidance).",
    segments: [
      { id: "street-green", label: "Street to Green Line platform", elevators: [{ externalId: "720", label: "Elevator 720 (Green Line platform to street)" }, { externalId: "721", label: "Elevator 721 (Green Line platform to street)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "place-gover",
    chainLabel: " (Blue Line)",
    note: "Street → Green Line platform (720/721) → Blue Line platform (722/723); every leg is a same-station redundant pair per MBTA guidance.",
    segments: [
      { id: "street-green", label: "Street to Green Line platform", elevators: [{ externalId: "720", label: "Elevator 720 (Green Line platform to street)" }, { externalId: "721", label: "Elevator 721 (Green Line platform to street)" }] },
      { id: "green-blue", label: "Green Line platform to Blue Line platform", elevators: [{ externalId: "722", label: "Elevator 722 (Blue Line platform to Green Line platform)" }, { externalId: "723", label: "Elevator 723 (Blue Line platform to Green Line platform)" }] },
    ],
  },

  // Alewife — a straight two-leg chain: platform → main lobby (813/961) →
  // street & parking garage (814/815). Both legs are same-station redundant
  // pairs; the station's four elevators are exactly these two pairs.
  {
    systemId: SYSTEM,
    stationExternalId: "place-alfcl",
    note: "Platform → main lobby (813/961) → street & garage (814/815); both legs are redundant pairs per MBTA guidance.",
    segments: [
      { id: "platform-lobby", label: "Platform to main lobby", elevators: [{ externalId: "813", label: "Elevator 813 (Platform to main lobby)" }, { externalId: "961", label: "Elevator 961 (Platform to main lobby)" }] },
      { id: "lobby-street", label: "Main lobby to street & parking garage", elevators: [{ externalId: "814", label: "Elevator 814 (Main lobby to street, parking garage)" }, { externalId: "815", label: "Elevator 815 (Main lobby to street, parking garage)" }] },
    ],
  },

  // Maverick — single step-free leg, platform ⇄ Maverick Square / busway, served
  // by a redundant pair (965/966). No other elevator legs at the station.
  {
    systemId: SYSTEM,
    stationExternalId: "place-mvbcl",
    note: "Platform ⇄ Maverick Square & busway via Elevators 965/966 (each backs the other, per MBTA guidance).",
    segments: [
      { id: "platform-street", label: "Platform to Maverick Square & busway", elevators: [{ externalId: "965", label: "Elevator 965 (Platform to Maverick Square, busway)" }, { externalId: "966", label: "Elevator 966 (Platform to Maverick Square, busway)" }] },
    ],
  },

  // Gilman Square (GLX) — single step-free leg, platform ⇄ Medford Street lobby,
  // served by a redundant pair (765/766).
  {
    systemId: SYSTEM,
    stationExternalId: "place-gilmn",
    note: "Platform ⇄ Medford Street lobby via Elevators 765/766 (each backs the other, per MBTA guidance).",
    segments: [
      { id: "platform-lobby", label: "Platform to Medford Street lobby", elevators: [{ externalId: "765", label: "Elevator 765 (Platform to Medford Street lobby)" }, { externalId: "766", label: "Elevator 766 (Platform to Medford Street lobby)" }] },
    ],
  },
];
