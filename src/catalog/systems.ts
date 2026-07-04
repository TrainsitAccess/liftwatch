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
  dataQuality: "good" | "fair" | "best_effort";
  // "confirmed-none": redundancy is fully curated, so a station with no model is a
  // confirmed non-redundant station (not merely 'assumed'). Defaults to "assumed".
  redundancyBaseline?: "assumed" | "confirmed-none";
  // false => the feed only reveals units as they break (no denominator feed).
  // Suppresses %-of-fleet-down displays AND the single_elevator redundancy
  // inference (counting broken units as the station's whole fleet would be
  // wrong). Defaults to true.
  inventoryComplete?: boolean;
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
  },
];

export function getSystem(id: string): SystemCatalogEntry | undefined {
  return SYSTEMS.find((s) => s.id === id);
}
