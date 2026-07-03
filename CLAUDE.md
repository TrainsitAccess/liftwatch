# CLAUDE.md — LiftWatch

Working notes for this codebase. **`SPEC.md` is the source of truth for design and
decisions**; this file is the operational summary + conventions + gotchas.

## What this is

Monitors public-transit **elevator** outages worldwide, archives them over time,
and ranks systems/stations/elevators on split-flap leaderboards. The archive (an
event history nobody else keeps) is the whole point — every metric derives from it.

Status: **Phase 0 complete**. Two adapters working (MTA, BART), full redundancy +
accessibility model, event-derivation ingest. Everything runs **dry-run only** until
a Supabase project exists.

## Running it

Node LTS is installed but **not on PATH in non-interactive shells** — prepend it:

```powershell
$env:Path = "C:\Program Files\nodejs;$env:Path"
```

```bash
npm install
npm run poll:dry         # MTA, fetch + normalize, no DB
npm run poll:bart:dry    # BART, same
npm run demo:access      # prove the chain-aware accessibility model
npm run typecheck        # tsc --noEmit — run after edits
# With SUPABASE_URL + SUPABASE_SERVICE_KEY in .env, drop `:dry` to archive.
```

No `SUPABASE_*` env → always dry-run (fetch + normalize, no writes).

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
  redundant iff no single elevator outage severs access) — never hand-typed.
- `src/catalog/redundancy-overrides.ts` turns models into the station-level flags
  ingest consumes, at top precedence (`curated`).
- **Precedence** (ingest resolves + never clobbers higher):
  `curated > explicit > pathways > serving_text > single_elevator > assumed`.
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
- Two systems, deliberately different fidelity: **MTA** = per-elevator (unit-level,
  `data_quality: good`); **BART** = station-level advisory (`best_effort`).

## Gotchas / deferred

- **BART is station-level**: the `cmd=elev` advisory names a station, usually not
  which elevator. Per-elevator *attribution* is **wired** — modeled stations expand
  into per-elevator units, outages are attributed via `matchHints`, and vague text
  falls back to `{ABBR}-UNSPECIFIED` → station reads AT RISK (see `poll:bart:dry`).
  Its GTFS has no `pathways.txt` (checked), so redundancy is all curation.
- **No DB yet**: everything is dry-run until Supabase is set up.
- MTA per-segment modeling not done (MTA's explicit `redundant` flag suffices for
  now).
