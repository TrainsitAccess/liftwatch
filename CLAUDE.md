# CLAUDE.md — LiftWatch

Working notes for this codebase. **`SPEC.md` is the source of truth for design and
decisions**; this file is the operational summary + conventions + gotchas.

## What this is

Monitors public-transit **elevator** outages worldwide, archives them over time,
and ranks systems/stations/elevators on split-flap leaderboards. The archive (an
event history nobody else keeps) is the whole point — every metric derives from it.

Status: **live in production.** Six systems archiving (MTA, BART, MBTA, WMATA,
TfL — first non-North-America system, CTA), polled every 10 min by a GitHub
Actions cron (`.github/workflows/poll.yml`), backed up weekly to a private repo
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
npm run poll:bart:dry    # BART, MBTA, WMATA, TfL have :dry variants too
npm run demo:access      # prove the chain-aware accessibility model (25 checks)
npm run check:tfl        # prove TfL's topology-derived redundancy (10 checks)
npm run typecheck        # tsc --noEmit — run after edits
npm run db:status        # row counts + latest poll_runs, once Supabase is set up
npm run site:data && npm run site:serve  # rebuild + preview the split-flap site
# With SUPABASE_URL + SUPABASE_SERVICE_KEY in .env, drop `:dry` to archive for real.
```

No `SUPABASE_*` env → always dry-run (fetch + normalize, no writes). Credentials
(Supabase, MBTA_API_KEY, WMATA_API_KEY) live in gitignored `.env` locally and as
GitHub Actions secrets in CI — never in chat, never committed.

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

## Conventions

- **Elevators only.** `unit_type` reserves escalators but they aren't ingested.
- **Planned vs unplanned** tracked separately; leaderboards rank unplanned by
  default. MTA: `ismaintenanceoutage`/`reason`. BART: all real-time = unplanned.
- **Curated data lives in version-controlled files**, not just the DB — reviewable,
  survives rebuilds, re-asserted every poll.
- **Timezones**: feeds report local wall-clock; parse to UTC (`src/lib/time.ts`,
  Luxon). Store UTC everywhere.
- Six systems, deliberately different fidelity: **MTA**, **MBTA**, **TfL** =
  per-elevator with full inventory (`data_quality: good`); **WMATA** =
  per-elevator ids but the feed only lists broken units (`fair`,
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
  polled live). Timestamps: MBTA = ISO w/ offset (no tz parsing); WMATA = ISO
  w/o offset = ET wall-clock (`parseIsoLocalToUtcIso`); MTA/BART = US date
  format wall-clock (`parseZonedToUtcIso`); TfL's live feed has no timestamp
  at all (free text only) — we rely on our own polling to timestamp events,
  same as BART. CTA = ISO w/o offset = CT wall-clock (`parseIsoLocalToUtcIso`,
  same helper as WMATA).

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
