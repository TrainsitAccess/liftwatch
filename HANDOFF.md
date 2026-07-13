# LiftWatch — Session Handoff (2026-07-12)

**To start the next session, paste the prompt in [§ Next-session prompt](#next-session-prompt) below.**

Repo: `C:\Users\Bryce\Claude\liftwatch` · main pushed to
github.com/TrainsitAccess/liftwatch. `SPEC.md` is the source of truth; `CLAUDE.md`
is the operational summary (both current). Full backlog + resume detail live in
Claude's memory: `project_liftwatch_handoff_2026-07-12.md` and
`project_liftwatch_curation_todo.md`.

---

## Next-session prompt

Copy everything in this block:

```
Resume LiftWatch (C:\Users\Bryce\Claude\liftwatch). Read the memory file
project_liftwatch_handoff_2026-07-12.md first, plus project_liftwatch_curation_todo.md,
and HANDOFF.md in the repo.

TASK: finish the WMATA (DC Metro) full per-elevator build. The scaffold is
scripts/wmata-pathways.mts (committed WIP, commit ccf42f8) — its header has the
plan. Architecture is already proven: WMATA's GTFS rail-gtfs-static.zip
(pathways.txt + levels.txt) gives a full elevator inventory + topology-derived
redundancy (mode-5 pathways = elevators between named levels
Street/Mezzanine/Platform); the live Incidents LocationDescription ("Elevator
between street and mezzanine") crosswalks each outage to its segment by level
pair. 75/97 stations model cleanly; 17 complex transfer stations exclude.

BLOCKER to fix before ANYTHING ships (correctness-critical — a missed elevator on
a segment makes a station falsely read ACCESSIBLE, an under-warn, which this
project never tolerates): the first-pass regex captured only 154 of ~205 mode-5
elevators because WMATA's node naming is inconsistent (ELV/ELE/EL markers,
BT/TP/MID/LG/UP suffixes, some ENT_-prefixed nodes, both endpoints).

DO, in order:
1. Rewrite the elevator extraction to capture ALL mode-5 elevators: get each
   pathway's two levels from stops.txt (don't parse levels from the node name),
   and group a physical elevator's pathways robustly (strip the position suffix;
   handle 3-level BT/MID/TP elevators as ONE elevator).
2. Reconcile the count: ~205 rail-pathways elevators vs WMATA's published ~320 —
   confirm the gap is garage/facility elevators absent from the RAIL GTFS, don't
   assume.
3. Validate the derived redundancy against a ground truth (spot-check a few
   stations); flag anything uncertain for me rather than guessing.
4. Only then: rework the WMATA adapter to emit the full inventory
   (inventoryComplete: true, retire the staticFleetReference hack) and attribute
   live outages by LocationDescription level pair; wire the models into
   station-models.ts; add a check:wmata regression. Update SPEC.md + CLAUDE.md.

GTFS download: GET https://api.wmata.com/gtfs/rail-gtfs-static.zip?api_key=KEY
(key is in .env as WMATA_API_KEY; no zip lib in the repo — extract to a dir and
pass it to the script, same pattern as tfl-import). Node isn't on PATH in
non-interactive shells: prepend $env:Path="C:\Program Files\nodejs;$env:Path".
Verify with npm run typecheck + demo:access; commit/push per commit as you go.

Do the extraction + validation yourself; bring me the redundancy spot-check and
anything ambiguous before wiring it live. CTA is out of scope (structurally can't
reach per-elevator parity — no ids, no pathways).
```

---

## What shipped this session

| Commit | Work |
|---|---|
| `6d0ae1f` | Expansion research — ranked plan of new systems to add (see `EXPANSION.md`). Not started. |
| `5eb6efd` | MBTA joint review — every flagged street-alternate/no-guidance elevator resolved; `review-flags.json` emptied. |
| `1f31ddf` | BART platform-default attribution — bare "Station" → the platform elevator when unique; fixed live RICH/POWL/COLS "unspecified"; removed Richmond override. |
| `65e9c6e` | Coliseum's 4 elevators modeled (auxiliary chains); renamed the access-issues layer → "other accessibility equipment" everywhere incl. the DB table (`other_equipment_events`); Coliseum wheelchair lift moved there; new `needsReview` flag + "Needs review" board + ntfy push. |
| `af5353d` | Schema-tolerance fix — ingest/build tolerate a missing `needs_review` column (would otherwise have broken the live poll). |
| `313a30b` | Missing-information flag — flags an outage missing a field its system is *expected* to provide, via a per-system capability profile (`field-expectations.ts`); never fires on an agency limitation. |
| — | Live data-integrity audit — all 125 current outages cross-checked vs each agency: **125/125 match, 0 phantom, 0 missing**. Delivered as an artifact + `SPEC.md` audit section. |
| `9418d30` `b00da7c` `8c4bca3` | MBTA curation — built the hand-curated MBTA tier (`mbta-models.ts`); modeled 8 stations (Gov Center, Alewife, Maverick, Gilman Sq, Orient Heights, Airport, Lynn, Beverly). |
| `ccf42f8` | WMATA WIP scaffold (`scripts/wmata-pathways.mts`) — see the prompt above. |

Tests green: `demo:access` 63, `check:mbta-chains` 20, typecheck clean.

## Pre-launch to-dos (before go-live, after the archive wipe)
- Apply the fresh `db/schema.sql` (renamed table + `needs_review` column).
- Set `NTFY_TOPIC` in the Netlify UI (env, by hand) so the push fires. A daily
  reminder task exists (`liftwatch-set-ntfy-topic`) — delete it once done.

## Modeling backlog that needs Bryce (not solo-shippable)
MBTA complex interchanges (~9: South/North Station, State, Haymarket, Aquarium,
Assembly, Lechmere, Wollaston), MBTA Harvard + Worcester, LIRR/MNR (13 — needs a
walk-through, raw location text is misread-prone), TfL (93 interchanges). CTA
can't reach per-elevator parity (structural). Detail in the curation-TODO memo.
