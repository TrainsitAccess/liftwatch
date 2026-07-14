# CLAUDE.md — LiftWatch

Working notes for this codebase. **`SPEC.md` is the source of truth for design and
decisions**; this file is the operational summary + conventions + gotchas.

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
in `gh run list`). `.github/workflows/poll.yml` is KEPT as a redundant
fallback during the transition (ingest is idempotent, so both firing is
harmless) — remove it only once Netlify's schedule is confirmed reliable over
a few cycles. Backed up weekly to a private repo (`backup.yml`), with a
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
  (its poll.yml step is commented out). Reversible: `hidden: false` + restore
  the poll step. TMB is currently hidden — its undocumented alerts feed is
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
npm run demo:access      # prove the chain-aware accessibility model (25 checks)
npm run check:tfl        # prove TfL's topology-derived redundancy (10 checks)
npm run check:tmb        # prove TMB's elevator catalog integrity (7 checks)
npm run check:mta        # prove MTA's multi-chain models vs feed flags (offline)
npm run check:rail       # prove the LIRR/MNR mapper + curated models (offline fixture)
npm run rail:chains      # regenerate LIRR/MNR simple-station chains (ground-truth-gated)
npm run check:rail-chains # prove the rail chain generator vs the 13 hand models (offline)
npm run mta:chains       # regenerate MTA multi-chain models from the live feed
npm run mbta:chains      # regenerate MBTA simple-station chains (validated vs MBTA's own guidance)
npm run check:mbta-chains # prove the MBTA chain generator offline (full-feed fixture)
npm run check:wmata       # prove the WMATA pathways chains + attribution crosswalk (offline)
npm run wmata:observed    # refresh observed-units.json (archive + live feed; grows only)
npm run check:cta         # prove the CTA text-identity parser vs the observed corpus (offline)
npm run cta:observed      # refresh CTA observed-units.json (archive + live alert texts; grows only)
npm run typecheck        # tsc --noEmit — run after edits
npm run db:status        # row counts + latest poll_runs, once Supabase is set up
npm run site:data && npm run site:serve  # rebuild + preview the departure-board site
# With SUPABASE_URL + SUPABASE_SERVICE_KEY in .env, drop `:dry` to archive for real.
```

No `SUPABASE_*` env → always dry-run (fetch + normalize, no writes). Credentials
(Supabase, MBTA_API_KEY, WMATA_API_KEY, TMB_APP_ID/TMB_APP_KEY) live in
gitignored `.env` locally, as **Netlify environment variables** for the
scheduled poll + site build, and (still) as GitHub Actions secrets for the
fallback `poll.yml` — never in chat, never committed.

## Deployment (Netlify)

Hosting + the 5-min poll cron both live on Netlify now (site
`liftwatch`, linked to `main`, auto-deploys on push):

- **`netlify.toml`** — build command `npm run site:data` (bakes a
  `site/data.json` snapshot at push time — shadowed in production by the data
  function below; kept for local preview parity), publish dir `site`,
  functions dir `netlify/functions`, `NODE_VERSION=22` (supabase-js needs
  native WebSocket, same constraint as the old poll.yml).
- **`netlify/functions/poll.mts`** — the scheduled poller
  (`schedule: "*/5 * * * *"`). A **REGULAR** synchronous function —
  **scheduled functions must not be background functions**: the first
  version was named `poll-background.mts`, and the `-background` name
  suffix forces background invocation mode, which Netlify's scheduler
  SILENTLY never fires (the schedule registers in the deploy log and
  manifest, but zero invocations ever happen; a manual POST returns 202
  "accepted" yet never executes either). Regular functions cap at 30s, so
  the 8 per-system polls run in PARALLEL (`Promise.allSettled` — wall-clock
  = slowest single feed; one failing feed doesn't stop the rest, mirroring
  poll.yml's per-step `if: !cancelled()`), then the site data payloads are
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
- **MTA multi-chain models are GENERATED, not hand-typed.** `npm run mta:chains`
  (`scripts/mta-chains.mjs`) derives one chain per platform line-group from the
  live `nyct_ene_equipments` feed: drops non-ADA elevators (re-running picks up
  any newly-accessible ones automatically), treats a line-spanning elevator as a
  shared prerequisite, and groups redundant elevators by description. Output →
  `src/catalog/mta-data/station-chains.json`, loaded by `station-models.ts`. The
  ENGINE + SELF-CHECK are system-agnostic (operate on the normalized elevator
  shape + `StationModel`); only the raw-feed mapper and the hand-verified config
  are MTA-specific. **Self-check** (in the generator and offline via
  `check:mta`): every elevator's model-DERIVED redundancy must match MTA's own
  DECLARED `redundant` flag (aggregated across all its chains) — mismatches fail
  the build unless listed in `REDUNDANCY_EXCEPTIONS` with a human reason (MTA's
  flag is sometimes wrong, e.g. 14 St-6 Av EL609/EL610; or reflects cross-station
  redundancy a per-station model can't see, e.g. Grand Central's Shuttle EL607X).
  Nine tangled interchanges are hand-authored OVERRIDES in the script, verified
  station-by-station with a human; the rest are inferred.
- **Commuter rail (LIRR + Metro-North) is DONE, both directions** (2026-07-06):
  (a) they are their own leaderboard systems (`mta-lirr`, `mta-mnr` — one
  shared adapter, `src/adapters/mta-rail`, filtering one undocumented feed
  pair by railroad; see SPEC.md's railroad section for the feed dossier), and
  (b) the five subway interchanges that touch them (Penn, Grand Central,
  Atlantic, Woodside, Sutphin Blvd–Jamaica) carry subway-side "(LIRR)" chains
  built only from subway-feed elevators. Fourteen railroad stations have
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
- **MBTA joint review pass COMPLETE (2026-07-12): `review-flags.json` is now
  empty.** Every flagged street-alternate and no-guidance elevator was walked
  through with Bryce and resolved into one of four HUMAN-approved lists in
  `scripts/mbta-chains.mts` (all re-asserted by `check:mbta-chains`, now 18
  checks): (1) `APPROVED_STREET_ALTERNATES` — 8 elevators (Framingham 50/51,
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
  ground-truth-gated by the hand-curated models (14 as of Greenwich)**
  (2026-07-10). eestatus has no
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
  `src/catalog/mta-rail-data/chains.json` (+ `chains-excluded.json`, 14
  stations for human review — TfL precedent). **Two-tier ingest**: hand
  models stay `curated`; generated models enter as `serving_text` (below
  every human signal; contradictions flag, never clobber; non-assumed, so ▮ +
  SPOF apply). The generator guarantees no station/elevator overlap between
  tiers. Offline: `npm run check:rail-chains` (50 checks, incl. the
  Chappaqua-148I regression that motivated the whole build). GOTCHA locked in
  the mapper: the feed abbreviates "Tk 3" — the first run's regex missed it
  and minted five FALSE redundant pairs; when touching the mapper, re-scan
  every multi-elevator segment in the output, not just the curated gate.
- **WMATA per-elevator chains are GENERATED from GTFS pathways (2026-07-13),
  with observed-UnitName binding and a fail-safe.** A physical elevator = a
  CONNECTED COMPONENT of the mode-5 pathway subgraph (`scripts/
  wmata-pathways.mts` — a node-name regex missed ~25%; components can't split
  a 3-level shaft into a false redundant pair). 206 in-station elevators / 98
  stations; 55 stations modeled + Rockville hand-curated
  (`src/catalog/wmata-models.ts` — human-confirmed pedestrian-bridge pair
  A14X01/X02 as its own chain), 43 excluded with reasons
  (`wmata-data/chains-excluded.json`): side platforms (16 — reachability
  tracing proves disjoint directions, never grouped by level name), big
  transfers (15), 3-level shafts (3), corrupt A02 levels, and the
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
  linked to Lift-A/C/D through a shared landing). Result: 151 chains across
  132 of 201 lift-equipped stations; 85 stations (all recognizable major
  interchanges — Bank, King's Cross, Paddington, Stratford, Tottenham Court
  Road, Victoria, Waterloo, and more) are excluded pending a human review
  pass, same precedent as MTA's 9 hand-authored interchanges (see SPEC.md's
  TfL section for the full writeup).
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
- **ALL 50 BART stations are now curated** (2026-07-08, up from the original
  7 — `src/catalog/bart-station-models.ts`, 43 more stations, wired into
  `station-models.ts`'s STATION_MODELS array). BART has no per-elevator feed
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
  RICH/POWL/COLS "unspecified" complaints (all now RICH-PLAT/POWL-PLAT/COLS-EL,
  verified `poll:bart:dry`), and let the **Richmond attribution-override be
  REMOVED** (`ATTRIBUTION_OVERRIDES` is now empty; the mechanism stays for a
  future human-confirmed elevator neither hints nor the default can reach).
  Regressions in `demo:access` (now 45). `matchHints` for the 12 per-direction
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
  Since 2026-07-13 WMATA ALSO carries 56 modeled stations with
  pathways-derived redundancy (see the WMATA bullet in the redundancy
  section) — an additive accessibility layer that deliberately does NOT flip
  inventoryComplete: ~⅓ of the fleet is garage/parking elevators absent from
  the rail GTFS, so 320 stays the honest denominator.
  **CTA** = same `inventoryComplete: false` tier as WMATA. The feed has no
  elevator ids, but since 2026-07-14 the adapter mints STABLE per-elevator
  unit ids from the alert text's persistent location identity
  ("The Harlem-bound platform elevator at Pulaski" → `40030-HARLEM-BOUND`,
  parsed by `src/adapters/cta/location.ts` — tolerant of CTA's hyphen-space
  explosions, headline station names, and consequence clauses; the full
  observed corpus is the regression fixture, `npm run check:cta`, snapshot
  via `npm run cta:observed`). A vague alert ("The elevator at Central")
  falls back to the BARE station id — the pre-identity unit id, so archive
  history continues unbroken and nothing is guessed. NO chains/redundancy
  (CTA publishes no inventory or backup guidance — re-verified 2026-07-13:
  ASAP plan tables are graphical, no per-station roster exists; ASAP's "163
  existing elevators" (2018) corroborates the 173 staticFleetReference). No
  `NormalizedRead.stations` (station list not fetched in this MVP pass).
  Layout research for a future curated-chains pass:
  `src/catalog/cta-data/STATION-RESEARCH.md` (chicago-L.org, all 42 observed
  stations, archetype-grouped with a verification order) — walk it with
  Bryce before modeling anything.
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
  **BART's Coliseum parking-lot wheelchair lift** is the first non-MBTA member
  (2026-07-12): a curated `bart-other-equipment.ts` list + a `matchHint` on the
  advisory text (BART has no per-facility feed), split OUT of the elevator model
  so it never inflates the elevator count. Other systems: add their equipment
  here as each is cross-checked against its agency's accessibility page (a real,
  verified per-facility signal, never a guessed feed field).
- **Unidentified-outage flag (universal, 2026-07-12)**: `NormalizedOutage.
  needsReview` marks an outage we could NOT confidently place onto a specific
  known elevator — a conservative `-UNSPECIFIED` fallback, or a low-confidence
  guess (BART's platform default at a station that ALSO has other equipment,
  e.g. Coliseum; a single-platform default like Richmond/Powell is confident and
  does NOT flag). Persisted as `outage_events.needs_review`. Surfaced three
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
  system's real capability changes. Regressions in `demo:access` (now 61).

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
- **No DB yet**: everything is dry-run until Supabase is set up.
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
  rendered site. To unhide: `hidden: false` + restore the poll.yml step.
