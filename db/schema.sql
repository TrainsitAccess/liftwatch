-- LiftWatch schema (Supabase / Postgres)
-- Philosophy: store outage EVENTS, not raw snapshots. Everything else
-- (uptime %, MTTR, streaks, leaderboards) is a query over this history.
-- Run in the Supabase SQL editor, or: psql "$DATABASE_URL" -f db/schema.sql

-- ---------------------------------------------------------------------------
-- systems: one row per transit system
-- ---------------------------------------------------------------------------
create table if not exists systems (
  id            text primary key,              -- 'mta-nyct'
  name          text not null,                 -- 'MTA New York City Transit'
  short_name    text not null,                 -- 'NYC Subway'
  city          text,
  metro_area    text,
  country       text not null,
  country_code  text not null,                 -- ISO 3166-1 alpha-2, e.g. 'US'
  continent     text not null,                 -- 'North America'
  timezone      text not null,                 -- IANA tz, e.g. 'America/New_York'
  adapter       text not null,                 -- which adapter drives it, e.g. 'mta'
  data_quality  text not null default 'good',  -- good | fair | best_effort
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- stations: geo-tagged; supports geographic leaderboards
-- ---------------------------------------------------------------------------
create table if not exists stations (
  id           text primary key,               -- '<system>:<stable station id>'
  system_id    text not null references systems(id),
  name         text not null,
  name_native  text,                           -- native-script name if different
  borough      text,
  metro_area   text,
  country      text,
  continent    text,
  gtfs_stop_id text,
  latitude     double precision,
  longitude    double precision,
  created_at   timestamptz not null default now()
);
create index if not exists stations_system on stations (system_id);

-- ---------------------------------------------------------------------------
-- units: individual elevators (unit_type reserves escalators for later)
-- ---------------------------------------------------------------------------
create table if not exists units (
  id           text primary key,               -- '<system>:<external id>'
  system_id    text not null references systems(id),
  station_id   text references stations(id),
  external_id  text not null,                  -- 'EL293'
  unit_type    text not null default 'elevator', -- elevator | escalator (reserved)
  description  text,
  lines        text,
  is_ada       boolean not null default false,
  is_redundant boolean,                         -- false => sole step-free access
  -- how is_redundant was determined; also the precedence order (curated wins).
  -- curated > explicit > pathways > serving_text > single_elevator > assumed
  redundancy_source text not null default 'assumed',
  redundancy_note   text,                        -- reviewer note for curated entries
  redundancy_updated_at timestamptz,             -- when redundancy was last set
  segment      text,                              -- access-chain leg (curated per-elevator model)
  is_active    boolean not null default true,
  first_seen   timestamptz not null default now(), -- monitoring start (streak fairness)
  last_seen    timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index if not exists units_system on units (system_id);
create index if not exists units_station on units (station_id);

-- ---------------------------------------------------------------------------
-- outage_events: THE archive. one row per outage occurrence.
-- ---------------------------------------------------------------------------
create table if not exists outage_events (
  id                bigint generated always as identity primary key,
  unit_id           text not null references units(id),
  system_id         text not null,             -- denormalized for fast group-by
  station_id        text,
  started_at        timestamptz not null,      -- when WE first observed it out
  ended_at          timestamptz,               -- null => still ongoing
  is_planned        boolean not null default false,
  attributed        boolean,                   -- station-level feeds: mapped to a specific elevator?
  reason            text,
  source_started_at timestamptz,               -- feed-reported start (may predate us)
  estimated_return  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- at most one open outage per unit
create unique index if not exists one_open_outage_per_unit
  on outage_events (unit_id) where ended_at is null;
create index if not exists outage_events_system on outage_events (system_id);
create index if not exists outage_events_unit_time on outage_events (unit_id, started_at);

-- ---------------------------------------------------------------------------
-- daily_rollups: precomputed per-unit daily downtime (fast uptime % / trends)
-- ---------------------------------------------------------------------------
create table if not exists daily_rollups (
  unit_id      text not null references units(id),
  day          date not null,
  system_id    text not null,
  down_seconds integer not null default 0,
  had_outage   boolean not null default false,
  primary key (unit_id, day)
);
create index if not exists daily_rollups_system_day on daily_rollups (system_id, day);

-- ---------------------------------------------------------------------------
-- poll_runs: per-poll health record (adapter monitoring at scale)
-- ---------------------------------------------------------------------------
create table if not exists poll_runs (
  id             bigint generated always as identity primary key,
  system_id      text not null,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  status         text not null default 'running', -- running | success | error
  units_seen     integer,
  outages_open   integer,
  events_opened  integer,
  events_closed  integer,
  flags_raised   integer,
  error          text
);
create index if not exists poll_runs_system_time on poll_runs (system_id, started_at desc);

-- ---------------------------------------------------------------------------
-- redundancy_flags: raised when a real signal contradicts a CURATED value.
-- The curated value is kept; the flag queues a human recheck (real-world change?).
-- Never raised by the 'assumed' default (absence of data, not new data).
-- ---------------------------------------------------------------------------
create table if not exists redundancy_flags (
  id              bigint generated always as identity primary key,
  unit_id         text not null references units(id),
  system_id       text not null,
  curated_value   boolean,          -- what the human recorded
  incoming_value  boolean,          -- what new data now says
  incoming_source text not null,    -- explicit | single_elevator | pathways | serving_text
  detected_at     timestamptz not null default now(),
  resolved_at     timestamptz,      -- null => open, awaiting review
  note            text
);
-- at most one open flag per unit
create unique index if not exists one_open_flag_per_unit
  on redundancy_flags (unit_id) where resolved_at is null;
create index if not exists redundancy_flags_open on redundancy_flags (system_id) where resolved_at is null;
