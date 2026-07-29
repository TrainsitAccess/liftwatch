# CLAUDE.md — LiftWatch

Working notes for this codebase. **`SPEC.md` is the source of truth for design and
decisions**; this file is the operational summary + conventions + gotchas.

**Before adding, modeling, or auditing ANY system, read `MODELING-PLAYBOOK.md`**
(repo root) — the system-agnostic distillation of everything the nine systems
(esp. the full DC Metro arc) taught us: how feeds/systems work, how stations &
elevators work, how models encode it, and the processing/review/audit workflows.
Per-system field guides (e.g. `wmata-data/WMATA-STATION-GUIDE.md`) specialize it.
Per-system modeling detail (how each system's models were built, its ground-truth
sources, audits, and traps) lives in the **`liftwatch-system-models` skill**
(`.claude/skills/liftwatch-system-models/SKILL.md`) — load it before touching any
system's chains.

## What this is

Monitors public-transit **elevator** outages worldwide, archives them over time,
and ranks systems/stations/elevators on departure-board-style leaderboards. The archive (an
event history nobody else keeps) is the whole point — every metric derives from it.

Status: **live in production.** Nine systems have adapters (MTA subway, BART,
MBTA, WMATA, TfL — first non-North-America system, CTA, TMB Barcelona — first
non-English-speaking system, LIRR + Metro-North — first commuter railroads,
sharing one adapter); **eight are visible** — TMB is `hidden` pending a
data-quality review of its feeds (see below), so the live site shows 8. Polled
every **5 min** by a **Netlify scheduled function** (`netlify/functions/
poll.mts`) that runs every system through the shared `pollSystem()`
core in parallel, then rebuilds the site's data payloads into **Netlify Blobs** (served at
/data.json + /systems/*.json by `netlify/functions/data.mts`) — fresh data
reaches the live site every poll with ZERO rebuilds/redeploys; deploys happen
only on push. Migrated off GitHub Actions cron because GitHub silently stopped
firing the schedule for 30+ min stretches (confirmed live 2026-07-09: BART's
Coliseum outage sat unarchived past its 10-min slot with no error, just a gap
in `gh run list`). The old `.github/workflows/poll.yml` was kept as a
redundant fallback through the transition and **removed 2026-07-17** once
Netlify's schedule had proven reliable for a week — Netlify is now the sole
poller. Backed up weekly to a private repo (`backup.yml`), with a
keepalive workflow so the backup cron never auto-disables. The site is styled
as a digital train-departure display
(`site/`) — amber LED boards with reasons, expected returns, live
station-access status, scheduled work, an OFFLINE column, and expandable route
notes; times shown agency-local; info column is a right-to-left marquee;
semantic tables (the accessible layer is the markup itself, no separate
#sr-data). Repo: github.com/TrainsitAccess/liftwatch (public).

- **`SystemCatalogEntry.hidden`** withholds a system from the ENTIRE site
  (board, per-system pages, longest-outages, aggregate totals) without
  deleting its adapter/catalog/checks/archive, and it stops being polled
  (the Netlify poller filters `hidden` systems out of `knownSystemIds()`).
  Reversible with a single `hidden: false` — no other change needed. TMB is
  currently hidden — its undocumented alerts feed is
  sparse, and the richer `itransit/metro/ascensors` feed we found reports
  statuses that contradict reality (274 "KO" vs 1 actually out of service —
  a classic don't-trust-an-unverified-feed-field trap; see SPEC.md).

## Running it

Node LTS is installed but **not on PATH in non-interactive shells** — prepend it:

```powershell
$env:Path = "C:\Program Files\nodejs;$env:Path"
```

```bash
npm install
npm run poll:dry         # MTA, fetch + normalize, no DB
npm run poll:bart:dry    # BART, MBTA, WMATA, TfL, CTA, TMB, LIRR, MNR have :dry variants too
npm run demo:access      # prove the chain-aware accessibility model (69 checks)
npm run check:tfl        # prove TfL's topology-derived redundancy (10 checks)
npm run check:tmb        # prove TMB's elevator catalog integrity (7 checks)
npm run check:mta        # prove MTA's per-station models vs feed flags (offline, full coverage)
npm run mta:audit        # INDEPENDENT MTA audit: models + fleet vs data.ny.gov + tsdataclinic topology (offline)
npm run check:rail       # prove the LIRR/MNR mapper + curated models (offline fixture)
npm run rail:chains      # regenerate LIRR/MNR simple-station chains (ground-truth-gated)
npm run check:rail-chains # prove the rail chain generator vs the 18 hand models (offline, 60 checks)
npm run mta:chains       # regenerate MTA multi-chain models from the live feed
npm run mbta:chains      # regenerate MBTA simple-station chains (validated vs MBTA's own guidance)
npm run check:mbta-chains # prove the MBTA chain generator offline (full-feed fixture)
npm run check:wmata       # prove the WMATA pathways chains + attribution crosswalk (offline)
npm run check:bart        # reconcile BART models vs the ADA-settlement real-id inventory + attribution (offline)
npm run bart:audit        # INDEPENDENT BART audit: models vs settlement (coverage/func/replacedBy) + dimensions guide (offline)
npm run wmata:observed    # refresh observed-units.json (archive + live feed; grows only)
npm run check:cta         # prove the CTA text-identity parser vs the observed corpus (offline)
npm run cta:observed      # refresh CTA observed-units.json (archive + live alert texts; grows only)
npm run mta:ny-inventory  # refresh the data.ny.gov MTA elevator ground-truth snapshot (475 elevators)
npm run check:mta-ny      # cross-check every modeled MTA elevator vs the data.ny.gov inventory (offline)
npm run mta:station-ada   # refresh MTA's own station-level ADA accessibility crosswalk (445 complexes)
npm run check:mta-ada     # prove every partial/inaccessible MTA station carries a real explanation (offline)
npm run rail:station-ada  # refresh the LIRR/MNR station-ADA board data (data.ny.gov wxmd-5cpm)
npm run check:rail-station-ada # prove every partial/none LIRR/MNR station carries an explanation (offline)
npm run review:status     # station-review walkthrough tracker (103/214 as of 2026-07-17)
npm run review:queue      # rebuild the review queue (verdicts + hand-added evidence persist)
npm run typecheck        # tsc --noEmit — run after edits
npm run db:status        # row counts + latest poll_runs, once Supabase is set up
npm run site:data && npm run site:serve  # rebuild + preview the departure-board site
# With SUPABASE_URL + SUPABASE_SERVICE_KEY in .env, drop `:dry` to archive for real.
```

No `SUPABASE_*` env → always dry-run (fetch + normalize, no writes). Credentials
(Supabase, MBTA_API_KEY, WMATA_API_KEY, TMB_APP_ID/TMB_APP_KEY) live in
gitignored `.env` locally and as **Netlify environment variables** for the
scheduled poll + site build — never in chat, never committed. (The GitHub
Actions secrets that fed the old `poll.yml` fallback are now unused — the
`model-refresh.yml` / `backup.yml` workflows still need `NTFY_TOPIC` and the
Supabase secrets respectively.)

## Deployment (Netlify)

Hosting + the 5-min poll cron both live on Netlify now (site
`liftwatch`, linked to `main`, auto-deploys on push):

- **`netlify.toml`** — build command `npm run site:data` (bakes a
  `site/data.json` snapshot at push time — shadowed in production by the data
  function below; kept for local preview parity), publish dir `site`,
  functions dir `netlify/functions`, `NODE_VERSION=22` (supabase-js needs
  native WebSocket, same constraint the old poll.yml ran under).
- **`netlify/functions/poll.mts`** — the scheduled poller
  (`schedule: "*/5 * * * *"`). A **REGULAR** synchronous function —
  **scheduled functions must not be background functions**: the first
  version was named `poll-background.mts`, and the `-background` name
  suffix forces background invocation mode, which Netlify's scheduler
  SILENTLY never fires (the schedule registers in the deploy log and
  manifest, but zero invocations ever happen; a manual POST returns 202
  "accepted" yet never executes either). Regular functions cap at 30s, so
  the 8 per-system polls run in PARALLEL (`Promise.allSettled` — wall-clock
  = slowest single feed; one failing feed doesn't stop the rest, the same
  isolation the old poll.yml got from its per-step `if: !cancelled()`), then the site data payloads are
  rebuilt via `buildSiteData()` and written to the **`site-data` Netlify
  Blobs store**. NO build hook / redeploy per poll — at a 5-min cadence
  that would be ~288 builds/day (~9x the free tier's 300 build-min/month)
  just to swap a 17 KB JSON file.
- **`netlify/functions/data.mts`** — serves `/data.json` and
  `/systems/{id}.json` straight from the `site-data` blobs (custom-path
  functions shadow same-path static files by default), 60s shared cache. The
  deploy-baked static JSON stays the LOCAL preview data source (site:serve
  has no functions). Blobs persist across deploys; only a brand-new/wiped
  store 503s until the first poll (~5 min).
- **`src/pollSystem.ts`** / **`src/site/build-site-data.ts`** — the archiving
  core and the site-payload builder, each extracted so the CLI
  (`src/poll.ts`, `src/site/build-data.ts`) and the Netlify functions share
  ONE code path apiece. Keep archiving/payload logic there, not in callers.
- **Freshness UI**: both pages show "Data updated N min ago" derived from
  `generatedAt` (re-rendered every 30s) and re-fetch their JSON every 2.5 min,
  reloading only when `generatedAt` actually changed.
- **Env vars on Netlify** (set in the UI, not committed — the MCP/API
  route silently fails to persist for this account, same as Lighter Than
  Air): `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `WMATA_API_KEY`,
  `MBTA_API_KEY`, and `NTFY_TOPIC` (the unidentified-outage push target;
  optional `NTFY_URL` defaults to https://ntfy.sh — without `NTFY_TOPIC` the
  push is a silent no-op). TMB keys omitted (hidden, not polled).
  `NETLIFY_BUILD_HOOK_URL` is OBSOLETE (build-hook design replaced by blobs
  before ever shipping) — the env var and the build hook itself can be
  deleted in the UI.
- **Bundling gotcha**: the `.mts` function is a v2 function, bundled by `nft`
  (node-file-trace), which traces the whole `src/` graph and resolves the
  `.js`-specifier NodeNext imports to their `.ts` sources — the `node_bundler
  = "esbuild"` line in netlify.toml only applies to v1 functions and is
  effectively ignored here. `npm run typecheck`'s tsconfig `include` is
  `["src"]`, so it does NOT cover `netlify/`; verify the function bundles with
  `npx netlify functions:build --src netlify/functions --functions <tmp>`
  (checks the whole import graph resolves) after touching it.

## Architecture

```
adapter.fetch() ──► NormalizedRead ──► ingest() ──► Supabase (events, not snapshots)
  (per system)      (units+outages)    (open/close outage events, resolve redundancy)
```

- **Adapters** (`src/adapters/*`) map an agency feed into `NormalizedRead`
  (`src/types.ts`). Nothing downstream knows which agency it came from — this seam
  is what lets us add systems by config. Bind a system → adapter in
  `src/adapters/registry.ts`.
- **Ingest** (`src/ingest.ts`) derives outage **events**: opens one when a unit goes
  out, closes it when it returns. Store events, never raw snapshots (keeps Supabase
  free-tier viable for years). Records `poll_runs` for adapter health.
- **Schema** (`db/schema.sql`) — apply in the Supabase SQL editor.

### Adding a system
1. Add a `SystemCatalogEntry` in `src/catalog/systems.ts`.
2. Bind it in `src/adapters/registry.ts`.
3. Implement an adapter whose `fetch()` returns a `NormalizedRead`.

## Redundancy + accessibility model (important)

Step-free access is a chain of **segments** (street→concourse→platform). A segment
is up if any of its elevators works OR a non-elevator step-free path exists (ramp,
parking lot). A station is accessible only if **every** segment is up.
(`src/lib/accessibility.ts` — pure, tested via `demo:access`.)

- Curated station structure lives in `src/catalog/station-models.ts` (source of
  truth). The simple redundant/not flag is **derived** from it (a station is
  redundant iff no single elevator outage severs access) — never hand-typed. The
  adapter expands modeled stations into per-elevator units carrying that curated
  redundancy.
- `src/catalog/redundancy-overrides.ts` is a slim MANUAL escape hatch only (quick
  boolean calls for units without a station model). The dry-run poll warns about
  override ids that match no live unit.
- **Precedence** (ingest resolves + never clobbers higher):
  `curated > explicit > pathways > serving_text > single_elevator > assumed`.
  Curated-vs-curated: incoming curated wins, so **editing your curation
  propagates**; only non-curated feed signals are blocked (they flag instead).
- **Baseline** (`systems.redundancyBaseline`): `confirmed-none` means a fully-curated
  system treats un-modeled stations as *confirmed* non-redundant. BART uses this,
  though as of 2026-07-08 all 50 stations are individually modeled anyway (see
  below) — the baseline is now just a safety net for a future new station, not
  load-bearing for any station today.
- **Contradiction flags** (`redundancy_flags`): a real signal that disagrees with a
  curated value never overwrites it — it opens a flag for human recheck. The
  `assumed` default never raises a flag.
- **Multi-chain stations** (`StationModel.chainLabel`): one physical station can
  gate several INDEPENDENT lines through different elevators (161 St: the 4 and
  the B/D each have their own; one being down says nothing about the other). Each
  such line is a separate `StationModel` sharing the `stationExternalId`, so the
  Accessibility Blackouts board reads "161 St-Yankee Stadium (4)" vs "(B/D)". A
  physical station MTA fragments across several complex-ids (Penn = 164+318,
  Fulton/Oculus = 628+624) merges under one canonical id via
  `coveredStationExternalIds` (build-data counts each covered id once).
- **"Sole access" markers require a real signal** (2026-07-06): the site only
  shows the ▮ / "station currently inaccessible" marker (and the structural
  SPOF board) for units whose `redundancy_source` is NOT `assumed` — the
  assumed policy default is a conservative unknown, not a confirmed fact.
  Blackout/streak boards keep the conservative history-based logic.
- **Step-free detour policy (2026-07-10, locked)**: an ELEVATOR-FREE detour of
  at most **0.3 miles** counts as a step-free alternative, with the walk
  always disclosed in the rider-facing note (Daly City's surface walk
  qualifies; Warm Springs' 0.8 mi and any detour that depends on another
  elevator do not). **Garage elevators (Millbrae precedent)**: a garage
  elevator providing a back access route is a REAL chain member when the
  agency's guidance or a human confirms the route; outside chains only when
  its destination is unknowable. **Agency-contradicts-us**: an agency's own
  elevator-free alternative guidance is applied via a HUMAN-APPROVED
  allowlist (`APPROVED_STREET_ALTERNATES` in scripts/mbta-chains.mts), never
  auto-parsed, quoting the agency in the note.

**Per-system modeling detail lives in the `liftwatch-system-models` skill**
(`.claude/skills/liftwatch-system-models/SKILL.md`) — how each system's models were
generated or curated, its ground-truth sources, audit results, and per-system traps:

- **MTA** — full coverage (123 stations / 230 chains), the two generator tiers, the
  conform-to-MTA gate, data.ny.gov + tsdataclinic sources, direction audit, ramp ruling.
- **LIRR / Metro-North** — 18 curated models, the five subway interchanges, station-ADA board.
- **MBTA** — feed-text chains, GTFS pathways review proposals, joint review pass, ADA settlement.
- **WMATA** — pathways generation, Rider-Tools + CIP ground truth, station review 42/42, final audit.
- **CTA** — the first curated tier (`cta-models.ts`).
- **TfL** — graph-topology chains, alert-evidence enrichment.
- **BART** — settlement asset ids, all 50 stations curated, live-outage attribution, dimensions guide.

## Conventions

- **Elevators only** (for the core metrics). `unit_type` reserves escalators
  but they aren't ingested. Non-elevator step-free facilities are tracked in a
  SEPARATE, walled-off access-issues layer — see the Access issues convention
  below; they never touch elevator counts/%/leaderboards.
  **Universal inclusion (Bryce, 2026-07-13): every ELEVATOR an agency reports
  is tracked** — garage, parking, pedestrian-bridge, whatever it serves; no
  adapter may drop an elevator by location. But an elevator enters an ACCESS
  CHAIN only when the agency's guidance or a human confirms the route (the
  Millbrae/garage precedent) — a garage elevator is a first-class tracked
  unit and leaderboard member that simply isn't a chain member.
- **Planned vs unplanned** tracked separately; leaderboards **rank by
  unplanned** (share of active fleet); scheduled work has its own column/board.
  MTA: classified by `reason` (`ismaintenanceoutage` is vestigial — "N" on
  every live record, even rows labeled "Maintenance"; regex covers
  planned|capital|scheduled|maintenance|inspection). **MTA current feed also
  MIXES IN future scheduled outages** (`isupcomingoutage=Y`, dated up to ~2
  weeks out, duplicated in the upcoming feed) — the adapter drops Y rows whose
  start hasn't passed, else they ingest as phantom open outages (this was a
  real bug — inflated NYC Subway to 60 down/14.7% vs the true ~29/7.1%). BART:
  all real-time = unplanned.
- **Curated data lives in version-controlled files**, not just the DB — reviewable,
  survives rebuilds, re-asserted every poll.
- **Two note tiers on StationModel (Bryce, 2026-07-13), migrated EVERYWHERE**:
  `note` is PUBLIC, rider-facing plain English (what the route is, which legs
  have a backup, what an outage means — no GTFS/feed/generator jargon);
  `internalNote` holds provenance and engineering caveats ("Topology from
  WMATA GTFS pathways…", verification dates, feed quirks) and NEVER ships to
  the site (build-site-data only reads `note`; leakage grep-verified 0).
  Every generator composes the public note via `composePublicNote()`
  (accessibility.ts — leg by leg + a consequence sentence; "lift" for TfL)
  AFTER its enrichment passes (stepFreeAlternative changes what it must say),
  and appends rider-relevant agency quotes/disclosures; provenance goes to
  internalNote. All 4 generators (MTA, rail, MBTA, TfL — the .mjs ones now
  run via tsx to import the composer) + all curated catalogs (BART, rail,
  MBTA, WMATA, inline) migrated 2026-07-13; the un-modeled-station fallback
  rows on the access board also carry an honest generic note. When writing a
  NEW curated model: rider guidance in `note`, verification dates/sources in
  `internalNote`.
- **Same-name elevator letters (Bryce, 2026-07-20), DERIVED never hand-typed**:
  within a physical station, when two or more curated elevators carry the
  IDENTICAL `label` (e.g. Rosslyn's three "street to eastbound platform"
  elevators, `C05E01/02/03`), each gets a stable letter designation — A, B, C…
  — appended as `(A)` so an outage says WHICH one is down. A uniquely-named
  elevator gets no letter (nothing to disambiguate), so pre-existing manual
  numbering (`Platform Elevator 1`/`2`, `1 of 4`) is untouched. Implemented in
  `accessibility.ts` (`elevatorLetterMap` groups per `stationExternalId` by
  exact label, dedups by `externalId`, assigns by sorted id → stable across
  every chain the elevator appears in and across rebuilds; `withElevatorLetter`
  is the display suffix). Applied at EVERY site elevator-name emit point in
  `build-site-data.ts` (cross-system longest board, per-system currently-broken,
  offline log, most-broken, uptime streak, and the "backed up by" list) via the
  per-system `letterMapForSystem`/`namedWithLetter` helpers — so it's automatic
  and universal across all systems, retroactive with zero model edits, and can't
  drift. The letter is keyed by `externalId`, so it rides the FEED description
  shown on the board (not just the curated label). Locked in `demo:access`
  (7 checks). **NEVER type a letter into a model label — the rule derives it.**
- **Timezones**: feeds report local wall-clock; parse to UTC (`src/lib/time.ts`,
  Luxon). Store UTC everywhere.
- Nine adapters, deliberately different fidelity (TMB currently `hidden`):
  **MTA**, **MBTA**, **TfL**, **TMB**, **LIRR**, **Metro-North** = per-elevator
  with full inventory (`data_quality: good`; LIRR/MNR share one adapter + one
  UNDOCUMENTED feed pair — backend-unified.mylirr.org, found by
  network-inspecting MTA's own status page, same risk tier as TMB; LIRR
  sub-feed has no timestamps → our polling timestamps outages; MNR sub-feed has
  epoch lastUpdated → sourceStartedAt, and "long term outage" → planned);
  **WMATA** = per-elevator ids but the feed only lists broken units (`fair`,
  `inventoryComplete: false`, no single_elevator inference, units discovered
  as they break; station list IS complete via `NormalizedRead.stations`).
  Since 2026-07-17 ALL 98 WMATA stations carry access-chain models —
  pathways-generated + hand-curated (see the WMATA bullets in the redundancy
  section) — an additive accessibility layer that deliberately does NOT flip
  inventoryComplete: ~⅓ of the fleet is garage/parking elevators absent from
  the rail GTFS, so 320 stays the honest denominator.
  **CTA** = same `inventoryComplete: false` tier as WMATA. The feed has no
  elevator ids, but since 2026-07-14 the adapter mints STABLE per-elevator
  unit ids from the alert text's persistent location identity
  ("The Harlem-bound platform elevator at Pulaski" → `40030-HARLEM-BOUND`,
  parsed by `src/adapters/cta/location.ts` — tolerant of CTA's hyphen-space
  explosions, headline station names, consequence clauses, and articles
  before the leg; the full
  observed corpus is the regression fixture, `npm run check:cta`, snapshot
  via `npm run cta:observed`). A vague alert ("The elevator at Central")
  falls back to the BARE station id — the pre-identity unit id, so archive
  history continues unbroken and nothing is guessed. The FEED has no
  chains/redundancy signal (CTA publishes no inventory or backup guidance —
  re-verified 2026-07-13: ASAP plan tables are graphical, no per-station
  roster exists; ASAP's "163 existing elevators" (2018) corroborates the 173
  staticFleetReference) — redundancy comes entirely from the hand-curated
  tier (`src/catalog/cta-models.ts`, 39 of 46 queue stations as of
  2026-07-17; see the CTA curated-tier bullets in the redundancy section).
  No `NormalizedRead.stations` (station list not fetched in this MVP pass).
  The research that seeded the curated tier is preserved in
  `src/catalog/cta-data/STATION-RESEARCH.md` (chicago-L.org, all 42
  then-observed stations, archetype-grouped) — mostly consumed now; the
  live tracker is `src/catalog/review/queue.json`.
  WMATA has no live fleet total anywhere (exhaustively verified), so its %
  ranking uses `staticFleetReference` — WMATA's own published "320 elevators"
  figure — as the denominator. It **does** rank (currently ~1.9%\*), but every
  number derived from it (fleet count, %, and the site's aggregate total) is
  marked with a trailing `*` + source/date, since it's static, not live. This
  mechanism is general (`fleetSource: live|static|none`), reusable by any
  future discovered-inventory system. **BART** = station-level advisory
  (`best_effort`). **TfL** (London, first non-North-America system) has a
  real per-lift inventory + real topology-derived redundancy (`redundancy_
  source: "pathways"`, `src/catalog/tfl-data/*.json` built by
  `scripts/tfl-import.mjs` from user-provided TfL open-data exports — no
  confirmed live URL for the topology itself, only the disruptions feed is
  polled live). **TMB** (Barcelona, first non-English-speaking system) has a
  real per-elevator inventory (151 elevators, `src/catalog/tmb-data/units.json`
  built by `scripts/tmb-import.mjs` from documented, live "transit" API
  endpoints — see SPEC.md) but its live outage feed is **completely
  undocumented**, found by inspecting real network traffic on TMB's own
  website rather than from any published API docs — a materially different
  risk profile than every other system here. No redundancy modeling yet
  (falls to `assumed`). Timestamps: MBTA = ISO w/ offset (no tz parsing);
  WMATA = ISO w/o offset = ET wall-clock (`parseIsoLocalToUtcIso`); MTA/BART =
  US date format wall-clock (`parseZonedToUtcIso`); TfL's live feed has no
  timestamp at all (free text only) — we rely on our own polling to
  timestamp events, same as BART. CTA = ISO w/o offset = CT wall-clock
  (`parseIsoLocalToUtcIso`, same helper as WMATA). TMB = epoch milliseconds
  (`msToUtcIso`, no timezone ambiguity to resolve). LIRR = none (own
  polling); MNR = epoch seconds (`msToUtcIso(lastUpdated * 1000)`).
- **LIRR/MNR unit ids are station-qualified** (`JAM-761`, `2SM-1 STM`):
  the feed's `unitId` is only unique per station and collides across unit
  types (Jamaica has an elevator AND an escalator both numbered 761).
- **LIRR/MNR planned/reason/return come from camsys alert enrichment**
  (`.../camsys%2F{lirr,mnr}-alerts.json`): the eestatus feed has none of
  these, so a currently-active alert mentioning an elevator is matched (by
  railroad-scoped `stop_id` crosswalk + `agency_id` guard) to at most ONE
  out-of-service elevator at the station — unique track intersection, else
  the sole out-of-service one; 0 or ≥2 candidates ⇒ never guess. Additive
  only (upgrades to planned, attaches reason + return; never downgrades).
  Best-effort fetch — a failure degrades to no enrichment. The **subway
  does NOT use this** — `nyct_ene` already has structured
  `ismaintenanceoutage`/`reason`/`estimatedreturntoservice` per exact
  equipment id, so fuzzy station-level matching would only add risk.

- **Offline tracking** (2026-07-07): a tracked unit missing from an
  inventory-complete feed past ~2 polls opens an `offline_events` row (status
  UNKNOWN — "you can't know before you go"); closes on reappearance. Site
  shows an OFFLINE column, a per-system offline board + restored log, and
  UNKNOWN on the access board. **Exemptions** (else false positives):
  `inventoryComplete: false` systems (WMATA/CTA — absence is normal),
  `best_effort` systems (BART — units are synthetic station-level
  placeholders), and synthetic/orphan unit ids (`-UNSPECIFIED`, `TMB-`). With
  every real feed complete + stable, this is genuinely ~0 today — it's a
  feed-integrity safety net, not a common event (verified: all
  inventory-complete feeds return their full inventory every poll). Requires
  the `offline_events` table (a later schema addition — apply `db/schema.sql`
  in the Supabase SQL editor, then `NOTIFY pgrst, 'reload schema';` or the API
  won't see it); ingest and build-data warn + skip until it exists.
  **IMPORTANT for any future DDL on this project: PostgREST caches the schema
  — run `NOTIFY pgrst, 'reload schema';` in the SQL editor after adding tables.**

- **Other accessibility equipment — NON-ELEVATOR step-free equipment**
  (2026-07-10; renamed from "Access issues" 2026-07-12 across the board per
  Bryce): a SEPARATE layer for accessibility equipment that isn't an elevator
  but whose loss removes step-free access — mini-high/raised boarding platforms,
  portable boarding lifts, **wheelchair lifts**, ramps (escalators deliberately
  excluded). Deliberately walled off: never in `units`, never in the elevator
  inventory / `%`-down / any leaderboard. Own denormalized
  `other_equipment_events` table (no FK to `units`), own per-system "Other
  accessibility equipment" board (hidden for systems with no such data).
  Captured by facility TYPE from the facilities feed (MBTA), NOT by trusting an
  alert's `effect` label (MBTA files elevators-out under `ELEVATOR_CLOSURE`,
  `ACCESS_ISSUE`, AND `FACILITY_ISSUE` — the effect field is unreliable, same
  trap as CTA `FullDescription`). Types: `NormalizedOtherEquipment` /
  `OtherEquipmentType` / `NormalizedRead.otherEquipment`, ingest §6.5
  (open/close like outages), `build-site-data` → `otherEquipment` board.
  `other_equipment_events` is a later schema addition (apply `db/schema.sql` +
  `NOTIFY pgrst, 'reload schema';`; degrades to empty until it exists).
  **STANDING RULE (2026-07-15, locked)**: before finalizing ANY station model
  (individual review, batch, or auto-generated), check whether the agency's own
  data already exposes a ramp or other ADA facility that could satisfy
  `stepFreeAlternative` — never limit this check to one system just because
  that's where the current question came from. MBTA's own
  `facilities?filter[type]=RAMP` endpoint (already fetched every poll for the
  other-equipment layer, but not cross-checked against the model) turned up 58
  ramps system-wide (subway, commuter rail, AND ferry) sitting unused for this
  purpose — found 2026-07-15 while researching the commuter-rail disclaimer.
  A ramp confirmed by the agency's OWN facility inventory meets the same
  evidence bar as a human walk-through confirmation (see the step-free detour
  policy above) — it is not a guess. Every system's adapter/API should be
  checked for equivalent facility-type data, not only MBTA's. **First
  full audit (2026-07-15/16)**: snapshotted via `scripts/mbta-ramps.mts` →
  `mbta-data/ramps.json`; MBTA's auto-generated tier already handles every
  ramp mention in its own per-elevator guidance correctly (zero pending
  `review-flags.json` entries — Natick Center and East Taunton were already
  `stepFreeAlternative` before this audit, just previously undocumented
  clearly); the real gap is stations where a ramp exists OUTSIDE that
  per-elevator mechanism (State/Wellington/Sullivan Square/JFK-UMass — the
  same interchange-anomaly stations already held for individual review, not
  a quick win). WMATA and CTA were checked and ruled out: neither exposes any
  ramp/facility data in its feed at all (WMATA's own accessibility page states
  its design standard is elevator-only at every station; its GTFS pathway
  spec has no ramp mode to signal one even if it existed). BART and TfL
  already had this fully solved before the audit (BART: Ashby/Coliseum/Daly
  City/Richmond via `stepFreeAlternative`; TfL: a native `ramps` array already
  contracted into the topology graph, see `tfl-chains.mjs` above).
  **BART's Coliseum parking-lot wheelchair lift** is the first non-MBTA member
  (2026-07-12): a curated `bart-other-equipment.ts` list + a `matchHint` on the
  advisory text (BART has no per-facility feed), split OUT of the elevator model
  so it never inflates the elevator count. Other systems: add their equipment
  here as each is cross-checked against its agency's accessibility page (a real,
  verified per-facility signal, never a guessed feed field).
- **Unidentified-outage flag (universal, 2026-07-12)**: `NormalizedOutage.
  needsReview` marks an outage we could NOT confidently place onto a specific
  known elevator — a conservative `-UNSPECIFIED` fallback, or a low-confidence
  guess. **BART platform-default policy (revised 2026-07-20, `platformDefaultAmbiguous`):**
  a bare/unhinted advisory that falls through to the platform elevator is
  CONFIDENT (no flag) UNLESS the station has an auxiliary elevator with NO
  matchHints — since the adapter tries every hint first, a real auxiliary outage
  only reaches the platform default if it matched no hint, so hint-distinguishable
  auxiliaries (Coliseum's OAC/arena, Richmond's Amtrak connector) never make the
  default ambiguous. Today every BART auxiliary carries hints (from the
  ADA-settlement re-source), so no BART station flags on the platform default;
  the guard remains for a future hint-less auxiliary. (Replaces the older "any
  auxiliary/other-equipment ⇒ flag" rule, which flagged Coliseum.) Persisted as
  `outage_events.needs_review`. Surfaced three
  ways: a poll-time warning (`poll.ts`), a per-system "Needs review" board
  (`build-site-data` → `needsReview`, rendered in `system.html`), and an **ntfy
  push** (`src/lib/notify.ts`, fired from `pollSystem` for NEWLY-opened flagged
  outages only, so a standing one doesn't re-alert every poll). Any adapter may
  set `needsReview`; today BART does. Requires `NTFY_TOPIC` env (silent no-op
  without it).
- **Missing-information flag (2026-07-12)** extends the same needs_review
  channel: ingest also flags an outage that is missing a rider-facing field its
  OWN system is expected to provide. Driven by a per-system CAPABILITY PROFILE
  (`src/catalog/field-expectations.ts`, `missingExpectedFields()`) so it never
  fires on an AGENCY LIMITATION (BART/TfL publish no cause/return, WMATA/CTA
  aren't curated) — that distinction is the whole point, established by the
  2026-07-12 data-integrity audit. It flags: an empty reason/location anywhere;
  a missing `estimatedReturn` where the agency always provides one
  (`expectsReturn`: MTA, WMATA); and an un-modeled unit (redundancy `assumed` /
  no unit) at a system we DO curate (`curatedRoute`: MTA/BART/TfL/MBTA/rail) —
  i.e. a curation gap. The flag reason ("missing predicted return",
  "route/redundancy") rides the ntfy push + poll warning. Verified quiet where
  data is complete (MTA/TfL/BART/CTA = 0) and firing only on real gaps
  (un-modeled MBTA/LIRR/MNR stations). Update `field-expectations.ts` when a
  system's real capability changes. **Per-symptom exemption (2026-07-16)**:
  `expectsReturn` supports a documented per-class carve-out via `returnExempt()`
  — WMATA publishes a return for its categorized symptoms but NOT for the
  open-ended `"Other"` catch-all, so a blank return on an `"Other"`-symptom WMATA
  outage is no longer flagged (it was pushing a spurious "missing predicted
  return", e.g. Waterfront F04X01). Regressions in `demo:access`.

## Gotchas / deferred

- **BART is station-level**: the `cmd=elev` advisory names a station, usually not
  which elevator. Per-elevator *attribution* is **wired**, three levels, never a
  guess: unique hint → specific elevator; multi-hit → `{ABBR}-{SEG}-UNSPECIFIED`
  (guessing would corrupt per-elevator stats); vague → `{ABBR}-UNSPECIFIED` →
  station reads AT RISK (see `poll:bart:dry`). Multiple outages at one station
  are preserved, not collapsed. Its GTFS has no `pathways.txt` (checked), so
  redundancy is all curation.
- **RLS is enabled on every table, no policies** — anon key can do nothing;
  the poller's service_role key bypasses it. Add read-only policies in Phase 2.
- Feed fetches have 30s timeouts; error text redacts query strings (API keys).
- `demo:access` is an asserting check (exits non-zero on failure) — run it after
  touching accessibility/attribution/station models.
- MTA per-segment modeling not done (MTA's explicit `redundant` flag suffices for
  now).
- **TfL redundancy is NOT "2+ lifts at a station"** — verified counter-examples
  (Kingsbury, King's Cross) show adjacent lift numbers routinely serve disjoint
  legs with zero redundancy. The only valid signal is an exact
  `(StationUniqueId, FromAreas, ToAreas)` match — see `check:tfl` for the
  locked-in regression cases before touching `tfl-import.mjs`. `LiftUniqueId`
  must be used verbatim (never reconstruct from station+number — ~5% of real
  ids break that pattern). `RampRoutes.csv`/`SameLevelPaths.csv` are WIRED
  (2026-07-14): tfl-import emits `step-free-paths.json`; tfl-chains CONTRACTS
  path-joined areas into one node (same station+area-group only — Outside and
  cross-group edges are never contracted), which marks path-paralleled lifts'
  legs `stepFreeAlternative`, merges true parallels, and collapsed enough
  branching to free 17 formerly-excluded stations (incl. Paddington; 93→74
  excluded components). Chains SPLIT at street-connected interior nodes
  (nodes path-adjacent to the literal `<station>-Outside` marker) so two legs
  meeting at the street stay independent routes, never a false series
  (Willesden Junction regression). Derived-vs-catalog redundancy mismatches
  caused by paths are documented in the same `evidenceExceptions` channel as
  alert evidence. Re-run `tfl-import.mjs` when TfL republishes the export.
- **CTA article trap — it stalled the daily refresh for 5 days (2026-07-22 →
  27)**: CTA writes the same elevator's leg both "to/from street" and "to/from
  **the** street" (the latter live-observed once, at Harold Washington
  Library `40850`). The article rode into the id, tripping `check:cta`'s
  "no article artifacts" assertion; since the text lives in the ARCHIVE,
  `cta:observed` re-derived it every sweep and `model-refresh.yml` failed
  identically every day, shipping nothing. Fixed by dropping a standalone
  `THE` in `slugify` alongside `AND`, so all four capture paths are covered
  at once. Two rules this bought: (1) an article is NOT cosmetic — "to/from
  the platform" on a direction-qualified alert slugs to `THE-PLATFORM`, which
  defeats the drop-generic-PLATFORM rule and forks one elevator into two ids;
  (2) **when a check fails ONLY in CI, re-run the SWEEP against the live
  archive, not the check** — the committed snapshot fixture stays clean and
  hides the offending row, which is exactly why this looked green locally for
  five days. Archive backfilled (see SPEC.md) so the elevator kept one
  identity; `units(id)` has no `ON UPDATE CASCADE`, so re-keying a unit is
  insert-new → repoint referrers → delete-old, never a rename.
- **CTA text-classification trap**: never classify planned-vs-unplanned
  against `FullDescription` — it carries a boilerplate "...repair and
  upgrade elevators" footer link on nearly every alert regardless of cause
  (live-verified false positive: 9 of 13 real outages misflagged as planned).
  Classify against `Headline` + `ShortDescription` only. CTA has no
  per-elevator id at all (station-level, like BART) and no station-list
  feed wired yet (deferred — CTA's GTFS `stops.txt` could supply one).
- **TMB is HIDDEN (2026-07-07) — data-quality concerns.** Kept intact
  (adapter, catalog, `check:tmb`, archive) via `hidden: true`; not shown, not
  polled. Two feed problems: (1) the live outage feed
  `api.tmb.cat/v1/alerts/metro/channels/WEB` is undocumented (found by network
  inspection), sparse, and covers conventional lines only (L1-L5, L11) — same
  `cause_code` trap as CTA's `FullDescription`; (2) the richer feed we found,
  **`api.tmb.cat/v1/itransit/metro/ascensors`** (real per-elevator status +
  segment topology + all 11 lines, 466 unique elevators), reports statuses
  that DON'T match reality — `KO` ("out of service") = 274 elevators while the
  alerts feed shows 1 actually out; automatic lines read 0% KO, old lines ~70%
  KO; a major hospital station reads all-KO. So itransit `KO` is NOT
  operational status (the recurring don't-trust-an-unverified-feed-field trap:
  cf. CTA `FullDescription`, TMB `cause_code`, MTA `isupcomingoutage`). Its
  `NO_INFO` = "no communication" (109 elevators, all `origen: NO_INTEGRAT` =
  never wired to monitoring, i.e. permanently unknown, not transient). **Do
  NOT migrate TMB to itransit or trust its statuses** without first
  time-series-sampling whether `KO` ever flips and comparing against TMB's own
  rendered site. To unhide: set `hidden: false` in systems.ts (the Netlify
  poller picks it up automatically — no workflow change needed).
