# CLAUDE.md — LiftWatch

Working notes for this codebase. **`SPEC.md` is the source of truth for design and
decisions**; this file is the operational summary + conventions + gotchas.

## What this is

Monitors public-transit **elevator** outages worldwide, archives them over time,
and ranks systems/stations/elevators on split-flap leaderboards. The archive (an
event history nobody else keeps) is the whole point — every metric derives from it.

Status: **live in production.** Nine systems archiving (MTA subway, BART, MBTA,
WMATA, TfL — first non-North-America system, CTA, TMB Barcelona — first
non-English-speaking system, LIRR + Metro-North — first commuter railroads,
sharing one adapter), polled every 10 min by a GitHub Actions cron
(`.github/workflows/poll.yml`), backed up weekly to a private repo
(`backup.yml`), with a keepalive workflow so the poller/backup crons never
auto-disable. A preview split-flap site reads the archive (`site/`).
Repo: github.com/TrainsitAccess/liftwatch (public).

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
npm run mta:chains       # regenerate MTA multi-chain models from the live feed
npm run typecheck        # tsc --noEmit — run after edits
npm run db:status        # row counts + latest poll_runs, once Supabase is set up
npm run site:data && npm run site:serve  # rebuild + preview the split-flap site
# With SUPABASE_URL + SUPABASE_SERVICE_KEY in .env, drop `:dry` to archive for real.
```

No `SUPABASE_*` env → always dry-run (fetch + normalize, no writes). Credentials
(Supabase, MBTA_API_KEY, WMATA_API_KEY, TMB_APP_ID/TMB_APP_KEY) live in
gitignored `.env` locally and as GitHub Actions secrets in CI — never in chat,
never committed.

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
  system treats un-modeled stations as *confirmed* non-redundant. BART uses this →
  all 50 stations human-confirmed, zero `assumed`.
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
  built only from subway-feed elevators. Thirteen railroad stations have
  hand-curated models (`src/catalog/mta-rail-models.ts`, human walk-through
  2026-07-06 — its notes outrank the feed's location strings; Stamford uses a
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

## Conventions

- **Elevators only.** `unit_type` reserves escalators but they aren't ingested.
- **Planned vs unplanned** tracked separately; leaderboards rank unplanned by
  default. MTA: `ismaintenanceoutage`/`reason`. BART: all real-time = unplanned.
- **Curated data lives in version-controlled files**, not just the DB — reviewable,
  survives rebuilds, re-asserted every poll.
- **Timezones**: feeds report local wall-clock; parse to UTC (`src/lib/time.ts`,
  Luxon). Store UTC everywhere.
- Nine systems, deliberately different fidelity: **MTA**, **MBTA**, **TfL**,
  **TMB**, **LIRR**, **Metro-North** = per-elevator with full inventory
  (`data_quality: good`; LIRR/MNR share one adapter + one UNDOCUMENTED feed
  pair — backend-unified.mylirr.org, found by network-inspecting MTA's own
  status page, same risk tier as TMB; LIRR sub-feed has no timestamps → our
  polling timestamps outages; MNR sub-feed has epoch lastUpdated →
  sourceStartedAt, and "long term outage" → planned);
  **WMATA** = per-elevator ids but the feed only lists broken units (`fair`,
  `inventoryComplete: false`, no single_elevator inference, units discovered
  as they break; station list IS complete via `NormalizedRead.stations`).
  **CTA** = same `inventoryComplete: false` tier as WMATA, but with **no
  per-elevator id at all** — station-level only (like BART), no
  `NormalizedRead.stations` (station list not fetched in this MVP pass).
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
  ids break that pattern). Deferred: `RampRoutes.csv`/`SameLevelPaths.csv`
  (non-lift step-free bypass paths, a stronger redundancy signal than
  lift-to-lift matching); re-running `tfl-import.mjs` when TfL republishes.
- **CTA text-classification trap**: never classify planned-vs-unplanned
  against `FullDescription` — it carries a boilerplate "...repair and
  upgrade elevators" footer link on nearly every alert regardless of cause
  (live-verified false positive: 9 of 13 real outages misflagged as planned).
  Classify against `Headline` + `ShortDescription` only. CTA has no
  per-elevator id at all (station-level, like BART) and no station-list
  feed wired yet (deferred — CTA's GTFS `stops.txt` could supply one).
- **TMB's live outage feed is undocumented** — `api.tmb.cat/v1/alerts/metro/
  channels/WEB` appears nowhere in developer.tmb.cat's published docs; it was
  found by inspecting real network traffic on a TMB station page. It could
  change or disappear without notice. Same `cause_code` trap as CTA's
  `FullDescription` (all 10/10 sampled alerts say `"CONSTRUCTION"` regardless
  of cause) — classify against the English publication text instead. Covers
  conventional lines only (L1-L5, L11); L9/L10/FM automatic lines aren't
  wired to TMB's own elevator-status system yet. Redundancy not modeled
  (no verified per-direction topology signal yet, unlike TfL) — falls to
  `assumed`. Deferred: verifying real per-direction topology before
  attempting `pathways`-tier redundancy; a live re-fetch URL for the whole
  network inventory in one call, if one is ever found, to replace the manual
  `scripts/tmb-import.mjs` re-run.
