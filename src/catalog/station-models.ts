import type { StationModel } from "../lib/accessibility.js";

// Curated per-station accessibility structure — the source of truth for stations
// whose feed doesn't expose per-elevator data (BART). Each station's step-free
// chain is broken into segments with their elevators. From this we derive both
// station accessibility (live) and the simple redundancy flag (see
// redundancy-overrides.ts). matchHints attribute a station-level advisory to a
// specific elevator when the text is specific enough.

export const STATION_MODELS: StationModel[] = [
  {
    systemId: "bart-bay-area",
    stationExternalId: "ASHB",
    note: "Two platform elevators give redundant platform access. The street elevator is not required: the concourse is also step-free from the sunken parking lot. No single outage severs access.",
    segments: [
      {
        id: "street-concourse",
        label: "Street to concourse",
        stepFreeAlternative: true, // sunken parking lot reaches concourse step-free
        elevators: [
          { externalId: "ASHB-ST-ADELINE-E", label: "Adeline Street East street elevator", matchHints: ["adeline", "street"] },
        ],
      },
      {
        id: "concourse-platform",
        label: "Concourse to platform",
        elevators: [
          { externalId: "ASHB-PLAT-1", label: "Platform Elevator 1", matchHints: ["platform"] },
          { externalId: "ASHB-PLAT-2", label: "Platform Elevator 2", matchHints: ["platform"] },
        ],
      },
    ],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "12TH",
    note: "Two street elevators (14th St and 11th St) back each other up, but a single platform elevator is a single point of failure. Accessible only if a street elevator AND the platform elevator work.",
    segments: [
      {
        id: "street-concourse",
        label: "Street to concourse",
        elevators: [
          { externalId: "12TH-ST-14TH", label: "14th St street elevator", matchHints: ["14th"] },
          { externalId: "12TH-ST-11TH", label: "11th St street elevator", matchHints: ["11th"] },
        ],
      },
      {
        id: "concourse-platform",
        label: "Concourse to platform",
        elevators: [
          { externalId: "12TH-PLAT", label: "Platform elevator", matchHints: ["platform"] },
        ],
      },
    ],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "19TH",
    note: "Two platform elevators back each other up, but a single street elevator is a single point of failure — if it fails the station is inaccessible.",
    segments: [
      {
        id: "street-concourse",
        label: "Street to concourse",
        elevators: [{ externalId: "19TH-ST", label: "Street elevator", matchHints: ["street"] }],
      },
      {
        id: "concourse-platform",
        label: "Concourse to platform",
        elevators: [
          { externalId: "19TH-PLAT-1", label: "Platform Elevator 1", matchHints: ["platform"] },
          { externalId: "19TH-PLAT-2", label: "Platform Elevator 2", matchHints: ["platform"] },
        ],
      },
    ],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "RICH",
    note: "A ramp gives step-free street access without elevators, so both street elevators can be out and the station stays accessible; but the single platform elevator is a single point of failure.",
    segments: [
      {
        id: "street-concourse",
        label: "Street to concourse",
        stepFreeAlternative: true, // ramp serves the same purpose
        elevators: [
          { externalId: "RICH-ST-1", label: "Street elevator 1", matchHints: ["street"] },
          { externalId: "RICH-ST-2", label: "Street elevator 2", matchHints: ["street"] },
        ],
      },
      {
        id: "concourse-platform",
        label: "Concourse to platform",
        elevators: [{ externalId: "RICH-PLAT", label: "Platform elevator", matchHints: ["platform"] }],
      },
    ],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "SFIA",
    note: "Two redundant platform elevators; the station connects directly to the airport at concourse level, so no street elevator is needed. Only both platform elevators failing severs access.",
    segments: [
      {
        id: "concourse-platform",
        label: "Concourse to platform",
        elevators: [
          { externalId: "SFIA-PLAT-1", label: "Platform Elevator 1", matchHints: ["platform"] },
          { externalId: "SFIA-PLAT-2", label: "Platform Elevator 2", matchHints: ["platform"] },
        ],
      },
    ],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "WARM",
    note: "Two street elevators and two platform elevators — every leg has a backup, so any single outage (or one per leg) keeps the station accessible.",
    segments: [
      {
        id: "street-concourse",
        label: "Street to concourse",
        elevators: [
          { externalId: "WARM-ST-1", label: "Street elevator 1", matchHints: ["street"] },
          { externalId: "WARM-ST-2", label: "Street elevator 2", matchHints: ["street"] },
        ],
      },
      {
        id: "concourse-platform",
        label: "Concourse to platform",
        elevators: [
          { externalId: "WARM-PLAT-1", label: "Platform Elevator 1", matchHints: ["platform"] },
          { externalId: "WARM-PLAT-2", label: "Platform Elevator 2", matchHints: ["platform"] },
        ],
      },
    ],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "WDUB",
    note: "Two street elevators and two platform elevators — every leg has a backup, so any single outage (or one per leg) keeps the station accessible.",
    segments: [
      {
        id: "street-concourse",
        label: "Street to concourse",
        elevators: [
          { externalId: "WDUB-ST-1", label: "Street elevator 1", matchHints: ["street"] },
          { externalId: "WDUB-ST-2", label: "Street elevator 2", matchHints: ["street"] },
        ],
      },
      {
        id: "concourse-platform",
        label: "Concourse to platform",
        elevators: [
          { externalId: "WDUB-PLAT-1", label: "Platform Elevator 1", matchHints: ["platform"] },
          { externalId: "WDUB-PLAT-2", label: "Platform Elevator 2", matchHints: ["platform"] },
        ],
      },
    ],
  },
  {
    systemId: "mta-nyct",
    stationExternalId: "604",
    chainLabel: " (4)",
    note:
      "EL132/EL133 gate the 4 platform by direction and are NOT redundant with " +
      "each other — each is essential for its own direction (confirmed directly: " +
      "EL132 = Bronx-bound, EL133 = Manhattan-bound; MTA's own feed text for " +
      'EL132, "B/D mezzanine to 4 train," does not state the direction). EL131 ' +
      "(street-mezzanine) is a shared prerequisite with this station's (B/D) " +
      "chain — if it fails, both chains go down together. EL132/EL133 are " +
      "currently mid capital-replacement (expected summer 2026) and marked " +
      "is_active: false in MTA's feed despite having a real, ongoing outage.",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine",
        elevators: [{ externalId: "EL131", label: "Street to mezzanine", matchHints: ["street to mezzanine"] }],
      },
      {
        id: "mezzanine-4-bronx",
        label: "Mezzanine to Bronx-bound 4",
        elevators: [
          {
            externalId: "EL132",
            label: 'Mezzanine to Bronx-bound 4 (feed text: "B/D mezzanine to 4 train")',
            matchHints: ["bronx-bound 4"],
          },
        ],
      },
      {
        id: "mezzanine-4-manhattan",
        label: "Mezzanine to Manhattan-bound 4",
        elevators: [
          { externalId: "EL133", label: "Mezzanine to Manhattan-bound 4", matchHints: ["manhattan-bound 4"] },
        ],
      },
    ],
  },
  {
    systemId: "mta-nyct",
    stationExternalId: "604",
    chainLabel: " (B/D)",
    note:
      "EL134/EL135 gate the B/D platform by direction and are NOT redundant " +
      "with each other (confirmed directly: EL134 = Manhattan-bound, EL135 = " +
      "Bronx-bound). EL131 (street-mezzanine) is a shared prerequisite with " +
      "this station's (4) chain — if it fails, both chains go down together.",
    segments: [
      {
        id: "street-mezzanine",
        label: "Street to mezzanine",
        elevators: [{ externalId: "EL131", label: "Street to mezzanine", matchHints: ["street to mezzanine"] }],
      },
      {
        id: "mezzanine-bd-manhattan",
        label: "Mezzanine to Manhattan-bound B/D",
        elevators: [
          { externalId: "EL134", label: "Mezzanine to Manhattan-bound B/D", matchHints: ["manhattan-bound b/d"] },
        ],
      },
      {
        id: "mezzanine-bd-bronx",
        label: "Mezzanine to Bronx-bound B/D",
        elevators: [
          { externalId: "EL135", label: "Mezzanine to Bronx-bound B/D", matchHints: ["bronx-bound b/d"] },
        ],
      },
    ],
  },
];

// A physical station can have more than one entry (multiple independent
// access chains sharing a stationExternalId — see StationModel.chainLabel),
// so this returns an ARRAY of models per station, not a single one.
export function stationModelsFor(systemId: string): Map<string, StationModel[]> {
  const map = new Map<string, StationModel[]>();
  for (const m of STATION_MODELS.filter((m) => m.systemId === systemId)) {
    const list = map.get(m.stationExternalId) ?? [];
    list.push(m);
    map.set(m.stationExternalId, list);
  }
  return map;
}
