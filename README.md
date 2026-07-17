# LiftWatch

Monitor public-transit **elevator** reliability worldwide, archive it over time,
and rank systems, stations, and individual elevators on departure-board-style leaderboards.

See [SPEC.md](SPEC.md) for the full design and roadmap.

## Status

**Live in production** at [liftwatch.netlify.app](https://liftwatch.netlify.app).
Nine adapters built (MTA subway, BART, MBTA, WMATA, TfL, CTA, TMB, LIRR,
Metro-North); **eight are visible** — TMB is hidden pending a feed
data-quality review. A Netlify scheduled function polls every system every
5 minutes, derives outage (and offline) events into Supabase, and rebuilds
the site's data payloads into Netlify Blobs — fresh data reaches the live
site every poll with no redeploys (a GitHub Actions cron remains as a
redundant fallback poller, and a weekly job backs the archive up to a
private repo). The site (`site/`) is a digital train-departure display
reading the archive, with chain-aware station accessibility: hand-verified
and generated access-chain models across every visible system say whether a
given elevator outage actually severs step-free access or a backup route
covers it. See [SPEC.md](SPEC.md) and [CLAUDE.md](CLAUDE.md) for design,
conventions, and per-system feed dossiers.

## Quick start

```bash
npm install

# Fetch live data and print a summary — no database needed:
npm run poll:dry            # MTA; :bart:dry, :mbta:dry, :wmata:dry, :tfl:dry,
                            # :cta:dry, :tmb:dry, :lirr:dry, :mnr:dry too
npm run demo:access         # offline regression suites: also check:mta,
npm run check:wmata         # check:rail, check:tfl, check:cta, check:tmb,
npm run typecheck           # check:*-chains, check:mta-ny, check:mta-ada …
npm run site:data && npm run site:serve   # rebuild + preview the site
```

Without `SUPABASE_*` env vars the poller always runs dry (fetch + normalize
only), so you can exercise adapters before any database exists. The
production deployment keeps its credentials in Netlify environment variables;
locally they go in a gitignored `.env` (`SUPABASE_URL` +
`SUPABASE_SERVICE_KEY`, schema in `db/schema.sql` — after applying it, run
`NOTIFY pgrst, 'reload schema';` so the API sees new tables). On Windows,
Node isn't on PATH in non-interactive shells — prepend
`C:\Program Files\nodejs`.

## Layout

```
db/schema.sql            Postgres/Supabase schema (events-based archive)
src/types.ts             Normalized domain types + the Adapter contract
src/catalog/             System catalog, curated station models, generated
                         model data + review queue (per-system subdirs)
src/adapters/            One adapter per agency feed (registry.ts binds them)
src/ingest.ts            Event derivation: open / refresh / close outages
src/pollSystem.ts        Shared polling core (CLI + Netlify function)
src/lib/accessibility.ts Chain-aware step-free access model
src/site/                Site data-payload builder + evidence miners
src/checks/              Offline regression suites (npm run check:*)
scripts/                 Model generators, importers, review-queue tooling
site/                    The departure-board site (static + data.json)
netlify/functions/       Scheduled 5-min poller + blob-backed data API
.github/workflows/       Fallback poller, daily model refresh, weekly backup
```

## Adding a system

1. Add a `SystemCatalogEntry` in `src/catalog/systems.ts`.
2. Bind it to an adapter in `src/adapters/registry.ts`.
3. An adapter's only job: implement `fetch()` returning a `NormalizedRead`.

See [EXPANSION.md](EXPANSION.md) for the researched, ranked list of systems
to add next.
