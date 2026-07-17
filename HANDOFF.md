# LiftWatch — Session Handoff (2026-07-17)

**To start the next session, paste the prompt in [§ Next-session prompt](#next-session-prompt) below.**

Repo: `C:\Users\Bryce\Claude\liftwatch` · main pushed to
github.com/TrainsitAccess/liftwatch. `SPEC.md` is the source of truth; `CLAUDE.md`
is the operational summary (both current as of this handoff, including the
WMATA-complete writeup). Deeper resume context lives in Claude's memory:
`project_liftwatch.md` (full narrative log), `project_liftwatch_wmata_findings.md`
(now says DONE, 42/42), plus the `reference_liftwatch_*_command.md` files for
each resumable slash-command workflow.

---

## Next-session prompt

Copy everything in this block:

```
Resume LiftWatch (C:\Users\Bryce\Claude\liftwatch). Read HANDOFF.md in the
repo first, then run `npm run review:status` (Node isn't on PATH in
non-interactive shells — export PATH="/c/Program Files/nodejs:$PATH" in bash,
or $env:Path="C:\Program Files\nodejs;$env:Path" in PowerShell) to see the
live station-review tracker.

TASK: continue the /liftwatch-station-review walkthrough (103/214 stations
done as of this handoff — WMATA is fully COMPLETE at 42/42, see the table
below for what's left in the other four systems). Use the Skill tool with
"liftwatch-station-review" to resume it properly (loads the full ritual +
queue conventions) rather than improvising from this doc alone.

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

## Where things stand (2026-07-17, end of session)

**Station-review progress: 103/214 (48.1%)** — `npm run review:status` for
the live number; verdicts AND evidence now both persist across
`npm run review:queue` regenerations (see the infra fix below).

| System | Done / Total | Notes |
|---|---|---|
| `mta-lirr` | 2/2 | **Complete.** |
| `wmata-dc` | 42/42 | **Complete as of this session** — every one of the 22 remaining excluded/holdout stations resolved with Bryce. See CLAUDE.md/SPEC.md for the full writeup; two internal (non-public) watch notes remain open (NoMa B35's elevator count, Ballston-MU K04's observed-id mapping), documented inline in `wmata-models.ts`. |
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
`STATION-RESEARCH.md` marked mostly-consumed. Flagged for Bryce, not acted
on: `.github/workflows/poll.yml` (the fallback poller) has outlived its
"few cycles" probation — Netlify's schedule has run reliably since
2026-07-09; removing it is Bryce's call.

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

## Known open item (not urgent)

**Homepage doesn't render elevator/ramp backups** — `site/index.html`'s
longest-outage boards annotate only `soleAccess`, not `severs`/`backups`/
`rampAlternative` (unlike `system.html`, which has all three). Root cause:
those fields come from `accessImpactFor`, a closure inside per-system
`buildSystemDetail`, unavailable at the cross-system `allOpenOutages` build
point in `build-site-data.ts`. Fix: extract a shared top-level
`accessImpact(systemId, extId, openExtIds)` helper, call from both places,
mirror `system.html`'s chip/line rendering in `index.html`. Low urgency —
only bites when a backup/ramp-covered outage is among the 10 *longest*
current outages system-wide.

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
