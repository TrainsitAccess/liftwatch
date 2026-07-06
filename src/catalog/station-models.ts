import { readFileSync } from "node:fs";
import type { StationModel } from "../lib/accessibility.js";

// MTA multi-chain models, generated from the live elevator inventory by
// scripts/mta-chains.mjs (self-checked against MTA's own ADA + redundant flags).
const mtaChains: StationModel[] = (
  JSON.parse(readFileSync(new URL("./mta-data/station-chains.json", import.meta.url), "utf8")) as {
    models: StationModel[];
  }
).models;

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
  // MTA's multi-chain stations are generated from the live elevator inventory
  // by scripts/mta-chains.mjs (verified station-by-station with a human; see
  // src/catalog/mta-data/station-chains.json and CLAUDE.md). Regenerate with
  // `npm run mta:chains` — do not hand-edit the JSON.
  ...mtaChains,
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
