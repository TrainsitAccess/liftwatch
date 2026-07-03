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
];

export function getSystem(id: string): SystemCatalogEntry | undefined {
  return SYSTEMS.find((s) => s.id === id);
}
