# LiftWatch

Monitor public-transit **elevator** reliability worldwide, archive it over time,
and rank systems, stations, and individual elevators on split-flap leaderboards.

See [SPEC.md](SPEC.md) for the full design and roadmap.

## Status

**Phase 0** — foundation. Working: the MTA (NYC) adapter, the normalized adapter
contract, the archive schema, and event-derivation ingest.

## Quick start

```bash
npm install

# Fetch live MTA data and print a summary — no database needed:
npm run poll:dry

# Once a Supabase project exists, copy .env.example -> .env, fill in
# SUPABASE_URL + SUPABASE_SERVICE_KEY, apply the schema, then archive:
#   (in Supabase SQL editor) paste db/schema.sql
npm run poll -- mta-nyct
```

Without `SUPABASE_*` env vars the poller always runs dry (fetch + normalize only),
so you can exercise adapters before any database exists.

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
