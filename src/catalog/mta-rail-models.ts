import type { StationModel } from "../lib/accessibility.js";

// Curated station models for the MTA commuter railroads (mta-lirr, mta-mnr).
// Hand-built from the eestatus feed's location text and WALKED THROUGH
// station-by-station with a human (2026-07-06) — the Stamford walk-through
// alone corrected three feed-text misreadings (Elevator 04's landing, the
// pedestrian bridge's street connection, per-track island asymmetries), so
// treat the notes here as the source of truth over the raw location strings.
//
// External ids are station-qualified exactly as the adapter emits them
// ("NYK-861", "2SM-1 STM" — see src/adapters/mta-rail). The adapter applies
// each modeled unit's derived redundancy as curated (BART pattern),
// aggregated across every chain the unit appears in: redundant only if its
// own outage severs NO chain.
//
// Commuter-rail reality is PER-TRACK: most stations gate each platform with
// its own elevator, so chains carry per-track labels ("(Track 3)") the same
// way subway interchanges carry per-line ones ("(B/D)").
//
// The paired-segment (CNF) encoding used at Stamford: a destination reachable
// "directly via elevator D, OR via a multi-elevator detour A+B" is expressed
// as segments [D, A] + [D, B] — the chain model is an AND of ORs, and that
// factoring reproduces every single- and double-failure case exactly.

export const MTA_RAIL_STATION_MODELS: StationModel[] = [
  // ------------------------------------------------------------------ LIRR
  {
    systemId: "mta-lirr",
    stationExternalId: "ATL",
    note: "Atlantic Terminal's two elevators (Units 1 & 2, adjacent to MTA Police) both run street to concourse/platform level and back each other up — no single outage severs access.",
    segments: [
      {
        id: "street-platform",
        label: "Street to concourse/platform",
        elevators: [
          { externalId: "ATL-664", label: "Unit 1 — street to concourse/platform" },
          { externalId: "ATL-663", label: "Unit 2 — street to concourse/platform" },
        ],
      },
    ],
  },
  {
    systemId: "mta-lirr",
    stationExternalId: "HVL",
    chainLabel: " (Platform A)",
    note: "Hicksville Platform A (Tracks 1 & 2) has elevators at both the east and west ends of the station building — redundant pair.",
    segments: [
      {
        id: "street-platform-a",
        label: "Street to Platform A (Tracks 1 & 2)",
        elevators: [
          { externalId: "HVL-429", label: "Unit A1 — east side" },
          { externalId: "HVL-721", label: "Unit A2 — west side" },
        ],
      },
    ],
  },
  {
    systemId: "mta-lirr",
    stationExternalId: "HVL",
    chainLabel: " (Platform B)",
    note: "Hicksville Platform B (Tracks 2 & 3) has elevators at both the east and west ends of the station building — redundant pair.",
    segments: [
      {
        id: "street-platform-b",
        label: "Street to Platform B (Tracks 2 & 3)",
        elevators: [
          { externalId: "HVL-428", label: "Unit B1 — east side" },
          { externalId: "HVL-722", label: "Unit B2 — west side" },
        ],
      },
    ],
  },
  {
    systemId: "mta-lirr",
    stationExternalId: "MIN",
    chainLabel: " (Track 2)",
    note: "Mineola Track 2 is reachable via the eastern overpass elevator (kiss-and-ride side) or the western overpass elevator (Intermodal Center) — two independent routes.",
    segments: [
      {
        id: "street-track-2",
        label: "Street to Track 2 (either overpass)",
        elevators: [
          { externalId: "MIN-1017", label: "Eastern overpass — Track 2 & kiss-and-ride" },
          { externalId: "MIN-435", label: "Western overpass — Intermodal Center & Track 2" },
        ],
      },
    ],
  },
  {
    systemId: "mta-lirr",
    stationExternalId: "MIN",
    chainLabel: " (Track 3)",
    note: "Mineola Track 3 is reachable via the eastern overpass elevator (north-side street) or the western overpass elevator (Intermodal Center) — two independent routes.",
    segments: [
      {
        id: "street-track-3",
        label: "Street to Track 3 (either overpass)",
        elevators: [
          { externalId: "MIN-1018", label: "Eastern overpass — Track 3 & street (north side)" },
          { externalId: "MIN-434", label: "Western overpass — Intermodal Center & Track 3" },
        ],
      },
    ],
  },
  {
    // Penn Station: five per-platform chains all share the single street
    // elevator (Unit P34 at 34 St & 7 Av). P34/NYK-861 is PHYSICALLY the
    // same elevator as the subway feed's EL34X (nonNYCT=Y) — tracked in both
    // systems deliberately. The subway side's other concourse elevators
    // (EL618/EL225) are a cross-system backup this model can't see, so a
    // P34 outage over-warns slightly rather than ever under-warning.
    systemId: "mta-lirr",
    stationExternalId: "NYK",
    chainLabel: " (Tks 13/14)",
    note: "Penn Station LIRR: street access via Unit P34 (34 St & 7 Av — physically shared with the subway's EL34X), then the per-platform elevator. The subway's other Penn concourse elevators are an unmodeled cross-system backup for the street leg.",
    segments: [
      { id: "street", label: "Street to LIRR concourse", elevators: [{ externalId: "NYK-861", label: "Unit P34 — 34 St & 7 Av to LIRR concourse" }] },
      { id: "platform", label: "Concourse to Tracks 13 & 14", elevators: [{ externalId: "NYK-440", label: "Unit P7 — Tracks 13 & 14" }] },
    ],
  },
  {
    systemId: "mta-lirr",
    stationExternalId: "NYK",
    chainLabel: " (Tks 15/16)",
    segments: [
      { id: "street", label: "Street to LIRR concourse", elevators: [{ externalId: "NYK-861", label: "Unit P34 — 34 St & 7 Av to LIRR concourse" }] },
      { id: "platform", label: "Concourse to Tracks 15 & 16", elevators: [{ externalId: "NYK-323", label: "Unit P8 — Tracks 15 & 16" }] },
    ],
  },
  {
    systemId: "mta-lirr",
    stationExternalId: "NYK",
    chainLabel: " (Tk 17)",
    segments: [
      { id: "street", label: "Street to LIRR concourse", elevators: [{ externalId: "NYK-861", label: "Unit P34 — 34 St & 7 Av to LIRR concourse" }] },
      { id: "platform", label: "Concourse to Track 17", elevators: [{ externalId: "NYK-322", label: "Unit P9 — Track 17" }] },
    ],
  },
  {
    systemId: "mta-lirr",
    stationExternalId: "NYK",
    chainLabel: " (Tks 18/19)",
    segments: [
      { id: "street", label: "Street to LIRR concourse", elevators: [{ externalId: "NYK-861", label: "Unit P34 — 34 St & 7 Av to LIRR concourse" }] },
      { id: "platform", label: "Concourse to Tracks 18 & 19", elevators: [{ externalId: "NYK-438", label: "Unit P10 — Tracks 18 & 19" }] },
    ],
  },
  {
    systemId: "mta-lirr",
    stationExternalId: "NYK",
    chainLabel: " (Tks 20/21)",
    segments: [
      { id: "street", label: "Street to LIRR concourse", elevators: [{ externalId: "NYK-861", label: "Unit P34 — 34 St & 7 Av to LIRR concourse" }] },
      { id: "platform", label: "Concourse to Tracks 20 & 21", elevators: [{ externalId: "NYK-437", label: "Unit P11 — Tracks 20 & 21" }] },
    ],
  },
  {
    // Jamaica: every platform hangs off the eastern overpass, whose street
    // (and subway-transfer) elevator is JAM-521 — the station's shared
    // prerequisite, like 161 St's EL131 on the subway side.
    systemId: "mta-lirr",
    stationExternalId: "JAM",
    chainLabel: " (Tks 1/2)",
    note: "Jamaica: all platforms are reached from the eastern overpass; its street/subway elevator (521) is the shared prerequisite for every chain — if it fails, every platform chain goes down together.",
    segments: [
      { id: "street", label: "Street/subway to eastern overpass", elevators: [{ externalId: "JAM-521", label: "Eastern overpass — street level & subway" }] },
      { id: "platform", label: "Overpass to Tracks 1 & 2", elevators: [{ externalId: "JAM-430", label: "Tracks 1 & 2" }] },
    ],
  },
  {
    systemId: "mta-lirr",
    stationExternalId: "JAM",
    chainLabel: " (Tks 2/3)",
    segments: [
      { id: "street", label: "Street/subway to eastern overpass", elevators: [{ externalId: "JAM-521", label: "Eastern overpass — street level & subway" }] },
      { id: "platform", label: "Overpass to Tracks 2 & 3", elevators: [{ externalId: "JAM-341", label: "Tracks 2 & 3" }] },
    ],
  },
  {
    systemId: "mta-lirr",
    stationExternalId: "JAM",
    chainLabel: " (Tks 4/5)",
    segments: [
      { id: "street", label: "Street/subway to eastern overpass", elevators: [{ externalId: "JAM-521", label: "Eastern overpass — street level & subway" }] },
      { id: "platform", label: "Overpass to Tracks 4 & 5", elevators: [{ externalId: "JAM-342", label: "Tracks 4 & 5" }] },
    ],
  },
  {
    systemId: "mta-lirr",
    stationExternalId: "JAM",
    chainLabel: " (Tks 6/7)",
    segments: [
      { id: "street", label: "Street/subway to eastern overpass", elevators: [{ externalId: "JAM-521", label: "Eastern overpass — street level & subway" }] },
      { id: "platform", label: "Overpass to Tracks 6 & 7", elevators: [{ externalId: "JAM-401", label: "Tracks 6 & 7" }] },
    ],
  },
  {
    systemId: "mta-lirr",
    stationExternalId: "JAM",
    chainLabel: " (Tks 7/8)",
    segments: [
      { id: "street", label: "Street/subway to eastern overpass", elevators: [{ externalId: "JAM-521", label: "Eastern overpass — street level & subway" }] },
      { id: "platform", label: "Overpass to Tracks 7 & 8", elevators: [{ externalId: "JAM-402", label: "Tracks 7 & 8" }] },
    ],
  },
  {
    systemId: "mta-lirr",
    stationExternalId: "JAM",
    chainLabel: " (Tks 11/12)",
    segments: [
      { id: "street", label: "Street/subway to eastern overpass", elevators: [{ externalId: "JAM-521", label: "Eastern overpass — street level & subway" }] },
      { id: "platform", label: "Overpass to Tracks 11 & 12", elevators: [{ externalId: "JAM-761", label: "Tracks 11 & 12" }] },
    ],
  },
  {
    // Woodside: elevator 449 is a three-stop unit (street, mezzanine, and
    // Platform A/Track 4), so it alone gates Platform A AND is every other
    // platform's street leg. The subway's EL415X (street to the shared
    // mezzanine, ADA) is a cross-system backup for the street leg that this
    // model conservatively can't see.
    systemId: "mta-lirr",
    stationExternalId: "WDD",
    chainLabel: " (Platform A)",
    note: "Woodside Platform A (Track 4): elevator 449 runs street–mezzanine–platform in one shaft, so it alone gates this platform. The subway's EL415X street elevator is an unmodeled cross-system backup for reaching the mezzanine.",
    segments: [
      { id: "street-platform-a", label: "Street/mezzanine to Platform A (Track 4)", elevators: [{ externalId: "WDD-449", label: "Street–mezzanine–Platform A (Track 4)" }] },
    ],
  },
  {
    systemId: "mta-lirr",
    stationExternalId: "WDD",
    chainLabel: " (Platform B)",
    segments: [
      { id: "street", label: "Street to mezzanine", elevators: [{ externalId: "WDD-449", label: "Street–mezzanine–Platform A (Track 4)" }] },
      { id: "platform-b", label: "Mezzanine to Platform B (Tracks 2 & 3)", elevators: [{ externalId: "WDD-448", label: "Mezzanine to Tracks 2 & 3" }] },
    ],
  },
  {
    systemId: "mta-lirr",
    stationExternalId: "WDD",
    chainLabel: " (Platform C)",
    segments: [
      { id: "street", label: "Street to mezzanine", elevators: [{ externalId: "WDD-449", label: "Street–mezzanine–Platform A (Track 4)" }] },
      { id: "platform-c", label: "Mezzanine to Platform C (Track 1)", elevators: [{ externalId: "WDD-447", label: "Mezzanine to Track 1" }] },
    ],
  },
  {
    // Grand Central Madison: three redundant street elevators, a redundant
    // concourse–mezzanine pair, then a redundant pair per platform group.
    // EL21 (945) connects the LIRR concourse to the Metro-North lower
    // tracks — a transfer connector, not part of Madison's own access, so
    // it is tracked but outside these chains.
    systemId: "mta-lirr",
    stationExternalId: "GCT",
    chainLabel: " (Tks 201/202·301/302)",
    note: "Grand Central Madison: three street elevators (44th/47th/48th St) back each other up into the LIRR concourse; EL01/EL02 pair concourse to mezzanine; each platform group has its own redundant elevator pair. EL21 is the Metro-North transfer connector, tracked separately outside these chains.",
    segments: [
      {
        id: "street",
        label: "Street to LIRR concourse (44th/47th/48th St)",
        elevators: [
          { externalId: "GCT-943", label: "EL12 — 44th St" },
          { externalId: "GCT-941", label: "EL13 — 47th St" },
          { externalId: "GCT-944", label: "EL20 — 48th St" },
        ],
      },
      {
        id: "concourse-mezz",
        label: "Concourse to mezzanine",
        elevators: [
          { externalId: "GCT-947", label: "EL01 — concourse to mezzanine" },
          { externalId: "GCT-948", label: "EL02 — concourse to mezzanine" },
        ],
      },
      {
        id: "platforms-201-301",
        label: "Mezzanine to Tracks 201/202 & 301/302",
        elevators: [
          { externalId: "GCT-949", label: "EL07 — Tracks 201/202 & 301/302" },
          { externalId: "GCT-950", label: "EL08 — Tracks 201/202 & 301/302" },
        ],
      },
    ],
  },
  {
    systemId: "mta-lirr",
    stationExternalId: "GCT",
    chainLabel: " (Tks 203/204·303/304)",
    segments: [
      {
        id: "street",
        label: "Street to LIRR concourse (44th/47th/48th St)",
        elevators: [
          { externalId: "GCT-943", label: "EL12 — 44th St" },
          { externalId: "GCT-941", label: "EL13 — 47th St" },
          { externalId: "GCT-944", label: "EL20 — 48th St" },
        ],
      },
      {
        id: "concourse-mezz",
        label: "Concourse to mezzanine",
        elevators: [
          { externalId: "GCT-947", label: "EL01 — concourse to mezzanine" },
          { externalId: "GCT-948", label: "EL02 — concourse to mezzanine" },
        ],
      },
      {
        id: "platforms-203-303",
        label: "Mezzanine to Tracks 203/204 & 303/304",
        elevators: [
          { externalId: "GCT-951", label: "EL05 — Tracks 203/204 & 303/304" },
          { externalId: "GCT-942", label: "EL06 — Tracks 203/204 & 303/304" },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------- MNR
  {
    systemId: "mta-mnr",
    stationExternalId: "0HL",
    chainLabel: " (Tks 1/3)",
    note: "Harlem-125 St: each island platform has a single elevator from the station building — sole access per platform.",
    segments: [
      { id: "platform-1-3", label: "Station building to Tracks 1 & 3 platform", elevators: [{ externalId: "0HL-002N", label: "Tracks 3 & 1 platform" }] },
    ],
  },
  {
    systemId: "mta-mnr",
    stationExternalId: "0HL",
    chainLabel: " (Tks 2/4)",
    segments: [
      { id: "platform-2-4", label: "Station building to Tracks 4 & 2 platform", elevators: [{ externalId: "0HL-002S", label: "Tracks 4 & 2 platform" }] },
    ],
  },
  {
    systemId: "mta-mnr",
    stationExternalId: "2NR",
    chainLabel: " (New York-bound)",
    note: "New Rochelle: one elevator per direction, no backups. During 206E's long-term rebuild MTA's own advisory directs riders to Larchmont — this model reads the same way (New Haven-bound chain blacked out).",
    segments: [
      { id: "ny-bound", label: "New York-bound platform (Track 3) to overpass", elevators: [{ externalId: "2NR-206W", label: "NY-bound platform (Track 3) to overpass" }] },
    ],
  },
  {
    systemId: "mta-mnr",
    stationExternalId: "2NR",
    chainLabel: " (New Haven-bound)",
    segments: [
      { id: "nh-bound", label: "Street to Stamford/New Haven-bound platform (Track 4)", elevators: [{ externalId: "2NR-206E", label: "Street to New Haven-bound platform (Track 4)" }] },
    ],
  },
  {
    systemId: "mta-mnr",
    stationExternalId: "1WP",
    note: "White Plains: one elevator gates the island platform (Tracks 1 & 2) — sole access. WP2 serves the parking garage only and sits outside the access chain.",
    segments: [
      { id: "street-island", label: "Street entrance to island platform (Tracks 1 & 2)", elevators: [{ externalId: "1WP-132I", label: "Street entrance to island platform" }] },
    ],
  },
  {
    // Yankees-E 153 St: platform legs verified from feed text; the street
    // leg is modeled through PE1 (003W, explicitly mezzanine-connected)
    // ONLY. PE4 (003P) serves the overpass east end — whether the overpass
    // and mezzanine are the same step-free level is UNVERIFIED, so PE4 is
    // conservatively omitted from chains (over-warns at worst, never
    // hides a blackout). Revisit after an on-site/StreetView check.
    systemId: "mta-mnr",
    stationExternalId: "0YS",
    chainLabel: " (Tks 1/2)",
    note: "Yankees-E 153 St: street leg modeled through PE1 (mezzanine to west parking/ferries) only; PE4's overpass-to-mezzanine relationship is unverified and conservatively omitted — the station may have more street redundancy than shown.",
    segments: [
      { id: "street", label: "West parking/ferries to mezzanine", elevators: [{ externalId: "0YS-003W", label: "PE1 — mezzanine to west parking & ferries" }] },
      { id: "platform-1-2", label: "Mezzanine to Tracks 2 & 1 platform", elevators: [{ externalId: "0YS-00321", label: "PE3 — Tracks 2 & 1 platform" }] },
    ],
  },
  {
    systemId: "mta-mnr",
    stationExternalId: "0YS",
    chainLabel: " (Tks 4/6)",
    segments: [
      { id: "street", label: "West parking/ferries to mezzanine", elevators: [{ externalId: "0YS-003W", label: "PE1 — mezzanine to west parking & ferries" }] },
      { id: "platform-4-6", label: "Mezzanine to Tracks 6 & 4 platform", elevators: [{ externalId: "0YS-00364", label: "PE2 — Tracks 6 & 4 platform" }] },
    ],
  },
  {
    // Stamford — fully walked through with a human 2026-07-06; several feed
    // strings were corrected in the process. East-end landings (ramps,
    // Elevators 01/04/07/10) reach single-track sections, NOT the island
    // platforms. Garage elevators (G1/G2/G3, 08, 09) are outside all
    // chains: "Access also possible through garage. Exact route unknown."
    systemId: "mta-mnr",
    stationExternalId: "2SM",
    chainLabel: " (Track 5)",
    note: "Stamford Track 5 has a RAMP from South State Street — always step-free, elevators (01, 10, 02-via-island) are conveniences. The Track 5 landings do NOT reach Track 3's island. Access also possible through garage. Exact route unknown.",
    segments: [
      {
        id: "track-5",
        label: "South State St to Track 5 (ramp; elevators as backup)",
        stepFreeAlternative: true, // ramp from South State Street
        elevators: [
          { externalId: "2SM-1 STM", label: "Elevator 01 — concourse, Track 5 & South State St" },
          { externalId: "2SM-2265", label: "Elevator 10 — pedestrian bridge, Track 5 & South State St" },
          { externalId: "2SM-22635", label: "Elevator 02 — concourse to Tracks 3/5 island" },
        ],
      },
    ],
  },
  {
    systemId: "mta-mnr",
    stationExternalId: "2SM",
    chainLabel: " (Track 4)",
    note: "Stamford Track 4 has a RAMP from Station Place — always step-free. The ramp and Elevator 04 land on a Track-4-only section, not the 2/4 island (human-verified).",
    segments: [
      {
        id: "track-4",
        label: "Station Place to Track 4 (ramp; elevators as backup)",
        stepFreeAlternative: true, // ramp from Station Place
        elevators: [
          { externalId: "2SM-2264", label: "Elevator 04 — concourse, Track 4 & Station Place" },
          { externalId: "2SM-22624", label: "Elevator 03 — concourse to Tracks 2/4 island" },
          { externalId: "2SM-7 STM", label: "Elevator 07 — pedestrian bridge to Track 4" },
        ],
      },
    ],
  },
  {
    systemId: "mta-mnr",
    stationExternalId: "2SM",
    chainLabel: " (Track 3)",
    note: "Stamford Track 3: the ONLY step-free route is street to concourse (Elevator 01 or 04), then Elevator 02 down to the 3/5 island — Elevator 02 is a single point of failure. Track 5's ramp/elevators land on a Track-5-only section and do not reach this island.",
    segments: [
      {
        id: "street-concourse",
        label: "Street to main concourse",
        elevators: [
          { externalId: "2SM-1 STM", label: "Elevator 01 — South State St to concourse" },
          { externalId: "2SM-2264", label: "Elevator 04 — Station Place to concourse" },
        ],
      },
      {
        id: "concourse-island-3-5",
        label: "Concourse to Tracks 3/5 island",
        elevators: [{ externalId: "2SM-22635", label: "Elevator 02 — concourse to Tracks 3/5 island" }],
      },
    ],
  },
  {
    systemId: "mta-mnr",
    stationExternalId: "2SM",
    chainLabel: " (Track 2)",
    note: "Stamford Track 2: street to concourse (Elevator 01 or 04), then Elevator 03 down to the 2/4 island — Elevator 03 is a single point of failure. Elevator 04 and the Station Place ramp land on a Track-4-only section, not this island (human-verified); the bridge's Elevator 07 likewise lands Track-4-only and is conservatively omitted.",
    segments: [
      {
        id: "street-concourse",
        label: "Street to main concourse",
        elevators: [
          { externalId: "2SM-1 STM", label: "Elevator 01 — South State St to concourse" },
          { externalId: "2SM-2264", label: "Elevator 04 — Station Place to concourse" },
        ],
      },
      {
        id: "concourse-island-2-4",
        label: "Concourse to Tracks 2/4 island",
        elevators: [{ externalId: "2SM-22624", label: "Elevator 03 — concourse to Tracks 2/4 island" }],
      },
    ],
  },
  {
    // Grand Central Terminal (MNR): the main terminal is step-free via its
    // ramps (Oyster Bar ramp, Kitty Kelly ramp) — the terminal chain can
    // never black out; its many elevators are listed for attribution only.
    // The North End Access is different: NE-4 alone reaches the Track 116 /
    // Tracks 34-35 platforms from the 45th St cross passage (it has been
    // out since 2023 — a real long-term blackout of that access point).
    // The remaining NE units (NE-1/2/3/5/6) are tracked but un-modeled
    // until their passage topology is verified.
    systemId: "mta-mnr",
    stationExternalId: "0NY",
    chainLabel: " (Terminal)",
    note: "Grand Central Terminal proper is step-free via the Oyster Bar and Kitty Kelly ramps — no elevator outage can sever main-terminal access. Elevators listed here are conveniences within the ramp-served areas.",
    segments: [
      {
        id: "terminal",
        label: "Terminal access (ramps; elevators as convenience)",
        stepFreeAlternative: true, // Oyster Bar + Kitty Kelly ramps
        elevators: [
          { externalId: "0NY-T-6", label: "Vanderbilt Av (A Hall)" },
          { externalId: "0NY-T-7", label: "Vanderbilt Av (A Hall)" },
          { externalId: "0NY-T-8", label: "Vanderbilt Av (A Hall) — ADA access to terminal" },
          { externalId: "0NY-T-9", label: "Oyster Bar ramp / Shuttle Passageway" },
          { externalId: "0NY-T-10", label: "Oyster Bar ramp / Shuttle Passageway" },
          { externalId: "0NY-T-11", label: "Oyster Bar ramp / Shuttle Passageway" },
          { externalId: "0NY-T-12", label: "Oyster Bar ramp / Shuttle Passageway" },
          { externalId: "0NY-T-13", label: "Track 11/13" },
          { externalId: "0NY-T-18", label: "Upper level, Northeast Passageway (B Hall)" },
          { externalId: "0NY-T-19", label: "Upper level, Northeast Passageway (B Hall)" },
          { externalId: "0NY-T-20", label: "Upper level, Northeast Passageway (B Hall)" },
          { externalId: "0NY-SE-6", label: "Kitty Kelly ramp, E 42nd St & Vanderbilt" },
          { externalId: "0NY-SE-7", label: "Kitty Kelly ramp, E 42nd St & Vanderbilt" },
          { externalId: "0NY-WCL", label: "Wheelchair lift at Vanderbilt Av (A Hall)" },
        ],
      },
    ],
  },
  {
    systemId: "mta-mnr",
    stationExternalId: "0NY",
    chainLabel: " (North End: Tks 34/35/116)",
    note: "Grand Central's 45th St cross passage: NE-4 is the sole elevator to the Track 116 and Tracks 34 & 35 platforms from this passage. It has been out of service since March 2023 (long-term outage). The other North End units (NE-1/2/3/5/6) are tracked but not yet modeled — passage topology unverified.",
    segments: [
      {
        id: "ne-45th-platforms",
        label: "45th St cross passage to Tk 116 / Tks 34-35 platforms",
        elevators: [{ externalId: "0NY-NE-4", label: "NE-4 — 45th St cross passage to Tk 116 & Tks 34/35" }],
      },
    ],
  },
];
