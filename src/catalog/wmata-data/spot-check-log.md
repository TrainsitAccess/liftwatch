# WMATA auto-tier spot-check log

_Manual accuracy spot-check of the AUTO-GENERATED WMATA station models (the ~55
stations built by `scripts/wmata-pathways.mts` into `chains.json`, never
individually reviewed). One line per station: code, name, verdict, date.
Driven by `/liftwatch-wmata-spot-check`._

| Code | Station | Verdict | Date |
|---|---|---|---|
| A08 | Friendship Heights | FIXED — auto 2×2 was wrong on two axes; re-modeled per-entrance CNF | 2026-07-17 |
| — | ALL 46 auto-tier stations | BULK AUDIT vs WMATA Rider Tools inventory — 38 confirmed, 4 fixed, 4 open | 2026-07-17 |
| N06 | Wiehle-Reston East | FIXED — real 2×2 (GTFS drew 1+1); curated with real page ids | 2026-07-17 |
| N11 | Loudoun Gateway | FIXED — real 2×2 (GTFS drew 1+1); curated with real page ids | 2026-07-17 |
| N10 | Washington Dulles International Airport | FIXED — 4-elevator platform bank (GTFS drew 2); real page ids | 2026-07-17 |
| D01 | Federal Triangle | FIXED — platform pair D01X02/D01X03 (GTFS drew 1+1); real page ids | 2026-07-17 |
| C13 | King St-Old Town | FIXED — 3rd standalone platform elevator C13S01 (south of King St) added; mezzanine at street grade; 3-way OR, all redundant | 2026-07-17 |
| F06 | Anacostia | FIXED — pair split across Howard Rd / Kiss & Ride (separate at-grade mezzanines); redundant via disclosed ~0.3 mi step-free walk | 2026-07-17 |
| B10 | Wheaton | FIXED — at-grade mezzanine via ramp (§3C); GTFS phantom street elevator dropped; 2 garage elevators are the Kiss & Ride entrance; only B10X01 gates | 2026-07-17 |
| B11 | Glenmont | FIXED — street pair flanking Georgia Ave confirmed REDUNDANT (crossable at grade); real ids + locations; sole platform elevator | 2026-07-17 |

## Notes

- **Tier B Group B: model-vs-page conflicts resolved (2026-07-18,
  `/liftwatch-wmata-tier-b`)** — 4 stations where WMATA's page structurally
  disagreed with the model, resolved with Bryce's direct ground truth
  (outranks the page):
  - **B35 NoMa-Gallaudet U** — RECONCILED to WMATA's count. The long-standing
    watch item (Bryce recalled 2 platform elevators; WMATA's page always
    showed 1) is now closed: Bryce confirmed the page's single elevator
    (B35N01) is correct. No longer redundant. Bike-trail auxiliary chain
    (B35N02) unaffected.
  - **F08 Southern Ave** — the assumed pedestrian-bridge elevator does NOT
    exist (Bryce confirmed); dropped. Core chain is now just the real
    mezz→platform elevator (F08X02), sole access. The garage elevator
    (F08X01, previously unmodeled) is now tracked as its own auxiliary
    chain, not required for ordinary access.
  - **K04 Ballston-MU** — the Vienna-bound platform elevator is one of the
    two real "to Vienna" street→mezzanine ids (K04X01, K04X03), running
    through in a single shaft — but Bryce does NOT know which one, and
    asked this be left unresolved rather than guessed. Modeled
    conservatively: BOTH K04X01 and K04X03 are now required (AND, not OR)
    for the Vienna-bound platform leg, so an outage on either reads
    inaccessible until alert evidence disambiguates which is the true
    through-shaft (over-warn). New-Carrollton-bound leg promoted cleanly to
    real id K04X02. **Watch item re-opened, not closed** — see
    `internalNote` on the Vienna-bound chain for what future alert wording
    would resolve it.
  - **C15 Huntington** — the Huntington Ave. entrance elevator promoted to
    real id C15N01. The South Kings Hwy inclinator confirmed to have no
    real id anywhere in WMATA's elevator feed/page (inclinators are
    separate equipment) — stays a synthetic placeholder, watch item closed
    (no further resolution possible from this source).
  `check:wmata` extended with a "Tier B Group B" regression block (11
  checks) locking in all four. `demo:access` (69 checks) + `check:wmata`
  both green.

- **Tier B Group A: Silver Line median stations RE-MODELED (2026-07-18,
  `/liftwatch-wmata-tier-b`)** — N01 McLean, N02 Tysons, N03 Greensboro, N04
  Spring Hill, N07 Reston Town Center, N08 Herndon, N12 Ashburn. WMATA's own
  Rider-Tools page inventory shows each station has SIX elevators (verified
  against Spring Hill as the reference layout, then all 7 individually): a
  redundant PAIR on each pavilion's street→mezzanine leg + a redundant PAIR on
  the shared platform leg (GTFS had undercounted every leg to a single
  elevator — the Silver Line's version of the Forest Glen/Rosslyn undercount
  class). Flips all 7 from non-redundant to redundant. Bryce confirmed
  2026-07-18: single shared island platform per station; the two pavilions
  ARE connected step-free but only via a long crossing that isn't necessarily
  pedestrian-safe — disclosed in the rider note but deliberately NOT counted
  as a cross-pavilion backup (kept as two separate per-pavilion pairs,
  over-warn default). Real page UnitNames throughout; id ordering varies by
  station (N01-N04 put the platform pair at X05/X06, N07/N08/N12 at X01/X02)
  — bound per-station, not assumed. N01/N02's non-confirmed-side pavilion is
  still inferred by elimination (WMATA's page labels it "mezzanine to
  grade/street" rather than a compass side); this also corrected N01's
  previous N/S label inversion. College Park (E09) was audited alongside and
  confirmed to be a genuinely different, single-elevator-per-leg structure —
  left unchanged. `check:wmata`'s grade-separated regression block split into
  an E09 case (non-redundant) and a new Silver-median case (7 stations, all
  redundant, 6 ids each, shared platform pair, cross-pavilion note asserted).
  Confidence 8/10. `demo:access` (69 checks) + `check:wmata` both green.

- **Bulk id promotion + full cross-check (2026-07-18)** — Bryce asked to promote
  every remaining synthetic `WMATA-<node>` id to its real UnitName, system-wide.
  The Rider-Tools inventory was extended to all 91 rail stations
  (`rider-tools-inventory.json`). **Generated tier**: an additive page-id binding
  pass in `scripts/wmata-pathways.mts` promoted all 38 stations (0 synthetics
  left; `PAGE_ID_OVERRIDES` for A15 "parking/Kiss & Ride" + B03 "Amtrak station").
  **Curated tier**: 33 stations (Tier A) promoted — self-consistent swaps where
  structure already matched the page. A full model-vs-page cross-check (real-id-
  not-on-page, segment-mismatch, missing-elevator) came back **0 errors**; the
  only real discrepancies are the **13 Tier B stations** (page structurally
  disagrees with the model), handed to `/liftwatch-wmata-tier-b`: the 7 Silver
  Line grade-separated median stations (undercounted redundant pairs — N01/N02/
  N03/N04/N07/N08/N12), NoMa B35 + Ballston K04 (watch items), Southern Ave F08,
  Huntington C15, Potomac Yard C11 (direction-grouping bug), Arlington Cemetery
  C06. **Bryce's knowledge outranks the page** where they conflict.

- **Bulk audit (2026-07-17)** — After A08 Friendship Heights turned up wrong on
  two axes, Bryce asked for a full audit of the remaining auto tier against
  WMATA's own Rider Tools station pages (the A08 ground-truth source). All 46
  pages fetched; WMATA's server-rendered `elevatorListCMF` payload carries the
  full per-station inventory with REAL unit ids, per-entrance grouping, and
  location phrases — snapshotted to `rider-tools-inventory.json`. Results: 38
  stations structurally confirmed (incl. D10 Deanwood — plain 2-series, the
  note artifact is phrasing only); 4 fixed as `page-inventory-undercount`
  curated models (N06 Wiehle-Reston East and N11 Loudoun Gateway real 2×2,
  N10 Dulles Airport 4-elevator bank, D01 Federal Triangle platform pair); 4
  left open pending Bryce (C13 King St-Old Town 3rd elevator C13S01, F06
  Anacostia per-entrance pair connectivity, B10 Wheaton street-leg mystery,
  B11 Glenmont standing Georgia Ave call). Untapped follow-up: the page
  inventory could promote nearly every remaining synthetic id to a real
  UnitName (deferred — Bryce approved only the 4 structural fixes this pass).

- **A08 Friendship Heights (2026-07-17)** — Auto-model was a plain 2×2
  redundancy (4 elevators, one connected mezzanine assumed). WMATA's own Rider
  Tools page shows **7 elevators** across two SEPARATE entrances: Jenifer Street
  (north) 4× street→mezzanine + 1× mezzanine→platform; Western Avenue (south)
  1× street→mezzanine + 1× mezzanine→platform. Bryce confirmed the two
  mezzanines are not connected without going through a platform. Two GTFS
  errors compounded: (a) undercounted the Jenifer St. street leg as 1 elevator
  instead of 4 (Forest Glen/Rosslyn bank pattern); (b) assumed one connected
  mezzanine (Navy Yard F05 split-mezzanine pattern). Re-modeled as a 4-clause
  CNF: (any Jenifer St. street elevator AND the Jenifer St. platform elevator)
  OR (the Western Ave. street elevator AND the Western Ave. platform elevator).
  Excluded from the generator via `CURATED_SPLIT_MEZZANINE`; curated in
  `wmata-models.ts`; 12-case regression in `check:wmata`. All 7 ids synthetic
  (page names entrances, not unit numbers). Confidence 8/10.
