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

  // Park Street — Red Line / Green Line interchange. Red Line has a single
  // island platform (both directions share the same elevators), while the
  // Green Line has two separate side platforms (Government Center & North
  // bound, and Copley/Boston College/Riverside/Cleveland Circle/Heath St
  // bound), linked to each other via an underpass and to the Red Line via a
  // shared concourse. Reviewed with Bryce 2026-07-14 (/liftwatch-station-review,
  // confidence 8/10): topology decoded from MBTA's per-elevator
  // alternate-service guidance, all six elevators' texts cross-reference each
  // other consistently. Three independent chains (one per platform/direction,
  // same pattern as Government Center's Green/Blue split above) — an outage
  // on one platform's elevators says nothing about the other two.
  {
    systemId: SYSTEM,
    stationExternalId: "place-pktrm",
    chainLabel: " (Red Line)",
    note: "Any of elevators 804/812/979: 3 elevators — any one keeps this leg open. Any of elevators 804/823/979: 3 elevators — any one keeps this leg open. Any of elevators 804/978: 2 elevators — either one keeps this leg open. Any of elevators 808/812/978: 3 elevators — any one keeps this leg open. Any of elevators 808/823/978: 3 elevators — any one keeps this leg open. Any of elevators 808/979: 2 elevators — either one keeps this leg open. No single elevator outage removes step-free access on this route.",
    internalNote: "Derived from MBTA's per-elevator alternate-service guidance (round-trip cut verification against the agency's own walking graph; answer-key-validated). Human-approved via /liftwatch-station-review 2026-07-14 at confidence 8/10 — no independent GTFS-pathways-graph audit was run for this station (unlike Aquarium); approval rests on the internal consistency of all six elevators' cross-referencing guidance texts.",
    segments: [
      { id: "cut-1", label: "Any of elevators 804/812/979", elevators: [{ externalId: "804", label: "Park Street Elevator 804 (Government Center & North lobby to Tremont Street, Winter Street)" }, { externalId: "812", label: "Park Street Elevator 812 (Green Line underpass to Government Center & North platform)" }, { externalId: "979", label: "Park Street Elevator 979 (Red Line center platform to Copley & West platform)" }] },
      { id: "cut-2", label: "Any of elevators 804/823/979", elevators: [{ externalId: "804", label: "Park Street Elevator 804 (Government Center & North lobby to Tremont Street, Winter Street)" }, { externalId: "823", label: "Park Street Elevator 823 (Green Line underpass to Copley & West platform)" }, { externalId: "979", label: "Park Street Elevator 979 (Red Line center platform to Copley & West platform)" }] },
      { id: "cut-3", label: "Any of elevators 804/978", elevators: [{ externalId: "804", label: "Park Street Elevator 804 (Government Center & North lobby to Tremont Street, Winter Street)" }, { externalId: "978", label: "Park Street Elevator 978 (Copley & West platform to Boston Common)" }] },
      { id: "cut-4", label: "Any of elevators 808/812/978", elevators: [{ externalId: "808", label: "Park Street Elevator 808 (Red Line center platform to Government Center & North platform, Winter Street Concourse)" }, { externalId: "812", label: "Park Street Elevator 812 (Green Line underpass to Government Center & North platform)" }, { externalId: "978", label: "Park Street Elevator 978 (Copley & West platform to Boston Common)" }] },
      { id: "cut-5", label: "Any of elevators 808/823/978", elevators: [{ externalId: "808", label: "Park Street Elevator 808 (Red Line center platform to Government Center & North platform, Winter Street Concourse)" }, { externalId: "823", label: "Park Street Elevator 823 (Green Line underpass to Copley & West platform)" }, { externalId: "978", label: "Park Street Elevator 978 (Copley & West platform to Boston Common)" }] },
      { id: "cut-6", label: "Any of elevators 808/979", elevators: [{ externalId: "808", label: "Park Street Elevator 808 (Red Line center platform to Government Center & North platform, Winter Street Concourse)" }, { externalId: "979", label: "Park Street Elevator 979 (Red Line center platform to Copley & West platform)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "place-pktrm",
    chainLabel: " (Green Line, Government Center & North)",
    note: "Any of elevators 804/808/812: 3 elevators — any one keeps this leg open. Any of elevators 804/808/823: 3 elevators — any one keeps this leg open. Any of elevators 804/812/979: 3 elevators — any one keeps this leg open. Any of elevators 804/823/979: 3 elevators — any one keeps this leg open. Any of elevators 804/978: 2 elevators — either one keeps this leg open. No single elevator outage removes step-free access on this route.",
    internalNote: "Derived from MBTA's per-elevator alternate-service guidance (round-trip cut verification against the agency's own walking graph; answer-key-validated). Human-approved via /liftwatch-station-review 2026-07-14 at confidence 8/10 — no independent GTFS-pathways-graph audit was run for this station (unlike Aquarium); approval rests on the internal consistency of all six elevators' cross-referencing guidance texts.",
    segments: [
      { id: "cut-1", label: "Any of elevators 804/808/812", elevators: [{ externalId: "804", label: "Park Street Elevator 804 (Government Center & North lobby to Tremont Street, Winter Street)" }, { externalId: "808", label: "Park Street Elevator 808 (Red Line center platform to Government Center & North platform, Winter Street Concourse)" }, { externalId: "812", label: "Park Street Elevator 812 (Green Line underpass to Government Center & North platform)" }] },
      { id: "cut-2", label: "Any of elevators 804/808/823", elevators: [{ externalId: "804", label: "Park Street Elevator 804 (Government Center & North lobby to Tremont Street, Winter Street)" }, { externalId: "808", label: "Park Street Elevator 808 (Red Line center platform to Government Center & North platform, Winter Street Concourse)" }, { externalId: "823", label: "Park Street Elevator 823 (Green Line underpass to Copley & West platform)" }] },
      { id: "cut-3", label: "Any of elevators 804/812/979", elevators: [{ externalId: "804", label: "Park Street Elevator 804 (Government Center & North lobby to Tremont Street, Winter Street)" }, { externalId: "812", label: "Park Street Elevator 812 (Green Line underpass to Government Center & North platform)" }, { externalId: "979", label: "Park Street Elevator 979 (Red Line center platform to Copley & West platform)" }] },
      { id: "cut-4", label: "Any of elevators 804/823/979", elevators: [{ externalId: "804", label: "Park Street Elevator 804 (Government Center & North lobby to Tremont Street, Winter Street)" }, { externalId: "823", label: "Park Street Elevator 823 (Green Line underpass to Copley & West platform)" }, { externalId: "979", label: "Park Street Elevator 979 (Red Line center platform to Copley & West platform)" }] },
      { id: "cut-5", label: "Any of elevators 804/978", elevators: [{ externalId: "804", label: "Park Street Elevator 804 (Government Center & North lobby to Tremont Street, Winter Street)" }, { externalId: "978", label: "Park Street Elevator 978 (Copley & West platform to Boston Common)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "place-pktrm",
    chainLabel: " (Green Line, Copley & West)",
    note: "Any of elevators 804/978: 2 elevators — either one keeps this leg open. Any of elevators 808/812/978: 3 elevators — any one keeps this leg open. Any of elevators 808/823/978: 3 elevators — any one keeps this leg open. Any of elevators 812/978/979: 3 elevators — any one keeps this leg open. Any of elevators 823/978/979: 3 elevators — any one keeps this leg open. No single elevator outage removes step-free access on this route.",
    internalNote: "Derived from MBTA's per-elevator alternate-service guidance (round-trip cut verification against the agency's own walking graph; answer-key-validated). Human-approved via /liftwatch-station-review 2026-07-14 at confidence 8/10 — no independent GTFS-pathways-graph audit was run for this station (unlike Aquarium); approval rests on the internal consistency of all six elevators' cross-referencing guidance texts.",
    segments: [
      { id: "cut-1", label: "Any of elevators 804/978", elevators: [{ externalId: "804", label: "Park Street Elevator 804 (Government Center & North lobby to Tremont Street, Winter Street)" }, { externalId: "978", label: "Park Street Elevator 978 (Copley & West platform to Boston Common)" }] },
      { id: "cut-2", label: "Any of elevators 808/812/978", elevators: [{ externalId: "808", label: "Park Street Elevator 808 (Red Line center platform to Government Center & North platform, Winter Street Concourse)" }, { externalId: "812", label: "Park Street Elevator 812 (Green Line underpass to Government Center & North platform)" }, { externalId: "978", label: "Park Street Elevator 978 (Copley & West platform to Boston Common)" }] },
      { id: "cut-3", label: "Any of elevators 808/823/978", elevators: [{ externalId: "808", label: "Park Street Elevator 808 (Red Line center platform to Government Center & North platform, Winter Street Concourse)" }, { externalId: "823", label: "Park Street Elevator 823 (Green Line underpass to Copley & West platform)" }, { externalId: "978", label: "Park Street Elevator 978 (Copley & West platform to Boston Common)" }] },
      { id: "cut-4", label: "Any of elevators 812/978/979", elevators: [{ externalId: "812", label: "Park Street Elevator 812 (Green Line underpass to Government Center & North platform)" }, { externalId: "978", label: "Park Street Elevator 978 (Copley & West platform to Boston Common)" }, { externalId: "979", label: "Park Street Elevator 979 (Red Line center platform to Copley & West platform)" }] },
      { id: "cut-5", label: "Any of elevators 823/978/979", elevators: [{ externalId: "823", label: "Park Street Elevator 823 (Green Line underpass to Copley & West platform)" }, { externalId: "978", label: "Park Street Elevator 978 (Copley & West platform to Boston Common)" }, { externalId: "979", label: "Park Street Elevator 979 (Red Line center platform to Copley & West platform)" }] },
    ],
  },
  // Arlington (place-armnl) — Batch 1, machine-validated pathways proposal (approved 2026-07-14).
  {
    systemId: SYSTEM,
    stationExternalId: "place-armnl",
    chainLabel: " (Copley & West)",
    note: "Elevator 962: one elevator, no backup. Elevator 964: one elevator, no backup. None of these legs has a backup — if any one of these elevators is out of service, this route is not step-free.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Elevator 962", elevators: [{ externalId: "962", label: "Arlington Elevator 962 (Copley & West platform to lobby)" }] },
      { id: "cut-2", label: "Elevator 964", elevators: [{ externalId: "964", label: "Arlington Elevator 964 (Lobby to Boylston Street)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "place-armnl",
    chainLabel: " (Park Street & North)",
    note: "Elevator 963: one elevator, no backup. Elevator 964: one elevator, no backup. None of these legs has a backup — if any one of these elevators is out of service, this route is not step-free.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Elevator 963", elevators: [{ externalId: "963", label: "Arlington Elevator 963 (Park Street & North platform to lobby)" }] },
      { id: "cut-2", label: "Elevator 964", elevators: [{ externalId: "964", label: "Arlington Elevator 964 (Lobby to Boylston Street)" }] },
    ],
  },
  // Assembly (place-astao) — Batch 1, machine-validated pathways proposal (approved 2026-07-14).
  {
    systemId: SYSTEM,
    stationExternalId: "place-astao",
    note: "Any of elevators 716/718: 2 elevators — either one keeps this leg open. Any of elevators 716/719: 2 elevators — either one keeps this leg open. Any of elevators 717/718: 2 elevators — either one keeps this leg open. Any of elevators 717/719: 2 elevators — either one keeps this leg open. No single elevator outage removes step-free access on this route.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Any of elevators 716/718", elevators: [{ externalId: "716", label: "Assembly Elevator 716 (Foley Street to unpaid lobby)" }, { externalId: "718", label: "Assembly Elevator 718 (Revolution Drive to unpaid lobby)" }] },
      { id: "cut-2", label: "Any of elevators 716/719", elevators: [{ externalId: "716", label: "Assembly Elevator 716 (Foley Street to unpaid lobby)" }, { externalId: "719", label: "Assembly Elevator 719 (Platform to Revolution Drive paid lobby)" }] },
      { id: "cut-3", label: "Any of elevators 717/718", elevators: [{ externalId: "717", label: "Assembly Elevator 717 (Platform to Foley Street paid lobby)" }, { externalId: "718", label: "Assembly Elevator 718 (Revolution Drive to unpaid lobby)" }] },
      { id: "cut-4", label: "Any of elevators 717/719", elevators: [{ externalId: "717", label: "Assembly Elevator 717 (Platform to Foley Street paid lobby)" }, { externalId: "719", label: "Assembly Elevator 719 (Platform to Revolution Drive paid lobby)" }] },
    ],
  },
  // Back Bay (place-bbsta) — Batch 1, machine-validated pathways proposal (approved 2026-07-14).
  {
    systemId: SYSTEM,
    stationExternalId: "place-bbsta",
    chainLabel: " (Forest Hills / Oak Grove)",
    note: "Elevator 853: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Elevator 853", elevators: [{ externalId: "853", label: "Back Bay Elevator 853 (Orange Line platform to lobby)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "place-bbsta",
    chainLabel: " (Commuter Rail - Track 5 / Commuter Rail - Track 7)",
    note: "Elevator 856: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Elevator 856", elevators: [{ externalId: "856", label: "Back Bay Elevator 856 (Commuter Rail tracks 5 and 7 to lobby)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "place-bbsta",
    chainLabel: " (Commuter Rail - Track 1 / Commuter Rail - Track 3)",
    note: "Elevator 855: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Elevator 855", elevators: [{ externalId: "855", label: "Back Bay Elevator 855 (Commuter Rail tracks 1 and 3 to lobby)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "place-bbsta",
    chainLabel: " (Commuter Rail - Track 2)",
    note: "Elevator 854: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Elevator 854", elevators: [{ externalId: "854", label: "Back Bay Elevator 854 (Commuter Rail track 2 to lobby)" }] },
    ],
  },
  // Copley (place-coecl) — Batch 1, machine-validated pathways proposal (approved 2026-07-14).
  {
    systemId: SYSTEM,
    stationExternalId: "place-coecl",
    chainLabel: " (Park Street & North)",
    note: "Elevator 976: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Elevator 976", elevators: [{ externalId: "976", label: "Copley Elevator 976 (Park Street & North platform to Boylston Street)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "place-coecl",
    chainLabel: " (Kenmore & West, Heath Street)",
    note: "Elevator 977: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Elevator 977", elevators: [{ externalId: "977", label: "Copley Elevator 977 (Kenmore & West, Heath Street platform to Boylston Street)" }] },
    ],
  },
  // Forest Hills (place-forhl) — Batch 1, machine-validated pathways proposal (approved 2026-07-14).
  {
    systemId: SYSTEM,
    stationExternalId: "place-forhl",
    chainLabel: " (Orange Line / Track 1 / Track 2)",
    note: "Any of elevators 724/842: 2 elevators — either one keeps this leg open. No single elevator outage removes step-free access on this route.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Any of elevators 724/842", elevators: [{ externalId: "724", label: "Forest Hills Elevator 724 (Orange Line platform to Southwest Corridor Park lobby)" }, { externalId: "842", label: "Forest Hills Elevator 842 (Orange Line platform to main upper lobby)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "place-forhl",
    chainLabel: " (Commuter Rail / Commuter Rail - Track 3 / Commuter Rail - Tr)",
    note: "Elevator 841: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Elevator 841", elevators: [{ externalId: "841", label: "Forest Hills Elevator 841 (Commuter Rail platform to lobby)" }] },
    ],
  },
  // Harvard (place-harsq) — Batch 1, machine-validated pathways proposal (approved 2026-07-14).
  {
    systemId: SYSTEM,
    stationExternalId: "place-harsq",
    note: "Any of elevators 821/973: 2 elevators — either one keeps this leg open. No single elevator outage removes step-free access on this route.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Any of elevators 821/973", elevators: [{ externalId: "821", label: "Harvard Elevator 821 (Lobby to Harvard Square)" }, { externalId: "973", label: "Harvard Elevator 973 (Upper busway to Brattle Square)" }] },
    ],
  },
  // Haymarket (place-haecl) — Batch 1, machine-validated pathways proposal (approved 2026-07-14).
  {
    systemId: SYSTEM,
    stationExternalId: "place-haecl",
    chainLabel: " (Forest Hills)",
    note: "Any of elevators 903/904/906: 3 elevators — any one keeps this leg open. Any of elevators 903/904/908: 3 elevators — any one keeps this leg open. Any of elevators 904/905: 2 elevators — either one keeps this leg open. Any of elevators 904/906/907: 3 elevators — any one keeps this leg open. Any of elevators 904/907/908: 3 elevators — any one keeps this leg open. No single elevator outage removes step-free access on this route.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Any of elevators 903/904/906", elevators: [{ externalId: "903", label: "Haymarket Elevator 903 (Oak Grove platform to Congress Street lobby)" }, { externalId: "904", label: "Haymarket Elevator 904 (Forest Hills platform to Congress Street lobby)" }, { externalId: "906", label: "Haymarket Elevator 906 (Underpass to Green Line platforms, busway)" }] },
      { id: "cut-2", label: "Any of elevators 903/904/908", elevators: [{ externalId: "903", label: "Haymarket Elevator 903 (Oak Grove platform to Congress Street lobby)" }, { externalId: "904", label: "Haymarket Elevator 904 (Forest Hills platform to Congress Street lobby)" }, { externalId: "908", label: "Haymarket Elevator 908 (Green Line lobby to busway, Sudbury Street, New Chardon Street)" }] },
      { id: "cut-3", label: "Any of elevators 904/905", elevators: [{ externalId: "904", label: "Haymarket Elevator 904 (Forest Hills platform to Congress Street lobby)" }, { externalId: "905", label: "Haymarket Elevator 905 (Underpass to Forest Hills platform)" }] },
      { id: "cut-4", label: "Any of elevators 904/906/907", elevators: [{ externalId: "904", label: "Haymarket Elevator 904 (Forest Hills platform to Congress Street lobby)" }, { externalId: "906", label: "Haymarket Elevator 906 (Underpass to Green Line platforms, busway)" }, { externalId: "907", label: "Haymarket Elevator 907 (Underpass to Oak Grove platform)" }] },
      { id: "cut-5", label: "Any of elevators 904/907/908", elevators: [{ externalId: "904", label: "Haymarket Elevator 904 (Forest Hills platform to Congress Street lobby)" }, { externalId: "907", label: "Haymarket Elevator 907 (Underpass to Oak Grove platform)" }, { externalId: "908", label: "Haymarket Elevator 908 (Green Line lobby to busway, Sudbury Street, New Chardon Street)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "place-haecl",
    chainLabel: " (Oak Grove)",
    note: "Any of elevators 903/904/906: 3 elevators — any one keeps this leg open. Any of elevators 903/904/908: 3 elevators — any one keeps this leg open. Any of elevators 903/905/906: 3 elevators — any one keeps this leg open. Any of elevators 903/905/908: 3 elevators — any one keeps this leg open. Any of elevators 903/907: 2 elevators — either one keeps this leg open. No single elevator outage removes step-free access on this route.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Any of elevators 903/904/906", elevators: [{ externalId: "903", label: "Haymarket Elevator 903 (Oak Grove platform to Congress Street lobby)" }, { externalId: "904", label: "Haymarket Elevator 904 (Forest Hills platform to Congress Street lobby)" }, { externalId: "906", label: "Haymarket Elevator 906 (Underpass to Green Line platforms, busway)" }] },
      { id: "cut-2", label: "Any of elevators 903/904/908", elevators: [{ externalId: "903", label: "Haymarket Elevator 903 (Oak Grove platform to Congress Street lobby)" }, { externalId: "904", label: "Haymarket Elevator 904 (Forest Hills platform to Congress Street lobby)" }, { externalId: "908", label: "Haymarket Elevator 908 (Green Line lobby to busway, Sudbury Street, New Chardon Street)" }] },
      { id: "cut-3", label: "Any of elevators 903/905/906", elevators: [{ externalId: "903", label: "Haymarket Elevator 903 (Oak Grove platform to Congress Street lobby)" }, { externalId: "905", label: "Haymarket Elevator 905 (Underpass to Forest Hills platform)" }, { externalId: "906", label: "Haymarket Elevator 906 (Underpass to Green Line platforms, busway)" }] },
      { id: "cut-4", label: "Any of elevators 903/905/908", elevators: [{ externalId: "903", label: "Haymarket Elevator 903 (Oak Grove platform to Congress Street lobby)" }, { externalId: "905", label: "Haymarket Elevator 905 (Underpass to Forest Hills platform)" }, { externalId: "908", label: "Haymarket Elevator 908 (Green Line lobby to busway, Sudbury Street, New Chardon Street)" }] },
      { id: "cut-5", label: "Any of elevators 903/907", elevators: [{ externalId: "903", label: "Haymarket Elevator 903 (Oak Grove platform to Congress Street lobby)" }, { externalId: "907", label: "Haymarket Elevator 907 (Underpass to Oak Grove platform)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "place-haecl",
    chainLabel: " (Copley & West / North Station & North)",
    note: "Any of elevators 903/904/908: 3 elevators — any one keeps this leg open. Any of elevators 903/905/908: 3 elevators — any one keeps this leg open. Any of elevators 904/907/908: 3 elevators — any one keeps this leg open. Any of elevators 905/907/908: 3 elevators — any one keeps this leg open. Any of elevators 906/908: 2 elevators — either one keeps this leg open. No single elevator outage removes step-free access on this route.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Any of elevators 903/904/908", elevators: [{ externalId: "903", label: "Haymarket Elevator 903 (Oak Grove platform to Congress Street lobby)" }, { externalId: "904", label: "Haymarket Elevator 904 (Forest Hills platform to Congress Street lobby)" }, { externalId: "908", label: "Haymarket Elevator 908 (Green Line lobby to busway, Sudbury Street, New Chardon Street)" }] },
      { id: "cut-2", label: "Any of elevators 903/905/908", elevators: [{ externalId: "903", label: "Haymarket Elevator 903 (Oak Grove platform to Congress Street lobby)" }, { externalId: "905", label: "Haymarket Elevator 905 (Underpass to Forest Hills platform)" }, { externalId: "908", label: "Haymarket Elevator 908 (Green Line lobby to busway, Sudbury Street, New Chardon Street)" }] },
      { id: "cut-3", label: "Any of elevators 904/907/908", elevators: [{ externalId: "904", label: "Haymarket Elevator 904 (Forest Hills platform to Congress Street lobby)" }, { externalId: "907", label: "Haymarket Elevator 907 (Underpass to Oak Grove platform)" }, { externalId: "908", label: "Haymarket Elevator 908 (Green Line lobby to busway, Sudbury Street, New Chardon Street)" }] },
      { id: "cut-4", label: "Any of elevators 905/907/908", elevators: [{ externalId: "905", label: "Haymarket Elevator 905 (Underpass to Forest Hills platform)" }, { externalId: "907", label: "Haymarket Elevator 907 (Underpass to Oak Grove platform)" }, { externalId: "908", label: "Haymarket Elevator 908 (Green Line lobby to busway, Sudbury Street, New Chardon Street)" }] },
      { id: "cut-5", label: "Any of elevators 906/908", elevators: [{ externalId: "906", label: "Haymarket Elevator 906 (Underpass to Green Line platforms, busway)" }, { externalId: "908", label: "Haymarket Elevator 908 (Green Line lobby to busway, Sudbury Street, New Chardon Street)" }] },
    ],
  },
  // Lechmere (place-lech) — Batch 1, machine-validated pathways proposal (approved 2026-07-14).
  {
    systemId: SYSTEM,
    stationExternalId: "place-lech",
    note: "Any of elevators 762/763/764: 3 elevators — any one keeps this leg open. No single elevator outage removes step-free access on this route.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Any of elevators 762/763/764", elevators: [{ externalId: "762", label: "Lechmere Elevator 762 (Platform to North First Street lobby)" }, { externalId: "763", label: "Lechmere Elevator 763 (Platform to North First Street lobby)" }, { externalId: "764", label: "Lechmere Elevator 764 (Platform to O'Brien Highway lobby)" }] },
    ],
  },
  // North Quincy (place-nqncy) — Batch 1, machine-validated pathways proposal (approved 2026-07-14).
  {
    systemId: SYSTEM,
    stationExternalId: "place-nqncy",
    note: "Any of elevators 739/740/897/898/900: 5 elevators — any one keeps this leg open. Any of elevators 899/900: 2 elevators — either one keeps this leg open. No single elevator outage removes step-free access on this route.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Any of elevators 739/740/897/898/900", elevators: [{ externalId: "739", label: "North Quincy Elevator 739 (Pick-up/drop-off area and northern lobby to parking garage)" }, { externalId: "740", label: "North Quincy Elevator 740 (Pick-up/drop-off area and northern lobby to parking garage)" }, { externalId: "897", label: "North Quincy Elevator 897 (Hancock Street parking to northern lobby)" }, { externalId: "898", label: "North Quincy Elevator 898 (Newport Avenue to northern lobby)" }, { externalId: "900", label: "North Quincy Elevator 900 (Platform to main lobby, busway)" }] },
      { id: "cut-2", label: "Any of elevators 899/900", elevators: [{ externalId: "899", label: "North Quincy Elevator 899 (Platform to northern lobby)" }, { externalId: "900", label: "North Quincy Elevator 900 (Platform to main lobby, busway)" }] },
    ],
  },
  // North Station (place-north) — Batch 1, machine-validated pathways proposal (approved 2026-07-14).
  {
    systemId: SYSTEM,
    stationExternalId: "place-north",
    chainLabel: " (Lechmere & North)",
    note: "Any of elevators 731/732/909/912: 4 elevators — any one keeps this leg open. No single elevator outage removes step-free access on this route.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Any of elevators 731/732/909/912", elevators: [{ externalId: "731", label: "North Station Elevator 731 (Passageway to Causeway Street)" }, { externalId: "732", label: "North Station Elevator 732 (Passageway to Commuter Rail, TD Garden)" }, { externalId: "909", label: "North Station Elevator 909 (Orange Line, Green Line lobby to Valenti Way)" }, { externalId: "912", label: "North Station Elevator 912 (Orange Line, Green Line lobby to Causeway Street)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "place-north",
    chainLabel: " (Oak Grove)",
    note: "Any of elevators 731/732/909/912: 4 elevators — any one keeps this leg open. Elevator 911: one elevator, no backup. A leg with a single elevator has no backup — an outage there makes this route not step-free.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Any of elevators 731/732/909/912", elevators: [{ externalId: "731", label: "North Station Elevator 731 (Passageway to Causeway Street)" }, { externalId: "732", label: "North Station Elevator 732 (Passageway to Commuter Rail, TD Garden)" }, { externalId: "909", label: "North Station Elevator 909 (Orange Line, Green Line lobby to Valenti Way)" }, { externalId: "912", label: "North Station Elevator 912 (Orange Line, Green Line lobby to Causeway Street)" }] },
      { id: "cut-2", label: "Elevator 911", elevators: [{ externalId: "911", label: "North Station Elevator 911 (Oak Grove platform to paid lobby)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "place-north",
    chainLabel: " (Copley & West / Forest Hills)",
    note: "Any of elevators 731/732/909/912: 4 elevators — any one keeps this leg open. Elevator 910: one elevator, no backup. A leg with a single elevator has no backup — an outage there makes this route not step-free.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Any of elevators 731/732/909/912", elevators: [{ externalId: "731", label: "North Station Elevator 731 (Passageway to Causeway Street)" }, { externalId: "732", label: "North Station Elevator 732 (Passageway to Commuter Rail, TD Garden)" }, { externalId: "909", label: "North Station Elevator 909 (Orange Line, Green Line lobby to Valenti Way)" }, { externalId: "912", label: "North Station Elevator 912 (Orange Line, Green Line lobby to Causeway Street)" }] },
      { id: "cut-2", label: "Elevator 910", elevators: [{ externalId: "910", label: "North Station Elevator 910 (Lobby to Forest Hills, Copley & West platform)" }] },
    ],
  },
  // Ruggles (place-rugg) — Batch 1, machine-validated pathways proposal (approved 2026-07-14).
  {
    systemId: SYSTEM,
    stationExternalId: "place-rugg",
    chainLabel: " (Forest Hills / Oak Grove)",
    note: "Elevator 850: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Elevator 850", elevators: [{ externalId: "850", label: "Ruggles Elevator 850 (Orange Line platform to upper lobby)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "place-rugg",
    chainLabel: " (Commuter Rail - Track 1 / Commuter Rail - Track 3)",
    note: "Elevator 849: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Elevator 849", elevators: [{ externalId: "849", label: "Ruggles Elevator 849 (Commuter Rail tracks 1 and 3 to lobby)" }] },
    ],
  },
  // Savin Hill (place-shmnl) — Batch 1, machine-validated pathways proposal (approved 2026-07-14).
  {
    systemId: SYSTEM,
    stationExternalId: "place-shmnl",
    note: "Elevator 946: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Elevator 946", elevators: [{ externalId: "946", label: "Savin Hill Elevator 946 (Platform to paid lobby)" }] },
    ],
  },
  // Science Park/West End (place-spmnl) — Batch 1, machine-validated pathways proposal (approved 2026-07-14).
  {
    systemId: SYSTEM,
    stationExternalId: "place-spmnl",
    chainLabel: " (Lechmere & North)",
    note: "Elevator 981: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Elevator 981", elevators: [{ externalId: "981", label: "Science Park/West End Elevator 981 (Lechmere & North platform to lobby)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "place-spmnl",
    chainLabel: " (Copley & West)",
    note: "Elevator 980: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Elevator 980", elevators: [{ externalId: "980", label: "Science Park/West End Elevator 980 (Copley & West platform to lobby)" }] },
    ],
  },
  // South Station (place-sstat) — Batch 1, machine-validated pathways proposal (approved 2026-07-14).
  {
    systemId: SYSTEM,
    stationExternalId: "place-sstat",
    chainLabel: " (Airport / SL3 Design Center/Chelsea)",
    note: "Any of elevators 6476/926/949: 3 elevators — any one keeps this leg open. Any of elevators 901/918: 2 elevators — either one keeps this leg open. Any of elevators 918/919: 2 elevators — either one keeps this leg open. Any of elevators 918/927: 2 elevators — either one keeps this leg open. No single elevator outage removes step-free access on this route.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Any of elevators 6476/926/949", elevators: [{ externalId: "6476", label: "South Station Elevator 6476 (Red Line, Silver Line SL1/SL2/SL3 lobby to Commuter Rail lobby)" }, { externalId: "926", label: "South Station Elevator 926 (Subway Lobby to Atlantic Avenue, Summer Street)" }, { externalId: "949", label: "South Station Elevator 949 (Lobby to Dewey Square)" }] },
      { id: "cut-2", label: "Any of elevators 901/918", elevators: [{ externalId: "901", label: "South Station Elevator 901 (Ashmont/Braintree platform to Silver Line drop-off platform and lobby)" }, { externalId: "918", label: "South Station Elevator 918 (Ashmont/Braintree platform to Airport/Design Center/Chelsea platform and lobby)" }] },
      { id: "cut-3", label: "Any of elevators 918/919", elevators: [{ externalId: "918", label: "South Station Elevator 918 (Ashmont/Braintree platform to Airport/Design Center/Chelsea platform and lobby)" }, { externalId: "919", label: "South Station Elevator 919 (Alewife platform to Airport/Design Center/Chelsea platform)" }] },
      { id: "cut-4", label: "Any of elevators 918/927", elevators: [{ externalId: "918", label: "South Station Elevator 918 (Ashmont/Braintree platform to Airport/Design Center/Chelsea platform and lobby)" }, { externalId: "927", label: "South Station Elevator 927 (Alewife platform to Silver Line Drop-off platform)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "place-sstat",
    chainLabel: " (Ashmont/Braintree)",
    note: "Any of elevators 6476/926/949: 3 elevators — any one keeps this leg open. Any of elevators 901/918: 2 elevators — either one keeps this leg open. No single elevator outage removes step-free access on this route.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Any of elevators 6476/926/949", elevators: [{ externalId: "6476", label: "South Station Elevator 6476 (Red Line, Silver Line SL1/SL2/SL3 lobby to Commuter Rail lobby)" }, { externalId: "926", label: "South Station Elevator 926 (Subway Lobby to Atlantic Avenue, Summer Street)" }, { externalId: "949", label: "South Station Elevator 949 (Lobby to Dewey Square)" }] },
      { id: "cut-2", label: "Any of elevators 901/918", elevators: [{ externalId: "901", label: "South Station Elevator 901 (Ashmont/Braintree platform to Silver Line drop-off platform and lobby)" }, { externalId: "918", label: "South Station Elevator 918 (Ashmont/Braintree platform to Airport/Design Center/Chelsea platform and lobby)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "place-sstat",
    chainLabel: " (Alewife)",
    note: "Any of elevators 6476/926/949: 3 elevators — any one keeps this leg open. Any of elevators 901/918: 2 elevators — either one keeps this leg open. Any of elevators 901/919: 2 elevators — either one keeps this leg open. Any of elevators 918/927: 2 elevators — either one keeps this leg open. Any of elevators 919/927: 2 elevators — either one keeps this leg open. No single elevator outage removes step-free access on this route.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Any of elevators 6476/926/949", elevators: [{ externalId: "6476", label: "South Station Elevator 6476 (Red Line, Silver Line SL1/SL2/SL3 lobby to Commuter Rail lobby)" }, { externalId: "926", label: "South Station Elevator 926 (Subway Lobby to Atlantic Avenue, Summer Street)" }, { externalId: "949", label: "South Station Elevator 949 (Lobby to Dewey Square)" }] },
      { id: "cut-2", label: "Any of elevators 901/918", elevators: [{ externalId: "901", label: "South Station Elevator 901 (Ashmont/Braintree platform to Silver Line drop-off platform and lobby)" }, { externalId: "918", label: "South Station Elevator 918 (Ashmont/Braintree platform to Airport/Design Center/Chelsea platform and lobby)" }] },
      { id: "cut-3", label: "Any of elevators 901/919", elevators: [{ externalId: "901", label: "South Station Elevator 901 (Ashmont/Braintree platform to Silver Line drop-off platform and lobby)" }, { externalId: "919", label: "South Station Elevator 919 (Alewife platform to Airport/Design Center/Chelsea platform)" }] },
      { id: "cut-4", label: "Any of elevators 918/927", elevators: [{ externalId: "918", label: "South Station Elevator 918 (Ashmont/Braintree platform to Airport/Design Center/Chelsea platform and lobby)" }, { externalId: "927", label: "South Station Elevator 927 (Alewife platform to Silver Line Drop-off platform)" }] },
      { id: "cut-5", label: "Any of elevators 919/927", elevators: [{ externalId: "919", label: "South Station Elevator 919 (Alewife platform to Airport/Design Center/Chelsea platform)" }, { externalId: "927", label: "South Station Elevator 927 (Alewife platform to Silver Line Drop-off platform)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "place-sstat",
    chainLabel: " (Exit Only)",
    note: "Any of elevators 6476/926/949: 3 elevators — any one keeps this leg open. Any of elevators 901/918: 2 elevators — either one keeps this leg open. Any of elevators 901/919: 2 elevators — either one keeps this leg open. Any of elevators 901/927: 2 elevators — either one keeps this leg open. No single elevator outage removes step-free access on this route.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Any of elevators 6476/926/949", elevators: [{ externalId: "6476", label: "South Station Elevator 6476 (Red Line, Silver Line SL1/SL2/SL3 lobby to Commuter Rail lobby)" }, { externalId: "926", label: "South Station Elevator 926 (Subway Lobby to Atlantic Avenue, Summer Street)" }, { externalId: "949", label: "South Station Elevator 949 (Lobby to Dewey Square)" }] },
      { id: "cut-2", label: "Any of elevators 901/918", elevators: [{ externalId: "901", label: "South Station Elevator 901 (Ashmont/Braintree platform to Silver Line drop-off platform and lobby)" }, { externalId: "918", label: "South Station Elevator 918 (Ashmont/Braintree platform to Airport/Design Center/Chelsea platform and lobby)" }] },
      { id: "cut-3", label: "Any of elevators 901/919", elevators: [{ externalId: "901", label: "South Station Elevator 901 (Ashmont/Braintree platform to Silver Line drop-off platform and lobby)" }, { externalId: "919", label: "South Station Elevator 919 (Alewife platform to Airport/Design Center/Chelsea platform)" }] },
      { id: "cut-4", label: "Any of elevators 901/927", elevators: [{ externalId: "901", label: "South Station Elevator 901 (Ashmont/Braintree platform to Silver Line drop-off platform and lobby)" }, { externalId: "927", label: "South Station Elevator 927 (Alewife platform to Silver Line Drop-off platform)" }] },
    ],
  },
  // Tufts Medical Center (place-tumnl) — Batch 1, machine-validated pathways proposal (approved 2026-07-14).
  {
    systemId: SYSTEM,
    stationExternalId: "place-tumnl",
    chainLabel: " (Oak Grove)",
    note: "Elevator 857: one elevator, no backup. Elevator 858: one elevator, no backup. None of these legs has a backup — if any one of these elevators is out of service, this route is not step-free.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Elevator 857", elevators: [{ externalId: "857", label: "Tufts Medical Center Elevator 857 (Lobby to Washington Street)" }] },
      { id: "cut-2", label: "Elevator 858", elevators: [{ externalId: "858", label: "Tufts Medical Center Elevator 858 (Oak Grove platform to Washington Street lobby)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "place-tumnl",
    chainLabel: " (Forest Hills)",
    note: "Elevator 857: one elevator, no backup. Elevator 859: one elevator, no backup. None of these legs has a backup — if any one of these elevators is out of service, this route is not step-free.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Elevator 857", elevators: [{ externalId: "857", label: "Tufts Medical Center Elevator 857 (Lobby to Washington Street)" }] },
      { id: "cut-2", label: "Elevator 859", elevators: [{ externalId: "859", label: "Tufts Medical Center Elevator 859 (Forest Hills platform to Washington Street lobby)" }] },
    ],
  },
  // Wollaston (place-wlsta) — Batch 1, machine-validated pathways proposal (approved 2026-07-14).
  {
    systemId: SYSTEM,
    stationExternalId: "place-wlsta",
    note: "Any of elevators 733/734: 2 elevators — either one keeps this leg open. Any of elevators 734/735: 2 elevators — either one keeps this leg open. No single elevator outage removes step-free access on this route.",
    internalNote: "Derived from MBTA's GTFS pathways graph (mode-5 elevator pathways carry real facility ids; step-free reachability → minimal cuts, round-trip-verified). Validated against MBTA's alternate-service guidance where present. Generated 2026-07-15. Human-approved as a batch via /liftwatch-station-review 2026-07-14 (Batch 1: 16 MBTA machine-validated proposals, approved verbatim on the same answer-key + round-trip validation basis as Aquarium and Park Street).",
    segments: [
      { id: "cut-1", label: "Any of elevators 733/734", elevators: [{ externalId: "733", label: "Wollaston Elevator 733 (Parking lot lobby to pedestrian bridge)" }, { externalId: "734", label: "Wollaston Elevator 734 (Newport Ave lobby to platform)" }] },
      { id: "cut-2", label: "Any of elevators 734/735", elevators: [{ externalId: "734", label: "Wollaston Elevator 734 (Newport Ave lobby to platform)" }, { externalId: "735", label: "Wollaston Elevator 735 (Platform to pedestrian bridge)" }] },
    ],
  },
];
