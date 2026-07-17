# WMATA auto-tier spot-check log

_Manual accuracy spot-check of the AUTO-GENERATED WMATA station models (the ~55
stations built by `scripts/wmata-pathways.mts` into `chains.json`, never
individually reviewed). One line per station: code, name, verdict, date.
Driven by `/liftwatch-wmata-spot-check`._

| Code | Station | Verdict | Date |
|---|---|---|---|
| A08 | Friendship Heights | FIXED — auto 2×2 was wrong on two axes; re-modeled per-entrance CNF | 2026-07-17 |

## Notes

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
