# LiftWatch

Monitor public-transit **elevator** reliability worldwide, archive it over time,
and rank systems, stations, and individual elevators on departure-board-style leaderboards.

See [SPEC.md](SPEC.md) for the full design and roadmap.

## Status

**Live in production.** Nine adapters built (MTA subway, BART, MBTA, WMATA,
TfL, CTA, TMB, LIRR, Metro-North); **eight are visible** — TMB is hidden
pending a feed data-quality review. A GitHub Actions cron polls every 10 min
and derives outage (and offline) events into Supabase; a weekly job backs the
archive up to a private repo. The site (`site/`) is a digital
train-departure display reading the archive. See [SPEC.md](SPEC.md) and
[CLAUDE.md](CLAUDE.md) for design, conventions, and per-system feed dossiers.

## Quick start

```bash
npm install

# Fetch live data and print a summary — no database needed:
npm run poll:dry            # MTA; :bart:dry, :mbta:dry, :tfl:dry, :cta:dry,
                            # :lirr:dry, :mnr:dry variants exist too
npm run check:mta           # offline regression suites: also check:rail,
npm run demo:access         # check:tfl, check:tmb, demo:access
npm run site:data && npm run site:serve   # rebuild + preview the site

# Once a Supabase project exists, copy .env.example -> .env, fill in
# SUPABASE_URL + SUPABASE_SERVICE_KEY, apply the schema, then archive:
#   (in Supabase SQL editor) paste db/schema.sql, then:
#   NOTIFY pgrst, 'reload schema';   -- so the API sees new tables
npm run poll -- mta-nyct
```

Without `SUPABASE_*` env vars the poller always runs dry (fetch + normalize only),
so you can exercise adapters before any database exists. Node isn't on PATH in
non-interactive shells — prepend `C:\Program Files\nodejs`.

## Layout

```
db/schema.sql            Postgres/Supabase schema (events-based archive)
src/types.ts             Normalized domain types + the Adapter contract
src/catalog/systems.ts   System catalog (metadata; add systems here)
src/adapters/registry.ts systemId -> adapter binding
src/adapters/mta/        MTA (NYC) adapter + raw feed types
src/ingest.ts            Event derivation: open / refresh / close outages
src/poll.ts              CLI entry point
```

## Adding a system

1. Add a `SystemCatalogEntry` in `src/catalog/systems.ts`.
2. Bind it to an adapter in `src/adapters/registry.ts` (bespoke for now; generic
   GTFS-RT / REST / SIRI adapters come in Phase 1).
3. An adapter's only job: implement `fetch()` returning a `NormalizedRead`.
