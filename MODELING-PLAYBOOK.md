# LiftWatch — Universal System Modeling Playbook

_The system-agnostic field guide, distilled from building and auditing all
nine systems (MTA subway, BART, MBTA, WMATA, TfL, TMB, LIRR, Metro-North, CTA)
and especially the full DC Metro arc — 98 stations modeled, then a final
independent accuracy audit that found a real bug the self-check couldn't see.
**Read this before adding, modeling, or auditing ANY transit system.** Then
read the system-specific guide if one exists (`wmata-data/WMATA-STATION-GUIDE.md`
is the model for what a per-system guide looks like). Companion docs: `SPEC.md`
(design source of truth), `CLAUDE.md` (operational summary + per-system
details), each system's `check:*` and `*-data/` folder._

The whole project exists to answer one question honestly, per station, in real
time: **is this station step-free right now, and if not, what's the impact?**
Every principle below serves one rule:

> ## Over-warn, never under-warn. No redundancy without a real signal. When unsure, the honest state is "not redundant" / "unknown".

Under-warning (calling an inaccessible station accessible) strands a real person
who trusted us. Over-warning (calling an accessible station at-risk) is
conservative and safe. Every ambiguous call breaks toward over-warning.

---

# Part I — How transit systems and their feeds work

## 1. The fidelity spectrum

No two agency feeds are alike. Every system lands somewhere on a spectrum, and
the catalog records where via a few knobs (`src/catalog/systems.ts`):

| Feed tier | What you get | Systems | Catalog signal |
|---|---|---|---|
| **Per-elevator, full inventory** | Every elevator, id + status every poll | MTA, MBTA, TfL, TMB, LIRR, MNR | `data_quality: good`, `inventoryComplete: true` |
| **Per-elevator, broken-only** | Real elevator ids, but the feed lists ONLY currently-broken units | WMATA, CTA | `inventoryComplete: false`, no `single_elevator` inference, units discovered as they break |
| **Station-level advisory** | A station is flagged, usually WITHOUT which elevator | BART | `data_quality: best_effort`; per-elevator attribution is inferred, never guessed |

Consequences that follow from the tier — get these set before modeling:

- **`inventoryComplete: false`** ⇒ absence of a unit is NOT proof it's working
  (you never saw it), so no offline-detection, no `%`-down denominator from the
  feed. Use `fleetSource: static` + a published fleet figure (WMATA's "320")
  with a trailing `*` on every derived number, or `none`.
- **`fleetSource: live | static | none`** is the general mechanism for "do we
  have a real denominator?" Reusable by any discovered-inventory system.
- **`redundancyBaseline: confirmed-none`** means a fully-curated system treats
  un-modeled stations as *confirmed* non-redundant (BART). Only set it once the
  system is actually fully curated.

## 2. THE identity rule — model on the id the LIVE FEED emits

**This is the single most expensive lesson. A model is only alive if the
attribution path can find it using the exact identifier the live outage feed
reports.** A perfectly-correct model keyed under the wrong identifier is dead
code — it silently never matches, and the station degrades to the un-modeled
fallback with nobody noticing.

- **The canonical failure (WMATA, 2026-07-20):** the 4 stacked interchanges
  (Metro Center, Gallery Place, Fort Totten, L'Enfant) were keyed under the
  **GTFS pathways generator's** compound station id (`A01_C01`). But the live
  incidents feed reports every elevator under a real single code (`C01`). So
  `stationModelsFor(...).get(StationCode)` returned nothing and four of the
  busiest interchanges' curated chains were bypassed for 3 days. The
  `check:wmata` self-check couldn't see it — it referenced the models by their
  own (wrong) ids. Only an independent audit that used the *feed's* codes
  exposed it.
- **General principle:** a model's `stationExternalId` (and every
  `coveredStationExternalIds` entry, and every elevator `externalId`) must be an
  identifier the **live outage feed** actually emits. Namespaces used by a
  *generator's input* (GTFS compound ids, internal node names) are NOT feed
  identifiers and must be translated before they reach a model.
- **When one physical station spans several feed ids** (WMATA Metro Center =
  A01+C01; MTA Penn = complex 164+318; Fulton/Oculus = 628+624): pick ONE
  canonical feed id for `stationExternalId` and list every id it subsumes in
  `coveredStationExternalIds`. Make the adapter resolve an incident to the model
  via a **covered-id-aware index** (WMATA's `wmataModelsByFeedCode`), not just
  the canonical id — a unit reported under a non-canonical covered code
  (L'Enfant's `D03W04` under `D03`) must still bind.
- **Elevator ids that embed a station code** (WMATA `C01N02`, BART, MTA
  equipment codes) give you a free cross-check: the embedded code should be one
  of the model's covered feed codes. A mismatch is a red flag (see the audit,
  Part V).

## 3. Don't trust an unverified feed field (the recurring trap)

A field named `redundant` / `KO` / `is_planned` / `effect` means what YOU think
only after you've verified it against reality. This trap has bitten us on nearly
every system:

- **TMB** `itransit .../ascensors` `KO` = "out of service" reported **274**
  elevators while the alerts feed showed **1** actually out. `KO` is not
  operational status. (TMB is `hidden` over exactly this.)
- **MTA** `isupcomingoutage=Y` rows are *future* scheduled outages mixed into
  the current feed — ingesting them as open outages inflated NYC Subway from
  ~29 down to 60 down. Drop `Y` rows whose start hasn't passed.
- **MTA** `ismaintenanceoutage` is vestigial ("N" on every row, even ones
  labeled Maintenance) — classify planned/unplanned by `reason` regex instead.
- **CTA** `FullDescription` carries a boilerplate "...repair and upgrade
  elevators" footer on nearly every alert → 9 of 13 real outages misflagged as
  planned. Classify against `Headline`+`ShortDescription` only.
- **MBTA** files elevators-out under `ELEVATOR_CLOSURE`, `ACCESS_ISSUE`, AND
  `FACILITY_ISSUE` — the `effect` label is unreliable; capture by facility
  TYPE.
- **MTA** data.ny.gov `redundant_elevator` is STRICTER than our segment
  redundancy (means "one elevator replaces this unit's WHOLE journey") — a `-`
  there does NOT contradict a segment-level redundancy claim. Read the field's
  real definition before diffing it.

**Rule:** before a feed field drives a decision, time-series-sample it or
cross-check it against a second source or the agency's rendered site. If it
disagrees with reality, it's a data-quality artifact, not a signal.

## 4. Ground-truth sources: tiers and the hunt

**Trust order (identical across systems):**

1. **The agency's own words** — per-elevator status-page text, per-elevator
   rider guidance (`alternate-service-text`), an official inventory API, a
   capital/settlement/ADA legal document, or a human field-confirmation. This is
   ground truth and settles everything. *The single most effective technique in
   the whole project is pasting the agency's own per-elevator status-page text*
   — it resolved WMATA's stacked interchanges outright.
2. **Live-observed ids + their agency location strings** (`observed-units.json`
   / archive). Real ids, real wording. 2+ identically-worded units at one
   station = strong redundant-bank evidence.
3. **Third-party corroboration** — chicago-L.org, Wikipedia, transit.wiki.
   **Corroboration-tier ONLY, never sole basis for a redundancy claim.**
   transit.wiki is open-sourced/community-editable — lowest trust of the three.
4. **Topology feeds (GTFS pathways)** — good for *structure*, but they
   undercount, mislabel, and corrupt (Part II §6). **Never take a redundancy
   claim from topology alone** — it both invents and hides redundancy.

**Every system has more ground truth than the live feed — go find it before
concluding evidence is thin.** The ones we found:

- **WMATA**: Rider-Tools station pages (`elevatorListCMF`, real UnitNames),
  the CIP quarterly report (incidental ids), GTFS pathways.
- **MTA**: `data.ny.gov/resource/94fv-bak7` (richer per-elevator inventory:
  named backups, reroute text, notes), `4ta5-wz5s`+`39hk-dx4f` (station ADA
  text).
- **BART**: `bart.gov/stations/<code>/accessible` (per-elevator "what to do if
  out" = the redundancy signal), the Elevator Dimensions guide (per-elevator
  inventory, corroboration).
- **MBTA**: `alternate-service-text` per elevator (the answer key), GTFS
  `pathways.txt` with real `facility_id`, the Daniels-Finegold ADA settlement,
  the ramp facility endpoint.
- **CTA**: the ASAP Strategic Plan (per-station elevator counts), an ADA
  settlement monitor's quarterly reports, chicago-L.org.
- **TfL**: the lift inventory + topology CSVs, step-free/avoiding-stairs PDFs,
  `StopPoint/<id>` lift counts.

**Extraction techniques (reusable):**
- JS-rendered or WAF-protected agency pages (bart.gov, transitchicago.com,
  wmata.com ridertools) → use the **in-app Browser pane**, not WebFetch/curl.
- Large/image-wrapped agency PDFs that WebFetch can't handle → `curl -A
  "<browser UA>" -o f.pdf <url>` then Node `pdf-parse` / `pdftotext -layout`.
  These are usually 508-compliant with a real text layer — don't give up on a
  PDF without trying this.
- Undocumented feeds are often found by **inspecting the agency site's own
  network traffic** (TMB, LIRR/MNR) — a materially higher risk tier; note it.

---

# Part II — How stations and elevators physically work

## 5. The vertical-stack mental model (universal)

Step-free access is a **chain of segments**: `street → concourse/mezzanine →
platform`. A segment is **up** if any of its elevators works OR a non-elevator
step-free path (ramp, at-grade entrance) exists. **A station is accessible only
if EVERY segment is up** (AND across legs; OR within a leg). The default station
is *two elevators in series, both sole-access*. Everything else is a deviation.

## 6. The archetype catalog (cross-system)

Generalized from WMATA's `WMATA-STATION-GUIDE.md` §3 — these shapes recur in
every system, only the vocabulary changes:

- **Single shaft serves everything** — one elevator, all levels, sole access
  for the whole station (Fort Totten). If it breaks, nothing is step-free.
- **Two-in-series, no redundancy** — the baseline. Both legs sole. Most stations.
- **A leg is at STREET GRADE → omit it** — the concourse/entrance is reachable
  step-free without an elevator; that leg gates nothing (WMATA Rockville,
  Downtown Largo). The mirror image of an undercount: the feed models an
  elevator leg that isn't load-bearing. State it in the note, leave it out of
  `segments`.
- **Shared prerequisite + per-direction legs** — one street→mezz elevator feeds
  separate per-direction platform elevators. One chain per direction, the shared
  id repeated in each (WMATA §3D; CTA Grand; MTA bridge elevators). No
  redundancy — the shared leg severs both directions.
- **Per-direction independent (side platforms)** — each direction its own
  street→platform elevator, nothing shared. **Per-direction elevators are NEVER
  redundant with each other** (you can't cross to the other platform without
  riding a train).
- **Stacked interchange — down-then-back-up series** — reaching a line means
  riding down to another platform and back up; each line/direction is a *series*
  chain of 2–3 elevators (WMATA Metro Center/Gallery Place/L'Enfant; CTA
  Jackson-Red). Resolve from the agency's own per-elevator text.
- **Redundant BANK (the highest-value trap)** — several elevators serve the
  *same* leg to the *same* destination; topology feeds routinely draw the whole
  bank as ONE edge. Caught by 2+ identically-worded observed units, an inventory
  count, or a human (WMATA Forest Glen 6-elevator bank drawn as 1).
- **Redundant pair on one leg / redundant pair of full routes** — two elevators
  (or two complete entrance→platform routes) both reaching the same platform,
  rider can use either. Real redundancy; encode the "either full route" case as
  paired-segment CNF (WMATA Navy Yard; CTA Jackson-Red; MTA Stamford).
- **Grade-separated entrances — per-entrance, NO cross-redundancy** — the
  dangerous inverse: two entrances on opposite sides of a highway/rail corridor,
  each with its own street elevator sharing a platform elevator. Topology sees a
  redundant street pair, but a rider **can't cross at grade**, so one failing
  strands that side — a false-redundancy **under-warn**. Model per-entrance
  (WMATA Silver Line median stations). Contrast with mutually-reachable
  entrances (same paid area / same sidewalk), where redundancy is real.
- **Auxiliary / secondary access** — pedestrian bridges, bike-trail elevators,
  garage elevators that are real entrances: each its own chain, additive, never
  a backup for the core route unless confirmed to reach the same platform.

## 7. The redundancy decision (get this right — it IS the point)

Two elevators are redundant **only if a rider at the start of the leg can use
either one to reach the same destination.**

| Situation | Redundant? |
|---|---|
| Two elevators, same leg, same platform, rider already there | **YES** |
| Two street elevators, same entrance/paid area, either reaches the concourse | **YES** |
| Two full routes to the same platform, rider can pick either entrance | **YES** (CNF) |
| Elevator **or** inclinator / **or** a confirmed ramp to the same platform | **YES** |
| Two elevators serving **different directions** (side platforms) | **NO** |
| Two entrances on **opposite sides of a barrier**, can't cross at grade | **NO** |
| "Ride to the next station and come back" (cross-station detour) | **NO, never** |
| A named backup reached only by **riding a train** ("exit at X, take a train back") | **NO** — it's a detour, not a backup |

The **cross-station / ride-a-train rule** is universal and has bitten every
system: a rider already headed somewhere is functionally stranded even if a
paired elevator exists elsewhere. BART's outage-options page, MBTA's
`alternate-service-text`, and WMATA all phrase detours as if they were backups —
they are not. Parse guidance for *named same-station backups only*; a guidance
route that boards a train is a detour (MBTA's "named-first" misread 13 stations
on the first pass because of this).

## 8. Non-elevator step-free & non-chain elevators

- **Universal inclusion, selective chain membership:** every ELEVATOR an agency
  reports is *tracked* as a unit (garage, parking, pedestrian-bridge, whatever)
  — no adapter drops an elevator by location. But an elevator enters an ACCESS
  CHAIN only when the agency's guidance or a human confirms the route (the
  Millbrae/garage precedent). A garage-*named* elevator may actually be a
  required entrance (WMATA Huntington "Garage #1") — check what it connects, not
  what it's called.
- **Non-elevator step-free equipment** (ramps, mini-highs, portable/wheelchair
  lifts) lives in a **separate, walled-off layer** — never in `units`, never in
  the `%`-down or any leaderboard. Its loss removes step-free access, so it's
  tracked as `other_equipment`, and a confirmed ramp can mark a segment
  `stepFreeAlternative`.
- **The 0.3-mile detour policy:** an elevator-FREE step-free detour of ≤0.3 mi
  counts as a `stepFreeAlternative` (disclosed in the note); longer, or any
  detour that depends on another elevator, does not.
- **Standing cross-system rule:** before finalizing ANY model, check whether the
  agency's own data exposes a ramp/facility that satisfies `stepFreeAlternative`
  — for **every** system, not just the one the question came from. A ramp in the
  agency's own facility inventory meets the same evidence bar as a human
  walk-through.

---

# Part III — How our models encode reality

## 9. StationModel anatomy + derived redundancy

A `StationModel` (`src/lib/accessibility.ts`) is: `systemId` +
`stationExternalId` (+ optional `coveredStationExternalIds`) + an ordered list
of `segments`, each with an `elevators` array and optional
`stepFreeAlternative`; plus `chainLabel` (independent chains), `auxiliary`, and
the two note tiers. **Redundancy is DERIVED from this structure, never
hand-typed** — a station is single-fault tolerant iff no single elevator outage
severs access; an elevator is redundant iff its own outage alone doesn't sever a
chain it's in. *Editing the structure propagates the redundancy* — that's why
curation is the source of truth.

**Precedence (ingest resolves, never clobbers higher):**
`curated > explicit > pathways > serving_text > single_elevator > assumed`.
Curated-vs-curated: incoming curated wins (edits propagate). A non-curated feed
signal that disagrees with a curated value **opens a contradiction flag for
human recheck — it never overwrites**. The `assumed` default never raises a flag.

## 10. Encoding patterns (the cheatsheet)

- **One chain per independent route/direction** — `chainLabel` names it
  (`" (northbound)"`, `" (Green/Yellow)"`). Independent chains share the
  `stationExternalId` (161 St pattern: the 4 and the B/D each depend on their
  own elevators; one down says nothing about the other).
- **Shared prerequisite** — repeat the same `externalId` across chains; the
  model makes it sole-access automatically (its outage severs every chain it's
  in).
- **Redundant leg** — put both ids in one segment's `elevators` array (OR within
  a segment).
- **"Either full route" redundancy** — paired-segment CNF: an AND of segments,
  each an OR across routes (Navy Yard, Jackson-Red, Stamford). Round-trip-verify
  it over every elevator subset when generated.
- **At-grade leg** — omit from `segments`; mention in the public `note` only.
- **Merged feed ids** — canonical `stationExternalId` + `coveredStationExternalIds`
  listing every subsumed feed code; adapter resolves via a covered-id-aware
  index (Part I §2).
- **Ids** — use the real observed id wherever one exists; otherwise a documented
  synthetic placeholder (`SYSTEM-<node>`, `SYSTEM-SYNTH-<...>`), promotable to
  the real id on first live observation. Track how many synthetics remain and
  why (Part V).
- **Locations** — whenever a human gives an address/corner/lat-long, fold it
  into the elevator `label` (standing rule).

## 11. Two-tier architecture + the answer-key gate

The scalable pattern used on every large system: **auto-generate what's provably
safe, park the rest for human review.**

- A **generator** derives models from a structured source (GTFS pathways,
  topology graph, feed text) and **self-excludes** anything it can't resolve
  conservatively into a `*-excluded.json` / `review-flags.json` file — that
  exclusion file IS the review backlog.
- **Every generator is gated by an ANSWER KEY** and aborts the build if it
  disagrees: MBTA's `alternate-service-text` (a named same-station backup must
  match topology-derived redundancy, else exclude), the rail/WMATA hand-model
  gate ("if what you generate disagrees with what I told you, your generator is
  broken"), TfL's `isRedundant` flag, WMATA's observed-units undercount gate.
  **Conservative gates are features** — an over-exclusion becomes a review item;
  an under-exclusion ships a wrong model.
- **Two-tier ingest:** generated models enter *below* every human signal
  (`serving_text`/`pathways`); hand-curated models are `curated`. The generator
  guarantees no station/elevator overlap between tiers, and a `check:*` asserts
  the tier separation.
- The generated proposals are the review queue's *best guesses* — they graduate
  to the curated tier one at a time (or in risk-bucketed batches) via human
  verdicts, never wired in wholesale.

## 12. Notes discipline (never leak)

Two note fields, enforced everywhere: **`note`** is PUBLIC, rider-facing plain
English (what the route is, which legs have a backup, what an outage means — no
feed/GTFS/generator jargon), composed via `composePublicNote()` AFTER any
enrichment. **`internalNote`** holds provenance, confidence, verification dates,
feed quirks, and watch items — it NEVER ships to the site (build-site-data reads
only `note`; leakage is grep-verified 0). When writing a new model: rider
guidance in `note`, everything about *how you know* in `internalNote`.

---

# Part IV — Workflow: processing a system

## 13. The pipeline

```
adapter.fetch() → NormalizedRead → ingest() → archive (events, not snapshots)
                   (units+outages)   (open/close outage events, resolve redundancy)
```

Adding a system: (1) `SystemCatalogEntry` in `systems.ts`; (2) bind in
`adapters/registry.ts`; (3) an adapter whose `fetch()` returns a
`NormalizedRead`. Nothing downstream knows the agency — the adapter seam is what
lets systems be added by config. Keep archiving/payload logic in the shared
cores (`pollSystem.ts`, `build-site-data.ts`), never in callers. Build
**system-agnostic engines over normalized types + thin per-system mappers** —
the chain-inference engine, the accessibility model, and the audit dimensions
are all reusable; only the raw-feed mapper and the hand-verified config are
system-specific.

## 14. The review ritual + risk-bucket batching

For every station the generator couldn't resolve, one at a time
(`/liftwatch-station-review`, tracked in `review/queue.json` — verdicts AND
hand-added evidence persist across rebuilds):

1. **Dossier** — every piece of evidence verbatim with its source label, plus
   anything fetched live. Don't pad; if evidence is thin, say so.
2. **Best guess** — proposed chain structure with REAL ids, a **numeric
   confidence (0–10) stated up front, every time**, and what specifically would
   change your mind.
3. **Open questions** — only the things a human or field check can answer.
4. **Verdict** → implement (curated tier only), record a `resolution` {verdict,
   notes, date, commit} + evidence in the queue.

**Risk-bucket batching:** a station claiming **zero** redundancy can't
under-warn by construction → batchable. A **new redundancy claim** needs
one-at-a-time scrutiny (it's the only direction that can under-warn). Batch the
safe bucket; slow down for the risky one.

## 15. Standing rules (locked, don't re-litigate)

- **Over-warn, never under-warn.** No redundancy without a real signal. The
  fail-safe display state for an unplaceable outage is **UNKNOWN**, never
  "accessible".
- **State a numeric confidence (0–10)** on every proposal, up front.
- Before finalizing, **check the agency's OWN feed/API/documents/status-page
  text first** — it often settles the question outright. Ask the human to paste
  per-elevator status text for tangled interchanges.
- **Record elevator locations** (address/corner/lat-long) in the model when
  given.
- **Give per-system completion % alongside the total** in progress updates.
- **Auto-advance** to the next pending station once the current ships; still
  stop for the actual verdict, and pause for possible location follow-ups before
  auto-pulling the next.
- **Commit per station/batch; PUSH only every ~5 updates** (each push = a live
  deploy). `git pull --rebase` before each push (a daily workflow auto-commits
  regenerated data); always push before ending a session.
- **"Update docs" = CLAUDE.md + SPEC.md + HANDOFF.md together, every time.**
- Every bug found becomes a **locked regression assertion**; every gate's
  motivating trap stays asserted.

---

# Part V — Auditing and checking

## 16. Two independent layers — you need BOTH

1. **Self-check** (`check:*`) — proves the generator/model is internally
   consistent and matches its answer key. Fast, runs every poll/CI. **But it
   shares the models' blind spots** — it references models by their own ids and
   assumptions.
2. **Independent audit** — re-derives from the raw ground-truth sources and
   reconciles them against the *production* models, using the identifiers the
   **live feed** actually emits. This is the layer that catches what the
   self-check structurally cannot.

**The proof this matters:** the WMATA merged-station bug (models keyed under an
id the feed never emits) passed 285 self-check assertions. It fell out
immediately from an independent audit that iterated the feed's real codes.
`scripts/wmata-final-audit.mts` (`npm run wmata:audit`) is the template — build
one per system as it reaches "done".

## 17. The universal audit dimensions

Reconcile the production models against each ground-truth source and flag:

1. **Coverage** — every feed station (incl. covered ids) has a model.
2. **ID authenticity (no ghosts)** — every real modeled id appears in at least
   one ground-truth source; an id in none is a typo/fabrication.
3. **Completeness (no under-warn gaps)** — every ground-truth ELEVATOR
   (non-garage) is represented in a chain; a missing one is a potential
   unmodeled chain member.
4. **Feed-code resolvability** — every model resolves from the identifier the
   live feed emits (the dimension that would have caught the merged-station
   bug — add it to every audit).
5. **Synthetic remnants** — every remaining synthetic id is a *documented*
   exception; anything else is an incomplete promotion.
6. **Observed-but-unmodeled** — every live-observed real elevator is modeled or
   a known non-chain unit (garage); anything else is an under-warn risk.
7. **Duplicate ids** — an id in two stations, or improperly in two segments
   (distinguish real shared-prerequisites from mistakes).
8. **Redundancy backing** — list every redundant segment; each must trace to a
   real signal (agency text / human / 2+ identically-worded observed units), not
   topology alone.

## 18. Reconciliation discipline

- **Cross-check against MULTIPLE independent sources.** A discrepancy resolves
  in favor of the agency's **live** text (a static inventory/guide can be
  stale — BART's dimensions guide showed a platform elevator that no longer
  exists).
- **Document known non-issues** so they're never re-flagged (BART's dimensions
  guide has a "Known non-issues" list of already-resolved discrepancies — 6
  stations that would otherwise get re-investigated every audit).
- **The answer-key hard gate:** if a generator's output disagrees with a
  human/agency ground truth, the *generator* is broken — abort the build, don't
  ship the disagreement.
- **Automate the refresh + full check suite** (the daily `model-refresh`
  workflow regenerates every regenerable model set, runs the whole `check:*`
  suite, and commits only if green and substantive) — but a green self-check is
  necessary, not sufficient; the independent audit is the final word before
  calling a system done.

---

# Part VI — Quick start for the next system

1. **Classify the feed** (Part I §1): per-elevator / broken-only / advisory?
   Set `data_quality`, `inventoryComplete`, `fleetSource`, `redundancyBaseline`.
2. **Nail the identity model** (Part I §2): what id does the LIVE outage feed
   emit? Model and attribute on THAT. Note any multi-id physical stations.
3. **Audit every feed field you rely on** (Part I §3) before trusting it.
4. **Hunt the ground truth** (Part I §4): find the agency's own inventory /
   per-elevator guidance / status text / settlement docs. Note trust tier.
5. **Build the generator** with a conservative answer-key gate (Part III §11);
   let it self-exclude the hard stations into a review queue.
6. **Run the review ritual** on the queue (Part IV §14) — dossier, best guess +
   confidence, verdict, curated tier, recorded resolution. Over-warn if unsure.
7. **Write the per-system guide** (the WMATA guide is the template) once you've
   learned the archetypes.
8. **Ship a `check:*` self-check AND an independent audit** (Part V). A bug found
   is a locked assertion. Only after both are green is the system "done".
