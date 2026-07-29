---
name: liftwatch-system-models
description: Per-system elevator access-chain modeling detail for LiftWatch — how each system's station models were generated or curated, its ground-truth sources, audit results, and system-specific traps. Read before adding, modeling, auditing, or debugging chains for MTA, LIRR/Metro-North, MBTA, WMATA, CTA, TfL, or BART.
---

# LiftWatch — per-system modeling detail

Split out of `CLAUDE.md` (2026-07-28). The UNIVERSAL rules still live there:
the segment/chain model, the `curated > explicit > pathways > serving_text >
single_elevator > assumed` precedence, redundancy baselines, contradiction flags,
multi-chain stations, the "sole access" signal rule, and the locked step-free
detour policy — plus every Convention and Gotcha. Read `CLAUDE.md` first;
this file is the per-system layer under it.

`MODELING-PLAYBOOK.md` remains the system-agnostic how-to;
`wmata-data/WMATA-STATION-GUIDE.md` is the WMATA field guide.

## MTA subway + commuter rail (LIRR / Metro-North)

- **MTA models are GENERATED, not hand-typed — now FULL COVERAGE** (2026-07-21:
  every elevator-equipped complex the live feed reports, 123 stations / 230
  chains, up from 19 interchange-only). `npm run mta:chains`
  (`scripts/mta-chains.mjs`) runs two tiers, both keyed on the live
  `nyct_ene_equipments` feed + the committed data.ny.gov inventory:
  - **`inferChains`** (unchanged) — multi-LINE-group interchanges: one chain per
    platform line-group, line-spanning elevators as shared prerequisites.
  - **`inferDirectional`** (NEW, the universal tier) — every simple/per-DIRECTION
    complex `inferChains` skipped. Structure comes from data.ny.gov's STRUCTURED
    fields (`elevator_mezzanine_1/2_access` + `elevator_platform_access` +
    `elevator_direction_serviced`), NOT free-text: `mez+ plat-` = street→mezz
    shared prereq; `mez- plat+` = street→platform direct; `mez+ plat+` = a spoke
    (if the complex has a dedicated street→mezz leg) else a direct single shaft.
    A redundant GROUP (union-find over MTA's own named/flagged backups) = one
    segment; one chain per platform-reaching segment, prefixed with the shared
    prereqs; label carries the direction. Handles per-direction sole (72 St),
    shared-prereq + spokes (DeKalb), redundant pairs collapsed (Far Rockaway,
    Parkchester), single-elevator SPOFs.
  - **Redundancy is READ from MTA, never re-derived-then-guessed**: the feed
    `redundant` flag == data.ny.gov `redundant_elevator` on all 391 ADA elevators
    (0 disagreements fleet-wide), so a claimed backup is always MTA's own.
  - **Gate = conform-to-MTA + log** (Bryce, 2026-07-21): the 10 hand-authored
    OVERRIDES + the multi-line auto tier keep the STRICT self-check (mismatch fails
    unless in `REDUNDANCY_EXCEPTIONS` — 14 St-6 Av EL609/EL610, GCT Shuttle EL607X,
    Times Sq EL619). The universal tier CONFORMS: a residual mismatch is only ever
    the SAFE over-warn direction (derived sole where MTA=redundant, backup
    unplaceable) → logged to `generator-disagreements.json` (the engine-improvement
    worklist) and never fails the build; an UNDER-warn (derived redundant where
    MTA=sole) fails loudly. `check:mta` embeds `overrideStations`/`overWarnAllowed`
    and applies the same policy offline. **59 St-Columbus Circle (614)** was the
    first station this worklist promoted to a hand OVERRIDE (2026-07-21): a
    6-elevator MESH the auto tier over-warned, hand-verified with Bryce (fully
    step-free interconnected, two opposite-side street entrances back each other
    up via the EL278 cross-under, EL279 real despite a stale "withdrawn" note),
    encoded with the Stamford/Jackson-Red "direct OR detour" CNF paired-segments
    so every single outage stays accessible (matching MTA) while real double
    outages sever — the disagreements log is now empty.
  - Excluded complexes are correct: no ADA elevator in the live feed (191 St etc.),
    or a data.ny.gov ADA elevator the feed doesn't emit (can't track it).
- **MTA ground-truth + topology sources (2026-07-21).** data.ny.gov `94fv-bak7`
  (`ny-elevator-inventory.json`, the redundancy/level/direction gate);
  **tsdataclinic/mta** (`mta-data/tsdataclinic/`, Apache-2.0, archived Jan 2025) —
  the elevator street→platform TOPOLOGY graph NYCT's GTFS lacks, plus a
  criticality analysis (its "Perc. Importance" is a betweenness score, NOT a
  redundancy flag — context only); the 2022 **ADA settlement** (CIDNY/De La Rosa,
  `mta-ada-settlement.md`) — a station-level buildout ROADMAP with no per-station
  or per-elevator list, so corroboration-tier only, does not feed the generator.
  Universal join key across all three (+ the feed): the elevator id `EL###`;
  data.ny.gov `station_complex_mrn` == our `stationExternalId` (pre-`MERGES`).
  **`npm run mta:audit`** (`scripts/mta-final-audit.mts`) is the independent NYCT
  reconciliation (analog to bart/wmata:audit): models + fleet vs data.ny.gov, plus
  a **topology reconciliation** against the tsdataclinic elevator GRAPH
  (edgelist_w_pid.csv) — id authenticity, whole-fleet coverage, and per-elevator
  DIRECTION (an unambiguous N/S axis on both the graph and model side must agree).
  0 review flags (known items = documented exceptions, logged over-warn fallbacks,
  data.ny.gov catalog lag). NOTE: a relative "grouping" check was tried + removed —
  it only false-flagged the hand overrides, because MTA redundancy legitimately
  spans opposite platforms via mezzanine cross-connections (the graph validates a
  single elevator's own direction, never the grouping).
- **MTA direction accuracy — exhaustively verified (2026-07-21/22): 0 inversions.**
  The `mta:audit` N/S check covers the IRT numbered lines; the lettered lines use
  terminus-name directions (e.g. "manhattan"/"woodlawn") that don't map to a global
  N/S axis, so those 62 were verified by an adversarial per-line workflow (agents
  reasoning from each line's real terminals). Combined, all ~200 directional
  platform elevators reconcile with the independent graph — the models faithfully
  carry MTA's own `elevator_direction_serviced` field. The 5 non-clean cases were a
  cosmetic label artifact, since **fixed at the root**: when MTA marks an elevator
  `elevator_direction_serviced = "Both"` (island platforms, line termini,
  multi-platform), `normDir` no longer parses a stray direction fragment out of the
  feed description — it stays non-directional. A `disambiguateLabels` pass gives two
  colliding "Both" chains at one complex a distinct suffix (real direction if the
  description has one, else a lettered ordinal), which also fixed 2 pre-existing
  duplicate-chainLabel bugs (Coney Island-Stillwell D, WTC Cortlandt 1).
- **MTA ramp/other-access: CHECKED and ruled out (2026-07-21, standing ramp
  rule).** Unlike MBTA (a `RAMP` facilities feed) and TfL (`RampRoutes`/
  `SameLevelPaths`), MTA publishes **no structured ramp data** usable as a
  `stepFreeAlternative`: GTFS has no `pathways.txt`/`levels.txt`, the stations
  dataset (`39hk-dx4f`) has only `ada`/`ada_northbound/southbound` flags,
  data.ny.gov's only "ramp" text is non-ADA/exit ramps or ramps used *with* an
  elevator, and MTA's own developer guidance states outright *"Ramps are not ADA
  accessible; elevators should be used instead."* So NO ramp `stepFreeAlternative`
  is added for MTA — doing so would contradict the agency and risk under-warning.
  (Genuinely ramp-accessible stations are ramp-ONLY, no elevator to break.) Same
  elevator-centric ruling as WMATA/CTA; opposite of MBTA/TfL.
- **Commuter rail (LIRR + Metro-North) is DONE, both directions** (2026-07-06):
  (a) they are their own leaderboard systems (`mta-lirr`, `mta-mnr` — one
  shared adapter, `src/adapters/mta-rail`, filtering one undocumented feed
  pair by railroad; see SPEC.md's railroad section for the feed dossier), and
  (b) the five subway interchanges that touch them (Penn, Grand Central,
  Atlantic, Woodside, Sutphin Blvd–Jamaica) carry subway-side "(LIRR)" chains
  built only from subway-feed elevators. Eighteen railroad stations have
  hand-curated models (`src/catalog/mta-rail-models.ts`, human walk-through
  2026-07-06; Greenwich added 2026-07-10 after a live 218E outage exposed it
  in the generator's review queue — overpass at grade, Track 3 ramp off
  Greenwich Plaza, 218T outside the chains — its notes outrank the feed's
  location strings); Stamford uses a
  paired-segment CNF encoding for "direct elevator OR multi-elevator detour",
  ramps are `stepFreeAlternative` legs). Penn's EL34X ≡ LIRR's NYK-861 (one
  physical elevator, tracked in both systems deliberately). Grand Central
  gets NO subway-side railroad chain (would overclaim — the terminals have
  their own tracked elevators).

## MBTA, WMATA, CTA, TfL, BART — generation, sources, audits

- **MBTA simple-station chains are GENERATED from feed text, validated by
  MBTA's own rider guidance** (2026-07-10). Same engine as rail
  (`chain-inference.ts`) + an MBTA vocabulary mapper
  (`src/adapters/mbta/chain-mapper.ts` — lobbies/pedestrian bridges are
  ordinary hubs here, paid/unpaid variants are DISTINCT hub identities,
  platforms are direction-named). The answer key is IN the feed: 215/237
  elevators carry `alternate-service-text` (MBTA's per-elevator rider
  guidance) — a named same-station backup ⇔ topology-derived redundancy must
  agree, else the station is excluded. CRITICAL parsing rule: guidance that
  NAMES an elevator but reaches it by riding a train ("exit at Savin Hill,
  take an Ashmont-bound train back…") is a DETOUR, not a backup (the BART
  cross-station rule) — checking named-first misread 13 stations on the
  first run. Output: 39/80 stations, 60 chains
  (`src/catalog/mbta-data/chains.json` + `chains-excluded.json` 41 stations).
  The adapter emits chain members as `serving_text`; un-modeled
  units keep single_elevator/assumed. Offline: `npm run check:mbta-chains`
  (full-feed fixture reproduction + Fields Corner detour + Wellington
  exclusion regressions).
- **MBTA GTFS pathways BUILT as REVIEW PROPOSALS (2026-07-14)**: MBTA's GTFS
  (cdn.mbta.com/MBTA_GTFS.zip) carries `pathways.txt` — 480 mode-5 elevator
  pathways with a REAL `facility_id` matching the live API (the direct
  crosswalk WMATA never had) plus a full door/node walking graph.
  `scripts/mbta-pathways.mts` computes EXACT step-free reachability per
  boarding platform (antichain fixpoint → minimal elevator-sets), encodes
  chains as MINIMAL CUTS (lossless AND-of-ORs, round-trip-verified over every
  elevator subset), labels chains with real platform names, and gates on the
  alternate-service-text answer key (contradiction → excluded; Wellington
  lands there, matching its historical mismatch). Cross-check: 28/30
  already-trusted tier stations reproduced semantically (only
  Alewife/Braintree differ — extra garage elevators; walkthrough items).
  Output `mbta-data/pathway-chains.json` originally covered 17 stations / 33
  chains of interchange backlog — **deliberately NOT wired into
  station-models.ts directly**: interchanges ship one at a time (or in
  risk-bucketed batches, see below) via Bryce's /liftwatch-station-review
  verdicts (the proposals are the queue's best guesses). South Station
  refused (facility-less elevator pathway = untrackable member = would
  under-warn). `npm run mbta:pathways -- <dir>` + `npm run
  check:mbta-pathways`; regenerated daily by model-refresh.yml.
  **18 of these proposals have now graduated to `mbta-models.ts`
  (2026-07-14/15)**: Aquarium and Park Street shipped individually
  (confidence 8-9/10, cross-validated against the pathways graph itself);
  16 more shipped as "Batch 1" (Arlington, Assembly, Back Bay, Copley, Forest
  Hills, Harvard, Haymarket, Lechmere, North Quincy, North Station, Ruggles,
  Savin Hill, Science Park/West End, South Station, Tufts Medical Center,
  Wollaston) — approved as a group since they'd all passed the identical
  answer-key + round-trip validation gates. `check:mbta-pathways`'s "Known
  regressions" assertions, which used to assert these three stations were
  STILL pending proposals, were stale after the graduation and got fixed
  into "Graduated to curated tier" assertions (confirms they're now ABSENT
  from the regenerated proposal set, which `check:mbta-pathways`'s Tier
  separation check already enforces generically). 6 stations remain
  genuinely held back for individual review, flagged by the generator as
  guidance-vs-topology contradictions or reachability anomalies rather than
  simple proposals: State, Wellington, Courthouse, Downtown Crossing, Oak
  Grove, Sullivan Square.
  **A same-session infra bug**: the daily model-refresh workflow's `unzip`
  command never extracted `facilities_properties.txt` from the GTFS zip,
  silently disabling the "excludes-stop" agency-declaration-contradiction
  gate for Charles/MGH, JFK/UMass, and Shawmut — found by reproducing the
  failing CI run locally with the live GTFS zip; fixed by adding the file to
  the unzip file list (2026-07-15).
  Same-audit result elsewhere: LIRR/MNR/NYCT GTFS have NO pathways/levels;
  BART/CTA re-verified none.
- **MBTA joint review pass COMPLETE (2026-07-12): `review-flags.json` is now
  empty.** Every flagged street-alternate and no-guidance elevator was walked
  through with Bryce and resolved into one of four HUMAN-approved lists in
  `scripts/mbta-chains.mts` (all re-asserted by `check:mbta-chains`, 20
  checks as of 2026-07-17): (1) `APPROVED_STREET_ALTERNATES` — 8 elevators (Framingham 50/51,
  Natick 750/751, Ball Square 769, Union Square 771, East Taunton 778/779):
  MBTA names an elevator-free ≤0.3-mi step-free route → sets
  `stepFreeAlternative` + discloses the walk. (2) `DISCLOSED_ALTERNATES` — NEW
  note-only category (South Acton 704/705): a real step-free route BEYOND 0.3
  mi → NO step-free credit (chains still read NO ACCESS) but MBTA's routing is
  surfaced in the note for riders willing to walk it. (3) `CONFIRMED_REDUNDANT`
  — NEW guarded human override (TF Green 400/401): a redundant pair with NO
  `alternate-service-text`; the human is the signal, and a check guards that a
  feed change making one sole-access excludes the station loudly. (4)
  Sibling-corroboration (generic): an elevator named by a sibling's guidance
  (Salem 996 → "use nearby 997") validates the un-texted sibling — no override.
  Pawtucket 405/406 confirmed redundant via the earlier `named-generic` parser.
- **LIRR/MNR simple-station chains are GENERATED from feed text,
  ground-truth-gated by the hand-curated models (18 as of 2026-07-15 —
  Amityville, Lindenhurst, Purdy's, Cortlandt added via
  /liftwatch-station-review; all single-elevator or straight 2-elevator
  chains, zero redundancy claimed)** (2026-07-10). eestatus has no
  serving field and no declared redundancy flag (unlike the subway), so
  `npm run rail:chains` (`scripts/rail-chains.mts`) parses each elevator's
  free location text via a SYSTEM-AGNOSTIC landing-classification engine
  (`src/lib/chain-inference.ts`) + a thin MTA-rail vocabulary mapper
  (`src/adapters/mta-rail/chain-mapper.ts` — engine/mapper split, reusable by
  any future free-text system). HARD GATE: every hand-curated station the
  engine models must match the hand model semantically or the run aborts
  ("if what you generate disagrees with what I've told you, then your
  generator is broken") — 9/13 reproduce exactly, the 4 tangled ones
  self-exclude. Output: 115 chains / 72 stations →
  `src/catalog/mta-rail-data/chains.json` (+ `chains-excluded.json`, 9
  stations still awaiting human review as of 2026-07-17, down from the
  original 14 — TfL precedent). **Two-tier ingest**: hand
  models stay `curated`; generated models enter as `serving_text` (below
  every human signal; contradictions flag, never clobber; non-assumed, so ▮ +
  SPOF apply). The generator guarantees no station/elevator overlap between
  tiers. Offline: `npm run check:rail-chains` (60 checks, incl. the
  Chappaqua-148I regression that motivated the whole build). GOTCHA locked in
  the mapper: the feed abbreviates "Tk 3" — the first run's regex missed it
  and minted five FALSE redundant pairs; when touching the mapper, re-scan
  every multi-elevator segment in the output, not just the curated gate.
- **WMATA per-elevator chains are GENERATED from GTFS pathways (2026-07-13),
  with observed-UnitName binding and a fail-safe.** A physical elevator = a
  CONNECTED COMPONENT of the mode-5 pathway subgraph (`scripts/
  wmata-pathways.mts` — a node-name regex missed ~25%; components can't split
  a 3-level shaft into a false redundant pair). 206 in-station elevators / 98
  stations; **ALL 98 stations now carry models** — 55 generated
  (`wmata-data/chains.json`) + 43 hand-curated
  (`src/catalog/wmata-models.ts`, grown 2026-07-13→17 via
  /liftwatch-station-review from Rockville alone, through the 2026-07-15
  batch of 21 no-redundancy ladder-chain stations, to the final 22
  individually-resolved holdouts — see the STATION REVIEW COMPLETE bullet
  below; several elevators upgraded from synthetic to real `UnitName`s by
  cross-checking `observed-units.json` along the way). The generator's
  conservative gates still park 43 stations in `chains-excluded.json` from
  its OWN output (all now covered by the curated tier instead): side
  platforms, big transfers, 3-level shafts, corrupt A02 levels, and the
  **observed-units gate** — every UnitName ever seen in the feed
  (`wmata-data/observed-units.json`, `npm run wmata:observed`) must map onto
  exactly one segment with no segment over-subscribed; this caught GTFS
  UNDERCOUNTS (Forest Glen's 3-elevator bank drawn as one pathway, Mt Vernon
  Sq, Morgan Blvd — all excluded). Model slot ids are REAL UnitNames wherever
  observed (slots within a segment are interchangeable → sorted assignment is
  exact), so live outages match models BY ID; unknown UnitNames fall back to
  the LocationDescription level pair (`src/adapters/wmata/location.ts`, the
  ONE vocabulary shared by generator + adapter) → `unit.segment` +
  `needsReview`; unparseable → `needsReview` and the site's generic fail-safe
  makes every chain at the station read UNKNOWN (never accessible) — also
  fixed BART's `-UNSPECIFIED` outages not surfacing on the access board.
  Garage elevators: tracked units, never chain members, never flagged
  (universal policy above). `inventoryComplete` stays false + `*320` static
  denominator — the chains are additive display-layer accessibility, NOT a
  fleet claim. Offline: `npm run check:wmata`. Refresh: new-UnitName ntfy push
  → `wmata:observed` + re-run the generator (binds it or auto-excludes).
  **The refresh loop is AUTOMATED daily FOR ALL SYSTEMS** by
  `.github/workflows/model-refresh.yml` (2026-07-14): sweeps observed
  units/evidence (WMATA, CTA, TfL alert-evidence, BART attribution-evidence),
  regenerates every regenerable model set (WMATA from fresh GTFS, MTA
  subway, LIRR/MNR ground-truth-gated, MBTA guidance-validated, TfL), runs
  the FULL cross-system check suite, and commits+pushes ONLY if green and
  substantive (timestamp-only churn is discarded; Netlify then deploys).
  Conservative gates park anything unresolvable into
  chains-excluded/review-flags files → the verification backlog; a generator
  abort or check failure fails the run WITHOUT committing and (once the
  NTFY_TOPIC repo secret is set — `gh secret set NTFY_TOPIC`, never hardcode
  it, the repo is public) sends a high-priority "needs review" push. Manual
  per-system loops still work anytime.
- **WMATA modeling field guide (2026-07-17): `wmata-data/WMATA-STATION-GUIDE.md`**
  — distilled from all 51 reviewed stations: the vertical-stack mental model,
  the station archetypes with examples, the redundancy decision table, what
  GTFS reliably gets wrong, an encoding cheatsheet, and a per-station
  checklist. **Read it before modeling or auditing any WMATA station.**
- **WMATA Rider-Tools page inventory — a THIRD ground-truth source + a bulk
  id-promotion (2026-07-18, `wmata-data/rider-tools-inventory.json`).**
  WMATA's own station-info pages (`wmata.com/ridertools/station/<slug>/info`)
  server-render an `elevatorListCMF` payload: a per-station roster of REAL
  UnitNames + per-entrance groups + level descriptions in the SAME vocabulary
  the live feed uses (`parseWmataLocation`). Snapshotted for all 91 rail
  stations (fetch via the in-app Browser pane — `fetch('/ridertools/station/
  <slug>/info')`; the JS-rendered pages need a real browser, and the payload
  interleaves escalators/garages that reuse ids, so filter to names starting
  "Elevator"/"Garage"). Used two ways: **(1) generated tier** — a purely-
  additive binding pass in `scripts/wmata-pathways.mts` fills every still-
  synthetic slot with its real id by level-pair (never overrides an observed
  binding, never gates/excludes; `PAGE_ID_OVERRIDES` covers 2 non-standard
  wordings — A15 "parking/Kiss & Ride", B03 "Amtrak station"), so all 38
  generated stations now carry real UnitNames and re-derive identically each
  daily refresh. **(2) curated tier** — 33 stations' synthetic ids promoted to
  real UnitNames (Tier A), a self-consistent swap where the model structure
  already matched the page. A full cross-check of EVERY model (curated +
  generated) vs the page found **0 wrong ids and 0 genuine segment errors** —
  the only real discrepancies were the **13 "Tier B" stations**, **ALL
  RESOLVED 2026-07-18** via **`/liftwatch-wmata-tier-b`**: the 7 Silver Line
  grade-separated median stations (N01/N02/N03/N04/N07/N08/N12) — WMATA's
  page showed a redundant PAIR on every leg (6 elevators/station) vs the
  prior single-elevator models, so all 7 flipped to redundant; the two
  pavilions are step-free connected but only via a long, not-necessarily-
  pedestrian-safe crossing, disclosed but never counted as a backup (Bryce,
  2026-07-18). The NoMa B35 / Ballston K04 watch items: NoMa reconciled to
  WMATA's count (1 platform elevator, no longer redundant — closed);
  Ballston's Vienna-bound platform elevator is one of two real ids but Bryce
  doesn't know which, so it's modeled conservatively as requiring BOTH
  (over-warn) with a standing `internalNote` TODO to watch future alert
  wording — deliberately left OPEN, not guessed. Southern Ave F08's assumed
  pedestrian-bridge elevator was confirmed NOT real and dropped (its garage
  elevator is now its own auxiliary chain); Huntington C15's entrance
  elevator promoted to its real id, its inclinator confirmed to have no real
  id anywhere in WMATA's feed. C11 Potomac Yard was a real bug (WMATA groups
  Largo+MtVernon on ONE platform, Franconia-Springfield+Huntington on the
  OTHER — the model was missing the second platform's chain entirely;
  re-modeled as two SIDE platforms, not the single island platform first
  assumed, sharing one 6-elevator entrance bank — Bryce corrected this
  mid-session) + the trivial C06 Arlington Cemetery East/West→destination
  relabel. Every WMATA elevator now carries a real UnitName except the
  Huntington inclinator (confirmed none exists) and K04's deliberately-
  unresolved through-shaft ambiguity.
- **WMATA FINAL ACCURACY AUDIT (2026-07-20) — one real bug found + fixed.**
  A fresh independent cross-check of every production model against every
  ground-truth source (rider-tools inventory, observed-units, CIP), separate
  from `check:wmata`'s self-check, is committed as `scripts/wmata-final-audit.mts`
  (`npm run wmata:audit`). Result: 0 ghost ids, 0 under-warn gaps (all 253
  rider-tools elevators modeled), 1 expected synthetic (the Huntington
  inclinator) — and **one structural defect**: the 4 stacked-interchange
  curated models (Metro Center, Gallery Place, Fort Totten, L'Enfant Plaza)
  were keyed under the GTFS pathways generator's COMPOUND transfer-station id
  (`A01_C01`, `B01_F01`, `B06_E06`, `D03_F03`). But the live incidents feed
  reports every elevator under a real SINGLE code (`C01`, `B01`, `B06`,
  `F03`/`D03`) — so `stationModelsFor(...).get(i.StationCode)` returned
  nothing and these four busy interchanges' curated chains were **silently
  bypassed at attribution AND display** (outages attributed `unmodeled`,
  since 2026-07-17). Fix: re-keyed each to its canonical single feed code with
  `coveredStationExternalIds` listing both real codes (`["A01","C01"]`, etc.),
  and made the WMATA adapter resolve incidents via a covered-id-aware index
  (`wmataModelsByFeedCode`, so L'Enfant's `D03W04` under the non-canonical
  `D03` still finds its model). Regression locked in `check:wmata`
  ("Merged-interchange feed-code lookup"). **Rule for any future WMATA
  interchange model: use the real feed code(s), never the GTFS `X_Y` compound
  id** — that id only exists in the pathways generator's namespace
  (`chains-excluded.json`, `units.json`) and never appears in an incident.
- **WMATA STATION REVIEW COMPLETE (2026-07-17): 42/42, every excluded
  station individually resolved with Bryce.** GTFS undercounted or
  corrupted more than the observed-units gate alone could catch — several
  stations needed Bryce's direct knowledge or WMATA's own elevator-
  description text (pasted from its status page) to resolve: Potomac Yard
  and Rosslyn each had a GTFS-undercounted redundant BANK (3+ elevators
  drawn as 1-2); Downtown Largo, West Falls Church, and Innovation Center
  have a mezzanine reachable at STREET GRADE with no elevator at all on
  that leg (Innovation Center modeled via `stepFreeAlternative`, since a
  separate elevator-free bridge exists alongside real elevators); Fort
  Totten is a single elevator serving all 3 stacked levels; Metro Center,
  Gallery Place, and L'Enfant Plaza are stacked interchanges resolved from
  WMATA's own per-elevator text descriptions into 2-3 chains apiece,
  including down-and-back-up 3-elevator series routes; Huntington's
  "Garage #1" was MIS-EXCLUDED as auxiliary at first — it's actually a
  required entrance elevator, corrected mid-review (a reminder that a
  garage-sounding name doesn't mean parking-only, see the Millbrae
  precedent); Farragut North's corrupt-levels flag was confirmed genuine
  (the 2 GTFS edges don't reflect reality — real structure is a plain
  2-elevator series). Every station carries its confidence rating +
  evidence trail in `src/catalog/review/queue.json`; two internal
  (non-public) watch notes remain open (NoMa B35's elevator count,
  Ballston-MU K04's observed-id mapping) — each documented inline in
  `wmata-models.ts`'s `internalNote` for the affected station.
  **Infra fix from this pass**: `scripts/review-queue.mts`'s rebuild step
  used to regenerate each station's `evidence` array from source files on
  every run, silently discarding any hand-added entry (a real incident —
  every manually-recorded confirmation and elevator coordinate since Mt
  Vernon Sq was wiped by routine `npm run review:queue` calls before being
  caught and restored from the session log). Fixed: the merge step now
  carries forward any prior evidence entry the regenerated list doesn't
  already contain (grows-only, exact source+text dedupe) — hand-added
  evidence can no longer be lost to a rebuild.
- **WMATA Capital Improvement Program report — a second ground-truth source
  (2026-07-16, `src/catalog/wmata-data/cip-elevator-mentions.md`)**. WMATA's
  own quarterly CIP progress report (241-page budget/contract PDF, NOT a
  designed inventory) incidentally names real elevator equipment ids
  (`UnitName` format, e.g. `A14X01`) in its narrative project updates —
  found in the same BART/WMATA/MBTA-equivalent research pass as the BART
  guide above. **One promotion shipped**: West Hyattsville's opposite-
  direction elevator (previously synthetic `WMATA-E07_MZ_ELV_W`) —
  `E07X01`, confirmed real by the report, following the same station-code +
  X01/X02 pairing convention already confirmed at Rockville. **Two
  ambiguous non-promotions** (McPherson Sq `C02E01`, New Carrollton
  `D13X02`): both stations have multiple curated synthetic slots, and the
  report names only one id per station with no disambiguating detail —
  left unpromoted rather than guessing which slot; will resolve naturally
  on first live observation. **One redundancy candidate strengthened, not
  resolved**: Mount Vernon Sq (`E01`, already excluded/queued for
  `observed-undercount` — our own live feed already found 4 real units
  forming two identically-worded pairs, the same shape as confirmed-
  redundant Rockville/19th-St-BART/Warm-Springs-BART) — this report
  independently corroborates `E01X04` as a 3rd source, added as new
  evidence to the `wmata:E01` review-queue entry, but NOT modeled — WMATA's
  own text never uses BART's explicit "use the other elevator" backup
  language, so this redundancy claim needs the `/liftwatch-station-review`
  ritual, not a unilateral fix. Extraction technique (reusable for any
  agency capital/budget PDF): `curl -A "<browser UA>"` to download + Node
  `pdf-parse` for the text layer, then regex for the `[A-Z]\d{2}[EX]\d{2}`
  unit-id pattern near a station name.
- **CTA's FIRST curated tier (2026-07-15/16, `src/catalog/cta-models.ts`)**:
  CTA has no per-elevator inventory or topology feed at all (structural — see
  the identity-parsing note above), so before this pass every station sat at
  `assumed` redundancy regardless of real layout. 18 stations modeled in
  this first pass via
  /liftwatch-station-review: Cermak-McCormick Place (confirmed bookend
  redundant pair) and Diversey (confirmed per-direction pair) individually,
  then "Batch 2" — 15 stations batched by risk (9 single-elevator islands
  where the bare station id IS the real elevator's id since there's no OR to
  hide behind; 1 island elevator serving both directions, agency-confirmed;
  5 Diversey-pattern per-direction pairs) — and Bryn Mawr (below).
  **SYNTHETIC ids** (`CTA-SYNTH-<station>-<slot>`) for an elevator known to
  exist but never yet observed in an alert — same pattern as WMATA's
  `WMATA-<node>` slots, promoted to the real id the first time it's seen.
  **Vague-alert fail-safe**: a CTA alert with no parseable location falls
  back to the bare station id; at a REDUNDANT-pair station that bare id can
  never match either member, so the adapter flags `needsReview` and the
  generic build-site-data fail-safe forces the chain to UNKNOWN (closes a
  real gap — two simultaneous vague alerts at one station can merge into a
  single outage, so a scenario where BOTH elevators of a pair break but only
  one vague alert fires must never silently read as accessible). **Caught and
  fixed a same-day bug**: the first cut of this check fired on ANY vague
  alert at ANY modeled station without checking whether the resulting id
  actually failed to match — false-flagging every ordinary outage at the 9
  single-elevator stations (their bare id is deliberately their real
  elevator's id) and sending 3 unnecessary "needs review" pushes (Loyola,
  87th, Central Park) before being fixed to check actual model-elevator
  membership.
  **Bryn Mawr (41380)** is the first CTA station modeled entirely from
  external research with ZERO live signal, ahead of any outage: Bryce asked
  whether CTA's Red-Purple Modernization rebuilt any stations with redundant
  elevator pairs. Of the 4 RPM Phase One stations (Lawrence, Argyle, Berwyn,
  Bryn Mawr, reopened 2025-07-20), only Bryn Mawr got one — a new Hollywood
  Ave entrance got its own elevator, separate from the main entrance's, both
  reaching the same single island platform (Lawrence/Argyle/Berwyn each also
  have an auxiliary exit, confirmed stairs-only at all three). Both ids are
  synthetic since neither elevator has ever broken since the station reopened;
  manually added to the review queue since the queue only surfaces stations
  that have appeared in the live feed.
  **6 more single-elevator stations shipped 2026-07-16** from prior-session
  research (Racine, Pulaski-Pink 40150 [distinct from per-direction Pulaski-
  Green 40030], 69th, 47th-Red 41230 [distinct from per-direction 47th-Green
  41080], Argyle) plus **Wilson (40540) CORRECTED**: the prior research's
  "no backup" call missed that the Sunnyside Ave entrance has TWO ADA ramps
  (one straight to each island platform, no mezzanine, confirmed by Bryce) —
  each direction is actually REDUNDANT (elevator OR ramp), encoded via
  `segment.stepFreeAlternative`; verified live, the station now reads
  ACCESSIBLE during a real southbound-elevator outage instead of a false
  INACCESSIBLE. Exactly the case the standing ramp-research rule exists to
  catch. **CTA-site audit (2026-07-16)**: cross-checked all 24 then-modeled
  stations against CTA's own project/station pages (transitchicago.com — 403s
  WebFetch, use the in-app browser) — 23/24 confirmed correct, **Morgan
  (41510) was a real mismodel**: built as ONE elevator "serving both
  directions," but CTA's page + chicago-L.org + Wikipedia agree it's actually
  TWO SIDE PLATFORMS with one elevator each, linked by a transfer-ONLY bridge
  (no step-free cross-platform backup) — re-modeled as a per-direction pair.
  **Batch 4 (2026-07-16)**: 7 more zero-redundancy stations — 4 Diversey-
  pattern per-direction pairs (Addison, Montrose, Pulaski-Green, Southport)
  + 2 series chains (Jackson-Blue 40070, Cicero) + 1 shared-prerequisite shape
  (Grand, WMATA-E01 pattern: one street→mezz elevator feeding per-direction
  mezz→platform legs). **95th/Dan Ryan (40450)**: rebuilt 2014-19 with two
  street-grade terminal buildings sharing one island platform via a platform-
  level walkway — REDUNDANT pair (South Terminal elevator agency-named in a
  live alert, North Terminal elevator from CTA's own /95thterminal/ page).
  **Jackson-Red (40560)**: island platform with a full elevator pair at EACH
  of its two mezzanines (Adams-Jackson + Jackson-Van Buren) — a REDUNDANT PAIR
  OF 2-IN-SERIES CHAINS, resolved via the CTA ADA Settlement-Agreement lead
  Bryce found (independent monitor quarterly reports, 2001-2006) plus a real
  CTA alert naming the Van Buren platform elevator + chicago-L.org + Bryce's
  confirmation of both street→mezz elevators; encoded as a 4-clause CNF
  (Stamford paired-segment pattern), verified with an 11-case accessibility
  test. **New research sources locked in**: **transit.wiki** (fallback only —
  open-sourced/community-editable, corroboration-tier like chicago-L.org, never
  ground truth) and **CTA's ASAP Strategic Plan** (`transitchicago.com/assets/
  1/6/ASAP_Strategic_Plan_508_FINAL.pdf`, 48MB — WebFetch's 10MB cap and its
  built-in extractor both fail on it; `curl -A "<browser UA>"` to download +
  Node `pdf-parse` to read the 508 text layer works). Its Tables 14/15
  ("Elevator Replacement Program") are an authoritative per-station elevator
  COUNT list (not topology), snapshotted to
  `src/catalog/cta-data/asap-elevator-counts.md` — cross-checked against every
  count-covered modeled station (7/7 match, 0 mismatches) and used to
  corroborate the Jackson-Red/Grand/Western models. CTA now 39/46 reviewed
  (as of 2026-07-17 — Roosevelt's Discord-sourced 2-chain model + follow-up
  4th-elevator correction, the transfer-bridge/rotogate batch, and more; 7
  pending, all interchange complexes — see HANDOFF.md).
- **TfL multi-chain models are GENERATED from graph topology, not hand-typed**
  (2026-07-08). Unlike MTA, TfL has no line-served field — only `FromAreas`/
  `ToAreas` area codes. `npm run tfl:chains` (`scripts/tfl-chains.mjs`) treats
  area codes as graph nodes and lifts as edges; connected components (shared
  nodes) reveal when a station has independent routes (e.g. Willesden
  Junction's Bakerloo lift and its National Rail lift share zero nodes — a
  real two-route split, verified against the live disruption text). Output →
  `src/catalog/tfl-data/chains.json`, loaded by `station-models.ts`.
  **Deliberately conservative**: only single edges, single redundant groups,
  or clean two-endpoint paths get modeled; a branching hub node or a
  multi-destination edge in a multi-edge route is EXCLUDED (never guessed) to
  `chains-excluded.json`. No line names are ever decoded from the area-code
  abbreviations — genuinely ambiguous (`NTH` could mean "Northern line" or
  "North Ticket Hall") — multi-route labels are neutral ordinals ("(Route
  1)", "(Route 2)") only. **Self-check** (`npm run check:tfl-chains`): every
  modeled elevator's chain-derived redundancy must equal its own `isRedundant`
  flag from `lifts.json` — simpler than MTA's aggregate check since excluded
  topology means no elevator here spans more than one chain. **Purely
  additive to the site display layer** — feeds `build-data.ts`'s
  station-access/blackout/streak/SPOF boards only; does NOT touch the TfL
  adapter or `ingest.ts`, so archived per-unit redundancy stays exactly as
  `tfl-import.mjs` computes it (`pathways` source), unchanged. A multi-level
  lift's `IntermediateAreas` landing counts as a real connectivity node too
  (missed in the first pass — caught by cross-checking live TfL alerts, below
  — King's Cross's Lift-B was wrongly modeled as isolated when it's actually
  linked to Lift-A/C/D through a shared landing). Result as of 2026-07-08:
  151 chains across 132 of 201 lift-equipped stations; after the 2026-07-14
  ramp/same-level wiring (see the TfL gotcha below), currently 209 chains
  across 132 stations with 71 stations (74 components) excluded — counts
  drift with the daily model refresh. The excluded stations (all
  recognizable major interchanges — Bank, King's Cross, Stratford, Tottenham
  Court Road, Victoria, Waterloo, and more) await the /liftwatch-station-review
  walkthrough (71 pending, none started), same precedent as MTA's 9
  hand-authored interchanges (see SPEC.md's TfL section for the full writeup).
- **TfL alert-evidence enrichment, progressive by design** (2026-07-08,
  `npm run tfl:alert-evidence` → `src/site/tfl-alert-evidence.ts`): mines
  TfL's own outage alert text — already archived verbatim in
  `outage_events.reason` every poll — for confirmed step-free alternatives
  (a ramp, a different entrance) our lift-only topology graph can't see.
  Per Bryce's instruction, TfL's own words are ground truth: a confirmed
  mention marks the segment `stepFreeAlternative` + records it in the
  chain's `note`, tracked as a documented `evidenceExceptions` entry (mirrors
  MTA's `REDUNDANCY_EXCEPTIONS`). Deliberately asymmetric: a confirmed
  mention only ever ADDS a bypass (safe to auto-apply); absence of a mention
  is never treated as proof of non-redundancy, only informational. For an
  excluded (unmodeled) station, any evidence found attaches as an
  `evidenceHints` entry in `chains-excluded.json` — a head start for the
  eventual human review, not a resolution. Re-running after more polls
  absorbs more evidence automatically — no per-outage manual audit needed.
- **BART elevators now carry REAL asset ids from the ADA settlement (2026-07-20).**
  Found the BART analog to MBTA's Daniels-Finegold / CTA's ADA settlement:
  *Senior and Disability Action v. BART*, 3:17-cv-01876 (N.D. Cal.), final
  approval 2024-04-18. Its **Exhibit F** (per-elevator Strategic Maintenance
  schedule) is a genuine per-elevator inventory with BART's OWN real asset ids
  (`M16-63`, `W40-116`, …, prefix = station asset code) + a function/position
  suffix (`HYD-S` street / `HYD-P*` platform / `HYD-SP` single-shaft / `TRA-G`
  garage / `HYD-AMTRAK` out-of-scope) — the identity source BART's station-level
  live feed never gave us. Extract: `curl -A "<UA>"` the PDF (dralegal.org host)
  + `pdftotext -layout`. Committed as `bart-data/settlement-elevator-inventory.json`
  + `bart-data/bart-ada-settlement.md`. A **3-way reconciliation** (models vs
  settlement vs our live `/accessible` scrape) CONFIRMED every model's structure
  (BART's live page settled the two apparent conflicts, 19th + Coliseum, in the
  model's favor) and resolved prior unknowns (19th's 3rd elevator `K20-163`,
  Warm Springs' 5th `S20-162` = the WAB bridge, Richmond's `R60-58` = the
  Amtrak connector (in scope as a Richmond auxiliary chain to the Amtrak
  platform, not part of the BART platform chain), San Bruno's extras = garage). **All 87 real
  ids adopted as elevator `externalId`s** (replacing invented ids like
  `MLBR-PLAT-3`); 10 stay descriptive where the settlement has no clean match
  (garages, Millbrae Caltrain/plaza access, a tunnel/arena bridge — documented
  in the model header). CAVEATS: asset ids ≠ live-feed ids (attribution stays
  matchHints-based; ids are for identity + validation); id↔side is inferential
  for same-function pairs; verify built-vs-current vs BART's live pages.
  **New `check:bart`** (`src/checks/bart-check.ts`) is BART's first self-check
  AND independent audit (reconciles every real id vs the settlement inventory +
  attribution crosswalk + hygiene) — closes the playbook Part V gap that BART
  previously had neither.
- **ALL 50 BART stations are now curated** (2026-07-08, up from the original
  7 — `src/catalog/bart-station-models.ts`, 43 more stations, wired into
  `station-models.ts`'s STATION_MODELS array). BART has no per-elevator LIVE feed
  at all (unlike TfL/MTA), so a topology-graph or line-served-field approach
  was never possible — instead this uses a REAL, BART-published per-elevator
  signal: bart.gov's own "Elevator Outage Options" page
  (`bart.gov/stations/<code>/accessible`) states, for every elevator, what a
  rider should do if it's out — directly revealing whether an in-station
  backup exists or only a cross-station-only fallback ("continue on BART to
  X and return"), which is treated as NOT redundant (a rider already headed
  there is functionally stranded even though a paired elevator exists
  elsewhere) — the same never-claim-redundancy-without-a-real-signal rule as
  everywhere else in this project. `bart.gov` blocks WebFetch (403, a bot
  WAF) but a plain `fetch()` with a spoofed browser User-Agent works fine.
  4 stations (EMBR/MONT/POWL/CIVC — the BART/Muni shared Market St.
  stations) were cross-validated against TransitAccess
  (`C:\Users\Bryce\Claude\metro-access`)'s independent Muni field survey —
  both sources agree exactly. **Two real structural bugs in the ORIGINAL 7
  stations were found and fixed against this same source**: WDUB was wrongly
  modeled as 2+2 redundant pairs — the real structure is 1 shared, non-
  redundant platform elevator (a bottleneck for BOTH garage sides, same
  "shared prerequisite" pattern as MTA's bridge elevators) plus 4 garage
  elevators split into 2 SEPARATE non-cross-redundant pairs (BART's own text:
  "the ALTERNATE parking garage elevator", singular, same-side sibling only);
  WARM was missing a 5th pedestrian-bridge elevator entirely (added as its
  own chain). SFIA/ASHB needed only label/note enrichment (their existing
  structure was already correct). Many of the 43 new stations use
  independent PER-DIRECTION chains (chainLabel, same pattern as MTA's 161 St)
  since BART's "opposite platform" elevator pairs usually require riding to
  a different station and back to reach the other one — not a real backup.
  Verified via `npm run poll:bart:dry`: 95 elevators, all 50 stations
  modeled across 66 chains, 0 structural errors. `demo:access` extended with
  new regression coverage for the corrected/new patterns.
- **BART live-outage ATTRIBUTION** — see SPEC.md's BART "Attribution" section
  for the full writeup. BART's live advisory has no per-elevator ID anywhere
  (checked 3 official sources), so a bare "Station" advisory can't be
  auto-attributed by text-matching — structural. **The bare-"Station" case is
  now DIRECTED BY POLICY (Bryce, 2026-07-12): "a bare station-elevator
  advisory means the platform elevator, unless I say otherwise."**
  `platformDefaultElevator()` (`accessibility.ts`) defaults to the elevator in
  each chain's LAST (platform-terminus) segment, but ONLY when the station has
  exactly ONE — a per-direction station has several, so it declines and stays
  `-UNSPECIFIED` (never guesses which platform). This resolved the live
  RICH/POWL/COLS "unspecified" complaints (all now R60-51/M30-55/A30-3,
  verified `poll:bart:dry`), and let the **Richmond attribution-override be
  REMOVED** (`ATTRIBUTION_OVERRIDES` is now empty; the mechanism stays for a
  future human-confirmed elevator neither hints nor the default can reach).
  Regressions in `demo:access`. `matchHints` for the 12 per-direction
  stations: only Milpitas, Hayward, and 12th St.'s "convention center" hint
  are CONFIRMED against a real live advisory; the other 10 are unverified
  guesses at BART's phrasing (built from the outage-options page wording,
  which for Milpitas turned out NOT to match the live feed). **A progressive
  evidence-
  mining tool now exists** (`npm run bart:attribution-evidence`,
  `src/site/bart-attribution-evidence.ts`, built 2026-07-09) — re-derives
  attribution fresh from archived `reason` text against TODAY's matchHints
  every run (not the stale `unit_id` from original ingest), surfacing
  confirmed matches, ambiguous raw text worth reviewing, and a `pureSpof`
  finding (single-elevator SPOF stations — note the platform default now gives
  these attribution credit on a bare "Station" advisory; the COLS
  auxiliary-elevator caveat is documented in SPEC.md as an accepted residual).
  The remaining OPEN part is the 10 unconfirmed per-direction `matchHints` —
  see `/liftwatch-bart-attribution` for the resume-work command.
  **Millbrae resolved from a real advisory (2026-07-16)**: MLBR's live
  `"Station - SF/East Bay/SFO Airport"` (a terminus → only the outbound platform
  direction exists) was in the `structuralUnsolvable` bucket and pushing a
  recurring needs-review alert; now attributed to `W40-109` via
  `"east bay"`/`"sfo airport"` hints on the Platform 3 elevator (BART's only
  platform elevator there; the Caltrain NB elevator is its named backup, so the
  redundant station stays accessible). Mirrors the confirmed Milpitas pattern;
  locked in `demo:access`.
- **MBTA Daniels-Finegold ADA settlement — ground truth (2026-07-17,
  `src/catalog/mbta-data/daniels-finegold-settlement.md`).** The MBTA analog to
  CTA's ADA settlement (*Daniels-Finegold v. MBTA*, D. Mass. 1:02-cv-11504,
  2006 + 2018 amendment). Commits the MBTA to specific new/redundant +
  replacement elevators at named stations **with real facility IDs matching our
  feed** (State's `802`, Central `861`, Park St `804`/`808`, Harvard `821`,
  Porter `818`/`820`). The 2018 amendment gives the authoritative Red↔Orange
  elevator topology at **Downtown Crossing** (the four OL/RL connections) and
  flags **Oak Grove** in its ¶59 review group — resolving 3 of the 6 MBTA
  anomaly holdouts. CAUTION: it's a legal/planning doc, not a live inventory —
  some "redundant" elevators are still in design (e.g. State), so always verify
  built-vs-planned against the live feed before modeling. Extract via
  `curl -A "<UA>"` + `pdftotext -layout` (PDFs at cdn.mbta.com, linked from
  mbta.com/accessibility/history). Corrects the earlier "MBTA came up empty"
  note — that was the inventory-style search; this is a settlement.
- **BART elevator dimensions guide — ground truth, fact-checked (2026-07-16,
  `src/catalog/bart-data/elevator-dimensions-guide.md`).** BART's own "Bikes
  on BART" elevator dimensions guide (2022) is a genuine per-elevator
  inventory with landing descriptions for every station — found while
  searching for a BART/WMATA/MBTA equivalent to CTA's ASAP plan and MTA's
  data.ny.gov inventory. **6 stations individually verified against BART's
  live `bart.gov/stations/<code>/accessible` pages** (JS-rendered — use the
  in-app Browser pane, not WebFetch/curl) where the guide appeared to
  disagree with our curated model: Colma (duplicate PDF row, not a 2nd
  elevator), Richmond (the guide's 4th row is a separate Amtrak-only
  connector outside BART's scope), 19th St. and Milpitas (the guide
  collapses same-dimension elevator pairs into one row), Millbrae (the
  guide's extra "Platform 1-2" row doesn't exist in BART's CURRENT text —
  likely stale, predating a platform reconfiguration), Warm Springs
  (word-for-word match). **Every discrepancy resolved in our favor — no
  model changes needed.** Enrichment pass (comparing every curated label
  against the guide's landing descriptions) found minimal opportunity: our
  labels, sourced from BART's own richer per-station outage-options text,
  are already more specific than this guide's terse table phrasing. Its
  real value was fact-checking, not new-bug detection (contrast CTA's ASAP
  plan / Morgan, or MTA's data.ny.gov) — and it incidentally corroborates
  all 16 single-elevator "Station elevator" BART stations by row count.
- **MTA enrichment from data.ny.gov, four pieces (2026-07-16).** Bryce found
  `data.ny.gov/resource/94fv-bak7.json` ("MTA Elevators and Escalators") — an
  official per-equipment inventory RICHER than the live `nyct_ene` feed our
  models derive from: `redundant_elevator` (+/−) with named backup elevators,
  `elevator_direction_serviced`, per-level access flags, `alternative_route`
  (rider-facing reroute text), and `notes` (MTA's own elevator description).
  `npm run mta:ny-inventory` snapshots it (475 elevators,
  `src/catalog/mta-data/ny-elevator-inventory.json`).
  1. **Ground-truth cross-check** (`npm run check:mta-ny`): every modeled
     elevator must exist in the NY inventory with matching ADA + redundancy —
     121/121 clean, 0 mismatches. CRITICAL nuance documented in
     `scripts/mta-ny-inventory.mts`: `redundant_elevator` is STRICTER than our
     segment-level redundancy (it means "one elevator fully replaces this
     unit's WHOLE journey") — 14 St-6 Av EL609/EL610 read `-` there yet each
     one's `alternative_route` names the OTHER as its L-platform backup,
     CORROBORATING our hand-authored `REDUNDANCY_EXCEPTIONS` override, not
     contradicting it. Never diff the raw boolean without this nuance.
  2. **Rider-facing reroutes**: `alternative_route` (421/475 elevators) is
     shown verbatim on both site pages as "MTA reroute (if this elevator is
     out)" whenever that specific elevator is out — MTA's own official
     wayfinding (cross to another entrance, use a named backup, ride to the
     next accessible station and return). Wired in `build-site-data.ts`
     (`mtaReroute` map, keyed by equipment code = our external ids) +
     `system.html`/`index.html` detail strips.
  3. **`preferMtaNote()`**: the displayed elevator description now prefers
     MTA's own `notes` text over our feed-derived one when it's equivalent or
     richer (e.g. "Street to mezzanine" → "179 Pl & Hillside Ave (SE corner)
     to mezzanine for Manhattan-bound service"); a `MTA_NOTE_JUNK` regex keeps
     our own text when MTA's is a data-quality artifact (internal "UNLINK...
     WITHDRAW...duplicate" bookkeeping, seen on EL132) or dramatically terser.
  4. **MTA's own display guidance saved + implemented**: Bryce uploaded MTA's
     developer page ("Displaying NYCT station accessibility and elevator &
     escalator status", mta.info/developers/display-elevators-NYCT — 403s
     WebFetch, extract from a saved `.mht`) to
     `src/catalog/mta-data/MTA-DISPLAY-GUIDE.md` with a compliance checklist.
     Its #1 ask — **station-level ADA accessibility (0=not/1=fully/2=partially
     accessible, by LINE and DIRECTION)** — is a DIFFERENT question from live
     outages (design-time, not today's elevator status). Built via
     `npm run mta:station-ada` → `src/catalog/mta-data/mta-station-ada.json`:
     joins data.ny.gov's `4ta5-wz5s` ("Station Complexes" — MTA's own AUTHORED
     rollup text at the ~32 true multi-line interchanges, e.g. "N Q R W
     accessible; L accessible; 4 5 6 not accessible") with `39hk-dx4f`
     ("Stations", per-line rows covering all 445 complexes, used to SYNTHESIZE
     an equally specific per-line-and-direction sentence for the ~413 single-
     line stations the complexes dataset omits). Join key = `complex_id`,
     which equals our `stationExternalId` (MTA's own `stationcomplexid`) —
     no fuzzy matching. **Bryce's explicit instruction: never show a bare
     "partially accessible" — always name which lines, which directions.**
     `npm run check:mta-ada` locks this in as an assertion (452 checks): every
     non-fully-accessible entry MUST carry a real explanation, every fully-
     accessible entry stays quiet. New "Station accessibility" board on
     `system.html` (originally MTA-only, later shared with LIRR/MNR — see the
     rail station-ADA bullet below; hidden for systems with no such data, same
     pattern as `otherEquipment`), restricted to complexes our archive tracks
     elevators at; explanation shown directly in the row, never behind an
     expand toggle. Verified against real production data (21 stations),
     including a nice validation of the underlying data: Clark St correctly
     reads NOT ACCESSIBLE despite having an elevator — it only reaches the
     mezzanine, matching MTA's own documented example of a non-step-free
     pathway.
- **LIRR + Metro-North station-ADA board — the railroads' first station-ADA
  source (2026-07-22).** The two thinnest systems now carry the SAME design-time
  "Station accessibility" board the subway has, from MTA's own
  `data.ny.gov/resource/wxmd-5cpm.json` ("MTA Rail Stations" — one row per
  station with `accessibility` = FULL/PARTIAL/NONE). `npm run rail:station-ada`
  (`scripts/rail-station-ada.mts`) snapshots it to
  `src/catalog/mta-rail-data/station-ada.json` (FULL/PARTIAL/NONE → ada 1/2/0,
  the SAME scheme + render path + `stationAccessibility` payload field as the
  subway board — so the `system.html` board is now shared, its header wording
  generalized off "MTA/line/direction"). Join key = `code`, which equals our rail
  `stationExternalId` CLEANLY for BOTH railroads (verified 0 missing — the source
  audit's "MNR needs a crosswalk" worry was wrong). **Different scoping from the
  subway board, deliberate + documented in build-site-data**: the subway restricts
  to tracked complexes (a partial subway complex still HAS a tracked elevator), but
  a rail station is FULL (has an elevator → tracked) or PARTIAL/NONE precisely
  because it has NO elevator (ramp-only/stairs) — so restricting empties the board
  (0 of ~99 tracked rail stations is partial/none). Rail therefore lists EVERY
  partial/none station (8 LIRR + 33 MNR). **PARTIAL enrichment**: `wxmd-5cpm` has no
  per-direction ADA field, so the 18 PARTIAL stations get MTA's OWN per-station text
  from `src/catalog/mta-rail-data/mta-ada-details.json` — the `field-ada-information`
  field scraped from each `mta.info/stations/<slug>` page via the in-app Browser
  pane (same-origin `fetch()` in the page context; mta.info's WAF 403s
  curl/WebFetch/Node, so this is a COMMITTED manual snapshot, not auto-refreshed).
  MTA's text reveals the consistent meaning: each platform is ramp-accessible but
  there's no accessible path BETWEEN them (drop off on the correct side), and it
  names the nearest fully-accessible stations. NONE stations keep a generic
  sentence. `npm run check:rail-station-ada` (267 checks) locks the enrichment +
  the "never a bare status word" guarantee. See `SOURCE-AUDIT.md` for the source
  hunt that surfaced wxmd-5cpm.

