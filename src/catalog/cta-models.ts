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
];
