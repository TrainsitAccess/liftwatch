import type { StationModel } from "../lib/accessibility.js";

// Curated BART station models beyond the original 7 (ASHB/12TH/19TH/RICH/
// SFIA/WARM/WDUB, which stay hand-authored inline in station-models.ts —
// their structure is already verified against this same source and mostly
// correct; only WARM/WDUB needed real fixes, applied there directly).
//
// Source: bart.gov's own "Elevator Outage Options" page for each station
// (bart.gov/stations/<code>/accessible) — a REAL, BART-published, per-elevator
// signal: for every elevator, BART states what a rider should do if it's out,
// which directly reveals whether an in-station backup exists or not. Scraped
// 2026-07-08 (raw text archived at src/catalog/bart-data/elevator-pages.json
// for audit/re-verification — re-scrape and diff against it if BART's pages
// change materially). This is a stronger signal than a bare elevator-count
// heuristic: BART's own words distinguish a genuine in-station backup ("take
// the other platform elevator") from a cross-station-only fallback ("continue
// on BART to <station> and return") — the latter means a rider already headed
// there is functionally stranded at that platform even though a paired
// elevator technically exists elsewhere in the system, so it is modeled as
// NOT redundant, same rigor as every other system in this project (never
// claim redundancy without a real, unambiguous signal).
//
// 4 stations (EMBR/MONT/POWL/CIVC) additionally cross-validated against
// TransitAccess (github.com/TrainsitAccess/metro-access-alpha), a sibling
// project's field-surveyed Muni accessibility data — those 4 stations are
// BART/Muni shared stations Muni's own surveyors already walked; both sources
// agree exactly (2 sequential, non-redundant elevators: street->mezzanine,
// mezzanine->platform).
//
// Classification used throughout:
// - Single elevator, no backup at all -> one segment, one elevator (SPOF).
// - Two elevators in sequence (street then platform) with NEITHER backed up
//   -> two segments, one elevator each (both legs required, both SPOFs).
// - Two elevators serving DIFFERENT directions/platforms, each requiring a
//   ride to a DIFFERENT station and back to reach the other -> modeled as two
//   INDEPENDENT chains (chainLabel per direction, each its own SPOF) — a
//   detour through another station is not a same-station backup, the same
//   principle as MTA's per-direction non-redundant elevators (161 St).
// - Two elevators with an IMMEDIATE in-station alternative (no detour to
//   another station mentioned) -> genuinely redundant, one segment, both
//   elevators as OR-alternatives.
// - A single elevator SHARED as a bottleneck by multiple independent entry
//   paths (WDUB's platform elevator, reached via either garage) -> the same
//   externalId appears in more than one chain, same "shared prerequisite"
//   pattern as MTA's bridge elevators (e.g. Penn's EL34X); its aggregated
//   redundancy is correctly derived as non-redundant since it's sole access
//   in at least one of those chains.
//
// A few stations (COLS, MLBR, DALY, SHAY) have genuinely more complex,
// multi-modal structure (airport connectors, a Caltrain-shared complex, a
// pedestrian tunnel) — modeled carefully per-station below with notes
// explaining the real layout, not templated.

export const BART_STATION_MODELS: StationModel[] = [
  // ---- Shared BART/Muni Market St. stations (cross-validated: TransitAccess
  // field survey + BART's own outage-options page agree exactly) ----
  {
    systemId: "bart-bay-area",
    stationExternalId: "EMBR",
    note: "Street and platform elevators are each a single point of failure — BART's own guidance for either is the Montgomery St. street elevator (0.3 mi), not an in-station alternative.",
    internalNote: "Confirmed against TransitAccess's independent Muni field survey of this shared station (same 2-elevator, non-redundant structure).",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine", elevators: [{ externalId: "EMBR-ST-MARKET-DRUMM", label: "Market and Drumm — Street Elevator", matchHints: ["street"] }] },
      { id: "mezzanine-platform", label: "Mezzanine to platform", elevators: [{ externalId: "EMBR-PLAT", label: "Platform Elevator", matchHints: ["platform"] }] },
    ],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "MONT",
    note: "Street and platform elevators are each a single point of failure — BART's own guidance for either is the Embarcadero St. street elevator (0.3 mi) or Powell St. (0.4 mi), not an in-station alternative.",
    internalNote: "Confirmed against TransitAccess's independent Muni field survey of this shared station (same 2-elevator, non-redundant structure).",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine", elevators: [{ externalId: "MONT-ST-MARKET-SUTTER", label: "Market and Sutter — Street Elevator", matchHints: ["street"] }] },
      { id: "mezzanine-platform", label: "Mezzanine to platform", elevators: [{ externalId: "MONT-PLAT", label: "Platform Elevator", matchHints: ["platform"] }] },
    ],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "POWL",
    note: "Street and platform elevators are each a single point of failure — BART's own guidance routes the street elevator to the Union Square/Market St. Muni elevators (0.2 mi) and the platform elevator to Civic Center's street elevator (0.5 mi) then onward to Montgomery St. — not an in-station alternative.",
    internalNote: "Confirmed against TransitAccess's independent Muni field survey of this shared station (same 2-elevator, non-redundant structure).",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine", elevators: [{ externalId: "POWL-ST-MARKET-ELLIS", label: "Market and Ellis — Street Elevator", matchHints: ["street"] }] },
      { id: "mezzanine-platform", label: "Mezzanine to platform", elevators: [{ externalId: "POWL-PLAT", label: "Platform Elevator", matchHints: ["platform"] }] },
    ],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "CIVC",
    note: "Street and platform elevators are each a single point of failure — BART's own guidance for either is the Powell St. street elevator at Market and Ellis (0.5 mi), not an in-station alternative.",
    internalNote: "Confirmed against TransitAccess's independent Muni field survey of this shared station (same 2-elevator, non-redundant structure).",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine", elevators: [{ externalId: "CIVC-ST-UN-PLAZA", label: "U.N. Plaza — Street Elevator", matchHints: ["street"] }] },
      { id: "mezzanine-platform", label: "Mezzanine to platform", elevators: [{ externalId: "CIVC-PLAT", label: "Platform Elevator", matchHints: ["platform"] }] },
    ],
  },

  // ---- Template: single elevator, no in-station backup (pure SPOF) ----
  {
    systemId: "bart-bay-area",
    stationExternalId: "BALB",
    note: "Single station elevator, no backup. BART's own outage guidance: use another mode of transportation to Glen Park if you can't enter; continue on BART to Glen Park and back if you can't exit.",
    segments: [{ id: "station", label: "Station elevator", elevators: [{ externalId: "BALB-EL", label: "Station elevator", matchHints: ["elevator"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "BAYF",
    note: "Single station elevator, no backup. BART's guidance: the nearest alternative is San Leandro station.",
    segments: [{ id: "station", label: "Station elevator", elevators: [{ externalId: "BAYF-EL", label: "Station elevator", matchHints: ["elevator"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "BERY",
    note: "Single station elevator, no backup. BART's guidance: the nearest alternative is Milpitas station.",
    segments: [{ id: "station", label: "Station elevator", elevators: [{ externalId: "BERY-EL", label: "Station elevator", matchHints: ["elevator"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "CAST",
    note: "Single station elevator, no backup. BART's guidance: the nearest alternative is Hayward station.",
    segments: [{ id: "station", label: "Station elevator", elevators: [{ externalId: "CAST-EL", label: "Station elevator", matchHints: ["elevator"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "COLM",
    note: "Single platform elevator, no backup. BART's guidance: the nearest alternatives are Daly City and South San Francisco, both about 2 miles away.",
    segments: [{ id: "platform", label: "Platform elevator", elevators: [{ externalId: "COLM-PLAT", label: "Platform elevator", matchHints: ["platform"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "CONC",
    note: "Single station elevator, no backup. BART's guidance: the nearest alternative is North Concord/Martinez station.",
    segments: [{ id: "station", label: "Station elevator", elevators: [{ externalId: "CONC-EL", label: "Station elevator", matchHints: ["elevator"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "DUBL",
    note: "Single station elevator, no backup. BART's guidance: the nearest alternative is West Dublin/Pleasanton station.",
    segments: [{ id: "station", label: "Station elevator", elevators: [{ externalId: "DUBL-EL", label: "Station elevator", matchHints: ["elevator"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "FRMT",
    note: "Single station elevator, no backup. BART's guidance: the nearest alternative is Warm Springs/South Fremont station.",
    segments: [{ id: "station", label: "Station elevator", elevators: [{ externalId: "FRMT-EL", label: "Station elevator", matchHints: ["elevator"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "GLEN",
    note: "Single station elevator, no backup. BART's guidance: the nearest alternative is Balboa Park station.",
    segments: [{ id: "station", label: "Station elevator", elevators: [{ externalId: "GLEN-EL", label: "Station elevator", matchHints: ["elevator"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "LAFY",
    note: "Single station elevator, no backup. BART's guidance: the nearest alternative is Orinda station.",
    segments: [{ id: "station", label: "Station elevator", elevators: [{ externalId: "LAFY-EL", label: "Station elevator", matchHints: ["elevator"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "NBRK",
    note: "Single station elevator, no backup. BART's guidance: the nearest alternative is Downtown Berkeley station.",
    segments: [{ id: "station", label: "Station elevator", elevators: [{ externalId: "NBRK-EL", label: "Station elevator", matchHints: ["elevator"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "NCON",
    note: "Single station elevator, no backup. BART's guidance: the nearest alternative is Concord station.",
    segments: [{ id: "station", label: "Station elevator", elevators: [{ externalId: "NCON-EL", label: "Station elevator", matchHints: ["elevator"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "ORIN",
    note: "Single station elevator, no backup. BART's guidance: the nearest alternative is Lafayette station.",
    segments: [{ id: "station", label: "Station elevator", elevators: [{ externalId: "ORIN-EL", label: "Station elevator", matchHints: ["elevator"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "PCTR",
    note: "Single station elevator, no backup. BART's guidance: the nearest alternative is Pittsburg/Bay Point station.",
    segments: [{ id: "station", label: "Station elevator", elevators: [{ externalId: "PCTR-EL", label: "Station elevator", matchHints: ["elevator"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "ROCK",
    note: "Single station elevator, no backup. BART's guidance: the nearest alternative is MacArthur station.",
    segments: [{ id: "station", label: "Station elevator", elevators: [{ externalId: "ROCK-EL", label: "Station elevator", matchHints: ["elevator"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "SBRN",
    note: "Single station elevator, no backup. BART's guidance: the nearest alternative is South San Francisco station.",
    segments: [{ id: "station", label: "Station elevator", elevators: [{ externalId: "SBRN-EL", label: "Station elevator", matchHints: ["elevator"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "SSAN",
    note: "Single station elevator, no backup. BART's guidance: the nearest alternative is Colma station.",
    segments: [{ id: "station", label: "Station elevator", elevators: [{ externalId: "SSAN-EL", label: "Station elevator", matchHints: ["elevator"] }] }],
  },

  // ---- Template: two sequential elevators (street then platform), neither backed up ----
  {
    systemId: "bart-bay-area",
    stationExternalId: "16TH",
    note: "Street and platform elevators are each a single point of failure — BART's own guidance for either is to use Muni to 24th St. Mission instead, not an in-station alternative.",
    segments: [
      { id: "street-concourse", label: "Street to concourse", elevators: [{ externalId: "16TH-ST", label: "Street elevator", matchHints: ["street"] }] },
      { id: "concourse-platform", label: "Concourse to platform", elevators: [{ externalId: "16TH-PLAT", label: "Platform elevator", matchHints: ["platform"] }] },
    ],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "24TH",
    note: "Street and platform elevators are each a single point of failure — BART's own guidance for either is to use Muni to 16th St. Mission instead, not an in-station alternative.",
    segments: [
      { id: "street-concourse", label: "Street to concourse", elevators: [{ externalId: "24TH-ST", label: "Street elevator", matchHints: ["street"] }] },
      { id: "concourse-platform", label: "Concourse to platform", elevators: [{ externalId: "24TH-PLAT", label: "Platform elevator", matchHints: ["platform"] }] },
    ],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "ANTC",
    note: "Street (concourse-to-walkway) and platform (walkway-to-platform) elevators are each a single point of failure — BART's guidance for either is Tri Delta Transit to Pittsburg Center, not an in-station alternative.",
    segments: [
      { id: "street-walkway", label: "Concourse to walkway", elevators: [{ externalId: "ANTC-ST", label: "Street elevator (concourse to walkway)", matchHints: ["street"] }] },
      { id: "walkway-platform", label: "Walkway to platform", elevators: [{ externalId: "ANTC-PLAT", label: "Platform elevator (walkway to platform)", matchHints: ["platform"] }] },
    ],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "DBRK",
    note: "Street and platform elevators are each a single point of failure — BART's own guidance for either is Ashby (1.3 mi) or North Berkeley (1.1 mi), not an in-station alternative.",
    segments: [
      { id: "street-concourse", label: "Street to concourse", elevators: [{ externalId: "DBRK-ST", label: "Street elevator", matchHints: ["street"] }] },
      { id: "concourse-platform", label: "Concourse to platform", elevators: [{ externalId: "DBRK-PLAT", label: "Platform elevator", matchHints: ["platform"] }] },
    ],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "PITT",
    note: "Street and platform elevators are each a single point of failure — BART's own guidance for either is Tri Delta Transit to Concord, not an in-station alternative.",
    segments: [
      { id: "street-concourse", label: "Street to concourse", elevators: [{ externalId: "PITT-ST", label: "Street elevator", matchHints: ["street"] }] },
      { id: "concourse-platform", label: "Concourse to platform", elevators: [{ externalId: "PITT-PLAT", label: "Platform elevator", matchHints: ["platform"] }] },
    ],
  },
  {
    // BART's own page gives both elevators here IDENTICAL fallback text ("walk
    // 0.6mi to 12th St.'s street elevator" / "continue on BART to 12th St.")
    // rather than pointing them at each other — read literally (conservative,
    // per the never-guess-redundancy rule), Lake Merritt's own platform and
    // street elevators do NOT back each other up.
    systemId: "bart-bay-area",
    stationExternalId: "LAKE",
    note: "Platform and street elevators are each a single point of failure — BART's own guidance for either is the 12th St. Oakland City Center street elevator (0.6 mi), not each other.",
    segments: [
      { id: "street-concourse", label: "Street to concourse", elevators: [{ externalId: "LAKE-ST", label: "Street elevator", matchHints: ["street"] }] },
      { id: "concourse-platform", label: "Concourse to platform", elevators: [{ externalId: "LAKE-PLAT", label: "Platform elevator", matchHints: ["platform"] }] },
    ],
  },

  // ---- Template: two elevators serving different directions, detour required ----
  {
    systemId: "bart-bay-area",
    stationExternalId: "DELN",
    chainLabel: " (Richmond direction)",
    note: "Platform 1 (Richmond direction) has no in-station backup — BART's own guidance is to ride to El Cerrito Plaza and back, using the opposite platform's elevator only after that detour.",
    segments: [{ id: "platform-1", label: "Platform 1 (Richmond direction)", elevators: [{ externalId: "DELN-PLAT-1", label: "Platform 1 elevator (Richmond direction)", matchHints: ["platform 1","richmond"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "DELN",
    chainLabel: " (Berryessa/SFO/Millbrae/Daly City direction)",
    note: "Platform 2 (Berryessa/SFO/Millbrae/Daly City direction) has no in-station backup — BART's own guidance is to ride to Richmond and back, using the opposite platform's elevator only after that detour.",
    segments: [{ id: "platform-2", label: "Platform 2 (Berryessa/SFO/Millbrae/Daly City direction)", elevators: [{ externalId: "DELN-PLAT-2", label: "Platform 2 elevator (Berryessa/SFO/Millbrae/Daly City direction)", matchHints: ["platform 2","berryessa","sfo","millbrae","daly city"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "PLZA",
    chainLabel: " (Richmond direction)",
    note: "Platform 1 (Richmond direction) has no in-station backup — BART's own guidance is to ride to El Cerrito del Norte and back, using the opposite platform's elevator only after that detour.",
    segments: [{ id: "platform-1", label: "Platform 1 (Richmond direction)", elevators: [{ externalId: "PLZA-PLAT-1", label: "Platform 1 elevator (Richmond direction)", matchHints: ["platform 1","richmond"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "PLZA",
    chainLabel: " (Berryessa/SFO/Millbrae/Daly City direction)",
    note: "Platform 2 (Berryessa/SFO/Millbrae/Daly City direction) has no in-station backup — BART's own guidance is to ride to North Berkeley and back, using the opposite platform's elevator only after that detour.",
    segments: [{ id: "platform-2", label: "Platform 2 (Berryessa/SFO/Millbrae/Daly City direction)", elevators: [{ externalId: "PLZA-PLAT-2", label: "Platform 2 elevator (Berryessa/SFO/Millbrae/Daly City direction)", matchHints: ["platform 2","berryessa","sfo","millbrae","daly city"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "FTVL",
    chainLabel: " (Richmond/Millbrae/SFO/Daly City direction)",
    note: "Platform 2 (Richmond/Millbrae/SFO/Daly City direction) has no in-station backup — BART's own guidance is to ride to Coliseum and back, using the opposite platform's elevator only after that detour.",
    segments: [{ id: "platform-2", label: "Platform 2 (Richmond/Millbrae/SFO/Daly City direction)", elevators: [{ externalId: "FTVL-PLAT-2", label: "Platform 2 elevator", matchHints: ["platform 2","richmond","millbrae","sfo","daly city"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "FTVL",
    chainLabel: " (Dublin/Berryessa direction)",
    note: "Platform 1 (Dublin/Berryessa direction) has no in-station backup — BART's own guidance is to ride to Lake Merritt and back, using the opposite platform's elevator only after that detour.",
    segments: [{ id: "platform-1", label: "Platform 1 elevator", elevators: [{ externalId: "FTVL-PLAT-1", label: "Platform 1 elevator", matchHints: ["platform 1","dublin","berryessa"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "HAYW",
    chainLabel: " (Richmond/Daly City direction)",
    note: "Platform 2 (Richmond/Daly City direction) has no in-station backup — BART's own guidance is to ride to South Hayward and back, using the opposite platform's elevator only after that detour.",
    segments: [{ id: "platform-2", label: "Platform 2 elevator", elevators: [{ externalId: "HAYW-PLAT-2", label: "Platform 2 elevator", matchHints: ["platform 2","richmond","daly city"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "HAYW",
    chainLabel: " (Berryessa direction)",
    note: "Platform 1 (Berryessa direction) has no in-station backup — BART's own guidance is to ride to Bay Fair and back, using the opposite platform's elevator only after that detour.",
    segments: [{ id: "platform-1", label: "Platform 1 elevator", elevators: [{ externalId: "HAYW-PLAT-1", label: "Platform 1 elevator", matchHints: ["platform 1","berryessa"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "PHIL",
    chainLabel: " (Antioch direction)",
    note: "Platform 1 (Antioch direction) has no in-station backup — BART's own guidance is to ride to Walnut Creek and back, using the opposite platform's elevator only after that detour.",
    segments: [{ id: "platform-1", label: "Platform 1 elevator", elevators: [{ externalId: "PHIL-PLAT-1", label: "Platform 1 elevator", matchHints: ["platform 1","antioch"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "PHIL",
    chainLabel: " (SFO/Millbrae/Daly City direction)",
    note: "Platform 2 (SFO/Millbrae/Daly City direction) has no in-station backup — BART's own guidance is to ride to Concord and back, using the opposite platform's elevator only after that detour.",
    segments: [{ id: "platform-2", label: "Platform 2 elevator", elevators: [{ externalId: "PHIL-PLAT-2", label: "Platform 2 elevator", matchHints: ["platform 2","sfo","millbrae","daly city"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "SANL",
    chainLabel: " (Richmond/SFO/Millbrae/Daly City direction)",
    note: "Platform 2 (Richmond/SFO/Millbrae/Daly City direction) has no in-station backup — BART's own guidance is to ride to Bay Fair and back, using the opposite platform's elevator only after that detour.",
    segments: [{ id: "platform-2", label: "Platform 2 elevator", elevators: [{ externalId: "SANL-PLAT-2", label: "Platform 2 elevator", matchHints: ["platform 2","richmond","sfo","millbrae","daly city"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "SANL",
    chainLabel: " (Dublin/Berryessa direction)",
    note: "Platform 1 (Dublin/Berryessa direction) has no in-station backup — BART's own guidance is to ride to Coliseum and back, using the opposite platform's elevator only after that detour.",
    segments: [{ id: "platform-1", label: "Platform 1 elevator", elevators: [{ externalId: "SANL-PLAT-1", label: "Platform 1 elevator", matchHints: ["platform 1","dublin","berryessa"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "UCTY",
    chainLabel: " (Berryessa direction)",
    note: "Platform 1 (Berryessa direction) has no in-station backup — BART's own guidance is to ride to South Hayward and back, using the opposite platform's elevator only after that detour.",
    segments: [{ id: "platform-1", label: "Platform 1 elevator", elevators: [{ externalId: "UCTY-PLAT-1", label: "Platform 1 elevator", matchHints: ["platform 1","berryessa"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "UCTY",
    chainLabel: " (Richmond/SFO/Millbrae/Daly City direction)",
    note: "Platform 2 (Richmond/SFO/Millbrae/Daly City direction) has no in-station backup — BART's own guidance is to ride to Fremont and back, using the opposite platform's elevator only after that detour.",
    segments: [{ id: "platform-2", label: "Platform 2 elevator", elevators: [{ externalId: "UCTY-PLAT-2", label: "Platform 2 elevator", matchHints: ["platform 2","richmond","sfo","millbrae","daly city"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "WCRK",
    chainLabel: " (Antioch direction)",
    note: "Platform 1 (Antioch direction) has no in-station backup — BART's own guidance is to ride to Lafayette and back, using the opposite platform's elevator only after that detour.",
    segments: [{ id: "platform-1", label: "Platform 1 elevator", elevators: [{ externalId: "WCRK-PLAT-1", label: "Platform 1 elevator", matchHints: ["platform 1","antioch"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "WCRK",
    chainLabel: " (SFO/Millbrae/Daly City direction)",
    note: "Platform 2 (SFO/Millbrae/Daly City direction) has no in-station backup — BART's own guidance is to ride to Pleasant Hill/Contra Costa Centre and back, using the opposite platform's elevator only after that detour.",
    segments: [{ id: "platform-2", label: "Platform 2 elevator", elevators: [{ externalId: "WCRK-PLAT-2", label: "Platform 2 elevator", matchHints: ["platform 2","sfo","millbrae","daly city"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "WOAK",
    chainLabel: " (SFO/Millbrae/Daly City direction)",
    note: "Platform 1 (SFO/Millbrae/Daly City direction) has no in-station backup — BART's own guidance is to ride to Lake Merritt or 12th St. Oakland City Center and back, using the opposite platform's elevator only after that detour.",
    segments: [{ id: "platform-1", label: "Platform 1 elevator", elevators: [{ externalId: "WOAK-PLAT-1", label: "Platform 1 elevator", matchHints: ["platform 1","sfo","millbrae","daly city"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "WOAK",
    chainLabel: " (Dublin/Antioch/Richmond/Berryessa direction)",
    note: "Platform 2 (Dublin/Antioch/Richmond/Berryessa direction) has no in-station backup — BART's own guidance is to ride to Embarcadero and back, using the opposite platform's elevator only after that detour.",
    segments: [{ id: "platform-2", label: "Platform 2 elevator", elevators: [{ externalId: "WOAK-PLAT-2", label: "Platform 2 elevator", matchHints: ["platform 2","dublin","antioch","richmond","berryessa"] }] }],
  },
  {
    // MacArthur: each elevator serves a PAIR of same-direction platforms
    // (a 3-way junction), but the two elevators do not back each other up —
    // BART's own guidance for either is a ride to a different station and back.
    systemId: "bart-bay-area",
    stationExternalId: "MCAR",
    chainLabel: " (SFO/Millbrae/Daly City, Berryessa direction)",
    note: "The Platforms 2 & 4 elevator (SFO/Millbrae/Daly City, Berryessa direction) has no in-station backup — BART's own guidance is to ride to Rockridge, Ashby, or 19th St. Oakland and back, using the Platforms 1 & 3 elevator only after that detour.",
    segments: [{ id: "platforms-2-4", label: "Platforms 2 & 4", elevators: [{ externalId: "MCAR-PLAT-24", label: "Platforms 2 & 4 elevator", matchHints: ["platform","sfo","millbrae","daly city","berryessa"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "MCAR",
    chainLabel: " (Antioch, Richmond direction)",
    note: "The Platforms 1 & 3 elevator (Antioch, Richmond direction) has no in-station backup — BART's own guidance is to ride to 19th St. Oakland, Rockridge, or Ashby and back, using the Platforms 2 & 4 elevator only after that detour.",
    segments: [{ id: "platforms-1-3", label: "Platforms 1 & 3", elevators: [{ externalId: "MCAR-PLAT-13", label: "Platforms 1 & 3 elevator", matchHints: ["platform","antioch","richmond"] }] }],
  },
  {
    // Milpitas: the two platform elevators are named for their OWN direction
    // (Berryessa-bound vs the other), and the fallback for each explicitly
    // requires boarding BART to a different station before reaching the
    // other elevator — a detour, not an in-station backup.
    systemId: "bart-bay-area",
    stationExternalId: "MLPT",
    chainLabel: " (Berryessa direction)",
    note: "Platform 1 (Berryessa direction) has no in-station backup — BART's own guidance is to use the opposite platform's elevator only after riding to Warm Springs/South Fremont and back.",
    segments: [{ id: "platform-1", label: "Platform 1 elevator", elevators: [{ externalId: "MLPT-PLAT-1", label: "Platform 1 elevator (Berryessa direction)", matchHints: ["platform 1","berryessa"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "MLPT",
    chainLabel: " (Millbrae/SFO/Daly City/Richmond direction)",
    note: "Platform 2 (Millbrae/SFO/Daly City/Richmond direction) has no in-station backup — BART's own guidance is to use the opposite platform's elevator only after riding to Berryessa/North San Jose and back.",
    // "east bay" added 2026-07-08: BART's LIVE advisory feed uses a regional
    // shorthand ("SF/East Bay") rather than the detailed outage-options
    // page's specific terminus names — confirmed against a real, currently-
    // live MLPT outage (verified via poll:bart:dry before shipping). This is
    // the only station where a live example exists to confirm this shorthand
    // pattern; the other per-direction stations' hints are NOT yet verified
    // against real live-feed phrasing, only against the outage-options page.
    segments: [{ id: "platform-2", label: "Platform 2 elevator", elevators: [{ externalId: "MLPT-PLAT-2", label: "Platform 2 elevator (Millbrae/SFO/Daly City/Richmond direction)", matchHints: ["platform 2","millbrae","sfo","daly city","richmond","east bay"] }] }],
  },

  // ---- Special / more complex real layouts ----
  {
    // Oakland Airport Connector: a single elevator dedicated to the
    // connector platform, no backup — a detour is via AC Transit bus, not
    // another BART elevator.
    systemId: "bart-bay-area",
    stationExternalId: "OAKL",
    note: "Single elevator to the Oakland Airport Connector platform, no backup — BART's own guidance is AC Transit bus as the alternative, not another elevator.",
    segments: [{ id: "connector", label: "Connector platform elevator", elevators: [{ externalId: "OAKL-EL", label: "Airport connector elevator", matchHints: ["elevator"] }] }],
  },
  {
    // Coliseum: BART lists FOUR pieces of equipment here (accessible-station
    // page). Three are ELEVATORS, each serving an INDEPENDENT destination, so
    // each is its own chain sharing the COLS id — the main station chain (BART
    // platforms) plus two AUXILIARY chains (Oakland Airport Connector, arena
    // footbridge). An auxiliary outage severs only its own labeled route, never
    // the BART platforms. The FOURTH, the parking-lot wheelchair LIFT, is NOT an
    // elevator — it lives in the other-accessibility-equipment layer
    // (bart-other-equipment.ts), never the elevator inventory. HINT ASSIGNMENT
    // per Bryce's own observations of BART's
    // (unreliable) live text: the STATION elevator gets NO hint — it's the
    // platform default, so anything not claimed by an auxiliary lands here
    // ("Terminal/Station" is the platform elevator, per Bryce); "Station -
    // Tunnel" is the ARENA footbridge elevator (per Bryce), so "tunnel" hints
    // the arena, NOT the station. The OAC hint is still a GUESS from BART's page
    // name (no live OAC advisory observed) — flagged for confirmation, same
    // honesty caveat as the unconfirmed per-direction stations.
    systemId: "bart-bay-area",
    stationExternalId: "COLS",
    note: "Station elevator: sole step-free access to the BART platforms — no in-station backup, BART's outage guidance is an AC Transit bus to Fruitvale (2.1 mi). No matchHint: it is the platform default, so a bare/unclaimed COLS advisory resolves here.",
    segments: [{ id: "station", label: "Station elevator (to BART platforms)", elevators: [{ externalId: "COLS-EL", label: "Station elevator" }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "COLS",
    chainLabel: " (Oakland Airport Connector)",
    auxiliary: true,
    note: "Elevator to the Oakland Airport Connector (OAC) platform — a separate BART destination. Sole step-free access to the OAC (BART's outage guidance is an AC Transit bus to the airport); its loss severs the OAC route only, not the BART platforms. Hints are a GUESS (no observed OAC advisory).",
    segments: [{ id: "oac", label: "Elevator to Oakland Airport Connector", elevators: [{ externalId: "COLS-OAC", label: "Oakland Airport Connector elevator", matchHints: ["airport", "connector", "oac"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "COLS",
    chainLabel: " (Arena footbridge)",
    auxiliary: true,
    note: "Elevator to the pedestrian footbridge to the Oakland Arena. Not sole access — BART's guidance routes around it via a ramp from the Amtrak parking lot (73rd St), a step-free alternative, so its loss does not sever step-free access to the arena. Bryce: BART's 'Station - Tunnel' advisory refers to THIS elevator, hence the 'tunnel' hint.",
    segments: [{ id: "arena", label: "Footbridge elevator to arena", stepFreeAlternative: true, elevators: [{ externalId: "COLS-ARENA", label: "Arena footbridge elevator", matchHints: ["tunnel", "arena", "footbridge"] }] }],
  },
  {
    // Daly City: Platforms 1&2 (East Bay direction) and Platform 3 (SFO/
    // Millbrae direction) each have no in-station backup for exiting (only a
    // ride-and-return to the other platform) — modeled as 2 independent
    // chains. The separate pedestrian-tunnel elevator pair is its own access
    // point (garage/parking to the main entrance), modeled as a 3rd chain.
    systemId: "bart-bay-area",
    stationExternalId: "DALY",
    chainLabel: " (East Bay direction)",
    note: "The Platforms 1 & 2 elevator (East Bay direction) has no in-station backup — BART's own guidance is to ride to Balboa Park and back, using the Platform 3 elevator only after that detour.",
    segments: [{ id: "platforms-1-2", label: "Platforms 1 & 2", elevators: [{ externalId: "DALY-PLAT-12", label: "Platforms 1 & 2 elevator", matchHints: ["platform","east bay"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "DALY",
    chainLabel: " (SFO/Millbrae direction)",
    note: "The Platform 3 elevator (SFO/Millbrae direction) has no in-station backup — BART's own guidance is to ride to Colma and back, using the Platforms 1 & 2 elevator only after that detour.",
    segments: [{ id: "platform-3", label: "Platform 3", elevators: [{ externalId: "DALY-PLAT-3", label: "Platform 3 elevator", matchHints: ["platform 3","sfo","millbrae"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "DALY",
    chainLabel: " (pedestrian tunnel)",
    note: "With the pedestrian-tunnel elevator out, BART's own step-free alternative is the surface route: a walk/roll of about 0.3 miles via John Daly Blvd. and De Long St. — within the project's 0.3-mile elevator-free-detour limit, so this route stays accessible, with the walk disclosed here.",
    segments: [{
      id: "tunnel",
      label: "Pedestrian tunnel elevator (surface walk ~0.3 mi as backup)",
      // Policy (2026-07-10, Bryce): an ELEVATOR-FREE step-free detour of at
      // most 0.3 miles counts as a real alternative — but the walk must be
      // disclosed to the rider (note + label above). Warm Springs' 0.8 mi
      // stays a non-backup; 19th St's 0.3 mi walk depends on ANOTHER
      // station's elevator, so it stays a non-backup too (the detour itself
      // must be elevator-free).
      stepFreeAlternative: true,
      elevators: [{ externalId: "DALY-TUNNEL", label: "Pedestrian tunnel elevator", matchHints: ["tunnel"] }],
    }],
  },
  {
    // South Hayward: a genuinely asymmetric two-leg layout — the "station"
    // elevator covers street-to-platform-1-and-bridge in one move, while a
    // separate elevator covers the bridge onward to platform 2. Modeled as
    // two independent chains (each platform's own access), since the second
    // leg (bridge to platform 2) is a distinct SPOF beyond the first.
    systemId: "bart-bay-area",
    stationExternalId: "SHAY",
    chainLabel: " (Berryessa direction, Platform 1)",
    note: "The station elevator (street to Platform 1 and the pedestrian bridge) has no backup — BART's own guidance is an AC Transit bus to Hayward.",
    segments: [{ id: "street-platform-1", label: "Street to Platform 1 / bridge", elevators: [{ externalId: "SHAY-EL", label: "Station elevator (street to Platform 1 and bridge)", matchHints: ["elevator"] }] }],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "SHAY",
    chainLabel: " (Richmond/SFO/Millbrae/Daly City direction, Platform 2)",
    note: "The bridge-to-Platform-2 elevator has no backup of its own for exiting — BART's own guidance is to ride to Union City and back, using the Platform 1 route only after that detour.",
    segments: [{ id: "bridge-platform-2", label: "Bridge to Platform 2", elevators: [{ externalId: "SHAY-PLAT-2", label: "Bridge to Platform 2 elevator", matchHints: ["platform 2"] }] }],
  },
  {
    // Millbrae: a real BART/Caltrain shared complex. Modeled on the
    // BART-relevant elevators only (Caltrain's own platform elevators are out
    // of scope — Caltrain isn't a tracked system here). The BART Platform 3
    // elevator and the Caltrain concourse-to-northbound-platform elevator
    // explicitly back each other up per BART's own text ("Use the Caltrain
    // Platform 4/Northbound elevator" / "Use the BART Platform 3 elevator"),
    // so BOTH are tracked even though one belongs to Caltrain's platform,
    // because it's the one real named backup for BART's own Platform 3
    // access — same principle as MTA's Penn Station EL34X/LIRR NYK-861
    // overlap (a real, deliberately cross-tracked shared physical link).
    systemId: "bart-bay-area",
    stationExternalId: "MLBR",
    note: "BART's Platform 3 elevator and the Caltrain concourse-to-northbound-platform elevator explicitly back each other up per BART's own guidance (\"use the Caltrain Platform 4/Northbound elevator\" / \"use the BART Platform 3 elevator\") — a real cross-agency backup at this shared station, tracked here even though one elevator is nominally Caltrain's. Separately, the East Plaza street elevator and the parking-garage elevator explicitly back each other up too (\"take the elevator in the BART parking garage\"); the West Plaza (Caltrain) elevator's own guidance is \"access from the opposite (East Plaza) side\", so all three form one shared concourse-access group.",
    segments: [
      { id: "platform-3", label: "Platform access (BART Platform 3 / Caltrain Platform 4 Northbound)", elevators: [
        { externalId: "MLBR-PLAT-3", label: "BART Platform 3 elevator", matchHints: ["platform 3"] },
        { externalId: "MLBR-CALTRAIN-NB", label: "Caltrain concourse-to-northbound-platform elevator", matchHints: ["caltrain", "northbound"] },
      ] },
      { id: "concourse-access", label: "Street/plaza to concourse", elevators: [
        { externalId: "MLBR-EAST-PLAZA", label: "East Plaza street elevator", matchHints: ["east plaza"] },
        { externalId: "MLBR-GARAGE", label: "BART parking garage elevator", matchHints: ["garage"] },
        { externalId: "MLBR-WEST-PLAZA", label: "West Plaza (Caltrain) elevator", matchHints: ["west plaza", "caltrain"] },
      ] },
    ],
  },
];
