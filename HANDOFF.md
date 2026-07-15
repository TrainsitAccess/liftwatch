# LiftWatch — Session Handoff (2026-07-16)

**To start the next session, paste the prompt in [§ Next-session prompt](#next-session-prompt) below.**

Repo: `C:\Users\Bryce\Claude\liftwatch` · main pushed to
github.com/TrainsitAccess/liftwatch. `SPEC.md` is the source of truth; `CLAUDE.md`
is the operational summary (both current as of this handoff). Deeper resume
context lives in Claude's memory: `project_liftwatch_handoff_2026-07-14.md`,
`project_liftwatch_curation_todo.md`, `project_liftwatch_wmata_findings.md`,
plus the `reference_liftwatch_*_command.md` files for each resumable
slash-command workflow.

---

## Next-session prompt

Copy everything in this block:

```
Resume LiftWatch (C:\Users\Bryce\Claude\liftwatch). Read HANDOFF.md in the
repo first, then run `npm run review:status` (Node isn't on PATH in
non-interactive shells — prepend $env:Path="C:\Program Files\nodejs;$env:Path"
or export PATH="/c/Program Files/nodejs:$PATH" in bash) to see the live
station-review tracker.

TASK: continue the /liftwatch-station-review walkthrough (61/213 stations
done as of this handoff — see the table below for what's left per system).
Use the Skill tool with "liftwatch-station-review" to resume it properly
(loads the full ritual + queue conventions) rather than improvising from
this doc alone.

Pace guidance learned this session: don't default to one-at-a-time. Pull the
queue's evidence for a whole system first and bucket by actual risk — a
station where NOTHING claims a backup (single elevator, or a machine-
validated proposal that already passed answer-key + round-trip validation)
is safe to batch; only a genuine NEW redundancy claim needs one-at-a-time
scrutiny. State a numeric confidence (0-10) on every proposal, batch or not —
Bryce asks for this every time, don't bury it in prose. Before finalizing ANY
station, check whether the agency's own feed/API already exposes a ramp or
other non-elevator access fact (CLAUDE.md's "STANDING RULE", 2026-07-15) —
don't assume only the system currently in question might have one.

Priority order for what's left (see "What's left" below for full detail):
TfL (71 pending) genuinely can't batch — no validated proposal exists for
any of its stations, work it one at a time. WMATA/CTA/MBTA/MTA-rail all have
a mix of remaining batchable stations and genuine individual-review
holdouts; check the queue fresh rather than trusting exact counts here, they
change as new outages surface new stations.
```

---

## Where things stand (2026-07-16)

**Station-review progress: 61/213 (28.6%)** — `npm run review:status` for the
live number; verdicts persist in `src/catalog/review/queue.json` across
regenerations.

| System | Done / Total | Notes |
|---|---|---|
| `mta-lirr` | 2/2 | **Complete.** Amityville + Lindenhurst (single-elevator, no backup). |
| `wmata-dc` | 21/42 | 21 shipped in one batch (4 structural ladder-chain groups); 2 genuine holdouts (Potomac Yard, West Falls Church) + the rest of the original excluded pool remain. |
| `mbta-boston` | 18/41 | Aquarium + Park St individually, 16 more as "Batch 1" (all machine-validated proposals). 6 genuine anomaly holdouts (State, Wellington, Courthouse, Downtown Crossing, Oak Grove, Sullivan Square) — guidance-vs-topology contradictions, not simple proposals. |
| `cta-chicago` | 18/45 | Cermak + Diversey individually, 15 more as "Batch 2", Bryn Mawr pre-modeled from research (see below). ~17 held-back stations have real complexity (2-in-series elevators, dual islands, ambiguous counts). |
| `mta-mnr` | 2/12 | Purdy's + Cortlandt shipped (straight 2-elevator chains, no redundancy). 10 remain, several genuinely complex (Croton-Harmon's criss-crossing tracks, missing/ambiguous eestatus text, South Norwalk's possible redundant pair, Peekskill's unconfirmed street-overpass leg). |
| `tfl-london` | 0/71 | **Not batchable** — confirmed 2026-07-15: no machine-validated proposal exists for any TfL station in this pool, and literally none of the 71 have just one lift (that's structurally why they're flagged branching/multi-destination). Needs the one-at-a-time ritual, ideally using the map/PDF sources noted in the `/liftwatch-station-review` skill (TfL's step-free tube guide PDF, `StopPoint` API lift counts). |

## What shipped this session (2026-07-14 through 2026-07-16)

| Commit(s) | Work |
|---|---|
| `4b2c5a2` | Station-review system built: one-at-a-time walkthrough queue (`src/catalog/review/queue.json`) + progress tracker (`npm run review:queue` / `:status`), the `/liftwatch-station-review` skill. |
| `b901ed7` `4602f82` `cd32b20` `45a13c2` `3fc5c84` | MBTA GTFS pathways discovered as a missed TfL-class dataset — built as REVIEW PROPOSALS (`scripts/mbta-pathways.mts`), not auto-shipped; TfL ramp/same-level paths wired in, freeing 17 stations. |
| `0b95a58` `a2fad62` | Aquarium, Park Street modeled individually (first two MBTA interchange proposals to graduate). |
| `ee7f6a9` `d86efcf` | Cermak-McCormick Place, Diversey modeled — the first two CTA curated stations ever (this system had zero station structure models before). |
| `2ff5d4f` | **Batch 1**: 16 MBTA stations from machine-validated pathway proposals, approved as a group. |
| `7d33320` | **Batch 2**: 15 CTA stations (single-elevator + confirmed per-direction pairs), approved as a group. |
| `02063c5` | **Batch 3**: 21 WMATA stations across 4 no-redundancy ladder-chain shapes, approved as a group. |
| `b6ebead` | Fixed a same-day CTA fail-safe bug: the vague-alert `needsReview` check fired on every ordinary outage at Batch 2's single-elevator stations (3 false pushes) before being scoped to genuine id-mismatch cases. |
| `8c0f7c9` | Fixed the daily model-refresh CI failure: `unzip` never extracted `facilities_properties.txt`, silently disabling MBTA's agency-declaration-contradiction gate; also fixed `check:mbta-pathways`'s stale "still pending" assertions for the 3 stations that had since graduated to curated. |
| `7fb7456` | 4 MTA rail stations (Amityville, Lindenhurst, Purdy's, Cortlandt) — `mta-lirr` now fully reviewed. |
| `ec3e54b` | Noted the ground-level-ramp blind spot (LIRR/MNR/MBTA Commuter Rail track elevators only) on the site's disclaimer + methodology pages. |
| `b114764` | Built `scripts/mbta-ramps.mts` (58-ramp live roster snapshot); locked "check every system for ramp/other-access data before finalizing a model" as a standing CLAUDE.md policy after finding MBTA's own ramp feed was fetched every poll but never cross-checked against any model. |
| `bf7aab9` | Pre-modeled Bryn Mawr (CTA) — the one CTA Red-Purple Modernization station with a genuine redundant elevator pair, found via external research (chicago-L.org + CTA's own project pages), modeled ahead of any live outage since it's never broken since reopening 2025-07-20. |

Full check suite green throughout (`typecheck`, `demo:access` 64 checks,
every system's `check:*` script) — verified after every batch before
shipping, not just at the end.

## Concurrent work in flight (as of this handoff)

A background task (spawned mid-session, `task_ef183134`) is fixing a CTA
identity-parser gap (reversed multi-direction phrasing, e.g. "Loop- and
63rd-bound" vs "95th- and Loop-bound") in a **separate local session**
sharing this same working tree. Its changes (`src/adapters/cta/location.ts`,
`src/checks/cta-check.ts`, `src/catalog/cta-data/observed-units.json`, one
hunk in `src/catalog/cta-models.ts` renaming Morgan's unit id) were verified
complete and correct but deliberately left **uncommitted** for that session
to commit itself — don't assume they're already shipped without checking
`git log` / `git status`.

## Standing rules now locked (see CLAUDE.md for full detail)

- **Confidence rating**: every best-guess/proposal gets an explicit
  "Confidence: N/10" up front, every time — not folded into prose.
- **Ramp/other-access research**: before finalizing any station model, check
  whether the agency's own feed/API already exposes a ramp or other
  non-elevator step-free fact, across every system, not just the one in
  question. `scripts/mbta-ramps.mts` is the reference snapshot for MBTA;
  WMATA and CTA confirmed to have no equivalent feed data (would need real
  external research if pursued further).
- **Batching methodology**: risk-bucket the queue by whether a proposal
  CLAIMS redundancy (needs individual scrutiny) vs claims none (safe to
  batch) before deciding pace — this is how Batches 1-3 moved ~52 stations
  in a handful of turns instead of 52 individual round-trips.

## Modeling backlog needing Bryce (not solo-shippable)

MBTA's 6 anomaly stations (State, Wellington, Courthouse, Downtown Crossing,
Oak Grove, Sullivan Square — guidance-vs-topology contradictions). CTA's
remaining held-back stations (2-in-series elevators, dual islands, ambiguous
counts — Roosevelt, Ashland, Cottage Grove, Washington/Wells, Lake, Jackson,
Grand, Clark/Lake, Cicero, Howard, King Drive; Wilson is resolved, see
below). WMATA's Potomac Yard + West Falls Church. MTA rail's ~10 remaining
MNR stations. All 71 TfL stations (no shortcut available — see above).

**Researched but NOT yet shipped** — 6 CTA stations where external research
(chicago-L.org + CTA's own project pages) already resolved the open
question, but the models were never implemented or recorded in the queue:
Racine (old 1950s ramp is gone/non-ADA, replaced by a single elevator opened
Oct 2025; the Loomis-entrance ramp is future work, not built until 2027 —
single elevator, no current backup), Pulaski (confirmed single elevator,
island platform), 69th (confirmed single elevator, in service Jan 2007),
47th/Red (confirmed single elevator, in service Dec 2006), Argyle (confirmed
single elevator, single 520-ft platform), Wilson (confirmed 2 island
platforms, 2 elevators — one per island, independent chains, same pattern
as Diversey but per-island instead of per-direction). Cheapest next move:
implement these 6 directly from this note rather than re-researching.
Howard was checked too but stayed genuinely ambiguous (search results
suggest its two elevators might reach all platforms via a shared mezzanine,
which would mean real redundancy — don't guess, needs a real signal).
