// HAND-CURATED CTA station models — the FIRST curated tier for this system.
// CTA publishes no per-station elevator inventory/roster and no GTFS pathways
// extension (re-verified 2026-07-13), so every station otherwise ships with
// redundancy: assumed regardless of its real layout. These models exist only
// for stations whose structure a human has confirmed from third-party
// research (chicago-L.org), cross-checked against every elevator identity
// CTA's own live feed has ever actually reported (observed-units.json).
//
// SYNTHETIC IDS (CTA-SYNTH-<station>-<slot>): an elevator this station is
// known to have but that has NEVER appeared in a CTA alert (so we have no
// agency-confirmed identity for it) gets a synthetic id that can never
// collide with a real one — real CTA unit ids always start with the numeric
// station id ("41690-23RD-STREET"), synthetic ids never do. Same pattern as
// WMATA's "WMATA-<node>" slots (wmata-models.ts): once the elevator is ever
// observed live with distinct location text (check scripts/cta-observed.mts'
// output, src/catalog/cta-data/observed-units.json, for a new
// "<station>-<slug>" unit), swap the synthetic id here for the real one —
// nothing else about the model needs to change.
//
// VAGUE-ALERT FAIL-SAFE (2026-07-14, first-model requirement): a CTA alert
// with no parseable location detail falls back to the bare station id
// (src/adapters/cta/location.ts / index.ts). Because that bare id never
// matches a synthetic slot here, and the adapter flags such alerts
// needsReview at a modeled station, a vague alert can never silently resolve
// via a redundant pair's OR — it forces the whole chain to read UNKNOWN
// (build-site-data.ts's generic "unplaced outage" fail-safe, same mechanism
// WMATA's "unmappable" kind relies on). This matters because CTA can merge
// two simultaneous vague alerts at one station into a single outage — without
// this fail-safe, a scenario where BOTH elevators of a redundant pair break
// but only one vague alert is reported would silently read as "accessible."

import type { StationModel } from "../lib/accessibility.js";

const SYSTEM = "cta-chicago";

export const CTA_STATION_MODELS: StationModel[] = [
  // Cermak-McCormick Place (Green Line) — rebuilt 2015, ADA from the ground
  // up. One island platform (wide 250ft center section serving both
  // directions, narrowing to single-sided ~175ft north / ~200+ft south, but
  // level and walkable end to end — no elevator needed to cross directions
  // once on the platform). Two elevators "bookend each end" (chicago-L.org):
  // the north end serves the North Cermak main headhouse; the south end
  // serves BOTH the South Cermak and 23rd Street headhouses via a shared
  // ground-level walkway in the paid area (confirmed compatible fare path —
  // this was the open question in the prior curation-todo note). Only the
  // south elevator has ever appeared in CTA's live feed (41690-23RD-STREET);
  // the north elevator's id is synthetic pending its first live appearance.
  // Reviewed with Bryce 2026-07-14 (/liftwatch-station-review, confidence
  // 7/10 on the structure — chicago-L.org is third-party, not CTA's own
  // text): approved to ship now rather than wait for agency confirmation.
  {
    systemId: SYSTEM,
    stationExternalId: "41690",
    note: "Street to platform: 2 elevators (one at each end of the platform) — either one keeps this station step-free. No single elevator outage removes step-free access on this route.",
    internalNote: "Structure from chicago-L.org (station design/history page, fetched 2026-07-14) — third-party, not CTA's own text; only the south/23rd elevator has ever appeared in CTA's live feed. North elevator id (CTA-SYNTH-41690-NORTH) is a synthetic placeholder — promote to its real CTA unit id the first time it appears in observed-units.json, same as a never-observed WMATA GTFS slot. Human-approved to ship without waiting for that observation, 2026-07-14.",
    segments: [
      {
        id: "street-platform",
        label: "Street to platform (either end elevator)",
        elevators: [
          { externalId: "CTA-SYNTH-41690-NORTH", label: "Cermak-McCormick Place north elevator (North Cermak entrance to platform) — never yet observed live, synthetic id" },
          { externalId: "41690-23RD-STREET", label: "Cermak-McCormick Place south elevator (South Cermak / 23rd Street entrances to platform)" },
        ],
      },
    ],
  },

  // Diversey (Brown Line; Purple Line Express rush hours) — elevated station,
  // two SIDE platforms (one per direction, no cross-connection at platform
  // level) reached from a single shared street-level paid fare-control area.
  // chicago-L.org: "dual brick-clad elevator towers", "the elevators to each
  // platform are located outboard of the stairs" — one dedicated elevator per
  // platform, NOT a redundant pair (the shared fare area doesn't help a rider
  // already through the gates whose platform elevator is down). Renovated
  // 2007-08 (Brown Line Capacity Expansion, ADA rebuild). CTA's OWN live alert
  // text confirms the direction-specific model ("The Loop-bound platform
  // elevator at Diversey"); only Loop-bound has appeared so far. Two
  // independent single-elevator chains (per-direction, same pattern as Park
  // Street), neither with a backup. Reviewed with Bryce 2026-07-14
  // (/liftwatch-station-review, confidence 8/10).
  {
    systemId: SYSTEM,
    stationExternalId: "40530",
    chainLabel: " (Loop-bound)",
    note: "Street to the Loop-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Direction-specific model confirmed by CTA's own live alert text ('The Loop-bound platform elevator at Diversey'); side-platform layout from chicago-L.org (fetched 2026-07-14, third-party). Loop-bound elevator observed live 2026-07-09 (40530-LOOP-BOUND). Human-approved 2026-07-14.",
    segments: [
      {
        id: "street-platform",
        label: "Street to Loop-bound platform",
        elevators: [
          { externalId: "40530-LOOP-BOUND", label: "Diversey Loop-bound platform elevator" },
        ],
      },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "40530",
    chainLabel: " (Kimball-bound)",
    note: "Street to the Kimball-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Direction-specific model confirmed by CTA's own live alert text for the opposite direction; side-platform layout from chicago-L.org (fetched 2026-07-14). The Kimball-bound elevator has NEVER appeared in a CTA alert, so its id (CTA-SYNTH-40530-KIMBALL-BOUND) is a synthetic placeholder — promote to the real CTA unit id the first time it appears in observed-units.json (expected 'Kimball-bound', per Montrose's observed phrasing). Human-approved 2026-07-14.",
    segments: [
      {
        id: "street-platform",
        label: "Street to Kimball-bound platform",
        elevators: [
          { externalId: "CTA-SYNTH-40530-KIMBALL-BOUND", label: "Diversey Kimball-bound platform elevator — never yet observed live, synthetic id" },
        ],
      },
    ],
  },
  // Sox-35th (40190, Red Line) — Batch 2, single island-platform elevator,
  // never individually identified in a live alert (vague only). No redundancy
  // claimed, so the bare station id is safe here: a vague alert unambiguously
  // means this one elevator — there is no OR to silently resolve behind.
  {
    systemId: SYSTEM,
    stationExternalId: "40190",
    note: "One elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Island platform; elevator added 2000 (chicago-L.org). Human-approved as Batch 2 via /liftwatch-station-review 2026-07-15 (confidence 8/10 collectively — no redundancy claimed anywhere in this batch).",
    segments: [
      { id: "street-platform", label: "Street to platform", elevators: [{ externalId: "40190", label: "Sox-35th platform elevator (only step-free access, never individually identified)" }] },
    ],
  },
  // Central (40280, Green Line) — Batch 2, single island-platform elevator,
  // never individually identified in a live alert (vague only). No redundancy
  // claimed, so the bare station id is safe here: a vague alert unambiguously
  // means this one elevator — there is no OR to silently resolve behind.
  {
    systemId: SYSTEM,
    stationExternalId: "40280",
    note: "One elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Island platform on embankment; elevator added 1994-96 (chicago-L.org). Human-approved as Batch 2 via /liftwatch-station-review 2026-07-15 (confidence 8/10 collectively — no redundancy claimed anywhere in this batch).",
    segments: [
      { id: "street-platform", label: "Street to platform", elevators: [{ externalId: "40280", label: "Central platform elevator (only step-free access, never individually identified)" }] },
    ],
  },
  // Forest Park (40390, Blue Line) — Batch 2, single island-platform elevator,
  // never individually identified in a live alert (vague only). No redundancy
  // claimed, so the bare station id is safe here: a vague alert unambiguously
  // means this one elevator — there is no OR to silently resolve behind.
  {
    systemId: SYSTEM,
    stationExternalId: "40390",
    note: "One elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Island platform; elevator in service since Dec 1982, transit center (chicago-L.org). Human-approved as Batch 2 via /liftwatch-station-review 2026-07-15 (confidence 8/10 collectively — no redundancy claimed anywhere in this batch).",
    segments: [
      { id: "street-platform", label: "Street to platform", elevators: [{ externalId: "40390", label: "Forest Park platform elevator (only step-free access, never individually identified)" }] },
    ],
  },
  // Central Park (40780, Pink Line) — Batch 2, single island-platform elevator,
  // never individually identified in a live alert (vague only). No redundancy
  // claimed, so the bare station id is safe here: a vague alert unambiguously
  // means this one elevator — there is no OR to silently resolve behind.
  {
    systemId: SYSTEM,
    stationExternalId: "40780",
    note: "One elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Island platform; one elevator tower, Douglas rehab (chicago-L.org). Human-approved as Batch 2 via /liftwatch-station-review 2026-07-15 (confidence 8/10 collectively — no redundancy claimed anywhere in this batch).",
    segments: [
      { id: "street-platform", label: "Street to platform", elevators: [{ externalId: "40780", label: "Central Park platform elevator (only step-free access, never individually identified)" }] },
    ],
  },
  // 63rd (40910, Red Line) — Batch 2, single island-platform elevator,
  // never individually identified in a live alert (vague only). No redundancy
  // claimed, so the bare station id is safe here: a vague alert unambiguously
  // means this one elevator — there is no OR to silently resolve behind.
  {
    systemId: SYSTEM,
    stationExternalId: "40910",
    note: "One elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Island platform, fare control on platform; elevator added in south Red upgrades (chicago-L.org). Human-approved as Batch 2 via /liftwatch-station-review 2026-07-15 (confidence 8/10 collectively — no redundancy claimed anywhere in this batch).",
    segments: [
      { id: "street-platform", label: "Street to platform", elevators: [{ externalId: "40910", label: "63rd platform elevator (only step-free access, never individually identified)" }] },
    ],
  },
  // 35th-Bronzeville-IIT (41120, Green Line) — Batch 2, single island-platform elevator,
  // never individually identified in a live alert (vague only). No redundancy
  // claimed, so the bare station id is safe here: a vague alert unambiguously
  // means this one elevator — there is no OR to silently resolve behind.
  {
    systemId: SYSTEM,
    stationExternalId: "41120",
    note: "One elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Center island platform (1960s config); one elevator added in rehab (chicago-L.org). Human-approved as Batch 2 via /liftwatch-station-review 2026-07-15 (confidence 8/10 collectively — no redundancy claimed anywhere in this batch).",
    segments: [
      { id: "street-platform", label: "Street to platform", elevators: [{ externalId: "41120", label: "35th-Bronzeville-IIT platform elevator (only step-free access, never individually identified)" }] },
    ],
  },
  // Halsted (41130, Orange Line) — Batch 2, single island-platform elevator,
  // never individually identified in a live alert (vague only). No redundancy
  // claimed, so the bare station id is safe here: a vague alert unambiguously
  // means this one elevator — there is no OR to silently resolve behind.
  {
    systemId: SYSTEM,
    stationExternalId: "41130",
    note: "One elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Island platform; one elevator (chicago-L.org). Human-approved as Batch 2 via /liftwatch-station-review 2026-07-15 (confidence 8/10 collectively — no redundancy claimed anywhere in this batch).",
    segments: [
      { id: "street-platform", label: "Street to platform", elevators: [{ externalId: "41130", label: "Halsted platform elevator (only step-free access, never individually identified)" }] },
    ],
  },
  // Loyola (41300, Red Line) — Batch 2, single island-platform elevator,
  // never individually identified in a live alert (vague only). No redundancy
  // claimed, so the bare station id is safe here: a vague alert unambiguously
  // means this one elevator — there is no OR to silently resolve behind.
  {
    systemId: SYSTEM,
    stationExternalId: "41300",
    note: "One elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Elongated island platform; the elevator bisects the platform (still one elevator) (chicago-L.org). Human-approved as Batch 2 via /liftwatch-station-review 2026-07-15 (confidence 8/10 collectively — no redundancy claimed anywhere in this batch).",
    segments: [
      { id: "street-platform", label: "Street to platform", elevators: [{ externalId: "41300", label: "Loyola platform elevator (only step-free access, never individually identified)" }] },
    ],
  },
  // 87th (41430, Red Line) — Batch 2, single island-platform elevator,
  // never individually identified in a live alert (vague only). No redundancy
  // claimed, so the bare station id is safe here: a vague alert unambiguously
  // means this one elevator — there is no OR to silently resolve behind.
  {
    systemId: SYSTEM,
    stationExternalId: "41430",
    note: "One elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Island platform; elevator added in south Red upgrades (chicago-L.org). Human-approved as Batch 2 via /liftwatch-station-review 2026-07-15 (confidence 8/10 collectively — no redundancy claimed anywhere in this batch).",
    segments: [
      { id: "street-platform", label: "Street to platform", elevators: [{ externalId: "41430", label: "87th platform elevator (only step-free access, never individually identified)" }] },
    ],
  },
  // Morgan (41510, Green/Pink Lines) — Batch 2, single island-platform
  // elevator. CTA's own alert text names both directions on one elevator
  // ("The Loop- and 63rd-bound platform elevator at Morgan"); the parser's
  // multi-direction handling was order-dependent (a reversed direction order
  // silently dropped "Loop-", producing "63RD-BOUND" instead of the full
  // combined id) — fixed 2026-07-15, now "63RD-LOOP-BOUND" regardless of
  // phrasing order. No redundancy claimed; single elevator serves the whole
  // (single) platform.
  {
    systemId: SYSTEM,
    stationExternalId: "41510",
    note: "One elevator serves the platform in both directions — no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Human-approved as Batch 2 via /liftwatch-station-review 2026-07-15 (confidence 8/10 collectively — no redundancy claimed anywhere in this batch).",
    segments: [
      { id: "street-platform", label: "Street to platform", elevators: [{ externalId: "41510-63RD-LOOP-BOUND", label: "Morgan platform elevator (serves both Loop-bound and 63rd-bound platforms)" }] },
    ],
  },
  // Chicago (40710, Brown, Purple Lines) — Batch 2, Diversey-pattern per-direction chains.
  {
    systemId: SYSTEM,
    stationExternalId: "40710",
    chainLabel: " (Loop-bound)",
    note: "Street to the Loop-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Side platforms; separate station houses, fare controls, and elevator per platform along Chicago Ave (chicago-L.org). Human-approved as Batch 2 via /liftwatch-station-review 2026-07-15 (confidence 8/10 collectively — no redundancy claimed anywhere in this batch).",
    segments: [
      { id: "street-platform", label: "Street to Loop-bound platform", elevators: [{ externalId: "40710-LOOP-BOUND", label: "Chicago Loop-bound platform elevator" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "40710",
    chainLabel: " (Kimball-bound)",
    note: "Street to the Kimball-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Never yet observed live; synthetic placeholder id, promotable once observed. Human-approved as Batch 2 via /liftwatch-station-review 2026-07-15 (confidence 8/10 collectively — no redundancy claimed anywhere in this batch).",
    segments: [
      { id: "street-platform", label: "Street to Kimball-bound platform", elevators: [{ externalId: "CTA-SYNTH-40710-KIMBALL-BOUND", label: "Chicago Kimball-bound platform elevator — never yet observed live, synthetic id" }] },
    ],
  },
  // Western (41480, Brown Line) — Batch 2, Diversey-pattern per-direction chains.
  {
    systemId: SYSTEM,
    stationExternalId: "41480",
    chainLabel: " (Kimball-bound)",
    note: "Street to the Kimball-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Side platforms; ADA since 1981, among CTA's first elevator stations (chicago-L.org). Human-approved as Batch 2 via /liftwatch-station-review 2026-07-15 (confidence 8/10 collectively — no redundancy claimed anywhere in this batch).",
    segments: [
      { id: "street-platform", label: "Street to Kimball-bound platform", elevators: [{ externalId: "41480-KIMBALL-BOUND", label: "Western Kimball-bound platform elevator" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "41480",
    chainLabel: " (Loop-bound)",
    note: "Street to the Loop-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Never yet observed live; synthetic placeholder id, promotable once observed. Human-approved as Batch 2 via /liftwatch-station-review 2026-07-15 (confidence 8/10 collectively — no redundancy claimed anywhere in this batch).",
    segments: [
      { id: "street-platform", label: "Street to Loop-bound platform", elevators: [{ externalId: "CTA-SYNTH-41480-LOOP-BOUND", label: "Western Loop-bound platform elevator — never yet observed live, synthetic id" }] },
    ],
  },
  // Conservatory (41670, Green Line) — Batch 2, Diversey-pattern per-direction chains.
  {
    systemId: SYSTEM,
    stationExternalId: "41670",
    chainLabel: " (63rd-bound)",
    note: "Street to the 63rd-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Twin station houses, side platforms, elevator towers (2001, Homan relocation) (chicago-L.org). Opposite direction inferred as Harlem-bound by system-wide Green Line convention (confirmed at King Drive, same branch) — verify on first observation. Human-approved as Batch 2 via /liftwatch-station-review 2026-07-15 (confidence 8/10 collectively — no redundancy claimed anywhere in this batch).",
    segments: [
      { id: "street-platform", label: "Street to 63rd-bound platform", elevators: [{ externalId: "41670-63RD-BOUND", label: "Conservatory 63rd-bound platform elevator" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "41670",
    chainLabel: " (Harlem-bound)",
    note: "Street to the Harlem-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Never yet observed live; synthetic placeholder id, promotable once observed. Human-approved as Batch 2 via /liftwatch-station-review 2026-07-15 (confidence 8/10 collectively — no redundancy claimed anywhere in this batch).",
    segments: [
      { id: "street-platform", label: "Street to Harlem-bound platform", elevators: [{ externalId: "CTA-SYNTH-41670-HARLEM-BOUND", label: "Conservatory Harlem-bound platform elevator — never yet observed live, synthetic id" }] },
    ],
  },
  // 47th (41080, Green Line) — Batch 2, Diversey-pattern per-direction chains.
  {
    systemId: SYSTEM,
    stationExternalId: "41080",
    chainLabel: " (Harlem-bound)",
    note: "Street to the Harlem-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Dual side platforms; \"elevators, one to each platform\" (1994-96 rehab) (chicago-L.org). Opposite direction inferred as 63rd-bound by system-wide Green Line convention — verify on first observation. Human-approved as Batch 2 via /liftwatch-station-review 2026-07-15 (confidence 8/10 collectively — no redundancy claimed anywhere in this batch).",
    segments: [
      { id: "street-platform", label: "Street to Harlem-bound platform", elevators: [{ externalId: "41080-HARLEM-BOUND", label: "47th Harlem-bound platform elevator" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "41080",
    chainLabel: " (63rd-bound)",
    note: "Street to the 63rd-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Never yet observed live; synthetic placeholder id, promotable once observed. Human-approved as Batch 2 via /liftwatch-station-review 2026-07-15 (confidence 8/10 collectively — no redundancy claimed anywhere in this batch).",
    segments: [
      { id: "street-platform", label: "Street to 63rd-bound platform", elevators: [{ externalId: "CTA-SYNTH-41080-63RD-BOUND", label: "47th 63rd-bound platform elevator — never yet observed live, synthetic id" }] },
    ],
  },
  // Polk (41030, Pink Line) — Batch 2, Diversey-pattern per-direction chains.
  {
    systemId: SYSTEM,
    stationExternalId: "41030",
    chainLabel: " (54th-bound)",
    note: "Street to the 54th-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Side platforms; \"dual elevators provide ADA accessibility\", one per platform (chicago-L.org). Opposite direction inferred as Loop-bound (Pink Line's Loop terminus) — verify on first observation. Human-approved as Batch 2 via /liftwatch-station-review 2026-07-15 (confidence 8/10 collectively — no redundancy claimed anywhere in this batch).",
    segments: [
      { id: "street-platform", label: "Street to 54th-bound platform", elevators: [{ externalId: "41030-54TH-BOUND", label: "Polk 54th-bound platform elevator" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "41030",
    chainLabel: " (Loop-bound)",
    note: "Street to the Loop-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Never yet observed live; synthetic placeholder id, promotable once observed. Human-approved as Batch 2 via /liftwatch-station-review 2026-07-15 (confidence 8/10 collectively — no redundancy claimed anywhere in this batch).",
    segments: [
      { id: "street-platform", label: "Street to Loop-bound platform", elevators: [{ externalId: "CTA-SYNTH-41030-LOOP-BOUND", label: "Polk Loop-bound platform elevator — never yet observed live, synthetic id" }] },
    ],
  },

  // Bryn Mawr (41380, Red Line) — rebuilt 2021-2025 as part of RPM Phase One
  // (Lawrence/Argyle/Berwyn/Bryn Mawr, all reopened 2025-07-20). A genuine
  // redundant PAIR — the ONE of the four RPM stations that got one: three
  // entrances (main Bryn Mawr Ave, an auxiliary exit, and a newly-added
  // Hollywood Ave entrance), and the Hollywood entrance got its own elevator,
  // separate from the main entrance's, both reaching the SAME single island
  // platform. (Lawrence/Argyle/Berwyn each also have an auxiliary exit, but
  // it's stairs-only — single elevator, no backup, at those three.)
  // Pre-modeled from research, not a live outage: NEITHER elevator has ever
  // appeared in a CTA alert (station opened 2025-07-20; zero elevator
  // outages recorded here since), so both ids are synthetic placeholders —
  // promote each to its real id the first time it's individually observed.
  // Station id 41380 found via CTA's public GTFS stops.txt (parent station,
  // location_type=1; child boarding stops 30267/30268).
  {
    systemId: SYSTEM,
    stationExternalId: "41380",
    note: "Street to platform: 2 elevators (one at the main entrance, one at the Hollywood Ave entrance) — either one keeps this station step-free. No single elevator outage removes step-free access on this route.",
    internalNote: "Structure from chicago-L.org (station design page, fetched 2026-07-16), verified against CTA's own RPM project pages (Lawrence/Argyle/Berwyn cross-checked the same way and confirmed single-elevator, ruling out the same pattern there). Confidence 9/10 on the structure; 0/10 live confirmation of either unit id — pre-modeled ahead of any outage per Bryce's approval 2026-07-16, so a false NO_ACCESS never happens on this station's first-ever elevator outage. Both ids are synthetic pending live observation.",
    segments: [
      {
        id: "street-platform",
        label: "Street to platform (either entrance's elevator)",
        elevators: [
          { externalId: "CTA-SYNTH-41380-MAIN", label: "Bryn Mawr main entrance elevator (Bryn Mawr Ave) — never yet observed live, synthetic id" },
          { externalId: "CTA-SYNTH-41380-HOLLYWOOD", label: "Bryn Mawr Hollywood Ave entrance elevator — never yet observed live, synthetic id" },
        ],
      },
    ],
  },
];
