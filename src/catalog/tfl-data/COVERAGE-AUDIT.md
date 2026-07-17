# TfL auto-generated models — coverage & accuracy audit

_Audit pass 2026-07-17, applying the lessons from the WMATA station review
(false redundancy, undercounts, note consistency) to TfL's auto-generated
access-chain tier. **Headline: the TfL generated tier is sound — no
under-warns found.** Unlike WMATA's GTFS-pathway tier (which invented
redundancy at grade-separated entrances), TfL's redundancy rests on a
principled signal that a self-check already enforces. This report records the
verification and the one non-blocking observation. Companion: the WMATA
`WMATA-STATION-GUIDE.md` / `COVERAGE-AUDIT.md`, and CLAUDE.md's TfL sections._

---

## 1. What was audited

- **209 generated models across 132 lift-equipped stations**
  (`tfl-data/chains.json`), built by `scripts/tfl-chains.mjs` from TfL's
  published lift-route topology + `RampRoutes`/`SameLevelPaths`.
- **71 stations (74 components) excluded** (`chains-excluded.json`) — the big
  branching interchanges, held for human review.
- Cross-checked against `lifts.json` (569-lift inventory, each with an
  `isRedundant` flag + `redundancyGroupSize` + `fromAreas`/`toAreas`),
  `step-free-paths.json` (TfL's own ramp + same-level paths), and TfL's live
  StopPoint API for lift counts.

Model shape breakdown:

| Shape | Count |
|---|--:|
| Single-lift, sole access (can't under-warn) | 168 |
| Multi-leg series, no redundancy (can't under-warn) | 17 |
| **Redundant** (a leg with 2+ lifts) | **24** |
| — of which genuine (identical from+to, `isRedundant=true`) | 13 |
| — of which step-free-path-backed (documented exception) | 11 |
| With an explicit `stepFreeAlternative` leg | 5 |

## 2. Why TfL is structurally safer than WMATA was

WMATA's tier derived redundancy from GTFS level-pair grouping, which can't see
which side of a barrier an entrance is on — so it invented redundancy at
grade-separated stations (the 2026-07-17 fix). TfL is different:

- **Redundancy = an exact `(fromAreas, toAreas)` match.** Two lifts are
  redundant only if they connect the *same specific named areas*. TfL's area
  codes are granular (e.g. `910GACTONML-1001003-AC-S-6`), so an identical
  from+to means the same physical origin and destination — genuinely
  interchangeable, not a grade-separated coincidence.
- **A self-check enforces it** (`check:tfl-chains`): every modeled lift's
  chain-derived redundancy (is the station still accessible with only this lift
  down?) must equal its own `isRedundant` flag, or be listed in
  `evidenceExceptions` with a reason. It passes with 41 documented exceptions.

## 3. Verification of the 24 redundancy claims (the only place an under-warn could hide)

Single-lift and series models can't under-warn by construction, so the audit
focused on the 24 redundant models. All 24 hold up:

### 3a. Genuine identical-route pairs (13 models) — `isRedundant=true`
Both lifts share the exact same `fromAreas` and `toAreas` (Poplar, Borough,
Caledonian Road, Wood Lane ×2, Elephant & Castle, Stratford International,
London City Airport, Paddington …). Same origin, same destination → truly
interchangeable. No grade-separated risk: identical area codes = same place.

### 3b. Step-free-path-backed (11 models) — `isRedundant=false`, documented exception
These group lifts that reach *different* platforms/exits, which looked like the
WMATA side-platform trap at first — but every one is justified in
`evidenceExceptions` by a **TfL-published step-free path** (`step-free-paths.json`,
from TfL's own `RampRoutes`/`SameLevelPaths`). The precise test that matters:
does **each** lift in the group have its own paralleling step-free route (so no
single platform is stranded)? **Verified yes for all of them**, and spot-checked
three against the raw path data + station reality:

- **East Croydon** — TfL publishes a ramp from the main concourse to **each** of
  platforms 1, 2, 3 (`MnCon↔RPL1/RPL2/RPL3`). Each platform is independently
  step-free, so any single lift outage is genuinely covered. (East Croydon is a
  known ramp-accessible station.)
- **Abbey Road (DLR)** — the two DLR platforms are directly connected same-level
  (`DLRN↔DLRS`), plus street access, so either lift + a short walk reaches
  either platform.
- **Royal Victoria (DLR)** — both platforms connect to `Outside` same-level
  (`Outside↔Plat01`, `Outside↔Plat02`) — genuinely step-free from the street.

The redundancy is the same principle as WMATA's mezzanine-at-grade /
`stepFreeAlternative`: a real, agency-published non-elevator step-free route.
Trustworthy because it's TfL's own accessibility data, the same tier as the
lift inventory itself.

## 4. Other checks

- **Notes** — 11 template shapes across all 209 models, every model has a note,
  none malformed or contradictory. Ordinal labels ("Route 1", "Leg 1") are the
  deliberate neutral choice (TfL area codes can't be decoded to line/platform
  names without guessing).
- **Undercount** — `lifts.json` is an enumerated per-lift export (not a
  collapsible topology graph like WMATA's GTFS), so the "bank drawn as one
  pathway" trap can't occur the same way. Spot-check vs TfL's live StopPoint
  API: Borough reads 2 lifts in both. Low risk.
- **Excluded set (71 stations)** — all excluded for topological complexity
  (branching hub nodes, multi-level lifts in multi-edge components,
  multi-destination edges). Conservative and correct: an un-modeled station
  shows its lifts individually with no redundancy claim (over-warn, never
  under-warn). This is the human-review backlog, same as WMATA's original
  excluded pool — needs the `/liftwatch-station-review` ritual, not a solo fix.

## 5. The one observation (flagged for Bryce — deliberately NOT auto-applied)

The 11 step-free-path-backed redundant segments carry `stepFreeAlternative:
false`. Effect: a **single** lift outage reads correctly (accessible via the
other lift and/or the ramp), but if **all** lifts in the group are down at once,
the model reads the station **inaccessible** — even though TfL's own data shows a
ramp/street step-free route still exists. That is an **over-warn** (the safe
direction, and consistent with the generator's conservative design), so it is
not a bug.

Making it fully accurate would mean setting `stepFreeAlternative: true` on those
segments so an all-lifts-down case reads accessible. But that moves the model
toward *less* warning, which needs confirmation that each published path is a
*complete* street→platform step-free route (not just one leg) — exactly the kind
of redundancy verdict the project reserves for a human. Left as-is pending your
call; the safe over-warn stands in the meantime.

## 6. Bottom line

No fixes applied — none were warranted. The TfL auto-generated tier does not
under-warn: every redundancy claim is backed by an identical-route match or a
per-destination TfL-published step-free path, enforced by `check:tfl-chains`.
The excluded interchanges remain the human-review backlog. The only open item
is the optional, less-conservative `stepFreeAlternative` refinement in §5.
