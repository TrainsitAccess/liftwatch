# LiftWatch — Specification

Monitor public-transit elevator reliability worldwide, archive it over time, and
rank systems, stations, and individual elevators on split-flap leaderboards.

Status: **Phase 0** (foundation). This document is the source of truth for design
decisions; code is built against it.

---

## 1. What it is

A globally-scoped tracker of transit **elevator** outages. It polls agency feeds on
a schedule, derives outage *events* (when a unit goes down and comes back), and
stores them forever. From that event history it computes leaderboards and trends.

The differentiator is **the archive**: agencies overwrite their outage data
constantly. Nobody keeps a longitudinal record. We do — and everything valuable
(uptime %, mean-time-to-repair, uptime streaks, chronic offenders) falls out of it.

Scope decision: **elevators only.** Escalator data exists in many feeds and the
schema reserves `unit_type` for it, but we do not ingest or display escalators.

---

## 2. Locked decisions

| Area | Decision |
|---|---|
| Stack | Supabase (Postgres, free tier) + static frontend |
| Schema philosophy | Store **events, not raw snapshots** — keeps us on the free tier for years |
| Poller | Scheduled job every 5–15 min (pg_cron or GitHub Actions — settled in Phase 1) |
| Backup / export | Weekly GitHub Action → dated XLSX + CSVs → Google Drive folder |
| Scope | Elevators only; `unit_type` reserved so escalators are a future config flip |
| Planned outages | Tracked separately; leaderboards rank on **unplanned** by default, with a toggle |
| Catalog | Solo-maintained, but structured as clean per-system files |
| Frontend | Hybrid: split-flap (Solari) leaderboards, editorial methodology pages |
| Alerts (later) | ntfy station subscriptions (reused from prior project) |

---

## 3. Data model

Hierarchy: **system → station → unit (elevator)**. Every unit carries its full
geographic lineage so any leaderboard can filter by continent / country / metro.

- `systems` — one per transit system; geo + timezone + which adapter drives it.
- `stations` — geo-tagged; `gtfs_stop_id` + coordinates enable auto-enrichment.
- `units` — individual elevators. Carries `is_ada`, `is_redundant` (false = sole
  step-free access → accessibility-impact weighting), `is_active`, and
  `first_seen` (monitoring start — makes streaks fair).
- `outage_events` — **the archive.** One row per outage occurrence.
  `started_at` = when *we* observed it out; `source_started_at` = feed-reported
  start (may predate our monitoring). `ended_at` null = ongoing. `is_planned` flag.
- `daily_rollups` — precomputed per-unit daily downtime for fast uptime %/trends.
- `poll_runs` — per-poll health record for adapter monitoring at scale.
- `upcoming_outages` — scheduled future work; a snapshot wiped and replaced each
  poll (agencies revise schedules, so "upcoming" history isn't meaningful).

See `db/schema.sql` for the authoritative definitions. **Row Level Security is
enabled on every table** with no policies: the anon key can't read or write
anything (the poller's service_role key bypasses RLS). Explicit read-only
policies get added in Phase 2 when the site needs public reads.

### Event derivation (the core loop)

On each poll, for one system:

1. Fetch **current outages**, **upcoming outages**, **all equipment** (denominator).
2. Upsert `stations` and `units` from the equipment feed. Any outage referencing
   unknown equipment still creates a minimal unit (feeds drift).
3. For each currently-out unit with **no open event** → open one
   (`started_at` = now, `source_started_at` = feed date, `is_planned` from mapping).
4. For each currently-out unit **with an open event** → refresh reason / ETA.
5. For each **open event whose unit is no longer out** → close it (`ended_at` = now).
6. Record a `poll_runs` row (counts, errors) for health tracking.

Only one open event per unit (enforced by a partial unique index).

---

## 4. Ingestion: config over code

Adding systems must scale to "a ton, worldwide." The rule: **onboard by config,
not bespoke code.** Feeds cluster into a few *types*; build a parameterized adapter
per type and most systems become a catalog entry with zero new code.

- Generic adapters (later): GTFS-Realtime service alerts, generic REST JSON, SIRI.
- Bespoke adapters (now): the rich feeds worth the effort (MTA, DB FaSta, TfL).
- **Adapter contract:** every adapter returns a `NormalizedRead`
  (`units[]` + `outages[]` + `upcoming[]`, all normalized). The rest of the
  pipeline never knows which agency it came from.
- **Status mapping** is config: each feed's raw "out"/"planned" strings map to our
  canonical enum.
- **Adapter health** (`poll_runs`) is mandatory at scale — silent feed rot corrupts
  leaderboards. Track last success, error rate, stale data.

---

## 5. Leaderboards

One parameterized component: **entity level × geo scope × metric × direction.**

Geo scope: World → Continent → Country → Metro → System.

| Level | "Most broken" (shame) | Reliability (honor) |
|---|---|---|
| System | Most down / highest % down / worst MTTR | Highest trailing-90-day uptime % |
| Station | Most frequently broken | Longest streak with full step-free access |
| Unit | Most outages / worst MTTR | **Longest current uptime streak** ("847 days") |

Reliability uses **uptime streak** (units/stations), which is self-guarding: a
streak can't exceed how long we've watched, so newly-added units can't top it.
Systems use trailing uptime % because big systems never have a meaningful streak.

### Accessibility leaderboards (redundancy-aware)

A distinct family of station boards keyed on `is_redundant`. Where "most broken
station" counts *every* elevator outage, these count only outages that **sever
step-free access** — outages of non-redundant (`is_redundant = false`) units,
which are the sole step-free path. A station with backups can break often yet
rarely go inaccessible; a single-elevator station goes inaccessible every time.

| Board | Metric | Type | Needs archive? |
|---|---|---|---|
| Accessibility blackouts | Count / hours a station lost step-free access | Shame | Yes |
| Step-free streak | Longest stretch keeping full step-free access | Honor | Yes |
| Single points of failure | Stations with ≥1 non-redundant unit (one break = out) | Structural | **No** |

The structural board is computable from the equipment feed alone — usable on day
one, before any outage history exists. All three are queries over
`units.is_redundant` and `outage_events`.

#### Determining redundancy

Redundancy is published by few systems, so it's resolved from the best available
signal, recording *how* via `units.redundancy_source`. That source is also a
**precedence order** — a poll only overwrites redundancy with an equal-or-higher
source:

`curated > explicit > pathways > serving_text > single_elevator > assumed`

- **explicit** — the feed states it (MTA `redundant`).
- **single_elevator** — a station with exactly one elevator is definitely a single
  point of failure (high confidence, works for any system's equipment feed).
- **pathways / serving_text** — later tiers (GTFS-Pathways graph reachability;
  parsing what each elevator serves). Built up over time.
- **assumed** — policy default when unknown: **treat as non-redundant** so a board
  never hides an accessibility risk. Over-counts blackouts; disclosed on the
  methodology page as "% confirmed vs assumed" per system.
- **curated** — a human confirmed it via the curation queue. Highest precedence;
  **never overwritten** by re-polling. Lives on the unit row (no override table).

**Curation store**: structured curation lives in `src/catalog/station-models.ts`
(version-controlled — reviewable in git, survives DB rebuilds). Modeled stations
expand into per-elevator units in the adapter, each carrying derived
`curated`-source redundancy, re-asserted every poll. A slim **manual override**
file (`src/catalog/redundancy-overrides.ts`) remains for simple boolean calls on
units without a station model; the dry-run poll warns about override ids matching
no live unit. Editing curation propagates on the next poll (curated-vs-curated:
the file wins); only non-curated *feed* signals are blocked from overwriting.

**Curated baseline** (`systems.redundancyBaseline`): a system whose redundancy is
fully hand-curated sets `confirmed-none`, so any un-modeled station is treated as
`curated` non-redundant (not merely `assumed`) — absence from the model list is
itself a confirmed statement. BART uses this: 7 stations modeled + the rest
confirmed non-redundant = the whole system is human-confirmed, no `assumed` left.

**Curation workflow** (admin view, Phase 2): a queue of `assumed` units ranked by
impact (busiest / most-broken first) with a yes/no review that appends to the
overrides file (`source = 'curated'`).

**Contradiction flags** (`redundancy_flags`): when a *real* signal (explicit /
single_elevator / pathways / serving_text — never `assumed`) disagrees with a
curated value, the curated value is kept and a flag opens for human recheck (the
real world may have changed — e.g. an elevator was decommissioned). The
`assumed` default never raises a flag, avoiding false alarms.

#### Chain-aware accessibility model

Step-free access is a chain of **segments** (street → concourse → platform). Each
segment is served by one or more elevators and is "up" if any of its elevators
works — or if a non-elevator step-free path exists (ramp, sunken parking lot). A
station is accessible only if **every** segment is up. (`src/lib/accessibility.ts`)

Redundancy is derived from this, not hand-set: a station is redundant iff no
single elevator outage severs access; an elevator is redundant iff its own outage
doesn't. Curated station structure lives in `src/catalog/station-models.ts`
(source of truth); the station-level redundancy flag is derived from it.

Worked example (12th St): street segment {14th St, 11th St} + platform segment
{platform}. 14th St out → still accessible (11th St covers it); platform out →
inaccessible (no backup). Ashby: street segment has a step-free alternative
(parking lot), platform segment has two elevators → only both-platforms-out fails.

Attribution (station-level feeds like BART) — **wired**: modeled stations expand
into per-elevator units (`segment` + derived redundancy). Each advisory outage is
attributed via `matchHints` (`attributeOutage`) at three levels, never guessing:
1. **Specific elevator** (unique hint match) → that unit, `attributed = true`.
2. **Segment only** (hints match multiple elevators in one segment) →
   `{ABBR}-{SEGMENT}-UNSPECIFIED` unit. Guessing a specific elevator would corrupt
   per-elevator stats (chronic-offender boards would blame the wrong unit).
3. **Unattributable** (the current live "RICH: Station") → `{ABBR}-UNSPECIFIED`;
   the station reads **AT RISK** — never a confident "accessible".
A station may appear multiple times in one advisory (two elevators out); entries
are preserved, not collapsed. Station accessibility =
`stationAccessibilityState` (accessible / inaccessible / at_risk). Un-modeled
stations stay station-level. Systems that identify the failed elevator (MTA)
would drive this exactly. Known limitation (methodology): an outage that later
becomes attributable splits into two events. Deferred: per-segment modeling for
MTA; storing/surfacing a live accessibility view beyond the poll output.

Rules baked into the metrics:
- Currently-out = streak of 0 ("currently out of service"), never a stale streak.
- New units are labeled ("90 days — monitored since …"), ranked fairly, not hidden.
- Monitoring gaps **pause** a streak, never extend it.
- Raw counts are labeled size-dependent; default fairness view is % / normalized.
- **Reporting bias** (diligent reporters look worse) is disclosed on the methodology
  page — load-bearing for credibility.

---

## 6. Design

Hybrid, per decision:
- **Split-flap / Solari boards** for live + leaderboard views. Riffle on first load
  and on *actual* rank changes (flip only changed tiles). Respect
  `prefers-reduced-motion` (snap, no riffle) and keep a screen-reader-readable
  ranking underneath.
- **Editorial** treatment for methodology and story pages.
- Deliberately not the generic-AI look: real type hierarchy, monospace numerals,
  one restrained status ramp, dense tables over airy cards.

---

## 7. Roadmap

- **Phase 0** — repo, schema, adapter contract, working MTA adapter. ← now
- **Phase 1** — scheduled poller, event derivation into Supabase, +3 adapters
  (MBTA, BART, DB FaSta).
- **Phase 1.5** — weekly Google Drive backup (XLSX + CSVs).
- **Phase 2** — the site: live view + parameterized split-flap leaderboards +
  methodology page.
- **Phase 3** — payoff metrics: uptime %, MTTR, chronic-offender Hall of Shame,
  trends, streaks.
- **Phase 4** — ntfy station alerts, coverage map with "request your city",
  public data export.

---

## 8. Data sources (launch targets — quality first)

MTA (NYC) ✓ · BART (SF) ✓ · MBTA (Boston) ✓ · WMATA (DC) ✓ · TfL (London) ·
Deutsche Bahn FaSta (Germany) · Wiener Linien (Vienna) · BVG/VBB (Berlin).

### MTA feeds (in use)

JSON, `America/New_York`, US date format `MM/DD/YYYY hh:mm:ss AM`:
- Current outages: `nyct_ene.json`
- Upcoming outages: `nyct_ene_upcoming.json`
- All equipment (denominator): `nyct_ene_equipments.json`

Base: `https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2F<feed>.json`

Field mapping: `equipmenttype=EL` → elevator (filter) · `equipmentno`/`equipment` →
external id · `stationcomplexid` → station id · `elevatorsgtfsstopid` → GTFS join ·
`ADA=Y` → `is_ada` · `redundant=0` → `is_redundant=false` (sole access) ·
`isactive=Y` → `is_active` · `ismaintenanceoutage=Y` or `reason` ~ planned/capital →
`is_planned` · `outagedate` → `source_started_at` · `estimatedreturntoservice` →
`estimated_return`.

### BART feeds (in use) — best-effort, station-level

BART exposes no structured per-elevator status. `data_quality: 'best_effort'`.
- Real-time (in use): `bsa.aspx?cmd=elev` — a free-text, **station-level**
  advisory ("2 elevators out: MLBR: Station; RICH: Station"). Parsed by matching
  station codes against the station list.
- Station list (in use): `stn.aspx?cmd=stns` — all ~50 stations + coordinates;
  serves as the geo source and the denominator (one synthetic "station elevator
  access" unit per station).
- Public key `MW9S-E7SL-26DU-VV8V` (override via `BART_API_KEY`).

Modeling: one synthetic unit per station; outages are stations named in the
advisory. Redundancy is `assumed` (GTFS has **no** `pathways.txt`, so Tier-B
derivation is unavailable). All real-time outages are unplanned.

Deferred sources (not parsed):
- GTFS static — no pathways/levels; nothing beyond the station list. Not used.
- Planned-advisories RSS (`rss/news/planned-elevator-advisories.xml`) —
  per-elevator, dated, prose (states redundancy in English). Brittle to parse;
  a future "maintenance calendar" source and useful reference for the manual
  redundancy curation queue.

### MBTA feeds (in use) — genuinely per-elevator

JSON:API (`https://api-v3.mbta.com`), `data_quality: 'good'`. Optional
`x-api-key` header (`MBTA_API_KEY`; unauthenticated works at 20 req/min, which
covers our cadence — a key raises it to 1,000/min).
- `/facilities?filter[type]=ELEVATOR&include=stop` — 237 elevators across 80
  stations (one page, `page[limit]=200` + pagination guard for headroom).
  `include=stop` gives station name, municipality, and coordinates directly —
  no separate geo enrichment needed, unlike MTA/BART.
- `/alerts?filter[activity]=USING_WHEELCHAIR` — kept only where
  `effect = "ELEVATOR_CLOSURE"`; `active_period[0].start/end` are **already
  ISO-8601 with a UTC offset** (no local-time parsing, unlike MTA/BART).
  `cause` in `{MAINTENANCE, CONSTRUCTION}` → planned. `lifecycle`/future
  `active_period.start` splits current vs. `upcoming`.
- One alert's `informed_entity` can list the same `facility` id many times
  (once per affected stop/route) — deduped to unique facility ids per alert.
- No explicit redundancy field — falls through to the existing precedence
  engine (`single_elevator` / `assumed`), same as any uncurated system. Some
  facility `properties` include `alternate-service-text` naming a backup
  elevator in prose (e.g. "use the nearby Elevator 736") — a candidate for
  future curation, intentionally not auto-parsed (same policy as BART's
  planned RSS).

### WMATA feeds (in use) — per-elevator ids, discovered inventory

`https://api.wmata.com`, header `api_key` (**required** — no unauthenticated
tier; free Default Tier = 10 calls/sec, 50k/day). `data_quality: 'fair'`,
`inventoryComplete: false`. All facts below live-verified 2026-07-04.
- `Incidents.svc/json/ElevatorIncidents` — despite the name it mixes in
  ESCALATORs (28 of 33 live); filter `UnitType === "ELEVATOR"`. `UnitName`
  (`A14X01`; prefix = StationCode) is a **stable per-unit id** → real per-
  elevator tracking (MTTR, chronic offenders). Dates are ISO-8601 with **no
  offset** = America/New_York wall-clock (`parseIsoLocalToUtcIso`).
  `EstimatedReturnToService` is date-level (always T23:59:59). Planned mapping
  from open-ended `SymptomDescription`: /modernization|preventive maintenance|
  safety inspection|scheduled|rehabilitation/i → planned; everything else
  (Service Call, Minor/Major Repair, Other, unseen values) → unplanned.
- `Rail.svc/json/jStations` — **complete** station layer: 102 codes with
  coords; transfer stations are separate codes cross-linked by
  `StationTogether1` (A01/C01 Metro Center etc.), kept separate since
  incidents reference a specific code. Join incidents on `StationCode`, never
  on name (incident `StationName` is decorated with entrance detail). Emitted
  via `NormalizedRead.stations`.
- **The denominator problem**: the API only lists *broken* units, and GTFS
  offers no crosswalk — pathways.txt models 212 elevator edges (mode 5) with
  synthetic node ids (`NODE_N06_S_PAV_ELV_BT`), and live UnitNames appear
  **nowhere** in any GTFS file (grep-verified, 0 matches; garage elevators
  like B11X05 aren't modeled at all). So units are discovered as they break:
  `inventoryComplete: false` disables the `single_elevator` redundancy
  inference (broken-unit counts are not fleet counts). GTFS pathway-graph
  redundancy (Tier B) remains possible per-station someday, but is blocked on
  a manual UnitName↔pathway crosswalk — future curation.
  - **No API, dataset, or GIS layer publishes a real elevator inventory**
    anywhere (exhaustively verified: WMATA's full API surface via its own
    published definition, its ArcGIS Online org — 108 datasets enumerated —
    and opendata.dc.gov all checked live, none exists). `jStationEntrances`
    tags 82 of 275 entrances "(ELEVATOR)" but that counts entrances, not
    units, and can't be trusted as a fleet total.
  - The one real number is WMATA's own **published static figure** — "320
    elevators system-wide" stated in prose on wmata.com. `staticFleetReference`
    (`src/catalog/systems.ts`) captures this (count + as-of date + source URL)
    and it **is used as the pctDown denominator and participates in
    ranking** — it's the best available number when no live feed exists. Every
    percentage computed from it is visibly marked with a trailing `*` on the
    site plus a footnoted source/date, so it's never confused with a system
    whose percentage comes from a live fleet count. `fleetSource` on each site
    system row records `live` / `static` / `none` for this purpose. This is
    the general mechanism — any future discovered-inventory system reuses the
    same field.
