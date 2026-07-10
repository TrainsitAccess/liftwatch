import type { StationModel } from "../lib/accessibility.js";
import { MTA_RAIL_STATION_MODELS } from "./mta-rail-models.js";
import { BART_STATION_MODELS } from "./bart-station-models.js";
// STATIC json imports, deliberately NOT readFileSync(new URL(import.meta.url))
// — the Netlify function bundler compiles its whole import graph into one
// poll.mjs, so runtime-relative file paths break in production (live-confirmed
// 2026-07-09: ENOENT on station-chains.json, a 502 on every poll invocation).
// Static imports are resolved/inlined at build time by tsx, tsc, and the
// bundler alike. Same pattern in the TfL/TMB adapters' catalog loads.
import mtaChainsJson from "./mta-data/station-chains.json" with { type: "json" };
import tflChainsJson from "./tfl-data/chains.json" with { type: "json" };

// MTA multi-chain models, generated from the live elevator inventory by
// scripts/mta-chains.mjs (self-checked against MTA's own ADA + redundant flags).
const mtaChains: StationModel[] = (mtaChainsJson as { models: StationModel[] }).models;

// TfL multi-chain models, generated from the bundled lift topology snapshot by
// scripts/tfl-chains.mjs (self-checked against lifts.json's own isRedundant
// flag). Deliberately conservative: covers only stations whose lift topology
// is an unambiguous single path or set of disjoint paths — no line names are
// guessed. Major interchanges with branching topology (Bank, King's Cross,
// Paddington, Stratford, …) are excluded pending a human review pass; see
// src/catalog/tfl-data/chains-excluded.json.
const tflChains: StationModel[] = (tflChainsJson as { models: StationModel[] }).models;

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
    note: "Two platform elevators give redundant platform access. The street elevator is not required: the concourse is also step-free from the sunken parking lot, and bart.gov's own outage-options page (2026-07-08) additionally names the Ed Roberts Campus elevator (open during its hours) as a further alternative. No single outage severs access.",
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
          // "convention center" added 2026-07-08: mining the outage_events
          // archive found 4 of BART's 11 historical events (36%) used this
          // exact phrase for this elevator ("Station - Convention Center"),
          // matching bart.gov's own "11th Street/Convention Center" naming —
          // a real, confirmed match, not a guess.
          { externalId: "12TH-ST-11TH", label: "11th St street elevator", matchHints: ["11th", "convention center"] },
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
    note: "Two redundant platform elevators (confirmed against bart.gov's own outage-options page 2026-07-08: each explicitly names 'the other platform elevator' as its backup, no detour to another station); the station connects directly to the airport at concourse level, so no street elevator is needed. Only both platform elevators failing severs access.",
    segments: [
      {
        id: "concourse-platform",
        label: "Concourse to platform",
        elevators: [
          { externalId: "SFIA-PLAT-1", label: "Platforms 1 & 2 Elevator", matchHints: ["platform"] },
          { externalId: "SFIA-PLAT-2", label: "Platforms 3 & 4 Elevator", matchHints: ["platform"] },
        ],
      },
    ],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "WARM",
    note: "Two street elevators and two platform elevators — every leg has a backup, so any single outage (or one per leg) keeps the station accessible. A fifth, separate pedestrian-bridge elevator (verified against bart.gov's own outage-options page 2026-07-08) is a secondary entrance with no backup of its own for ENTERING that way — BART's guidance is a 0.8 mi walk/roll to the main Warm Springs Blvd. entrance; exiting via the bridge is already covered by the main platform elevators.",
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
    stationExternalId: "WARM",
    chainLabel: " (pedestrian bridge)",
    note: "The pedestrian-bridge elevator is a separate, secondary entrance with no backup of its own for entering that way — BART's guidance is a 0.8 mi walk/roll to the main Warm Springs Blvd. entrance instead.",
    segments: [{ id: "bridge", label: "Pedestrian bridge elevator", elevators: [{ externalId: "WARM-BRIDGE", label: "Pedestrian bridge elevator", matchHints: ["bridge", "pedestrian"] }] }],
  },
  {
    // Corrected 2026-07-08 against bart.gov's own outage-options page: the
    // previous model wrongly claimed 2 mutually-redundant platform elevators
    // and 2 mutually-redundant street elevators. The real structure is 1
    // platform elevator (a pure single point of failure, shared as a
    // bottleneck by BOTH garage-side entries — same "shared prerequisite"
    // pattern as MTA's bridge elevators) and 4 garage elevators split into
    // TWO SEPARATE redundant pairs (North/Dublin side, South/Pleasanton
    // side) that do NOT back each other up — BART's own text says "take the
    // ALTERNATE parking garage elevator" (singular, same-side sibling only),
    // never a cross-side alternative.
    systemId: "bart-bay-area",
    stationExternalId: "WDUB",
    chainLabel: " (North/Dublin side)",
    note: "The North/Dublin-side garage elevators back each other up, but do not back up the South/Pleasanton-side pair — BART's own text names only 'the alternate' (same-side sibling). The single platform elevator beyond the garage is a pure single point of failure with no backup at all (BART's guidance is a detour through West Dublin/Pleasanton), shared as a bottleneck by both garage sides.",
    segments: [
      { id: "garage-concourse", label: "North/Dublin garage to concourse", elevators: [
        { externalId: "WDUB-GAR-N1", label: "Garage Elevator 1 (North/Dublin side)", matchHints: ["north", "dublin", "garage"] },
        { externalId: "WDUB-GAR-N2", label: "Garage Elevator 2 (North/Dublin side)", matchHints: ["north", "dublin", "garage"] },
      ] },
      { id: "concourse-platform", label: "Concourse to platform", elevators: [{ externalId: "WDUB-PLAT", label: "Platform elevator", matchHints: ["platform"] }] },
    ],
  },
  {
    systemId: "bart-bay-area",
    stationExternalId: "WDUB",
    chainLabel: " (South/Pleasanton side)",
    note: "The South/Pleasanton-side garage elevators back each other up, but do not back up the North/Dublin-side pair — BART's own text names only 'the alternate' (same-side sibling). The single platform elevator beyond the garage is a pure single point of failure with no backup at all (BART's guidance is a detour through West Dublin/Pleasanton), shared as a bottleneck by both garage sides.",
    segments: [
      { id: "garage-concourse", label: "South/Pleasanton garage to concourse", elevators: [
        { externalId: "WDUB-GAR-S1", label: "Garage Elevator 1 (South/Pleasanton side)", matchHints: ["south", "pleasanton", "garage"] },
        { externalId: "WDUB-GAR-S2", label: "Garage Elevator 2 (South/Pleasanton side)", matchHints: ["south", "pleasanton", "garage"] },
      ] },
      { id: "concourse-platform", label: "Concourse to platform", elevators: [{ externalId: "WDUB-PLAT", label: "Platform elevator", matchHints: ["platform"] }] },
    ],
  },
  // The remaining 43 BART stations: curated 2026-07-08 from bart.gov's own
  // outage-options page (+ 4 cross-validated against TransitAccess's Muni
  // field survey) — see src/catalog/bart-station-models.ts for the full
  // writeup and src/catalog/bart-data/elevator-pages.json for the raw source.
  ...BART_STATION_MODELS,
  // MTA's multi-chain stations are generated from the live elevator inventory
  // by scripts/mta-chains.mjs (verified station-by-station with a human; see
  // src/catalog/mta-data/station-chains.json and CLAUDE.md). Regenerate with
  // `npm run mta:chains` — do not hand-edit the JSON.
  ...mtaChains,
  // LIRR + Metro-North curated models (hand-built from eestatus location
  // text, walked through station-by-station with a human 2026-07-06).
  ...MTA_RAIL_STATION_MODELS,
  // TfL's auto-generated multi-chain models (see tflChains above).
  ...tflChains,
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
