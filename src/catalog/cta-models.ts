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
  // Morgan (41510, Green + Pink Lines, Lake St elevated) — CORRECTED 2026-07-16
  // (CTA-site audit). Batch 2 had modeled this as a SINGLE elevator "serving
  // both directions," which is WRONG: Morgan has TWO SIDE platforms (one per
  // direction) connected by an overhead transfer bridge, each reached by its
  // OWN elevator (chicago-L.org: "dual 425-ft side platforms", two elevator
  // towers; Wikipedia: "an elevator on either side of the tracks"). The bridge
  // only lets riders transfer once up — reaching a given platform step-free
  // still requires that platform's own elevator, so there is NO redundancy.
  // The combined alert id resolved because CTA groups the EASTBOUND platform's
  // destinations: "The Loop- and 63rd-bound platform elevator" = the eastbound
  // platform (Green toward Loop→63rd/Cottage Grove + Pink Loop-bound), NOT both
  // directions on one elevator. The opposite (westbound) platform has its own,
  // never-yet-observed elevator. Now a per-direction pair like Diversey/Chicago.
  {
    systemId: SYSTEM,
    stationExternalId: "41510",
    chainLabel: " (Loop/63rd-bound)",
    note: "Street to the eastbound platform (toward the Loop and on to 63rd/Cottage Grove; Pink Line toward the Loop): one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Eastbound side platform of Morgan's per-direction pair; two side platforms + a transfer bridge, one elevator each (chicago-L.org + Wikipedia) — the bridge is transfer-only, not a step-free cross-platform backup. Real id observed live (41510-63RD-LOOP-BOUND ← 'The Loop- and 63rd-bound platform elevator at Morgan (Green, Pink Lines)'). Corrected from the Batch-2 single-elevator model 2026-07-16 via the CTA project/station-page audit. Confidence 9/10.",
    segments: [
      { id: "street-platform", label: "Street to eastbound (Loop/63rd-bound) platform", elevators: [{ externalId: "41510-63RD-LOOP-BOUND", label: "Morgan eastbound (Loop-/63rd-bound) platform elevator" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "41510",
    chainLabel: " (Harlem-bound)",
    note: "Street to the westbound platform (Green Line toward Harlem; Pink Line toward 54th/Cermak): one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Westbound side platform of Morgan's per-direction pair. Never yet observed live; synthetic placeholder id (CTA-SYNTH-41510-HARLEM-BOUND) — promote to the real CTA unit id the first time it appears in observed-units.json (expected phrasing ~'The Harlem- and 54th/Cermak-bound platform elevator at Morgan'). Corrected from the Batch-2 single-elevator model 2026-07-16. Confidence 9/10.",
    segments: [
      { id: "street-platform", label: "Street to westbound (Harlem-bound) platform", elevators: [{ externalId: "CTA-SYNTH-41510-HARLEM-BOUND", label: "Morgan westbound (Harlem-/54th-/Cermak-bound) platform elevator — never yet observed live, synthetic id" }] },
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

  // ── Researched externally, shipped 2026-07-16 (/liftwatch-station-review) ──
  // Five single-elevator stations resolved by external research last session
  // (chicago-L.org + CTA project pages) but never implemented. Each has ONE
  // elevator and no backup; CTA's own live alert text calls it "the elevator
  // at <station>" (singular, no direction — see observed-units.json), so the
  // bare station id IS the real elevator's id (no OR to hide behind, same safe
  // pattern as the Batch 2 single-elevator islands). No redundancy claimed at
  // any of the five, so a vague alert unambiguously means this one elevator.
  // Confidence 9/10 each (single-elevator layout independently confirmed by
  // both third-party research AND the singular live-alert phrasing).

  // Racine (40470, Blue Line — Forest Park branch). The old 1950s ramp is gone
  // / non-ADA; replaced by a single new elevator opened Oct 2025. (A second,
  // Loomis-entrance ramp is future work not built until ~2027 — NOT a current
  // backup, so it is not modeled here.)
  {
    systemId: SYSTEM,
    stationExternalId: "40470",
    note: "One elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Single new elevator opened Oct 2025, replacing the removed non-ADA 1950s ramp (chicago-L.org / CTA project pages, researched prior session). The planned Loomis-entrance ramp (~2027) is future work, not a current backup. Live alert phrasing 'The elevator at Racine (Blue Line)' (singular). Researched prior session, shipped 2026-07-16 (confidence 9/10).",
    segments: [
      { id: "street-platform", label: "Street to platform", elevators: [{ externalId: "40470", label: "Racine platform elevator (only step-free access, never individually identified)" }] },
    ],
  },
  // Pulaski (40150, Pink Line — Cermak branch). Single elevator, island
  // platform. NOTE: the OTHER Pulaski (40030, Green Line) is a per-direction
  // two-elevator side-platform station and is deliberately left pending.
  {
    systemId: SYSTEM,
    stationExternalId: "40150",
    note: "One elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Single elevator, island platform (chicago-L.org, researched prior session). Distinct from Green Line Pulaski (40030), which has two per-direction elevators and stays pending. Live alert phrasing 'The elevator at Pulaski (Pink Line)' (singular). Researched prior session, shipped 2026-07-16 (confidence 9/10).",
    segments: [
      { id: "street-platform", label: "Street to platform", elevators: [{ externalId: "40150", label: "Pulaski (Pink Line) platform elevator (only step-free access, never individually identified)" }] },
    ],
  },
  // 69th (40990, Red Line — Dan Ryan branch). Single elevator, in service
  // Jan 2007.
  {
    systemId: SYSTEM,
    stationExternalId: "40990",
    note: "One elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Single elevator, island platform, in service Jan 2007 (chicago-L.org, researched prior session). Live alert phrasing 'The elevator at 69th (Red Line)' (singular). Researched prior session, shipped 2026-07-16 (confidence 9/10).",
    segments: [
      { id: "street-platform", label: "Street to platform", elevators: [{ externalId: "40990", label: "69th platform elevator (only step-free access, never individually identified)" }] },
    ],
  },
  // 47th (41230, Red Line — Dan Ryan branch). Single elevator, in service
  // Dec 2006. Distinct from 47th (41080, Green Line), already modeled as a
  // per-direction pair.
  {
    systemId: SYSTEM,
    stationExternalId: "41230",
    note: "One elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Single elevator, island platform, in service Dec 2006 (chicago-L.org, researched prior session). Distinct from Green Line 47th (41080). Live alert phrasing 'The elevator at 47th (Red Line)' (singular). Researched prior session, shipped 2026-07-16 (confidence 9/10).",
    segments: [
      { id: "street-platform", label: "Street to platform", elevators: [{ externalId: "41230", label: "47th (Red Line) platform elevator (only step-free access, never individually identified)" }] },
    ],
  },
  // Argyle (41200, Red Line — RPM Phase One, reopened 2025-07-20). Single
  // elevator to a single ~520-ft island platform; the auxiliary exit is
  // stairs-only (confirmed, unlike RPM-sibling Bryn Mawr which got a 2nd
  // elevator — see the Bryn Mawr entry above).
  {
    systemId: SYSTEM,
    stationExternalId: "41200",
    note: "One elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Single elevator, single ~520-ft island platform; auxiliary exit stairs-only (chicago-L.org / CTA RPM pages, researched prior session — Bryn Mawr was the only RPM Phase One station to get a redundant pair). Live alert phrasing 'The elevator at Argyle (Red Line)' (singular). Researched prior session, shipped 2026-07-16 (confidence 9/10).",
    segments: [
      { id: "street-platform", label: "Street to platform", elevators: [{ externalId: "41200", label: "Argyle platform elevator (only step-free access, never individually identified)" }] },
    ],
  },

  // Wilson (40540, Red Line + Purple Line Express) — rebuilt 2017. TWO island
  // platforms arranged by DIRECTION for cross-platform Red↔Purple transfers:
  // the southbound (west) island serves 95th-bound (Red) + Loop-bound (Purple),
  // the northbound (east) island serves Howard-bound (Red) + Linden-bound
  // (Purple). The islands sit on opposite sides of the tracks (a rider can't
  // cross directions at platform level), so each direction is its own route.
  // CTA's own live alert text confirms the direction model: "The 95th- and
  // Loop-bound platform elevator at Wilson (Red, Purple Lines)"
  // (observed-units.json → 40540-95TH-LOOP-BOUND).
  //
  // EACH DIRECTION IS REDUNDANT (step-free backup): besides the main-entrance
  // elevator per island, the Sunnyside Ave entrance has TWO ADA ramps — one to
  // each island — connecting street directly to platform (no mezzanine). So a
  // platform stays step-free even if its own elevator is out (elevator OR
  // Sunnyside ramp). Geometry confirmed by Bryce 2026-07-16; this is exactly
  // the agency-confirmed non-elevator step-free path the STANDING RAMP RULE
  // (CLAUDE.md, 2026-07-15) requires checking for — the prior-session research
  // note that called Wilson "no backup" had MISSED the Sunnyside ramps.
  // Encoded as segment.stepFreeAlternative on each chain: the elevators are
  // still tracked (an outage is recorded), but the ramp keeps the platform
  // accessible, so neither direction is a single point of failure.
  {
    systemId: SYSTEM,
    stationExternalId: "40540",
    chainLabel: " (95th/Loop-bound)",
    note: "Street to the 95th-bound (Red) / Loop-bound (Purple) platform: reachable step-free by this platform's elevator OR the Sunnyside Ave entrance ramp. This platform stays step-free even if the elevator is out of service.",
    internalNote: "Direction-organized island platforms (cross-platform Red/Purple transfer), rebuilt 2017; one elevator per island (chicago-L.org / CTA reconstruction-project page — 'elevators serving the east and west platforms'). Southbound elevator observed live (40540-95TH-LOOP-BOUND). REDUNDANCY: the Sunnyside Ave entrance has two ADA ramps, one straight from street to each island platform (no mezzanine) — geometry confirmed by Bryce 2026-07-16 — so each direction has a permanent non-elevator step-free path (stepFreeAlternative). This corrects the prior-session research note that called Wilson 'no backup' (it had missed the Sunnyside ramps). Confidence 9/10. Shipped 2026-07-16.",
    segments: [
      { id: "street-platform", label: "Street to 95th/Loop-bound platform", stepFreeAlternative: true, elevators: [{ externalId: "40540-95TH-LOOP-BOUND", label: "Wilson 95th-bound / Loop-bound platform elevator (Sunnyside Ave ramp is a step-free backup)" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "40540",
    chainLabel: " (Howard/Linden-bound)",
    note: "Street to the Howard-bound (Red) / Linden-bound (Purple) platform: reachable step-free by this platform's elevator OR the Sunnyside Ave entrance ramp. This platform stays step-free even if the elevator is out of service.",
    internalNote: "Opposite (northbound/east) island of Wilson's cross-platform pair; one elevator, plus the Sunnyside Ave ramp to this island as a step-free backup (stepFreeAlternative — see the sibling chain's internalNote for the ramp geometry confirmed by Bryce 2026-07-16). The northbound elevator has never appeared in an alert, so its id (CTA-SYNTH-40540-HOWARD-LINDEN-BOUND) is a synthetic placeholder — promote to the real CTA unit id the first time it appears in observed-units.json (expected phrasing 'The Howard- and Linden-bound platform elevator at Wilson'). Confidence 9/10. Shipped 2026-07-16.",
    segments: [
      { id: "street-platform", label: "Street to Howard/Linden-bound platform", stepFreeAlternative: true, elevators: [{ externalId: "CTA-SYNTH-40540-HOWARD-LINDEN-BOUND", label: "Wilson Howard-bound / Linden-bound platform elevator — never yet observed live, synthetic id (Sunnyside Ave ramp is a step-free backup)" }] },
    ],
  },

  // ── Batch 4 (2026-07-16, /liftwatch-station-review risk-bucketed batch) ──
  // Seven zero-redundancy stations approved as a group: 4 Diversey-pattern
  // per-direction pairs (Addison, Montrose, Pulaski-Green, Southport), 2
  // series chains (Jackson-Blue, Cicero), and 1 shared-prerequisite shape
  // (Grand — the WMATA "street↔mezzanine prerequisite feeding per-direction
  // platform legs" pattern). None claims a backup anywhere, so none can
  // under-warn by construction. Structures from chicago-L.org
  // (STATION-RESEARCH.md), corroborated by fitting live alert identities.
  // Confidence 8/10 collectively.

  // Addison (41440, Brown Line) — dual side platforms, dual elevator towers,
  // one per platform. BOTH directions observed live.
  {
    systemId: SYSTEM,
    stationExternalId: "41440",
    chainLabel: " (Kimball-bound)",
    note: "Street to the Kimball-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Dual side platforms, dual elevator towers, one per platform (chicago-L.org). Observed live: 41440-KIMBALL-BOUND. Batch 4, 2026-07-16 (confidence 8/10 collectively).",
    segments: [
      { id: "street-platform", label: "Street to Kimball-bound platform", elevators: [{ externalId: "41440-KIMBALL-BOUND", label: "Addison Kimball-bound platform elevator" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "41440",
    chainLabel: " (Loop-bound)",
    note: "Street to the Loop-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Observed live: 41440-LOOP-BOUND. Batch 4, 2026-07-16 (confidence 8/10 collectively).",
    segments: [
      { id: "street-platform", label: "Street to Loop-bound platform", elevators: [{ externalId: "41440-LOOP-BOUND", label: "Addison Loop-bound platform elevator" }] },
    ],
  },

  // Montrose (41500, Brown Line) — dual side platforms, "a set of stairs and
  // an elevator… to each platform" (chicago-L.org). BOTH directions observed.
  {
    systemId: SYSTEM,
    stationExternalId: "41500",
    chainLabel: " (Kimball-bound)",
    note: "Street to the Kimball-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Dual side platforms, one elevator per platform (chicago-L.org). Observed live: 41500-KIMBALL-BOUND. Batch 4, 2026-07-16 (confidence 8/10 collectively).",
    segments: [
      { id: "street-platform", label: "Street to Kimball-bound platform", elevators: [{ externalId: "41500-KIMBALL-BOUND", label: "Montrose Kimball-bound platform elevator" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "41500",
    chainLabel: " (Loop-bound)",
    note: "Street to the Loop-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Observed live: 41500-LOOP-BOUND. Batch 4, 2026-07-16 (confidence 8/10 collectively).",
    segments: [
      { id: "street-platform", label: "Street to Loop-bound platform", elevators: [{ externalId: "41500-LOOP-BOUND", label: "Montrose Loop-bound platform elevator" }] },
    ],
  },

  // Pulaski (40030, Green Line — Lake branch) — dual side platforms, separate
  // station house + elevator per platform (Blue-Green Program rebuild;
  // re-confirmed in the 2026-07-16 chicago-L.org sweep: "separate inbound and
  // outbound station houses with stairs and elevators from the street to
  // each"). BOTH directions observed. Distinct from Pink Pulaski (40150).
  {
    systemId: SYSTEM,
    stationExternalId: "40030",
    chainLabel: " (Harlem-bound)",
    note: "Street to the Harlem-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Separate station house + elevator per platform (chicago-L.org, re-confirmed 2026-07-16 sweep). Observed live: 40030-HARLEM-BOUND. Batch 4, 2026-07-16 (confidence 8/10 collectively).",
    segments: [
      { id: "street-platform", label: "Street to Harlem-bound platform", elevators: [{ externalId: "40030-HARLEM-BOUND", label: "Pulaski (Green Line) Harlem-bound platform elevator" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "40030",
    chainLabel: " (63rd-bound)",
    note: "Street to the 63rd-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Observed live: 40030-63RD-BOUND. Batch 4, 2026-07-16 (confidence 8/10 collectively).",
    segments: [
      { id: "street-platform", label: "Street to 63rd-bound platform", elevators: [{ externalId: "40030-63RD-BOUND", label: "Pulaski (Green Line) 63rd-bound platform elevator" }] },
    ],
  },

  // Southport (40360, Brown Line) — dual side platforms, dual elevator towers
  // one per platform, NO transfer bridge (chicago-L.org, fetched 2026-07-16).
  // Only Loop-bound observed; Kimball-bound synthetic pending observation.
  {
    systemId: SYSTEM,
    stationExternalId: "40360",
    chainLabel: " (Loop-bound)",
    note: "Street to the Loop-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Dual side platforms, dual elevator towers, no transfer bridge (chicago-L.org, fetched 2026-07-16). Observed live: 40360-LOOP-BOUND. Batch 4, 2026-07-16 (confidence 8/10 collectively).",
    segments: [
      { id: "street-platform", label: "Street to Loop-bound platform", elevators: [{ externalId: "40360-LOOP-BOUND", label: "Southport Loop-bound platform elevator" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "40360",
    chainLabel: " (Kimball-bound)",
    note: "Street to the Kimball-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Never yet observed live; synthetic placeholder id, promotable once observed (expected 'Kimball-bound' per Brown Line convention). Batch 4, 2026-07-16 (confidence 8/10 collectively).",
    segments: [
      { id: "street-platform", label: "Street to Kimball-bound platform", elevators: [{ externalId: "CTA-SYNTH-40360-KIMBALL-BOUND", label: "Southport Kimball-bound platform elevator — never yet observed live, synthetic id" }] },
    ],
  },

  // Jackson (40070, Blue Line — Dearborn subway) — island platform reached via
  // the Adams-Jackson mezzanine: street→mezzanine elevator (1991) THEN
  // mezzanine→platform elevator, TWO IN SERIES — both must work
  // (chicago-L.org). Observed: 40070-STREET (fits the street→mezz elevator);
  // the mezz→platform elevator is synthetic pending observation. A series
  // chain can only over-warn, never under-warn.
  {
    systemId: SYSTEM,
    stationExternalId: "40070",
    note: "Street to the platform takes two elevators in a row (street to mezzanine, then mezzanine to platform) — both must be working, and neither has a backup. If either elevator is out of service, this route is not step-free.",
    internalNote: "Subway island via the Adams-Jackson mezzanine; street→mezz elevator (1991, replaced the NE stair) + mezz→platform elevator, 2-in-series (chicago-L.org). Observed live: 40070-STREET ('The elevator to/from street at Jackson (Blue Line)') = the street→mezz leg; mezz→platform leg synthetic pending observation. Batch 4, 2026-07-16 (confidence 8/10 collectively).",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine", elevators: [{ externalId: "40070-STREET", label: "Jackson (Blue Line) street-to-mezzanine elevator" }] },
      { id: "mezzanine-platform", label: "Mezzanine to platform", elevators: [{ externalId: "CTA-SYNTH-40070-PLATFORM", label: "Jackson (Blue Line) mezzanine-to-platform elevator — never yet observed live, synthetic id" }] },
    ],
  },

  // Cicero (40480, Green Line — Lake branch) — two-story station house:
  // street→2nd-floor fare control (elevator #1), then a mezzanine passageway
  // over the street to the island platform (elevator #2). TWO IN SERIES
  // (chicago-L.org). Observed: 40480-STREET (fits elevator #1); the
  // passage→platform elevator is synthetic pending observation.
  {
    systemId: SYSTEM,
    stationExternalId: "40480",
    note: "Street to the platform takes two elevators in a row (street to the fare-control level, then across the passageway down to the platform) — both must be working, and neither has a backup. If either elevator is out of service, this route is not step-free.",
    internalNote: "Two-story station house: street→2nd-floor fare (elevator #1) → mezzanine passageway over the street → island platform (elevator #2), 2-in-series (chicago-L.org). Observed live: 40480-STREET = elevator #1; platform leg synthetic pending observation. Batch 4, 2026-07-16 (confidence 8/10 collectively).",
    segments: [
      { id: "street-fare", label: "Street to fare-control level", elevators: [{ externalId: "40480-STREET", label: "Cicero (Green Line) street-to-fare-control elevator" }] },
      { id: "passage-platform", label: "Passageway to platform", elevators: [{ externalId: "CTA-SYNTH-40480-PLATFORM", label: "Cicero (Green Line) passageway-to-platform elevator — never yet observed live, synthetic id" }] },
    ],
  },

  // Grand (40330, Red Line — State St subway) — dual side platforms +
  // mezzanine: ONE street→mezzanine elevator (NW-corner kiosk) is the shared
  // prerequisite for BOTH directions, then each platform has its own
  // mezz→platform elevator (2000s rehab; chicago-L.org). Same shape as
  // WMATA's Batch-3 "shared street↔mezzanine prerequisite feeding
  // per-direction platform legs". Observed: 40330-95TH-BOUND (a platform
  // leg); street elevator + Howard-bound leg synthetic pending observation.
  {
    systemId: SYSTEM,
    stationExternalId: "40330",
    chainLabel: " (95th-bound)",
    note: "Street to the 95th-bound platform takes two elevators in a row (street to mezzanine, then mezzanine to the 95th-bound platform) — both must be working, and neither has a backup. If either elevator is out of service, this route is not step-free.",
    internalNote: "Shared street→mezz elevator (NW-corner kiosk) feeding per-direction mezz→platform elevators (chicago-L.org, 2000s rehab) — WMATA Batch-3 shared-prerequisite shape. Observed live: 40330-95TH-BOUND (platform leg). Street elevator synthetic (expected 'The elevator to/from street at Grand'). Batch 4, 2026-07-16 (confidence 8/10 collectively).",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine", elevators: [{ externalId: "CTA-SYNTH-40330-STREET", label: "Grand (Red Line) street-to-mezzanine elevator — never yet observed live, synthetic id" }] },
      { id: "mezzanine-platform", label: "Mezzanine to 95th-bound platform", elevators: [{ externalId: "40330-95TH-BOUND", label: "Grand (Red Line) 95th-bound platform elevator" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "40330",
    chainLabel: " (Howard-bound)",
    note: "Street to the Howard-bound platform takes two elevators in a row (street to mezzanine, then mezzanine to the Howard-bound platform) — both must be working, and neither has a backup. If either elevator is out of service, this route is not step-free.",
    internalNote: "Shares the street→mezz prerequisite elevator with the 95th-bound chain (same physical unit, same synthetic id in both chains — an outage on it severs BOTH directions, which is the real structure). Howard-bound platform elevator never yet observed; synthetic pending observation. Batch 4, 2026-07-16 (confidence 8/10 collectively).",
    segments: [
      { id: "street-mezzanine", label: "Street to mezzanine", elevators: [{ externalId: "CTA-SYNTH-40330-STREET", label: "Grand (Red Line) street-to-mezzanine elevator — never yet observed live, synthetic id" }] },
      { id: "mezzanine-platform", label: "Mezzanine to Howard-bound platform", elevators: [{ externalId: "CTA-SYNTH-40330-HOWARD-BOUND", label: "Grand (Red Line) Howard-bound platform elevator — never yet observed live, synthetic id" }] },
    ],
  },

  // 95th/Dan Ryan (40450, Red Line terminal) — rebuilt 2014-2019 with TWO
  // street-level terminal buildings (North + South of 95th St), one island
  // platform in the Dan Ryan median. The platform sits under the North
  // Terminal and a PLATFORM-LEVEL walkway continues south to under the South
  // Terminal (chicago-L.org), so the whole platform level is walkable end to
  // end. EACH terminal has its own elevator to the platform: the South
  // Terminal's is agency-named in a live alert ("The South Terminal elevator
  // to/from platform"), the North Terminal's is on CTA's own project page
  // ("Stairs, escalators and an elevator connect the North Terminal concourse
  // to the train platform"). Both terminals are street-grade concourses →
  // either elevator alone keeps the station step-free — a REDUNDANT pair
  // (Cermak bookend pattern, terminal-flavored). Approved by Bryce 2026-07-16
  // (individual review). A vague "elevator at 95th" alert matches neither
  // member → needsReview → UNKNOWN (fail-safe, never false-accessible).
  {
    systemId: SYSTEM,
    stationExternalId: "40450",
    note: "Street to platform: 2 elevators (one in the North Terminal, one in the South Terminal — the platform connects to both) — either one keeps this station step-free. No single elevator outage removes step-free access on this route.",
    internalNote: "One island platform + platform-level walkway spanning both terminals (chicago-L.org); North Terminal elevator from CTA's own /95thterminal/ project page; South Terminal elevator agency-named in a live alert (observed id 40450-SOUTH-TERMINAL-PLATFORM). Both terminals street-grade. North elevator never yet observed → synthetic id, promote on first observation (expected phrasing ~'The North Terminal elevator to/from platform at 95th/Dan Ryan'). Residual: overnight terminal hours unverified (if one terminal locks overnight the redundancy is time-dependent) — no closure evidence found; same precedent as Cermak's auxiliary headhouses. Approved by Bryce 2026-07-16. Confidence 8/10.",
    segments: [
      {
        id: "street-platform",
        label: "Street to platform (either terminal's elevator)",
        elevators: [
          { externalId: "40450-SOUTH-TERMINAL-PLATFORM", label: "95th/Dan Ryan South Terminal elevator (street concourse to platform)" },
          { externalId: "CTA-SYNTH-40450-NORTH-TERMINAL", label: "95th/Dan Ryan North Terminal elevator (street concourse to platform) — never yet observed live, synthetic id" },
        ],
      },
    ],
  },

  // Jackson (40560, Red Line — State St subway) — island platform with TWO
  // full independent step-free routes, one per mezzanine (a Chicago subway
  // first, 2000). The Adams-Jackson (north) mezzanine and the Jackson-Van
  // Buren (south) mezzanine EACH have a street→mezzanine elevator AND a
  // mezzanine→platform elevator — 4 elevators total. The station stays
  // step-free as long as BOTH elevators on at least ONE route are working:
  // a REDUNDANT PAIR OF 2-IN-SERIES CHAINS,
  //   (Adams_street ∧ Adams_plat) ∨ (VanBuren_street ∧ VanBuren_plat).
  // The segment model is AND-of-ORs (a station is accessible iff EVERY segment
  // has a working elevator), so this OR-of-ANDs is encoded in CNF as the four
  // pairwise clauses below (the Stamford paired-segment pattern) — exact, not
  // an approximation: any single elevator outage leaves all four clauses
  // covered (redundant), while losing both elevators on one route AND one on
  // the other correctly severs access.
  // EVIDENCE (2026-07-16 research): Adams-Jackson street+platform observed live
  // (40560-ADAMS-JACKSON-STREET/-PLATFORM). Van Buren pair confirmed by
  // chicago-L.org (the 2000 Jackson-Van Buren renovation added a platform
  // elevator, "making Jackson/State accessible from both mezzanines, a Chicago
  // subway first") + a REAL CTA alert naming "the elevator to/from platform at
  // the Jackson Van Buren entrance" + Bryce (confident both street→mezz
  // elevators exist). All four ids are REAL: the two Van Buren ids are the
  // deterministic CTA parser's output for that alert text, so a future Van
  // Buren outage matches by id (no synthetic placeholder needed). A vague
  // "elevator at Jackson" alert matches no member → needsReview → UNKNOWN.
  {
    systemId: SYSTEM,
    stationExternalId: "40560",
    note: "Two independent step-free routes to the platform: the Adams-Jackson entrance (street elevator then platform elevator) or the Jackson-Van Buren entrance (street elevator then platform elevator). The station stays step-free as long as both elevators on at least one of the two routes are working — no single elevator outage removes step-free access.",
    internalNote: "State St subway island platform. Redundant pair of 2-in-series chains, one per mezzanine, encoded as a 4-clause CNF (paired-segment / Stamford pattern) of (Adams_street ∧ Adams_plat) ∨ (VanBuren_street ∧ VanBuren_plat). Adams-Jackson street+platform observed live. Jackson-Van Buren pair confirmed 2026-07-16: chicago-L.org (2000 renovation, 'accessible from both mezzanines, a Chicago subway first'), a real CTA alert ('elevator to/from platform at the Jackson Van Buren entrance'), and Bryce (both street→mezz elevators confirmed). Van Buren ids are the deterministic parser output (40560-JACKSON-VAN-BUREN-STREET/-PLATFORM) — real, not synthetic. Approved by Bryce 2026-07-16 (individual review). Confidence 9/10.",
    segments: [
      { id: "cnf-street-street", label: "Step-free guard: an Adams-Jackson or Jackson-Van Buren STREET elevator", elevators: [
        { externalId: "40560-ADAMS-JACKSON-STREET", label: "Adams-Jackson entrance street-to-mezzanine elevator" },
        { externalId: "40560-JACKSON-VAN-BUREN-STREET", label: "Jackson-Van Buren entrance street-to-mezzanine elevator" },
      ] },
      { id: "cnf-street-plat", label: "Step-free guard: Adams-Jackson street or Jackson-Van Buren platform elevator", elevators: [
        { externalId: "40560-ADAMS-JACKSON-STREET", label: "Adams-Jackson entrance street-to-mezzanine elevator" },
        { externalId: "40560-JACKSON-VAN-BUREN-PLATFORM", label: "Jackson-Van Buren entrance mezzanine-to-platform elevator" },
      ] },
      { id: "cnf-plat-street", label: "Step-free guard: Adams-Jackson platform or Jackson-Van Buren street elevator", elevators: [
        { externalId: "40560-ADAMS-JACKSON-PLATFORM", label: "Adams-Jackson entrance mezzanine-to-platform elevator" },
        { externalId: "40560-JACKSON-VAN-BUREN-STREET", label: "Jackson-Van Buren entrance street-to-mezzanine elevator" },
      ] },
      { id: "cnf-plat-plat", label: "Step-free guard: an Adams-Jackson or Jackson-Van Buren PLATFORM elevator", elevators: [
        { externalId: "40560-ADAMS-JACKSON-PLATFORM", label: "Adams-Jackson entrance mezzanine-to-platform elevator" },
        { externalId: "40560-JACKSON-VAN-BUREN-PLATFORM", label: "Jackson-Van Buren entrance mezzanine-to-platform elevator" },
      ] },
    ],
  },

  // ── Transfer-bridge / rotogate family, shipped 2026-07-16 (/liftwatch-station-review) ──
  // Two archetypes from STATION-RESEARCH.md, both resolved the same way:
  // B′ (Ashland, 43rd, California — side platforms linked by an overhead
  // transfer bridge; open question was whether either tower reaches BOTH
  // platforms, a possible cross-redundant pair) and B″ (King Drive, Cottage
  // Grove — fare control only on the inbound platform, outbound platform's
  // elevator is egress-only via wheelchair rotogates; open question was how
  // to model the boarding-vs-exiting asymmetry). Neither question is
  // resolved here — both are modeled the SAME conservative way as
  // Conservatory (41670, Batch 2, also a B′ station): two INDEPENDENT,
  // NON-REDUNDANT per-direction chains, using whichever id CTA's own alerts
  // have actually reported and a synthetic placeholder for the unconfirmed
  // side. This never claims a redundancy we can't back with a real signal
  // (over-warn, never under-warn), and it sidesteps the boarding/egress
  // schema question entirely — the model only tracks whether an elevator is
  // up, not which direction a rider can enter fare control from. Approved by
  // Bryce as a batch (confidence 7/10 collectively — matches Conservatory's
  // already-shipped precedent exactly; the soft spot is unconfirmed
  // direction naming at Ashland/California/Cottage Grove, cosmetic only).

  // Ashland (40170, Green/Lake + Pink). "All entry via the inbound side,
  // outbound reached by the overhead transfer bridge; two elevator towers on
  // the paid side" (chicago-L.org). Only the street/inbound tower has ever
  // been observed live; the bridge/outbound tower's id and direction name are
  // unconfirmed.
  {
    systemId: SYSTEM,
    stationExternalId: "40170",
    chainLabel: " (street/inbound)",
    note: "Street to the inbound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Side platforms; all entry via the inbound side (chicago-L.org). Real observed id, alert text never names a direction ('the elevator to/from street'). Human-approved as part of the transfer-bridge/rotogate batch via /liftwatch-station-review 2026-07-16 (confidence 7/10 — no redundancy claimed).",
    segments: [
      { id: "street-platform", label: "Street to inbound platform", elevators: [{ externalId: "40170-STREET", label: "Ashland street/inbound platform elevator" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "40170",
    chainLabel: " (outbound, via bridge)",
    note: "Inbound platform (via the overhead transfer bridge) to the outbound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Never yet observed live; synthetic placeholder id, promotable once observed. Direction name unconfirmed (no distinct alert text has ever named it). Human-approved as part of the transfer-bridge/rotogate batch via /liftwatch-station-review 2026-07-16 (confidence 7/10 — no redundancy claimed).",
    segments: [
      { id: "bridge-platform", label: "Transfer bridge to outbound platform", elevators: [{ externalId: "CTA-SYNTH-40170-OUTBOUND", label: "Ashland outbound platform elevator — never yet observed live, synthetic id" }] },
    ],
  },

  // 43rd (41270, Green Line). "TWO stainless elevator towers + overhead
  // bridge (1994-96)" (chicago-L.org) — the only one of this family where
  // BOTH towers have independently appeared live: 41270-STREET-PLATFORMS-
  // BRIDGE (one tower serving street+bridge+platform) and 41270-HARLEM-BOUND
  // (the outbound tower). Strongest evidence of the five.
  {
    systemId: SYSTEM,
    stationExternalId: "41270",
    chainLabel: " (street/inbound)",
    note: "Street to the inbound platform (and the transfer bridge): one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Dual side platforms, two stainless elevator towers + overhead bridge, 1994-96 (chicago-L.org). Real observed id; alert text ('elevator to/from street, platforms and bridge') reads as one tower serving all three functions. Human-approved as part of the transfer-bridge/rotogate batch via /liftwatch-station-review 2026-07-16 (confidence 7/10 — no redundancy claimed).",
    segments: [
      { id: "street-platform-bridge", label: "Street/bridge to inbound platform", elevators: [{ externalId: "41270-STREET-PLATFORMS-BRIDGE", label: "43rd street/platform/bridge elevator" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "41270",
    chainLabel: " (Harlem-bound)",
    note: "Transfer bridge to the Harlem-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Real observed id (41270-HARLEM-BOUND), independently confirmed live — distinct from the street/platforms/bridge tower. Human-approved as part of the transfer-bridge/rotogate batch via /liftwatch-station-review 2026-07-16 (confidence 7/10 — no redundancy claimed).",
    segments: [
      { id: "bridge-platform", label: "Transfer bridge to Harlem-bound platform", elevators: [{ externalId: "41270-HARLEM-BOUND", label: "43rd Harlem-bound platform elevator" }] },
    ],
  },

  // California (41360, Green/Lake). "Single fare control at track level on
  // the INBOUND (south) side; street elevator at the corner + dual elevators
  // flanking the platforms with crossbridge structures" (chicago-L.org).
  // CTA's own alerts never gave the platform-side elevator distinct location
  // text — it's always bundled with "street" in a compound alert, or falls
  // to the bare station id (vague-alert fail-safe) — so it stays synthetic.
  {
    systemId: SYSTEM,
    stationExternalId: "41360",
    chainLabel: " (street/inbound)",
    note: "Street to the inbound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Side platforms, single fare control on the inbound side, street elevator at the corner (chicago-L.org). Real observed id. Human-approved as part of the transfer-bridge/rotogate batch via /liftwatch-station-review 2026-07-16 (confidence 7/10 — no redundancy claimed).",
    segments: [
      { id: "street-platform", label: "Street to inbound platform", elevators: [{ externalId: "41360-STREET", label: "California street/inbound platform elevator" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "41360",
    chainLabel: " (Harlem-bound)",
    note: "Inbound platform (via crossbridge) to the Harlem-bound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Never independently observed live — CTA's compound alert ('elevator to/from street and elevators needed to access the Harlem-bound platforms') bundles it with the street elevator, and the vague form falls to the bare station id (41360). Synthetic placeholder id, promotable once individually observed. Human-approved as part of the transfer-bridge/rotogate batch via /liftwatch-station-review 2026-07-16 (confidence 7/10 — no redundancy claimed).",
    segments: [
      { id: "bridge-platform", label: "Crossbridge to Harlem-bound platform", elevators: [{ externalId: "CTA-SYNTH-41360-HARLEM-BOUND", label: "California Harlem-bound platform elevator — never yet observed live, synthetic id" }] },
    ],
  },

  // Cottage Grove (40720, Green Line). B″ pattern — "same design" as King
  // Drive (chicago-L.org): fare control only on the inbound platform, the
  // outbound platform's elevator is egress-only via wheelchair rotogates.
  // Only the street/inbound elevator has ever been observed live.
  {
    systemId: SYSTEM,
    stationExternalId: "40720",
    chainLabel: " (street/inbound)",
    note: "Street to the inbound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Fare-control platform + exit-only outbound elevator/rotogates, same design as King Drive (chicago-L.org). Real observed id. Human-approved as part of the transfer-bridge/rotogate batch via /liftwatch-station-review 2026-07-16 (confidence 7/10 — no redundancy claimed).",
    segments: [
      { id: "street-platform", label: "Street to inbound platform", elevators: [{ externalId: "40720-STREET", label: "Cottage Grove street/inbound platform elevator" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "40720",
    chainLabel: " (outbound, egress via rotogates)",
    note: "Outbound platform elevator (egress via wheelchair rotogates): one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Never yet observed live; synthetic placeholder id, promotable once observed. Fare control exists only on the inbound platform — this elevator is understood to be egress-only via high-barrier rotogates (chicago-L.org), not a boarding path; tracked here as an ordinary single-elevator chain regardless. Human-approved as part of the transfer-bridge/rotogate batch via /liftwatch-station-review 2026-07-16 (confidence 7/10 — no redundancy claimed).",
    segments: [
      { id: "rotogate-platform", label: "Outbound platform elevator (egress via rotogates)", elevators: [{ externalId: "CTA-SYNTH-40720-OUTBOUND", label: "Cottage Grove outbound platform elevator — never yet observed live, synthetic id" }] },
    ],
  },

  // King Drive (41140, Green Line). B″ pattern, inverse of Cottage Grove:
  // only the outbound (Harlem-bound)/rotogate elevator has ever been
  // observed live; the street/inbound elevator's id is unconfirmed.
  {
    systemId: SYSTEM,
    stationExternalId: "41140",
    chainLabel: " (street/inbound)",
    note: "Street to the inbound platform: one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Never yet observed live; synthetic placeholder id, promotable once observed. Fare-control platform + exit-only outbound elevator/rotogates (chicago-L.org). Human-approved as part of the transfer-bridge/rotogate batch via /liftwatch-station-review 2026-07-16 (confidence 7/10 — no redundancy claimed).",
    segments: [
      { id: "street-platform", label: "Street to inbound platform", elevators: [{ externalId: "CTA-SYNTH-41140-STREET", label: "King Drive street/inbound platform elevator — never yet observed live, synthetic id" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "41140",
    chainLabel: " (Harlem-bound, egress via rotogates)",
    note: "Harlem-bound platform elevator (egress via wheelchair rotogates): one elevator, no backup. If that elevator is out of service, this route is not step-free.",
    internalNote: "Real observed id (41140-HARLEM-BOUND). Fare control exists only on the inbound platform — this elevator is understood to be egress-only via high-barrier rotogates (chicago-L.org), not a boarding path; tracked here as an ordinary single-elevator chain regardless. Human-approved as part of the transfer-bridge/rotogate batch via /liftwatch-station-review 2026-07-16 (confidence 7/10 — no redundancy claimed).",
    segments: [
      { id: "rotogate-platform", label: "Harlem-bound platform elevator (egress via rotogates)", elevators: [{ externalId: "41140-HARLEM-BOUND", label: "King Drive Harlem-bound platform elevator" }] },
    ],
  },

  // Roosevelt (41400, Red/Orange/Green) — deferred 2026-07-16 pending
  // firsthand info (chicago-L.org accounted for only 2 of the ASAP plan's
  // 3 elevators). Bryce asked on Discord and got a full structural answer:
  // TWO independent chains, not one. Green/Orange riders reach the elevated
  // platform via ONE elevator straight from the street (never yet observed
  // live). Red Line riders reach the underground platform via TWO elevators
  // in series: street to the transfer tunnel, then transfer tunnel to the
  // Red Line platform — different elevator from the one Green/Orange riders
  // use to reach street. The transfer tunnel's real, live-observed id
  // (41400-TRANSFER-TUNNEL) is the SECOND leg (tunnel-to-platform) — Bryce
  // confirmed this mapping explains why the real alert text names "Red,
  // Orange and Green Lines" together: that elevator is also the shared
  // choke point for Orange/Green riders transferring down to the Red Line
  // platform, not just for Red riders arriving from street. Confidence
  // 8/10 — crowd-sourced via Discord rather than an agency document, but a
  // complete, internally-consistent structural answer Bryce vetted himself.
  {
    systemId: SYSTEM,
    stationExternalId: "41400",
    chainLabel: " (Orange/Green)",
    note: "Street to the elevated Orange/Green platform: one elevator, no backup. If that elevator is out of service, this route is not step-free. This station's layout was reconstructed from rider reports rather than an agency diagram, so confidence here is lower than most of the site — if you use this station and something looks off, feedback is welcome (a proper reporting channel is coming soon).",
    internalNote: "Never yet observed live; synthetic placeholder id, promotable once individually observed. Structure confirmed by Bryce via Discord 2026-07-16 (confidence 8/10).",
    segments: [
      { id: "street-platform", label: "Street to elevated platform", elevators: [{ externalId: "CTA-SYNTH-41400-ORANGE-GREEN", label: "Roosevelt Orange/Green platform elevator — never yet observed live, synthetic id" }] },
    ],
  },
  {
    systemId: SYSTEM,
    stationExternalId: "41400",
    chainLabel: " (Red)",
    note: "Street to the underground Red Line platform: 2 elevators in series (street to the transfer tunnel, then transfer tunnel to the platform), no backup on either leg. If either elevator is out of service, this route is not step-free. This station's layout was reconstructed from rider reports rather than an agency diagram, so confidence here is lower than most of the site — if you use this station and something looks off, feedback is welcome (a proper reporting channel is coming soon).",
    internalNote: "Street-to-tunnel leg never yet observed live, synthetic placeholder id. Tunnel-to-platform leg is the real, live-observed 41400-TRANSFER-TUNNEL -- also the shared choke point for Orange/Green riders transferring down to the Red Line platform (explains the live alert naming all 3 lines). Structure confirmed by Bryce via Discord 2026-07-16 (confidence 8/10).",
    segments: [
      { id: "street-tunnel", label: "Street to transfer tunnel", elevators: [{ externalId: "CTA-SYNTH-41400-STREET-TUNNEL", label: "Roosevelt street-to-transfer-tunnel elevator — never yet observed live, synthetic id" }] },
      { id: "tunnel-platform", label: "Transfer tunnel to Red Line platform", elevators: [{ externalId: "41400-TRANSFER-TUNNEL", label: "Roosevelt transfer tunnel to Red Line platform elevator" }] },
    ],
  },
];
