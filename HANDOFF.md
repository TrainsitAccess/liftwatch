# LiftWatch — Session Handoff (2026-07-20)

**To start the next session, paste the prompt in [§ Next-session prompt](#next-session-prompt) below.**

Repo: `C:\Users\Bryce\Claude\liftwatch` · main pushed to
github.com/TrainsitAccess/liftwatch. `SPEC.md` is the source of truth; `CLAUDE.md`
is the operational summary (both current as of this handoff, including the
WMATA Tier B completion writeup). Deeper resume context lives in Claude's
memory: `project_liftwatch.md` (full narrative log), the
`reference_liftwatch_*_command.md` files for each resumable slash-command
workflow.

**WMATA is now fully DONE** — `/liftwatch-wmata-tier-b` (2026-07-18/20)
resolved all 13 Tier B stations where WMATA's Rider-Tools page structurally
disagreed with the model. Every WMATA elevator now carries a real UnitName
except the Huntington inclinator (confirmed none exists) and one deliberately
open watch item (Ballston K04's Vienna-bound through-shaft — see below).
A **final independent accuracy audit (2026-07-20)** then cross-checked every
model against every ground-truth source and found the models clean (0 ghost
ids, all 253 rider-tools elevators modeled) EXCEPT one real bug — the 4
stacked interchanges (Metro Center, Gallery Place, Fort Totten, L'Enfant) were
keyed under the GTFS compound id (`A01_C01`…) the live feed never emits, so
their curated chains were silently bypassed. **Fixed + regression-locked**
(see the shipped-this-session section below). **Primary next task: the broader
station-review backlog** (TfL/CTA/MBTA/MTA-rail, table below) via
`/liftwatch-station-review`.

---

## Next-session prompt

Copy everything in this block:

```
Resume LiftWatch (C:\Users\Bryce\Claude\liftwatch). Read HANDOFF.md in the
repo first. Node isn't on PATH in non-interactive shells — export
PATH="/c/Program Files/nodejs:$PATH" in bash, or
$env:Path="C:\Program Files\nodejs;$env:Path" in PowerShell.

WMATA is fully done (all 13 Tier B stations resolved 2026-07-18/20 — see
CLAUDE.md/SPEC.md's WMATA sections). One standing watch item remains, NOT a
task to act on unless new evidence appears: Ballston-MU K04's Vienna-bound
platform elevator is one of two real ids (K04X01/K04X03) but which one is
unconfirmed — modeled conservatively (both required, over-warn) with a
standing internalNote TODO to watch future WMATA alert wording for
disambiguating text.

PRIMARY TASK: continue the /liftwatch-station-review walkthrough (103/214
stations done — WMATA's review tier is COMPLETE at 42/42; the table below
shows what's left in the other four systems). Run `npm run review:status`
for the live tracker and use the Skill tool with "liftwatch-station-review"
to resume it properly.

Standing rules, all locked in CLAUDE.md — don't re-litigate:
- Risk-bucket the queue and batch stations that claim ZERO redundancy
  (can't under-warn by construction); only a genuine NEW redundancy claim
  needs one-at-a-time scrutiny.
- State a numeric confidence (0-10) on every proposal, up front, every time.
- Always give the per-system completion percentage alongside the total in
  progress updates (e.g. "MBTA 18/41 (43.9%) · TOTAL 103/214 (48.1%)").
- Don't ask "want me to pull it up?" between stations — present the next
  pending one automatically once the current one ships. Still stop and ask
  for the actual verdict, or for a genuine clarifying question.
- Before finalizing ANY station, check whether the agency's own feed/API/
  official documents already answer the open question, AND whether the
  agency's own per-elevator status-page TEXT (ask Bryce to paste it — he did
  this repeatedly for WMATA this session and it resolved several otherwise-
  unmodelable stacked interchanges) settles it outright.
- transit.wiki is a valid fallback research source but OPEN-SOURCED —
  corroboration-tier only, same as chicago-L.org, never sole ground truth.
- Commit per station/batch, but PUSH only every ~5 station updates (each
  push triggers a live Netlify deploy) — still push before ending a session.
- When Bryce gives an elevator's physical location (address, corner,
  lat/long), always fold it into the model's label/internalNote — don't
  paraphrase it away as just a direction/id.
- When Bryce says "update docs," that means CLAUDE.md + SPEC.md + HANDOFF.md
  together, every time — not just the code-facing files.
- **queue.json evidence is now durable across rebuilds** (fixed 2026-07-17,
  see below) — `npm run review:queue` no longer wipes hand-added evidence.
  Still write it via a small one-off node script that appends to `evidence`
  and sets `resolution`, same as always; just no longer need to worry about
  a later rebuild silently discarding it.

Priority order for what's left: WMATA is DONE — nothing left there. TfL
(71 pending) genuinely can't batch — no validated proposal exists for any of
its stations, work it one at a time. CTA has 7 pending, all "Archetype C"
interchange complexes (Clark/Lake, Howard, Lake, Cumberland's redundancy
candidate, 2 newly-surfaced unnamed stations, Garfield's id-mismatch) — none
batchable, each needs individual research or Bryce's knowledge. MBTA has 23
pending; State was picked up this session (evidence gathered, 3 open
questions posed to Bryce, not yet resolved — see below) but the other 22 are
untouched interchange anomalies. MTA-rail has 10 pending, several genuinely
tangled (Croton-Harmon, South Norwalk, Peekskill). Check the queue fresh
rather than trusting exact counts here — they drift as new outages surface
new stations.
```

---

## What shipped this session (2026-07-20, parallel) — Same-name elevator letter designations

Ran alongside the BART re-sourcing below (same working tree; see the
coordination note at the end of this section). Bryce's standing rule: within
one physical station, elevators that share an IDENTICAL label (e.g. Rosslyn's
three "street to eastbound platform" elevators `C05E01/02/03`) each get a
stable letter — A, B, C… — appended as `(A)` so an outage names WHICH one is
down; uniquely-named elevators get none.

- **Derived, never hand-typed** — `elevatorLetterMap` (`src/lib/accessibility.ts`)
  groups per `stationExternalId` by exact label, dedups by `externalId`, assigns
  by sorted id (stable across chains + rebuilds); `withElevatorLetter` is the
  `(X)` suffix. Wired into every site elevator-name emit point in
  `build-site-data.ts` (cross-system longest board, per-system currently-broken,
  offline log, most-broken, uptime streak, "backed up by" list) via
  `letterMapForSystem` / `namedWithLetter`. Automatic + universal, retroactive
  with zero model edits — lit up **33 same-name groups** (WMATA 17, MTA subway
  10, Metro-North 4, MBTA 2; BART/TfL/CTA have distinct labels → none). Keyed by
  `externalId`, so it rides the feed description on the board. Format `(A)` was
  Bryce's pick. Locked in `demo:access` (7 checks).
- **Commits** (all pushed to main): `10a9be0` (feature code), `f7ddd3d`
  (regression block + finished the BART session's uncommitted RICH→Amtrak demo
  migration: `m("RICH")`→`mChain("RICH", undefined)` since RICH gained a 2nd
  chain, and a truthful `platformDefaultAmbiguous(RICH)` check), `b71c092`
  (realigned the COLS assertion to the new platform-default policy, per the BART
  session's request). CLAUDE.md convention + SPEC.md §5 updated.
- **Coordination note (two parallel sessions, ONE working tree):** the BART
  re-sourcing session and this one committed to the same local `main`
  simultaneously. A BART `git add`/commit swept this feature's CLAUDE.md bullet
  into BART commit `ae8897f`; the shared `accessibility-demo.ts` had to be
  reconciled by hand (BART's uncommitted id/chain updates + these letter tests).
  No content was lost and no interaction exists (letters key on label, so BART's
  id re-sourcing is irrelevant — verified 0 BART elevators lettered). Lesson for
  future parallel work: avoid `git add -A` when another session shares the tree.

## What shipped this session (2026-07-20, latest) — BART re-sourced from its ADA settlement (real elevator ids)

Bryce asked to hunt for better BART sources (BART was our weakest-sourced
system — no per-elevator ids anywhere). Found the BART analog to MBTA's
Daniels-Finegold / CTA's settlement: **_Senior and Disability Action v. BART_,
3:17-cv-01876 (N.D. Cal.), final approval 2024-04-18**. Its **Exhibit F**
(per-elevator maintenance schedule) is a real per-elevator inventory with BART's
own asset ids + function/position — extracted via `curl -A "<UA>"` +
`pdftotext -layout` from the DRA-hosted PDF.

- Committed the inventory: `bart-data/settlement-elevator-inventory.json` (96
  elevators, real ids + function) + `bart-data/bart-ada-settlement.md`
  (provenance, id scheme, caveats, 3-way reconciliation).
- **3-way reconciliation** (models × settlement × our live `/accessible` scrape)
  CONFIRMED every model's structure. Two apparent conflicts (19th's redundant
  platform pair, Coliseum's single station elevator) were settled in the model's
  favor by BART's own live page. Resolved prior unknowns: 19th's 3rd elevator
  (`K20-163`), Warm Springs' 5th (`S20-162`, the WAB bridge), Richmond's
  `R60-58` = Amtrak connector (modeled as a Richmond auxiliary chain to the
  Amtrak platform, in scope but not part of the BART platform chain), San
  Bruno's extras = garage.
- **Adopted all 87 real asset ids as elevator `externalId`s** (replacing invented
  ids like `MLBR-PLAT-3` → `W40-109`); 10 stay descriptive where the settlement
  has no clean match (garages, Millbrae access, tunnel/arena). Caveat: asset ids
  ≠ live-feed ids (attribution stays matchHints-based; ids are for identity +
  validation); id↔side inferential for same-function pairs. `poll:bart:dry` now
  emits real ids (`M60-36`, `M30-55`, `R60-51`).
- **New `check:bart`** (`src/checks/bart-check.ts`) — BART's first self-check AND
  independent audit (reconciles every real id vs the settlement inventory +
  attribution crosswalk + hygiene), closing the playbook Part V gap.
- **Standing BART platform-default policy** (`platformDefaultAmbiguous`, commit
  `20f49d9`): a bare/unhinted "Station" advisory that falls through to the
  platform elevator is CONFIDENT (no `needsReview`) UNLESS the station has an
  auxiliary elevator with NO matchHints. Since the adapter tries every hint
  first, a real auxiliary outage only reaches the platform default if it matched
  no hint — so hint-distinguishable auxiliaries (Coliseum OAC/arena, Richmond
  Amtrak) never make it ambiguous. Every BART auxiliary carries hints today, so
  NO BART station flags on the platform default anymore (this flipped Coliseum
  from flagged → confident; replaces the old "any auxiliary ⇒ flag" rule).
  Regressions in `check:bart`; policy documented in CLAUDE.md + SPEC.md.
- typecheck + demo:access + check:bart + poll:bart:dry all green.
- Follow-ups noted, not blocking: Millbrae's Caltrain/plaza ids + Daly City's
  tunnel elevator have no clean settlement id (kept descriptive); the settlement
  also has Exhibit D (SMP memo) + a per-station outage-options section (~p.8560)
  as an extra redundancy corroboration source if ever needed.

## What shipped this session (2026-07-20, later) — WMATA FINAL ACCURACY AUDIT + merged-station keying fix

Bryce asked for one final, exhaustive accuracy check of the (nominally
complete) DC Metro. Built an independent cross-check — `npm run wmata:audit`
(`scripts/wmata-final-audit.mts`) — that re-derives from every ground-truth
source (rider-tools inventory, observed-units, CIP), deliberately NOT reusing
`check:wmata`'s self-check so it can catch shared blind spots. Verdict: models
are accurate and complete — **0 ghost/typo ids, 0 under-warn gaps (all 253
rider-tools elevators modeled), 1 expected synthetic (Huntington inclinator)** —
with exactly **one structural defect found and fixed**:

- The 4 stacked-interchange curated models (Metro Center, Gallery Place, Fort
  Totten, L'Enfant Plaza) were keyed under the GTFS pathways generator's
  COMPOUND transfer-station id (`A01_C01`, `B01_F01`, `B06_E06`, `D03_F03`).
  The live incidents feed reports every elevator under a real SINGLE code
  (`C01`, `B01`, `B06`, `F03`/`D03`), so `stationModelsFor(...).get(StationCode)`
  returned nothing and these four busy interchanges' curated chains were
  **silently bypassed at both attribution and the access board** — outages
  there attributed `unmodeled` (assumed redundancy), a latent regression since
  the 2026-07-17 review completion.
- Fix: re-keyed each model to its canonical real feed code +
  `coveredStationExternalIds` for both codes; made the WMATA adapter resolve
  incidents via a covered-id-aware index (`wmataModelsByFeedCode`) so a unit
  reported under a non-canonical covered code (L'Enfant's `D03W04` under `D03`)
  still binds. Also fixed a stale Fort Totten `internalNote` (B06X01 called
  "synthetic/never observed" — it's a real observed UnitName).
- Regression locked in `check:wmata` ("Merged-interchange feed-code lookup",
  5 asserts). typecheck + demo:access (69) + check:wmata (290) + wmata:audit
  (0 errors) + poll:wmata:dry all green. **Convention recorded (CLAUDE.md /
  SPEC.md): a WMATA interchange model keys on the real feed code, never the
  GTFS `X_Y` compound id.**

## What shipped this session (2026-07-20, earlier) — WMATA Tier B, all 13 stations resolved

Picked up from the 2026-07-18 handoff via `/liftwatch-wmata-tier-b`. No
station-review-queue progress this session — that backlog table below is
unchanged from 2026-07-17.

- **Group A — 7 Silver Line grade-separated median stations** (McLean N01,
  Tysons N02, Greensboro N03, Spring Hill N04, Reston Town Center N07,
  Herndon N08, Ashburn N12). WMATA's page confirmed 6 elevators per station —
  a redundant pair on every leg — vs the prior single-elevator-per-leg
  models; all 7 flip to redundant. Bryce confirmed the two pavilions ARE
  step-free connected, but only via a long crossing that isn't necessarily
  pedestrian-safe — disclosed in the note but never counted as a backup
  (kept as separate per-pavilion pairs, over-warn). Verified all 7 have
  exactly 6 elevators, same layout as the Spring Hill reference (ids just
  reordered station to station).
- **Group B — 4 model-vs-page conflicts**, each settled with Bryce's direct
  ground truth: NoMa B35 reconciled to WMATA's count (1 platform elevator,
  no longer redundant — the long-standing watch item is closed). Southern
  Ave F08's assumed pedestrian-bridge elevator confirmed NOT real, dropped;
  its garage elevator is now its own auxiliary chain. Ballston K04's
  Vienna-bound platform elevator is one of two real ids, but Bryce doesn't
  know which — modeled conservatively as requiring BOTH (over-warn), watch
  item **re-opened, not closed**, with a standing internalNote TODO to watch
  future alert wording. Huntington C15's entrance elevator promoted to its
  real id; its inclinator confirmed to have no real id anywhere in WMATA's
  feed (separate equipment), stays synthetic.
- **Group C — C11 Potomac Yard + C06 Arlington Cemetery.** C11 was a real
  structural bug: WMATA groups Downtown Largo + Mt. Vernon Sq on ONE
  platform (not opposite directions as modeled) and Franconia-Springfield +
  Huntington on the OTHER — the model had no chain at all for the second
  platform. Re-modeled as two SIDE platforms (Bryce corrected an initial
  single-island-platform assumption mid-session) sharing one 6-elevator
  entrance bank. C06's guessed East/West labels swapped for WMATA's own
  destination names.

Every WMATA elevator now carries a real UnitName except the Huntington
inclinator (confirmed none exists) and K04's deliberately-unresolved
through-shaft ambiguity. 3 commits, all pushed to main
(`cd4bbbc`, `e12fcd4`, `b95f871`). typecheck + demo:access (69) + check:wmata
(with new Tier B regression blocks for all three groups) green throughout.

## Where things stand (station-review queue — unchanged since 2026-07-17)

**Station-review progress: 103/214 (48.1%)** — `npm run review:status` for
the live number; verdicts AND evidence now both persist across
`npm run review:queue` regenerations (see the infra fix below).

| System | Done / Total | Notes |
|---|---|---|
| `mta-lirr` | 2/2 | **Complete.** |
| `wmata-dc` | 42/42 | **Fully done.** Review tier complete AND all 13 Tier B page-vs-model conflicts resolved (2026-07-18/20) — every elevator carries a real UnitName except the Huntington inclinator (none exists) and the Ballston K04 through-shaft ambiguity (deliberately open watch item). See CLAUDE.md/SPEC.md. |
| `mbta-boston` | 18/41 | 23 pending. `State` is IN PROGRESS — full evidence gathered, 3 open questions posed to Bryce, awaiting his answers (see below). The other 22 are untouched interchange/anomaly stations. |
| `cta-chicago` | 39/46 | 7 pending, all genuine "Archetype C" complexes — see table below. |
| `mta-mnr` | 2/12 | 10 pending, several genuinely tangled (Croton-Harmon, South Norwalk, Peekskill). |
| `tfl-london` | 0/71 | **Not batchable** — no machine-validated proposal exists for any station in this pool; needs the one-at-a-time ritual. |

### MBTA `State` — in progress, needs Bryce's answers next session

5 elevators, all real ids, evidence fully gathered from MBTA's own
alternate-service-text guidance (see `mbta:place-state` in
`src/catalog/review/queue.json` for the full dossier). Best-guess structure:
Wonderland platform via 975 (with an in-station detour through 802/967 + a
ramp + 974); Bowdoin platform via 974 (alternate via 975 + 802/967 + ramp);
Oak Grove platform via the ramp only (no direct street elevator); Forest
Hills platform via 803, but MBTA's own guidance treats the hallway to
Wonderland as EXIT-ONLY, not board-capable — an asymmetry the generator
flagged as a guidance-vs-topology contradiction.

Three questions posed to Bryce, unanswered as of this handoff:
1. Is the Forest Hills↔Wonderland hallway genuinely exit-only, or usable both
   directions?
2. Is the Bowdoin↔Oak Grove ramp step-free and bidirectional?
3. Full CNF treatment (encode every detour as a real backup) vs. a
   conservative version (only the explicitly-stated 802/967 pair counts,
   everything else sole access)?

### CTA — 7 pending, all individual-review complexes

- `40230` Cumberland — 3 observed units, possible parallel street paths
  (redundancy candidate, worth chasing first).
- `40380` Clark/Lake, `40900` Howard, `41660` Lake — major interchange
  complexes, thin chicago-L.org data. Lake is also mid-reconstruction
  through 2029 — may need to wait rather than model a transient state.
- `40510` Garfield — id-mismatch trap: CTA's feed once attached a "Garfield
  (Red Line)" alert to 40510, which is actually GREEN Garfield's station id
  (Red Garfield is 41170) — untangle the identity before modeling either.
- `40730`, `41700` — newly-surfaced stations (unnamed in the queue, appeared
  via a live outage), unresearched.

## What shipped this session (2026-07-16/17)

Full session log lives in the conversation transcript; condensed version:

**Documentation audit (2026-07-17, follow-up session)** — every repo doc
cross-checked against the live code/data and brought current: README.md
rewritten (still described the retired GitHub-Actions-cron architecture and
a pre-production Supabase); CLAUDE.md/SPEC.md stale counts fixed (demo:access
69 not 25, check:rail-chains 60 not 50, check:mbta-chains 20 not 18, rail
hand-models 18 not 14, rail generator exclusions 9 not 14, CTA 39/46 not
33/46, TfL 209 chains/71 excluded not 151/85, WMATA "55+22 modeled, 2
holdouts" reconciled to all-98-complete); the stale "No DB yet" gotcha
removed; CTA's adapter bullet updated to point at the now-existing curated
tier; `review:status`/`review:queue` added to the Running It block;
`roosevelt-discord-question.md` marked RESOLVED (provenance kept);
`STATION-RESEARCH.md` marked mostly-consumed.

**GitHub Actions fallback poller removed (2026-07-17)** — Bryce approved
retiring `.github/workflows/poll.yml`. It had been kept as a redundant
fallback through the Netlify-poller transition; Netlify's schedule has run
reliably since 2026-07-09, so it outlived its "few cycles" probation. The
Netlify function is now the sole poller (it enumerates systems from the
registry and filters `hidden` out itself, so TMB unhiding no longer needs a
workflow edit — just `hidden: false`). Docs updated across CLAUDE.md/SPEC.md/
README.md; the unused GitHub Actions Supabase/API-key secrets can be deleted
from the repo settings whenever convenient (`model-refresh.yml` still needs
`NTFY_TOPIC`, `backup.yml` still needs the Supabase secrets).

**WMATA station review taken from 21/42 to 42/42 (COMPLETE)** — 21 stations
individually reviewed with Bryce in one continuous session. Highlights:
GTFS-undercounted redundant banks found at Potomac Yard (10 elevators total,
GTFS drew ~5) and Rosslyn (4, GTFS drew 2); several stations turned out to
have their mezzanine at street grade with no elevator needed on that leg at
all (Downtown Largo, West Falls Church, Innovation Center); Fort Totten is a
single elevator serving all 3 stacked levels; Metro Center, Gallery Place,
and L'Enfant Plaza — all stacked multi-line interchanges — were resolved
cleanly from WMATA's own per-elevator status-page text, which Bryce pasted
in directly (this became the single most effective technique of the
session); Huntington's "Garage #1" was caught and corrected mid-review —
initially modeled as auxiliary/parking-only by name pattern, it's actually
the required street entrance elevator; Farragut North confirmed its
corrupt-levels flag was pointing at genuinely fictional GTFS data. Every
station's elevator locations (many with exact lat/long) were recorded per
the standing documentation rule. See CLAUDE.md/SPEC.md's WMATA sections for
the full technical writeup.

**Infra fix — evidence-loss bug found and fixed**: `scripts/review-queue.mts`'s
rebuild step regenerated each station's `evidence` array from source files
on every run, silently discarding any hand-added entry. This had been
happening throughout the WMATA push (every "Bryce said..." confirmation and
elevator coordinate since Mt Vernon Sq had been wiped by routine
`npm run review:queue` calls) before being caught. Fixed: the merge step now
carries forward any prior evidence entry the regenerated list doesn't
already contain (grows-only, exact source+text dedupe). All 23 wiped entries
across 17 stations were reconstructed from the session transcript and
restored; verified surviving a fresh rebuild.

**New standing rules locked this session** (all in CLAUDE.md's memory
equivalents / this repo's conventions):
- Always give per-system completion % alongside the total in progress
  updates.
- Don't ask "want me to pull it up?" between stations — auto-advance to the
  next pending station once the current one ships.
- When Bryce gives an elevator's physical location, always record it in the
  model.
- "Update docs" means CLAUDE.md + SPEC.md + HANDOFF.md together.

## Modeling backlog needing Bryce (not solo-shippable)

MBTA's `State` (in progress, 3 questions posed) plus its other 22 pending
anomaly stations. MTA rail's ~10 remaining MNR stations. All 71 TfL
stations. CTA's 7 remaining complexes (Cumberland's redundancy candidate is
the most promising quick win; Garfield needs id untangling first).

## TfL auto-model audit — DONE 2026-07-17 (sound, no fixes)

Audited all 209 auto-generated TfL models against the WMATA-audit lessons
(`src/catalog/tfl-data/COVERAGE-AUDIT.md`). Outcome: the tier is **sound, no
under-warns** — unlike WMATA, TfL derives redundancy from exact
`(fromAreas, toAreas)` matches enforced by `check:tfl-chains`, and the
different-platform redundancies are all backed by TfL-published step-free
paths (verified East Croydon ramps, Abbey Road / Royal Victoria same-level).
Notes consistent; excluded 71 = the interchange human-review backlog. **One
flagged observation needing your verdict**: the 11 step-free-path-backed
redundant segments have `stepFreeAlternative:false`, so an *all-lifts-down*
case over-warns (reads inaccessible though a ramp exists). Safe direction;
making it accurate is a *less-conservative* change reserved for you — see §5
of the report.

## Known open item — RESOLVED 2026-07-17

**Homepage now renders elevator/ramp backups.** `site/index.html`'s longest-
outage boards used to annotate only `soleAccess`, missing `severs`/`backups`/
`rampAlternative`. Fixed: extracted the per-system `accessImpactFor` closure
into a top-level pure `computeAccessImpact()` in `build-site-data.ts`
(buildSystemDetail delegates to it, per-system behavior unchanged), wired it
into the `allOpenOutages` rows, and mirrored `system.html`'s chips + "Access
impact" / "Route notes" rendering in `index.html`. Verified in the browser
(16/30 current longest rows carried impact previously invisible). Commit on
main.

## Not yet done (flagged, not started)

**Pixel-level visual verification of the MTA station-accessibility board** —
carried over from the previous handoff, still not done (no UI work touched
this session). When resuming: load
`http://localhost:4173/system.html?id=mta-nyct` (`npm run site:data && npm
run site:serve` first) and eyeball the "Station accessibility" section for
layout/chip-color/wrapping.

**Future feature idea (not started)**: a clickable Google Maps link per
elevator with a recorded location, once enough stations carry lat/long data
— Bryce's idea, noted 2026-07-16 during Huntington's review.
