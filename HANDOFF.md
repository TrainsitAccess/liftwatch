# LiftWatch — Session Handoff (2026-07-16)

**To start the next session, paste the prompt in [§ Next-session prompt](#next-session-prompt) below.**

Repo: `C:\Users\Bryce\Claude\liftwatch` · main pushed to
github.com/TrainsitAccess/liftwatch. `SPEC.md` is the source of truth; `CLAUDE.md`
is the operational summary (both current as of this handoff). Deeper resume
context lives in Claude's memory: `project_liftwatch.md` (full narrative log),
`project_liftwatch_wmata_findings.md`, plus the `reference_liftwatch_*_command.md`
files for each resumable slash-command workflow, and
`reference_liftwatch_mta_ny_inventory.md` / `reference_liftwatch_transit_wiki.md`
for the two new research sources added this session.

---

## Next-session prompt

Copy everything in this block:

```
Resume LiftWatch (C:\Users\Bryce\Claude\liftwatch). Read HANDOFF.md in the
repo first, then run `npm run review:status` (Node isn't on PATH in
non-interactive shells — export PATH="/c/Program Files/nodejs:$PATH" in bash,
or $env:Path="C:\Program Files\nodejs;$env:Path" in PowerShell) to see the
live station-review tracker.

TASK: continue the /liftwatch-station-review walkthrough (76/214 stations
done as of this handoff — see the table below for what's left per system).
Use the Skill tool with "liftwatch-station-review" to resume it properly
(loads the full ritual + queue conventions) rather than improvising from
this doc alone.

Standing rules, all locked in CLAUDE.md — don't re-litigate:
- Risk-bucket the queue and batch stations that claim ZERO redundancy
  (can't under-warn by construction); only a genuine NEW redundancy claim
  needs one-at-a-time scrutiny.
- State a numeric confidence (0-10) on every proposal, up front, every time.
- Before finalizing ANY station, check whether the agency's own feed/API/
  official documents (elevator-count tables, settlement reports, budget/
  capital-program reports, etc.) already answer the open question — don't
  assume only live-feed text and chicago-L.org are available. This session
  found CTA's own ASAP Strategic Plan (per-station elevator COUNTS), an old
  ADA settlement-agreement monitor report (via a lead Bryce found), BART's
  own "Bikes on BART" elevator dimensions guide (per-elevator inventory),
  and WMATA's own quarterly Capital Improvement Program report (incidental
  real elevator ids) — all PDFs, all extractable with
  `curl -A "<browser UA>"` + Node `pdf-parse` (WebFetch chokes on large/
  image-wrapped PDFs; a plain fetch/WebFetch call often 403s these agency
  sites entirely — the in-app Browser pane or curl work instead). MBTA was
  checked too and came up empty (its PATI plan is policy-level only) — not
  every system will have one of these, and that's a valid, documented
  conclusion, not a reason to keep digging indefinitely.
- transit.wiki is a valid fallback research source but OPEN-SOURCED —
  corroboration-tier only, same as chicago-L.org, never sole ground truth.
- Commit per station/batch, but PUSH only every ~5 station updates (each
  push triggers a live Netlify deploy) — still push before ending a session.

Priority order for what's left: TfL (71 pending) genuinely can't batch — no
validated proposal exists for any of its stations, work it one at a time.
CTA has 13 pending, several with real redundancy potential (Cumberland's 3
observed units suggest parallel street paths; the transfer-bridge family —
Ashland/43rd/California/Cottage Grove/King Drive — shares one open question
about whether the bridge gives cross-platform redundancy, answer it once and
it may resolve all five). WMATA/MBTA/MTA-rail all have a mix of remaining
batchable stations and genuine individual-review holdouts; check the queue
fresh rather than trusting exact counts here, they change as new outages
surface new stations (Washington/Wabash 41700 just appeared this way).
```

---

## Where things stand (2026-07-16, end of session)

**Station-review progress: 76/214 (35.5%)** — `npm run review:status` for the
live number; verdicts persist in `src/catalog/review/queue.json` across
regenerations.

| System | Done / Total | Notes |
|---|---|---|
| `mta-lirr` | 2/2 | **Complete.** |
| `wmata-dc` | 21/42 | 2 genuine holdouts (Potomac Yard, West Falls Church) + the rest of the original excluded pool remain. |
| `mbta-boston` | 18/41 | 6 genuine anomaly holdouts (State, Wellington, Courthouse, Downtown Crossing, Oak Grove, Sullivan Square) — guidance-vs-topology contradictions, needs Bryce. |
| `cta-chicago` | 33/46 | See "What's left" below — 13 pending, a mix of real redundancy candidates and genuine complexes. |
| `mta-mnr` | 2/12 | 10 remain, several genuinely complex (Croton-Harmon's criss-crossing tracks, South Norwalk's possible redundant pair, Peekskill's unconfirmed overpass leg). |
| `tfl-london` | 0/71 | **Not batchable** — no machine-validated proposal exists for any station in this pool; needs the one-at-a-time ritual (TfL's step-free tube guide PDF, `StopPoint` API lift counts — see the `/liftwatch-station-review` skill). |

### CTA — 13 pending, grouped by what would resolve them

- **Redundancy candidates** (worth chasing first — could flip like Wilson/
  Jackson-Red did): `40230` Cumberland (3 observed units, possibly parallel
  street paths), `41700` Washington/Wabash (new — Loop elevated, just
  surfaced by a live outage, unresearched).
- **Transfer-bridge family** (ONE open question — does the overhead bridge
  give cross-platform redundancy? — likely resolves all five at once):
  `40170` Ashland, `41270` 43rd, `41360` California, `40720` Cottage Grove,
  `41140` King Drive.
- **Complexes** (genuine multi-elevator tangles, interchange tier):
  `40380` Clark/Lake, `41400` Roosevelt (transfer tunnel), `40900` Howard
  (dual islands), `40730` Washington/Wells (thin chicago-L data).
- **Data quirk**: `40510` Garfield — CTA's feed once attached a "Garfield
  (Red Line)" alert to 40510, which is actually GREEN Garfield's station id
  (Red Garfield is 41170) — untangle the identity before modeling either.
- **Lake (`41660`)**: street→mezzanine elevator existence unconfirmed, AND
  the State/Lake subway is under active reconstruction through 2029 — may
  need to wait for the rebuild rather than model the current transient state.

## What shipped this session (2026-07-14 through 2026-07-16)

Full session log with commit-by-commit detail lives in memory
(`project_liftwatch.md`) — this is the condensed version.

**Station-review infrastructure + first four days of batching** (2026-07-14/15):
station-review queue + `/liftwatch-station-review` skill built; MBTA GTFS
pathways discovered + Batch 1 (16 MBTA stations); CTA's first-ever curated
tier + Batch 2 (15 stations); WMATA Batch 3 (21 stations); MTA-rail's
`mta-lirr` completed; standing rules locked (confidence rating, ramp-research,
batching methodology).

**This session's continuation (2026-07-16):**
- **6 researched-but-unshipped CTA stations** landed (Racine, Pulaski-Pink,
  69th, 47th-Red, Argyle — single-elevator; **Wilson corrected** to
  redundant via two Sunnyside Ave ramps the prior research had missed).
- **Full CTA-model audit** against CTA's own project/station pages — 23/24
  then-modeled stations confirmed correct, **Morgan (41510) was a real
  mismodel** (built as one shared elevator, actually two per-direction
  platforms) — found and fixed.
- **Batch 4**: 7 more zero-redundancy CTA stations (4 per-direction pairs,
  2 series chains, 1 shared-prerequisite shape).
- **95th/Dan Ryan** and **Jackson-Red** individually reviewed and modeled as
  redundant (terminal pair; 2-in-series pair, resolved via a CTA ADA
  settlement-monitor report lead Bryce found).
- **New research sources locked in**: transit.wiki (corroboration-tier),
  CTA's ASAP Strategic Plan (authoritative per-station elevator COUNTS,
  extracted from a 48MB PDF via curl + `pdf-parse` — cross-checked 7/7
  clean against our models).
- **MTA enrichment from data.ny.gov** (four pieces, all shipped): a ground-
  truth elevator inventory + cross-check (`check:mta-ny`, 121/121 clean);
  MTA's own rider-facing reroute text surfaced on outages; MTA's own
  elevator descriptions preferred over ours when richer; and a new
  **station-level ADA accessibility board** (by line and direction, per
  Bryce's explicit "never just say partial" instruction) — 445 MTA
  complexes crosswalked, 452-check regression suite, verified against real
  production data. MTA's own official display-guidance doc saved and used
  as the compliance checklist for all of this.
- **BART and WMATA ground-truth sources found, fact-checked, enriched**:
  BART's own "Bikes on BART" elevator dimensions guide (a genuine
  per-elevator inventory) — 6 stations individually verified against
  BART's live per-station pages, **all 6 confirmed our existing models
  correct** (no bugs found; Millbrae's guide row appears stale, predating a
  platform change). WMATA's quarterly Capital Improvement Program report —
  named real elevator ids incidentally; **one promotion shipped**
  (`E07X01`, West Hyattsville), **two left ambiguous on purpose**
  (McPherson Sq, New Carrollton — multiple synthetic slots, no
  disambiguating detail, would be a guess), and **one existing redundancy
  candidate strengthened** (Mount Vernon Sq `E01` — already queued for
  review; this report is a 3rd independent source confirming one of its
  4 suspicious units; see "Modeling backlog" below). MBTA: no comparable
  source found (checked; its PATI plan is policy-level only).

Full check suite green throughout every step (`typecheck`, `demo:access` 69
checks, `check:cta`, `check:mta`, `check:mta-ny` 121, `check:mta-ada` 452,
`check:wmata`, Netlify function bundle verified after every JSON-import
change).

## Standing rules now locked (see CLAUDE.md for full detail)

- **Confidence rating**: every best-guess/proposal gets an explicit
  "Confidence: N/10" up front, every time — not folded into prose.
- **Ramp/other-access research**: before finalizing any station model, check
  whether the agency's own feed/API/documents already expose a ramp or other
  non-elevator step-free fact, across every system. Extended this session:
  also check for official PDFs (elevator-count tables, settlement/monitor
  reports) — CTA's ASAP plan and the ADA settlement lead both paid off.
- **Batching methodology**: risk-bucket the queue by whether a proposal
  CLAIMS redundancy (needs individual scrutiny) vs claims none (safe to
  batch).
- **Push cadence** (2026-07-16): commit per station/batch, but push only
  every ~5 station updates — each push is a live Netlify deploy.
- **transit.wiki** (2026-07-16): valid fallback, but open-sourced —
  corroboration-tier only, never sole ground truth for a redundancy claim.
- **Rider-facing partial-accessibility text** (2026-07-16, Bryce): never
  display a bare status word like "partially accessible" — always name
  the specific lines and directions. Locked in as an assertion
  (`check:mta-ada`) for the new MTA station-ADA board, and should apply to
  any future accessibility-status display.

## Modeling backlog needing Bryce (not solo-shippable)

MBTA's 6 anomaly stations (State, Wellington, Courthouse, Downtown Crossing,
Oak Grove, Sullivan Square). WMATA's Potomac Yard + West Falls Church, plus
**Mount Vernon Sq (`E01`) — the strongest unshipped WMATA redundancy
candidate found to date**: 4 live-observed real units forming two
identically-worded pairs (street↔mezzanine, mezzanine↔platform), the same
shape as 3 already-confirmed-redundant stations elsewhere, now with a 3rd
independent source (WMATA's own CIP report) confirming one of the ids —
but WMATA's text never uses BART-style explicit backup language, so this
needs Bryce's verdict via the review ritual, not a unilateral model.
MTA rail's ~10 remaining MNR stations. All 71 TfL stations. CTA's transfer-
bridge cross-redundancy question (Ashland/43rd/California/Cottage Grove/
King Drive) — one field-check or agency confirmation likely resolves all
five at once. CTA's Garfield id-mismatch needs untangling before modeling.

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

**Pixel-level visual verification of the new MTA station-accessibility
board** — the screenshot/zoom capture tool was down for the whole
verification attempt (confirmed via a plain `example.com` timeout — a tool
infrastructure issue, not a code problem). Data, DOM structure, and text
content were all verified correct through other means (live production data
inspection, page-text extraction, no console errors). When resuming: load
`http://localhost:4173/system.html?id=mta-nyct` (`npm run site:data && npm
run site:serve` first) and eyeball the "Station accessibility" section for
layout/chip-color/wrapping.
