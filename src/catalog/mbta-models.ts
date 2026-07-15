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

  // Orient Heights (Blue Line, elevated) — each side platform reaches the paid
  // pedestrian bridge (the exit) via its own redundant pair. The bridge→street
  // leg has NO listed elevator, and MBTA marks the station accessible, so that
  // leg is step-free without an elevator (ramp/level) — the pairs are the only
  // elevator legs. Two independent per-direction chains (one platform's outage
  // never severs the other).
  {
    systemId: SYSTEM,
    stationExternalId: "place-orhte",
    chainLabel: " (Bowdoin-bound platform)",
    note: "Bowdoin-bound platform ⇄ paid pedestrian bridge via Elevators 712/713 (each backs the other). Bridge→street is step-free without an elevator.",
    segments: [
      { id: "platform-bridge", label: "Bowdoin-bound platform to pedestrian bridge", elevators: [{ externalId: "712", label: "Elevator 712 (Bowdoin platform to paid pedestrian bridge)" }, { externalId: "713", label: "Elevator 713 (Bowdoin platform to paid pedestrian bridge)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "place-orhte",
    chainLabel: " (Wonderland-bound platform)",
    note: "Wonderland-bound platform ⇄ paid pedestrian bridge via Elevators 714/715 (each backs the other). Bridge→street is step-free without an elevator.",
    segments: [
      { id: "platform-bridge", label: "Wonderland-bound platform to pedestrian bridge", elevators: [{ externalId: "714", label: "Elevator 714 (Wonderland platform to paid pedestrian bridge)" }, { externalId: "715", label: "Elevator 715 (Wonderland platform to paid pedestrian bridge)" }] },
    ],
  },

  // Lynn (Commuter Rail) — its only two elevators, 929/930, are an identical
  // same-function pair (both "street ⇄ parking garage", each named as the
  // other's backup); the elevated platform is reached via the garage level. No
  // other elevator leg exists, so this pair is the station's step-free path.
  {
    systemId: SYSTEM,
    stationExternalId: "place-ER-0115",
    note: "Elevators 929/930 (Lynn's only two, both street ⇄ parking garage, reaching the platform via the garage level) are a same-function redundant pair per MBTA guidance.",
    segments: [
      { id: "street-garage", label: "Street to parking garage (to platform)", elevators: [{ externalId: "929", label: "Elevator 929 (Street to parking garage)" }, { externalId: "930", label: "Elevator 930 (Street to parking garage)" }] },
    ],
  },

  // Beverly (Commuter Rail) — its only two elevators, 994/995, are an identical
  // same-function pair (both "parking garage ⇄ platform walkway"), directly
  // reaching the platform. A redundant pair.
  {
    systemId: SYSTEM,
    stationExternalId: "place-ER-0183",
    note: "Elevators 994/995 (Beverly's only two, both parking garage ⇄ platform walkway) are a same-function redundant pair per MBTA guidance.",
    segments: [
      { id: "garage-platform", label: "Parking garage to platform walkway", elevators: [{ externalId: "994", label: "Elevator 994 (Parking garage to platform walkway)" }, { externalId: "995", label: "Elevator 995 (Parking garage to platform walkway)" }] },
    ],
  },

  // Airport (Blue Line, elevated) — same layout as Orient Heights: each side
  // platform ⇄ paid pedestrian bridge by its own redundant pair; bridge→street
  // is step-free without an elevator (none listed, station is accessible).
  {
    systemId: SYSTEM,
    stationExternalId: "place-aport",
    chainLabel: " (Wonderland-bound platform)",
    note: "Wonderland-bound platform ⇄ paid pedestrian bridge via Elevators 931/956 (each backs the other). Bridge→street is step-free without an elevator.",
    segments: [
      { id: "platform-bridge", label: "Wonderland-bound platform to pedestrian bridge", elevators: [{ externalId: "931", label: "Elevator 931 (Wonderland platform to paid pedestrian bridge)" }, { externalId: "956", label: "Elevator 956 (Wonderland platform to paid pedestrian bridge)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "place-aport",
    chainLabel: " (Bowdoin-bound platform)",
    note: "Bowdoin-bound platform ⇄ paid pedestrian bridge via Elevators 932/955 (each backs the other). Bridge→street is step-free without an elevator.",
    segments: [
      { id: "platform-bridge", label: "Bowdoin-bound platform to pedestrian bridge", elevators: [{ externalId: "932", label: "Elevator 932 (Bowdoin platform to paid pedestrian bridge)" }, { externalId: "955", label: "Elevator 955 (Bowdoin platform to paid pedestrian bridge)" }] },
    ],
  },

  // Aquarium — Blue Line interchange with two side platforms (Wonderland-bound,
  // Bowdoin-bound), two street lobbies (State St, Atlantic Ave/Long Wharf), and
  // six elevators (913-915, 923-925) linking them in a mesh. Reviewed with Bryce
  // 2026-07-14 (/liftwatch-station-review): topology decoded from MBTA's
  // per-elevator alternate-service guidance, then independently confirmed by
  // MBTA's own GTFS pathways graph, which resolved the one open field question
  // (does the Atlantic Ave lobby sit at street grade, or does street access
  // require Elevator 925?) — the pathways graph shows 925 is the ONLY vertical
  // (elevator, escalator, or ramp) connecting the Atlantic/Waterfront street
  // door to the lobby other than stairs, so 925 is structurally required.
  // Two independent per-direction chains: elevators 923/924 both land in the
  // Atlantic lobby but serve different platforms (923 = Bowdoin-bound only,
  // 924 = Wonderland-bound only), so one is never a backup for the other — see
  // 161 St-Yankee Stadium for the same pattern. Segments are minimal cuts
  // (AND of ORs) derived from the pathways graph and round-trip-verified
  // against the alternate-service text.
  {
    systemId: SYSTEM,
    stationExternalId: "place-aqucl",
    chainLabel: " (Wonderland-bound platform)",
    note: "Any of elevators 913/914/925: 3 elevators — any one keeps this leg open. Any of elevators 913/923/925: 3 elevators — any one keeps this leg open. Any of elevators 913/924: 2 elevators — either one keeps this leg open. Any of elevators 914/915/924: 3 elevators — any one keeps this leg open. Any of elevators 915/923/924: 3 elevators — any one keeps this leg open. Any of elevators 915/925: 2 elevators — either one keeps this leg open. No single elevator outage removes step-free access on this route.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability -> minimal cuts, round-trip-verified) and validated against MBTA's alternate-service guidance. Field question (Atlantic Ave lobby grade) resolved by the pathways graph itself (925 is the only elevator/escalator/ramp on that leg) — human-approved to ship without a physical field check, 2026-07-14.",
    segments: [
      { id: "cut-1", label: "Any of elevators 913/914/925", elevators: [{ externalId: "913", label: "Aquarium Elevator 913 (Wonderland platform to State Street lobby)" }, { externalId: "914", label: "Aquarium Elevator 914 (Bowdoin platform to State Street lobby)" }, { externalId: "925", label: "Aquarium Elevator 925 (Atlantic Avenue lobby to Long Wharf)" }] },
      { id: "cut-2", label: "Any of elevators 913/923/925", elevators: [{ externalId: "913", label: "Aquarium Elevator 913 (Wonderland platform to State Street lobby)" }, { externalId: "923", label: "Aquarium Elevator 923 (Bowdoin platform to Atlantic Avenue lobby)" }, { externalId: "925", label: "Aquarium Elevator 925 (Atlantic Avenue lobby to Long Wharf)" }] },
      { id: "cut-3", label: "Any of elevators 913/924", elevators: [{ externalId: "913", label: "Aquarium Elevator 913 (Wonderland platform to State Street lobby)" }, { externalId: "924", label: "Aquarium Elevator 924 (Wonderland platform to Atlantic Avenue lobby)" }] },
      { id: "cut-4", label: "Any of elevators 914/915/924", elevators: [{ externalId: "914", label: "Aquarium Elevator 914 (Bowdoin platform to State Street lobby)" }, { externalId: "915", label: "Aquarium Elevator 915 (State Street lobby to street)" }, { externalId: "924", label: "Aquarium Elevator 924 (Wonderland platform to Atlantic Avenue lobby)" }] },
      { id: "cut-5", label: "Any of elevators 915/923/924", elevators: [{ externalId: "915", label: "Aquarium Elevator 915 (State Street lobby to street)" }, { externalId: "923", label: "Aquarium Elevator 923 (Bowdoin platform to Atlantic Avenue lobby)" }, { externalId: "924", label: "Aquarium Elevator 924 (Wonderland platform to Atlantic Avenue lobby)" }] },
      { id: "cut-6", label: "Any of elevators 915/925", elevators: [{ externalId: "915", label: "Aquarium Elevator 915 (State Street lobby to street)" }, { externalId: "925", label: "Aquarium Elevator 925 (Atlantic Avenue lobby to Long Wharf)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "place-aqucl",
    chainLabel: " (Bowdoin-bound platform)",
    note: "Any of elevators 913/914/925: 3 elevators — any one keeps this leg open. Any of elevators 913/915/923: 3 elevators — any one keeps this leg open. Any of elevators 914/923: 2 elevators — either one keeps this leg open. Any of elevators 914/924/925: 3 elevators — any one keeps this leg open. Any of elevators 915/923/924: 3 elevators — any one keeps this leg open. Any of elevators 915/925: 2 elevators — either one keeps this leg open. No single elevator outage removes step-free access on this route.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability -> minimal cuts, round-trip-verified) and validated against MBTA's alternate-service guidance. Field question (Atlantic Ave lobby grade) resolved by the pathways graph itself (925 is the only elevator/escalator/ramp on that leg) — human-approved to ship without a physical field check, 2026-07-14.",
    segments: [
      { id: "cut-1", label: "Any of elevators 913/914/925", elevators: [{ externalId: "913", label: "Aquarium Elevator 913 (Wonderland platform to State Street lobby)" }, { externalId: "914", label: "Aquarium Elevator 914 (Bowdoin platform to State Street lobby)" }, { externalId: "925", label: "Aquarium Elevator 925 (Atlantic Avenue lobby to Long Wharf)" }] },
      { id: "cut-2", label: "Any of elevators 913/915/923", elevators: [{ externalId: "913", label: "Aquarium Elevator 913 (Wonderland platform to State Street lobby)" }, { externalId: "915", label: "Aquarium Elevator 915 (State Street lobby to street)" }, { externalId: "923", label: "Aquarium Elevator 923 (Bowdoin platform to Atlantic Avenue lobby)" }] },
      { id: "cut-3", label: "Any of elevators 914/923", elevators: [{ externalId: "914", label: "Aquarium Elevator 914 (Bowdoin platform to State Street lobby)" }, { externalId: "923", label: "Aquarium Elevator 923 (Bowdoin platform to Atlantic Avenue lobby)" }] },
      { id: "cut-4", label: "Any of elevators 914/924/925", elevators: [{ externalId: "914", label: "Aquarium Elevator 914 (Bowdoin platform to State Street lobby)" }, { externalId: "924", label: "Aquarium Elevator 924 (Wonderland platform to Atlantic Avenue lobby)" }, { externalId: "925", label: "Aquarium Elevator 925 (Atlantic Avenue lobby to Long Wharf)" }] },
      { id: "cut-5", label: "Any of elevators 915/923/924", elevators: [{ externalId: "915", label: "Aquarium Elevator 915 (State Street lobby to street)" }, { externalId: "923", label: "Aquarium Elevator 923 (Bowdoin platform to Atlantic Avenue lobby)" }, { externalId: "924", label: "Aquarium Elevator 924 (Wonderland platform to Atlantic Avenue lobby)" }] },
      { id: "cut-6", label: "Any of elevators 915/925", elevators: [{ externalId: "915", label: "Aquarium Elevator 915 (State Street lobby to street)" }, { externalId: "925", label: "Aquarium Elevator 925 (Atlantic Avenue lobby to Long Wharf)" }] },
    ],
  },
];
