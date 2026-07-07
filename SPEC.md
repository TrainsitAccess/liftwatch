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

MTA (NYC) ✓ · BART (SF) ✓ · MBTA (Boston) ✓ · WMATA (DC) ✓ · TfL (London) ✓ —
first non-North-America system · CTA (Chicago) ✓ · Deutsche Bahn FaSta
(Germany) · Wiener Linien (Vienna) · BVG/VBB (Berlin).

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

### TfL feeds (in use) — real per-lift inventory, real topology-derived redundancy

The richest system yet: a genuine per-lift inventory (569 lifts, 201/509
stations) with a stable id (`LiftUniqueId`) that exactly matches the live
disruption feed — no crosswalk problem, unlike WMATA/BART. `data_quality:
'good'`, `inventoryComplete: true` (default). Facts below verified live
2026-07-04 against user-provided TfL open-data exports (GTFS + detailed CSV)
and the live disruptions endpoint.

- **Live**: `GET https://api.tfl.gov.uk/Disruptions/Lifts/v2` — **no API key
  needed**. Returns `[{ stationUniqueId, disruptedLiftUniqueIds: string[],
  message }]`. No structured cause or start-date field — only free text, so
  (like BART) we rely on our own polling to timestamp events
  (`sourceStartedAt` stays undefined). Planned vs. unplanned: message text
  matched against `/planned|upgrade|engineering work|modernisation
  |modernization|refurbishment/i`; the common "faulty lift" / staffing-outage
  phrasing (the large majority of live entries) defaults to unplanned.
- **Static topology** (no confirmed live URL — downloaded manually from TfL's
  open data pages, so treated as a periodically-refreshed snapshot, same
  pattern as BART's hand-curated station models): TfL publishes both a GTFS
  export (stops/pathways/levels) and a richer "detailed CSV" set (Stations,
  Lifts, StationPoints, Platforms, …). The detailed CSVs are the adapter's
  primary source — `Lifts.csv` models a multi-level lift as **one row** with
  `IntermediateAreas`, whereas GTFS `pathways.txt` splits it across multiple
  rows (one per level-pair) requiring fragile `pathway_id` parsing. Lifts.csv
  is also where `LiftUniqueId` is confirmed unique (569/569) and confirmed
  identical to the live feed's ids.
- **Redundancy — real, not inferred, but not naive**: `scripts/tfl-import.mjs`
  groups `Lifts.csv` rows by `(StationUniqueId, FromAreas, ToAreas)`; a group
  with 2+ lifts is genuinely redundant. **"2+ lifts at a station" alone is
  wrong** — verified counter-examples: Kingsbury's two lifts share an origin
  but serve *different* platforms (not redundant; losing both is a full
  outage); King's Cross's Lift-A/Lift-B serve different legs of one journey
  (not redundant). Genuine redundancy is real and sometimes multi-way: South
  Quay DLR has 3 lifts on an identical route. This computation is
  `redundancy_source: "pathways"` — the first system where that precedence
  tier is real derived-from-topology data rather than aspirational. Locked
  in as a regression check: `npm run check:tfl`
  (`src/checks/tfl-redundancy-check.ts`) asserts all 4 verified cases against
  the bundled catalog.
- **Ingestion architecture**: `src/catalog/tfl-data/{stations,lifts}.json`
  (git-tracked, built by the import script — re-run by hand when TfL
  republishes topology) supply the full inventory + redundancy; the adapter's
  `fetch()` loads this bundled snapshot and makes one live HTTP call for
  current outages. Station coordinates are a centroid of `StationPoints.csv`
  rows (no direct station-level lat/lon is published anywhere).
- **Known real-data quirks handled**: `LiftUniqueId` must be used verbatim
  (~5% of ids don't follow the `{Station}-Lift-{N}` pattern — e.g. a space
  instead of a hyphen; `LiftId` values repeat across different lifts at the
  same station, so it's display-only, never a key). `FriendlyName` needs
  trimming (stray whitespace in real rows). Boolean-ish CSV columns mix
  `TRUE`/`True`/`FALSE`/`False` casing.
- **Deferred**: `RampRoutes.csv`/`SameLevelPaths.csv` (non-lift step-free
  paths — would extend `accessibility.ts` to detect "a ramp bypasses this
  broken lift entirely," a strictly stronger redundancy signal than lift-to-
  lift matching); `Toilets.csv`/`Platforms.csv`/`PlatformServices.csv`
  (out of scope, elevators-only); a live re-fetch URL for topology, if one is
  ever found, would let the static snapshot self-refresh instead of manual
  re-import.

### CTA feeds (in use) — station-level, discovered inventory

`http://lapi.transitchicago.com/api/1.0/alerts.aspx` (Customer Alerts API),
`outputType=JSON`, **no API key needed** (Terms of Use only).
`data_quality: 'fair'`, `inventoryComplete: false`. Facts below verified live
2026-07-05.

- Filter to `Impact === "Elevator Status"` — an exact, exclusive value (10
  possible `Impact` values total; no fuzzy matching needed, unlike WMATA).
- **No per-elevator id at all** — only a station-level identifier
  (`ImpactedService.Service` where `ServiceType === "T"`; `ServiceId` matches
  CTA's GTFS parent-station id, `4xxxx` range). So each "unit" is a whole
  station's elevator access, same modeling tier as BART's un-modeled
  stations — a station with two simultaneous elevator alerts would collide
  onto one unit (not observed live; documented limitation, not fixed).
- **No full inventory feed** — CTA's GTFS is a standard 10-table schedule
  feed (agency.txt, stops.txt, routes.txt, trips.txt, stop_times.txt,
  calendar.txt, calendar_dates.txt, shapes.txt, frequencies.txt,
  transfers.txt) with no pathways/levels extension (checked, unlike TfL). No
  redundancy signal exists; falls to the same `assumed` /
  `inventoryComplete: false` precedence as WMATA.
- `EventStart`/`EventEnd` are ISO-8601 **without an offset** —
  America/Chicago wall-clock (verified: response `TimeStamp` vs. real UTC
  clock at fetch time showed exactly a 5-hour CDT offset) —
  `parseIsoLocalToUtcIso`, reused directly from WMATA.
- One call returns both current and future-scheduled alerts (`activeonly`
  defaults false); bucketed into `outages`/`upcoming` by comparing
  `EventStart` to now, same pattern as MTA/MBTA.
- **Planned vs. unplanned — classify against `Headline` + `ShortDescription`
  ONLY, never `FullDescription`.** Live-verified false-positive trap:
  `FullDescription` carries a boilerplate "...repair and upgrade elevators"
  footer link on nearly every alert regardless of cause — matching against
  it flagged 9 of 13 real outages as planned when only 2 genuinely were
  (Lake, Western — both say "upgrade" directly in `ShortDescription`).
- One `Alert` can have multiple `ImpactedService.Service` entries (one
  station `T` + several route `R` entries, e.g. Howard serves Red/Purple/
  Yellow) — verified this is **one alert object**, not duplicates; extract
  the single `T`-type entry, ignore the `R`-type route entries.
- **Deferred**: CTA's GTFS `stops.txt` (`location_type=1` rows) could supply
  a complete station list (name + coords) via `NormalizedRead.stations`,
  matching WMATA's pattern — skipped for this MVP pass to keep the adapter
  small; stations are only known when currently alerting.

### TMB feeds (in use) — real inventory, live outage feed found via network inspection

TMB (Barcelona)'s first non-North-America, non-UK system. `data_quality:
'good'`, `inventoryComplete: true` (default) — closer to TfL's tier than
CTA's. Facts below verified live 2026-07-05.

- **The live outage feed is completely undocumented.** `developer.tmb.cat`'s
  published "transit" API (Línies, Recorreguts, Parades, Estacions,
  Mobiliari, Accessos, Correspondències, Intercanviadors, Horaris) has *no*
  incidents/status endpoint anywhere, and the full GTFS static feed (with
  real `pathways.txt` + `wheelchair_boarding`) has no realtime component
  either — both exhaustively checked before concluding this. The actual live
  signal, `GET https://api.tmb.cat/v1/alerts/metro/channels/WEB`, was found
  by inspecting real browser network traffic on a TMB station page
  (`tmb.cat/en/barcelona/metro/-/lineametro/L2/estacion/210`) — it's the
  exact endpoint powering TMB's own website's green/yellow/red elevator
  traffic-light widget. It authenticates with the same `app_id`/`app_key`
  issued for the documented transit API (confirmed live). Being
  undocumented, it could change or disappear without notice — a materially
  different risk than every other system's adapter here, which are all built
  on officially published APIs.
- **Scope limitation (per TMB's own announcement)**: this elevator-status
  system currently covers conventional lines only (L1-L5, L11) — the
  automatic lines (L9, L10, FM funicular) aren't wired to it yet, so no
  outage will ever appear for them regardless of real elevator state.
- **Effect-code taxonomy** (live-verified, 10 active alerts sampled
  2026-07-05): `categories.effect_code` values seen: `PP8` = "Ascensors fora
  de servei" (elevators out of service — the only code ingested), `PP9` =
  "Escales mecàniques fora de servei" (escalators, out of scope, same
  elevators-only convention as every system here), `PP1` = partial service,
  `PP2` = closed connection/transfer, `PP7` = closed access. **Do not trust
  `categories.cause_code` for planned/unplanned classification** — all 10/10
  sampled alerts carry `cause_code: "CONSTRUCTION"` regardless of apparent
  cause, the same shape of trap as CTA's `FullDescription` boilerplate.
  Classify against the English publication text instead
  (`/maintenance|planned|scheduled|upgrade|improvement|refurbishment
  |renovation/i`), same approach as CTA/TfL.
- **Timestamps**: `disruption_dates[].begin_date`/`end_date` are epoch
  milliseconds — an absolute instant, no wall-clock/timezone parsing needed
  (new helper `msToUtcIso`, `src/lib/time.ts`).
- **Matching an alert to a specific elevator**: each `entities[]` entry
  carries `entrance_code` (matches the catalog's `CODI_ACCES`, the
  entrance-level code — reliably unique across the whole network, verified:
  the same `CODI_ACCES` for one physical entrance appears identically across
  every line/funicular listing that shares it, e.g. Paral·lel's "Nou de la
  Rambla" access under L2, L3, and the Montjuïc funicular all show
  `CODI_ACCES 21001`). Two distinct fallbacks (split 2026-07-06 — they were
  one, which corrupted per-elevator stats in the drift case): when
  `entrance_code` is the literal string `"ALL"` (or missing), the FEED
  itself declares a station-wide effect, so the outage expands to every
  known elevator at that station (`attributed: false` — the agency's own
  claim, not a guess); when `entrance_code` is present but matches nothing
  in the catalog snapshot (drift since the last import), the outage is
  recorded on ONE synthetic unit (`TMB-{station}-{entrance}`) instead of
  blaming every elevator at the station — the same never-guess rule as
  BART's `-UNSPECIFIED` units.
- **Inventory — real per-elevator, built from the documented API, not
  reverse-engineered**: `scripts/tmb-import.mjs` calls
  `GET /v1/transit/estacions` (live-verified: omitting a station id returns
  all 140 station groups network-wide, not just one) then, for each,
  `GET /v1/transit/estacions/{codi_grup_estacio}/accessos/fisics`
  (live-verified: omitting the trailing `/{codi_acces}` segment returns
  every physical access at that station, not just one) — ~140 calls total,
  filtered to `ID_TIPUS_ACCES === 3` ("Ascensor"; 1 = stairs, 4 = ramp).
  Result: 151 elevators across 123 stations (2026-07-05 snapshot). No
  confirmed live URL returns the whole network in one call, so — same
  pattern as TfL — this is a versioned snapshot (`src/catalog/tmb-data/
  units.json`) refreshed by re-running the import script by hand; only the
  alerts endpoint is polled live.
- **Redundancy is NOT modeled** — no verified per-direction topology signal
  exists yet (unlike TfL's exact `FromAreas`/`ToAreas` match). One real
  counter-example already on file to avoid the TfL trap later: Església
  Major's "Mossèn Camil Rossell" access has **3** physical elevator units
  sharing one entrance code — confirmed via both the Accessos and Accessos
  Físics endpoints independently — but per the TfL lesson, "N units at one
  access" is not by itself evidence they're parallel/redundant paths rather
  than sequential legs. Locked into the regression check
  (`npm run check:tmb`, `src/checks/tmb-check.ts`) as a count assertion only,
  not a redundancy claim.
- **Deferred**: verifying real per-direction redundancy topology before
  attempting `redundancy_source: "pathways"`-tier modeling; a live re-fetch
  URL for the whole-network inventory, if one is ever found, would let the
  static snapshot self-refresh instead of manual re-import.

### MTA commuter railroad feeds (in use) — LIRR + Metro-North, one shared undocumented pair

Systems 8 and 9 (`mta-lirr`, `mta-mnr`) share ONE feed pair at
`backend-unified.mylirr.org` — the backend of MTA's own public
elevator-escalator-status page and the unified TrainTime app. One adapter
(`src/adapters/mta-rail`) serves both systems, each instance filtering by
railroad. Facts below verified live 2026-07-06.

- **Both endpoints are UNDOCUMENTED** (same risk tier and discovery method
  as TMB's alerts feed): found by inspecting the network traffic of
  `mta.info/elevator-escalator-status` itself. `GET /eestatus` returns, per
  station code, every elevator AND escalator with per-unit
  `{location, unitId, status, lastUpdated}` — inventory and live status in
  one call (working units listed too, so `inventoryComplete: true`, unlike
  WMATA/CTA). `GET /infrastructure?language=en` returns all 242 stations
  (code, name, coords, branch, `railroad: LIRR|MNR|BOTH`, accessibility
  tier, gtfs_stop_id). No auth; the API family versions via
  `Accept-Version: 3.0` (other routes 301 without it — these two answer
  regardless, but the adapter sends it anyway). Could change without
  notice.
- **Dead ends checked first** (don't re-walk): the `nyct_ene*` feeds are
  subway-only (their `nonNYCT=Y` records are subway-station elevators that
  secondarily serve the railroads); `lirr%2F.../mnr%2F...` S3 keys don't
  exist (`NoSuchKey`); Socrata 9hjt-526f / ax67-8386 are monthly
  availability aggregates by branch; the railroads' static GTFS zips have
  no `pathways.txt`; the camsys GTFS-RT alert feeds carry elevator outages
  only as occasional long-planned prose notices.
- **Two upstream sources are merged in `/eestatus`, distinguishable per
  unit**: LIRR units use `"Working"/"Not Working"` (capitalized) with
  `lastUpdated: null` — our own polling timestamps their outages (BART/TfL
  precedent). MNR units use lowercase `"working"/"not working"/"long term
  outage"` with `lastUpdated` = epoch SECONDS of the last status change —
  used as `sourceStartedAt`, validated against New Rochelle 206E, whose
  `lastUpdated` exactly matches the announced start of its planned rebuild
  (and GCT's NE-4 backdates a real outage to 2023-03-24). Status matching
  must be case-insensitive; `"long term outage"` maps to `isPlanned` (it is
  how MNR marks announced long-term work).
- **`unitId` is only unique per station — and collides across unit types**
  (Jamaica has an elevator AND an escalator both numbered 761; MNR ids can
  embed spaces, e.g. Stamford's `"1 STM"`). External ids are
  station-qualified verbatim: `{stationCode}-{unitId}`.
- **Grand Central is three records**: `GCT` = Grand Central Madison (LIRR,
  incl. EL21, the connector down to MNR track level), `0NY` = Grand Central
  Terminal (MNR), `_GC` = the app's combined entry (`railroad: "BOTH"`, no
  units) — excluded from both systems.
- **Shared physical elevator at Penn**: LIRR's `NYK-861` ("Unit P34, 34 St
  & 7 Av to LIRR concourse") is the subway feed's `EL34X` (`nonNYCT=Y`).
  Tracked in BOTH systems deliberately — each system's accessibility truth
  stays self-contained; the one-unit overlap in the homepage aggregate is
  accepted and documented.
- **Stations with no eestatus entry have no elevators** (ramp/level-boarding
  stations — 117 of the 198 FULL/PARTIAL-accessible stations). Absence
  means "no elevators", not "missing data"; the complete station layer
  still comes from `/infrastructure` via `NormalizedRead.stations` (branch
  rides in the borough slot).
- **Redundancy**: no signal in the feed. Thirteen major stations are
  hand-modeled in `src/catalog/mta-rail-models.ts` (walked through
  station-by-station with a human 2026-07-06 — the walk-through corrected
  three feed-text misreadings at Stamford alone; its notes outrank the raw
  location strings). The adapter applies model-derived redundancy as
  `curated`, aggregated across every chain a unit appears in; un-modeled
  units fall to `assumed`. Commuter-rail chains are PER-TRACK
  ("Stamford (Track 3)") the way subway chains are per-line. Stamford uses
  a paired-segment (CNF) encoding to express "direct elevator OR
  multi-elevator detour"; ramps appear as `stepFreeAlternative` legs
  (Stamford Tracks 4/5, Grand Central Terminal's Oyster Bar / Kitty Kelly
  ramps).
- **Subway interchanges**: the five railroad interchanges (Penn, Grand
  Central, Atlantic, Woodside, Sutphin Blvd–Jamaica) get subway-side
  "(LIRR)" chains built ONLY from subway-feed elevators (chains are
  single-system); the railroad side of each interchange is modeled in the
  railroad system. Grand Central deliberately gets NO subway-side railroad
  chain — EL606X is one of many entrances to terminals with their own
  tracked elevators, so a single-elevator chain would overclaim.
- **camsys alert enrichment** (the eestatus feed has no planned flag, reason,
  or return estimate — only a status string, so these are borrowed from the
  camsys service-alert feeds `.../camsys%2F{lirr,mnr}-alerts.json`). A
  currently-active alert that mentions an elevator and resolves (via its
  `stop_id`) to a station on this railroad may **upgrade** an out-of-service
  elevator's outage to planned and attach a human-readable reason + scheduled
  return. Attribution is strictly conservative — the alert names a station and
  describes the elevator only by track in free text, never a unit id, so:
  - it only ever touches **currently out-of-service** elevators, and only
    ever *upgrades* to planned (never downgrades — a false "planned" would
    hide a real outage from the unplanned-ranked boards);
  - it attributes to **exactly one** out-of-service elevator (unique track
    intersection, or the sole out-of-service elevator when the alert names no
    track) — 0 or ≥2 candidates ⇒ ambiguous ⇒ skip, the same never-guess rule
    as BART / `attributeOutage`. **A track served by multiple elevators
    cannot be pinned** — that's the ambiguous case, by design;
  - the `stop_id` crosswalk is **railroad-scoped** (gtfs_stop_id collides
    across LIRR/MNR — 64 cross-railroad collisions), with a second guard on
    the alert's `agency_id` (`"LI"` for the LIRR, `"MNR"`);
  - the alerts fetch is best-effort: a failure degrades to no enrichment,
    never fails the poll (the eestatus outages are complete on their own).
  Residual limitation documented in code: if the alert's true target is
  currently *working* while a different track-sharing elevator is out for an
  unrelated reason, the unique-match could attribute to the wrong one — rare
  (an active closure usually means the target is out) and only at a station
  with a live planned-elevator alert.
- **Not applicable to the subway**: the NYCT `nyct_ene` outage feed already
  carries, per exact equipment id, a structured `ismaintenanceoutage` flag +
  `reason` + `estimatedreturntoservice` (verified: 35/35 current outages have
  all three) — strictly better than deriving them from station-level prose.
  Running this fuzzy enrichment on the subway would add nothing and reintroduce
  the over-attribution risk it's built to avoid.
- **Regression coverage**: `npm run check:rail`
  (`src/checks/mta-rail-check.ts`) exercises the pure mapper offline
  against a fixture distilled from the live feeds — dual status casings,
  id collisions/spaces, epoch-vs-null timestamps, railroad filtering, the
  `_GC` exclusion, the curated-redundancy wiring (incl. the Stamford
  walk-through outcomes), and all ten camsys-enrichment rules (unique-match
  attribution, ambiguity skip, no-track fallback, future-window rejection,
  never-downgrade, cross-railroad collision guard).
- **Deferred**: modeling the remaining North End Access units at
  Grand Central (NE-1/2/3/5/6 — passage topology unverified); Yankees-E
  153 St's PE4 overpass elevator (level relationship to the mezzanine
  unverified, conservatively omitted from chains).
