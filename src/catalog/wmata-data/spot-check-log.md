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
| B10 | Wheaton | OPEN — GTFS street→mezz elevator absent from WMATA's page (only garage listed); how does street access work? | 2026-07-17 |
| B11 | Glenmont | OPEN — ids/locations page-confirmed; standing Georgia Ave redundancy call unchanged | 2026-07-17 |

## Notes

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
