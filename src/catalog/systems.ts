// The system catalog: the single source of truth for which systems exist and
// their metadata. Adding a system = adding an entry here (+ an adapter binding
// in ../adapters/registry.ts, or pure config once generic adapters land).

export interface SystemCatalogEntry {
  id: string;
  name: string;
  shortName: string;
  city: string;
  metroArea: string;
  country: string;
  countryCode: string; // ISO 3166-1 alpha-2
  continent: string;
  timezone: string; // IANA
  adapter: string;
  // Overrides the site's long-form label (e.g. leaderboard/screen-reader
  // text), which otherwise defaults to "{shortName} ({city})". Use when
  // leading with the city reads better than the operator's own brand — e.g.
  // "TMB" isn't a widely recognized name the way "BART" or "TfL" are.
  displayLabel?: string;
  // Overrides the split-flap board's fixed-width (13-char) name column,
  // which otherwise defaults to shortName. The board can't fit a compound
  // label like displayLabel (e.g. "Barcelona (TMB Metro)" is 21 chars, would
  // get cut off mid-word) — use this for a short, board-only substitute
  // (e.g. just the city name) when shortName alone isn't the clearest label.
  boardLabel?: string;
  dataQuality: "good" | "fair" | "best_effort";
  // "confirmed-none": redundancy is fully curated, so a station with no model is a
  // confirmed non-redundant station (not merely 'assumed'). Defaults to "assumed".
  redundancyBaseline?: "assumed" | "confirmed-none";
  // false => the feed only reveals units as they break (no denominator feed).
  // Suppresses %-of-fleet-down displays AND the single_elevator redundancy
  // inference (counting broken units as the station's whole fleet would be
  // wrong). Defaults to true.
  inventoryComplete?: boolean;
  // A system-wide fleet total the agency has PUBLISHED (a press/website
  // statistic), for systems with inventoryComplete: false. USED as the pctDown
  // denominator and DOES participate in ranking — it's the best available
  // number when no live inventory feed exists. But it is static (not from a
  // live feed) and will drift as the agency's real fleet changes, so every
  // display of a percentage computed from it must be visibly marked (e.g. an
  // asterisk) and carry its source + as-of date, so it's never confused with a
  // system whose percentage comes from a live, currently-active fleet count.
  staticFleetReference?: {
    totalUnits: number;
    asOfDate: string; // ISO date the figure was checked/published
    source: string; // URL
  };
}

export const SYSTEMS: SystemCatalogEntry[] = [
  {
    id: "mta-nyct",
    name: "MTA New York City Transit",
    shortName: "NYC Subway",
    city: "New York",
    metroArea: "New York City",
    country: "United States",
    countryCode: "US",
    continent: "North America",
    timezone: "America/New_York",
    adapter: "mta",
    dataQuality: "good",
  },
  {
    id: "bart-bay-area",
    name: "Bay Area Rapid Transit",
    shortName: "BART",
    city: "San Francisco",
    metroArea: "San Francisco Bay Area",
    country: "United States",
    countryCode: "US",
    continent: "North America",
    timezone: "America/Los_Angeles",
    adapter: "bart",
    // Station-level advisory feed only; no per-elevator data or redundancy.
    dataQuality: "best_effort",
    // BART redundancy is fully hand-curated: every redundant station is modeled,
    // so any un-modeled station is a confirmed single point of failure.
    redundancyBaseline: "confirmed-none",
  },
  {
    id: "mbta-boston",
    name: "Massachusetts Bay Transportation Authority",
    shortName: "MBTA",
    city: "Boston",
    metroArea: "Greater Boston",
    country: "United States",
    countryCode: "US",
    continent: "North America",
    timezone: "America/New_York",
    adapter: "mbta",
    // Genuinely per-elevator, real ISO timestamps — same tier as MTA. No
    // explicit redundancy field yet (falls to assumed/single_elevator), so no
    // redundancyBaseline until a curation pass is done.
    dataQuality: "good",
  },
  {
    id: "wmata-dc",
    name: "Washington Metropolitan Area Transit Authority",
    shortName: "DC Metro",
    city: "Washington",
    metroArea: "Washington DC",
    country: "United States",
    countryCode: "US",
    continent: "North America",
    timezone: "America/New_York",
    adapter: "wmata",
    // Per-elevator outage ids, but the API only lists BROKEN units — no full
    // inventory feed and no GTFS crosswalk (verified: UnitNames appear nowhere
    // in GTFS). Units are discovered as they break.
    dataQuality: "fair",
    inventoryComplete: false,
    // No live inventory API exists (exhaustively verified — see SPEC.md); this
    // is WMATA's own published PR figure, used as the pctDown denominator
    // (marked with an asterisk on the site — see build-data.ts/index.html).
    staticFleetReference: {
      totalUnits: 320,
      asOfDate: "2026-07-04",
      source: "https://www.wmata.com/ride/elevators-escalators.html",
    },
  },
  {
    id: "tfl-london",
    name: "Transport for London",
    shortName: "TfL",
    city: "London",
    metroArea: "Greater London",
    country: "United Kingdom",
    countryCode: "GB",
    continent: "Europe",
    timezone: "Europe/London",
    adapter: "tfl",
    // Real per-lift inventory (569 lifts) with real, verified redundancy
    // derived from TfL's own published route topology (src/catalog/tfl-data,
    // built by scripts/tfl-import.mjs) — no redundancyBaseline needed, every
    // unit already carries an explicit value via redundancySource "pathways".
    dataQuality: "good",
  },
  {
    id: "cta-chicago",
    name: "Chicago Transit Authority",
    shortName: "CTA",
    city: "Chicago",
    metroArea: "Chicago",
    country: "United States",
    countryCode: "US",
    continent: "North America",
    timezone: "America/Chicago",
    adapter: "cta",
    // Alerts API only reports elevators CURRENTLY broken — no full inventory
    // feed (GTFS is standard 10-table, no pathways/levels), and no per-unit
    // id at all (station-level only, like BART). Units discovered as they
    // break, same mechanism as WMATA.
    dataQuality: "fair",
    inventoryComplete: false,
    // 173 reported directly (2026-07-05), more precise than CTA's own public
    // page, which independently corroborates with "more than 170 elevators"
    // (https://www.transitchicago.com/elevatorescalatorupgrades/) — that page
    // is used as the source URL (a real link for the site's "*" footnote to
    // point to) since it's the closest citable public backing; the exact 173
    // figure itself is a direct report, not literally printed there. CTA
    // states it is actively installing more, so this will drift upward.
    staticFleetReference: {
      totalUnits: 173,
      asOfDate: "2026-07-05",
      source: "https://www.transitchicago.com/elevatorescalatorupgrades/",
    },
  },
  {
    id: "mta-lirr",
    name: "MTA Long Island Rail Road",
    shortName: "LIRR",
    city: "New York",
    metroArea: "New York City",
    country: "United States",
    countryCode: "US",
    continent: "North America",
    timezone: "America/New_York",
    adapter: "mta-rail",
    // Real per-unit inventory + live status in ONE undocumented feed
    // (backend-unified.mylirr.org/eestatus — the backend of MTA's own
    // status page, found by network inspection; same risk tier as TMB's
    // alerts feed). Shares the feed with mta-mnr; the adapter filters by
    // railroad. Working units are listed too, so the inventory is complete
    // (default inventoryComplete: true) — unlike WMATA/CTA. No redundancy
    // signal in the feed; curated station models cover the major stations,
    // the rest fall to assumed. Penn's NYK-861 is physically the subway's
    // EL34X — tracked in both systems deliberately (see adapter header).
    dataQuality: "good",
  },
  {
    id: "mta-mnr",
    name: "MTA Metro-North Railroad",
    shortName: "Metro-North",
    city: "New York",
    metroArea: "New York City",
    country: "United States",
    countryCode: "US",
    continent: "North America",
    // Reaches Connecticut, but the whole railroad runs on Eastern time —
    // and its feed timestamps are epoch seconds anyway (no tz parsing).
    timezone: "America/New_York",
    adapter: "mta-rail",
    // Same shared undocumented feed as mta-lirr (see that entry). MNR units
    // carry epoch lastUpdated timestamps -> real backdated outage starts
    // (GCT NE-4 has been out since 2023), and a distinct "long term outage"
    // status that maps to planned work (validated vs the announced New
    // Rochelle closure).
    dataQuality: "good",
  },
  {
    id: "tmb-barcelona",
    name: "Transports Metropolitans de Barcelona",
    shortName: "TMB Metro",
    city: "Barcelona",
    metroArea: "Barcelona",
    country: "Spain",
    countryCode: "ES",
    continent: "Europe",
    timezone: "Europe/Madrid",
    adapter: "tmb",
    // "TMB" isn't a widely recognized brand outside Catalonia, unlike BART/
    // TfL/CTA — lead with the city instead of the default "{shortName} ({city})".
    displayLabel: "Barcelona (TMB Metro)",
    // Board's name column can't fit the full "Barcelona (TMB Metro)" — this
    // shorter form fits the (now-widened, 15-char) column exactly.
    boardLabel: "Barcelona (TMB)",
    // Real per-elevator inventory (151 elevators, 123 stations — built by
    // scripts/tmb-import.mjs from TMB's documented "transit" API) combined
    // with a live outage feed that is NOT in developer.tmb.cat's docs at all
    // — found by inspecting network traffic from TMB's own station pages
    // (see src/adapters/tmb/index.ts). Covers conventional lines (L1-L5,
    // L11) only, per TMB's own announcement; L9/L10/FM aren't wired to the
    // elevator-status system yet. No redundancyBaseline yet (no verified
    // per-direction topology signal, unlike TfL) — falls to assumed.
    dataQuality: "good",
  },
];

export function getSystem(id: string): SystemCatalogEntry | undefined {
  return SYSTEMS.find((s) => s.id === id);
}
