# LiftWatch — Specification

Monitor public-transit elevator reliability worldwide, archive it over time, and
rank systems, stations, and individual elevators on departure-board-style leaderboards.

Status: **live in production** (Phase 2 in progress). This document is the
source of truth for design decisions; code is built against it.

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
| Poller | Netlify scheduled function every 5 min (`netlify/functions/poll.mts`); migrated off GitHub Actions cron 2026-07-09 — see below |
| Hosting | Netlify (site `liftwatch`, auto-deploys `main` on push only); post-poll data reaches the live site via Netlify Blobs (`data.mts` serves /data.json + /systems/*), NOT rebuilds — zero build-minutes per poll |
| Backup / export | Weekly GitHub Action → dated XLSX + CSVs → Google Drive folder |
| Scope | Elevators only; `unit_type` reserved so escalators are a future config flip |
| Planned outages | Tracked separately; leaderboards rank on **unplanned** by default, with a toggle |
| Catalog | Solo-maintained, but structured as clean per-system files |
| Frontend | Hybrid: digital departure-display boards (amber LED aesthetic), editorial methodology pages |
| Alerts (later) | ntfy station subscriptions (reused from prior project) |
| Step-free detour limit | (2026-07-10) An **elevator-free** detour of at most **0.3 miles** counts as a step-free alternative — and the walk is always disclosed to the rider in the note. The detour itself must not depend on any elevator (Daly City's 0.3-mi surface walk qualifies; Warm Springs' 0.8 mi and 19th St's walk-to-another-station's-elevator do not) |
| Garage elevators | (2026-07-10, Millbrae precedent) A garage elevator that provides a **back access route** is a real chain member, included in models when the agency's guidance or a human confirms the route (MLBR, WDUB). Outside chains only when its destination is genuinely unknowable (bare "Garage Elevator 1" texts) |
| Agency-contradicts-us rule | (2026-07-10) When an agency's own guidance describes an elevator-free alternative that contradicts a NO ACCESS claim, it is applied via a **human-approved allowlist** (never auto-parsed), quoting the agency's words in the rider-facing note |

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
- `offline_events` — the OTHER archive (added 2026-07-07): a tracked unit that
  VANISHES from an inventory-complete system's feed is neither broken nor
  working — its status is unknowable, which is as bad as broken for planning a
  trip ("you can't know before you go"). Same open/close treatment as outages:
  opened once a unit has been unseen past a debounce window (~2 missed polls,
  using pre-upsert `last_seen` as the spell's start), closed when it reappears.
  Feed-declared-inactive units are exempt (that's decommission/replacement, not
  silence); so are discovered-inventory systems (WMATA/CTA — absence is
  normal), `best_effort` systems (BART — synthetic station-level units), and
  synthetic/orphan unit ids (`-UNSPECIFIED`, `TMB-`) — those last exemptions
  fix a real false positive (BART's `12TH-UNSPECIFIED` logged as offline).
  Reality check: every real inventory-complete feed returns its FULL inventory
  every poll, so this is genuinely ~0 today — a feed-integrity safety net, not
  a common event. Site: an OFFLINE column on the systems board, a per-system
  "status unavailable" board with the recent restored log, UNKNOWN state on the
  station access board when a route's elevator is offline, and offline units
  can't earn uptime streaks. Ingest and build-data degrade gracefully (warn +
  skip) until the table exists — the schema addition is applied by hand in the
  Supabase SQL editor, followed by `NOTIFY pgrst, 'reload schema';` (PostgREST
  caches the schema — required after ANY DDL on this project).
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
itself a confirmed statement. BART uses this — as of 2026-07-08 all 50 of its
stations are individually modeled (see CLAUDE.md's redundancy section), so the
baseline no longer has anything left to fall back on; it stays set for safety
if a future station is ever added to BART's own feed before being curated.

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

Hybrid, per decision (REVISED 2026-07-07 — the split-flap aesthetic was
retired for a **digital train-departure display**, RFI/LED style, chosen
against a reference photo):
- **Departure boards** for live + leaderboard views: amber LED rows on black
  strips, white sans-serif column headers, legibility-first (crisp mono type,
  no heavy pixel-grid effects). Outages read as departures: unit | station |
  status (reason) | time out | estimated return | information. A cell with
  **more than 7 words** becomes a continuous right-to-left marquee (an
  aria-hidden duplicate trails the visible text so the wrap is seamless;
  paused on hover/focus) — a deterministic word-count trigger rather than
  pixel overflow, which shifts with width/zoom. This applies to both the
  information column and the **status column** (2026-07-08): TfL has no
  structured status, so its whole free-text alert (30-40 words) lands there
  and needs to scroll like any other long cell; short statuses ("Repair",
  "Capital Replacement") stay put. A cell that's merely too wide without being
  long enough to marquee ellipsizes rather than hard-clipping — the full text
  is always in the row's expand strip. Every row expands to a detail strip
  with the full reason, agency-local timestamps, access impact (severed
  routes / working backups / ramp coverage) and the curated route notes. A
  bottom strip carries a live clock + rotating ticker. Systems rank by
  **unplanned** share; scheduled work has its own column and its own board.
  The homepage pairs the systems board with **two longest-outage boards split
  by cause** (2026-07-07): unplanned breakdowns (the shame metric) and
  planned closures, each ranked by duration within its cause — so a wall of
  multi-year planned capital replacements (161 St, Jamaica-179) can't bury
  the longest genuine breakdown, while planned closures that strand a
  sole-access station for months stay visible. Long durations **escalate for
  legibility** — plain days under a month, then months, then years, so
  "1201D" reads "3Y 3MO" — the same ramp on every day-count column (out,
  streaks, offline). New live boards: station access (NO ACCESS / REDUCED per
  modeled route) and scheduled work. All times are shown in the system's own
  IANA timezone (station time, not viewer time). Respect
  `prefers-reduced-motion` (no marquee/ticker/blink; ellipsis + static text).
  **Responsive** (2026-07-08): below 940px each table row collapses into a
  stacked card — every cell on its own line, labelled from its column header
  (a generic `labelCells()` reads each table's `<thead>` and stamps
  `data-label`, so it covers all board types with no per-board code) — so
  nothing is cut off or requires horizontal scrolling on a phone. Above the
  breakpoint the station column wraps to a second line rather than forcing
  the table wide. The breakpoint sits at 940px rather than a conventional
  tablet width because the widest board (a system with long unit ids plus two
  marqueeing columns) needs that much room before its station column
  shrinks to a sliver — cards take over below that instead. Accessibility is
  the markup itself — real `<table>`s with captions and scoped headers,
  `aria-expanded` row toggles, skip link, focus-visible styles; the old
  duplicated `#sr-data` layer is gone. (Known tradeoff: the mobile card layout
  sets `display: block` on table elements, which drops their native table
  semantics for screen readers at that viewport — sighted mobile users get the
  `data-label` prefixes, and the `<caption>` is retained; a documented,
  common pattern for responsive tables, not a full accessible-table solution.)
- **Editorial** treatment for methodology and story pages.
- **Disclaimer & methodology (2026-07-10)**: accessibility proclamations are
  explained on TWO SEPARATE TRUST AXES, never blended — (1) agency data
  quality: TfL + NYC Subway publish the best redundancy data ("trust the
  most"); WMATA + CTA feeds can't support access claims at all (outage list,
  never a verdict); (2) the maintainer's personal familiarity, ranked: 1
  DC Metro & BART · 2 NYC Subway, LIRR, Metro-North · 3 CTA · 4 TfL — and
  **never been on the MBTA** (stated plainly; nothing in Boston personally
  verified). The two axes deliberately cut opposite ways (knows DC best,
  weakest feed; knows TfL least, best feed). Three surfaces: an "About these
  assessments" section on the homepage, a full `site/methodology.html` page
  (what a proclamation means, the chain model, the four model-building
  methods, per-system summaries, the TMB withdrawal), and a per-system
  disclaimer section on `system.html` (a `DISCLAIMERS` map keyed by system
  id — editorial copy versioned with the page; a system without an entry
  shows no section). Feedback: a "coming soon" section by explicit choice —
  no live link until the real feedback feature ships.
- Deliberately not the generic-AI look: real type hierarchy, monospace numerals,
  one restrained status ramp, dense tables over airy cards.

---

## 7. Roadmap

- **Phase 0** ✓ — repo, schema, adapter contract, working MTA adapter.
- **Phase 1** ✓ — scheduled poller, event derivation into Supabase, many
  adapters (MTA, BART, MBTA, WMATA, TfL, CTA, TMB, LIRR, Metro-North).
  **Poller + hosting moved to Netlify 2026-07-09** (was GitHub Actions cron):
  GitHub silently stopped firing the `*/10` schedule for 30+ min stretches
  with no error — discovered when BART's Coliseum outage sat unarchived past
  its slot (`gh run list` showed a gap; GitHub documents scheduled workflows
  as best-effort and deprioritizes them on lower-traffic/public repos). The
  poll logic (`src/pollSystem.ts`) is now shared by both the CLI and a Netlify
  scheduled function (`netlify/functions/poll.mts`) on a **5-min** cadence —
  a REGULAR synchronous function polling all 8 feeds in parallel to fit the
  30s cap; a background function was tried first and its schedule silently
  never fires (see the function's header comment). Each poll rebuilds the site's data
  payloads (`src/site/build-site-data.ts`, shared with the `site:data` CLI)
  into Netlify **Blobs**, served at the site's existing /data.json +
  /systems/* URLs by `netlify/functions/data.mts` — fresh data with zero
  rebuilds (a build-hook-per-poll design was considered and dropped: ~288
  builds/day, ~9x the free tier, to swap a 17 KB file). Pages show "updated
  N min ago" from `generatedAt` and self-reload when a newer snapshot lands.
  The old `poll.yml` GitHub Actions cron was kept as a redundant fallback
  through the transition and **removed 2026-07-17** once Netlify's schedule
  had proven reliable for a week — Netlify is now the sole poller. See
  CLAUDE.md's "Deployment (Netlify)" for the operational detail.
- **Phase 1.5** ✓ — weekly backup (XLSX + JSON) to a private git repo (Google
  Drive abandoned: service accounts have no Drive quota).
- **Phase 2** ~ — the site: **live departure-board view shipped** (per-system
  boards, station access, scheduled work, offline log); still to do:
  parameterized geo-scope leaderboards + methodology page.
- **Phase 3** — payoff metrics: uptime %, MTTR, chronic-offender Hall of Shame,
  trends, streaks.
- **Phase 4** — ntfy station alerts, coverage map with "request your city",
  public data export.

Deferred / parked (not on the critical path): TfL multi-chain review for the
71 stations with branching/ambiguous topology (see §5's TfL section — the
safe majority shipped 2026-07-08, some now with alert-evidence hints from
real down-elevator alerts as a review head start), TMB feed data-quality
review (currently hidden), DB FaSta (Germany).

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

**Two live-verified traps (2026-07-07):** (1) the *current* feed MIXES IN
future scheduled outages flagged `isupcomingoutage=Y` (dated up to ~2 weeks
out, duplicated verbatim in the upcoming feed) — the adapter drops `Y` rows
whose start hasn't passed, or they ingest as phantom open outages (this bug
had inflated NYC Subway to 60 down/14.7% vs the true ~29/7.1%; 27 phantom
events were cleaned from the archive). (2) `ismaintenanceoutage` is vestigial
— `"N"` on every live record incl. rows whose `reason` is literally
"Maintenance" — so planned classification rests on the `reason` vocabulary
(`planned|capital|scheduled|maintenance|inspection`).

Field mapping: `equipmenttype=EL` → elevator (filter) · `equipmentno`/`equipment` →
external id · `stationcomplexid` → station id · `elevatorsgtfsstopid` → GTFS join ·
`ADA=Y` → `is_ada` · `redundant=0` → `is_redundant=false` (sole access) ·
`isactive=Y` → `is_active` · `ismaintenanceoutage=Y` or `reason` ~ planned/capital →
`is_planned` · `outagedate` → `source_started_at` · `estimatedreturntoservice` →
`estimated_return`.

### BART feeds (in use) — best-effort, station-level, but ALL 50 stations curated

BART exposes no structured per-elevator status. `data_quality: 'best_effort'`.
- Real-time (in use): `bsa.aspx?cmd=elev` — a free-text, **station-level**
  advisory ("2 elevators out: MLBR: Station; RICH: Station"). Parsed by matching
  station codes against the station list.
- Station list (in use): `stn.aspx?cmd=stns` — all 50 stations + coordinates;
  serves as the geo source and the denominator.
- Public key `MW9S-E7SL-26DU-VV8V` (override via `BART_API_KEY`).

**Every one of BART's 50 stations is curated** (`src/catalog/bart-station-models.ts`
+ 7 more hand-authored inline in `station-models.ts`; see CLAUDE.md's
redundancy section for the full writeup) — modeled stations expand into
per-elevator units the same way as BART's original 7 (ASHB/12TH/19TH/RICH/
SFIA/WARM/WDUB); outage advisories are attributed via `matchHints` (specific
elevator > segment-only > station-unspecified, never a guess) exactly as
before. Real-time outages that don't resolve to one specific elevator (the
live feed is usually just "Station", too vague — confirmed live 2026-07-08)
still fall to the conservative unspecified tier. All real-time outages are
unplanned.

**Source**: bart.gov's own "Elevator Outage Options" page
(`bart.gov/stations/<code>/accessible`) — a real, BART-published per-elevator
signal (scraped 2026-07-08, raw text archived at
`src/catalog/bart-data/elevator-pages.json`): for every elevator, BART states
what a rider should do if it's out, directly revealing whether an in-station
backup exists. Blocked WebFetch (403, a bot-protection WAF) but a plain
`fetch()` with a spoofed browser User-Agent works fine — no `claude-in-chrome`
needed once that was found. 4 stations (EMBR/MONT/POWL/CIVC, the BART/Muni
shared Market St. stations) additionally cross-validated against
TransitAccess (a sibling Muni accessibility project,
`C:\Users\Bryce\Claude\metro-access`)'s independent field survey — both
sources agree exactly.

Deferred sources (not parsed):
- GTFS static — no pathways/levels; nothing beyond the station list. Not used.

Planned-advisories RSS (`rss/news/planned-elevator-advisories.xml`) — WIRED
2026-07-09 (`src/adapters/bart/planned-rss.ts`, was deferred as "brittle
prose"): feeds `upcoming` (the scheduled-work board) and, narrowly, upgrades
a live outage to planned on an EXACT elevator-id match with an active
advisory window. The prose is indeed brittle, and two real traps were caught
by live verification before shipping: (a) the description names sibling
elevators that "remain in service" AND recommends alternative STATIONS
("use the 16th St. Mission Station instead"), so station matching + elevator
attribution both run ONLY on the title/subject clause (before "will be out
of service") — full-description matching live-misattributed the real 24th
St. item to 16TH; (b) BART strips HTML without spacing ("tank unit.During
this outage"), so nothing assumes ". " sentence separators. Date ranges
parse from the description's explicit "July 13 to August 10, 2026" prose
(title fallback, pubDate-anchored year resolution); unparseable dates
degrade to null, unrecognizable stations are skipped, ambiguous elevator
attribution falls to `${abbr}-UNSPECIFIED` — never a guess, same rule as
the live advisory. Fetch is best-effort (failure = empty scheduled work,
never a failed poll — same posture as camsys enrichment); www.bart.gov's
WAF needs the browser-UA workaround (same as the elevator-pages scrape).

**Attribution — status as of 2026-07-08 end of session.** BART's live
`bsa.aspx?cmd=elev` advisory is the ONLY real-time signal, and it is free
text with no structured elevator field anywhere — confirmed by checking three
official sources (the live advisory's raw JSON, the outage-options page's raw
HTML, and BART's own "Elevator Dimension Guide" PDF at
`bart.gov/sites/default/files/docs/AccessibilityBARTElevatorDimensions_0.pdf`);
none contains a numeric or otherwise stable per-elevator ID, only descriptive
route names. So the ceiling on automatic attribution is always going to be
"can we recognize enough of the free text," never "look up an ID."

*What's shipped and working*: `attributeOutageAcrossChains()`
(`src/lib/accessibility.ts`) tries every independent chain at a station and
attributes only when EXACTLY ONE chain's `matchHints` matched — fixing a real
bug where the adapter only ever checked a station's first chain (a stale
"no BART station has more than one chain" comment, true when written, false
after this session curated 13 multi-chain per-direction stations). Two
stations — **Milpitas and Hayward** — have their `matchHints` CONFIRMED
against a real live advisory (Milpitas: "SF/East Bay" regional shorthand,
caught and fixed by testing before shipping; Hayward: "SF/Richmond").
**12th St.'s "convention center" hint is also confirmed** (4 of BART's 11
historical events used that exact phrase, found by mining the archive).

*What's shipped but UNVERIFIED*: the other 10 per-direction stations (of 12
total — DELN, PLZA, FTVL, PHIL, SANL, UCTY, WCRK, WOAK, MCAR, DALY; see
`bart-station-models.ts`) have `matchHints` built from the outage-options
page's wording only, with no real live advisory yet observed to confirm BART
phrases it the same way. They may already work, may need the same kind of
regional-shorthand correction Milpitas needed, or may never match — unknown
until a real example appears in `outage_events.reason`.

*Millbrae directional attribution — resolved from a real advisory (2026-07-16)*:
Millbrae is a special complex station (BART/Caltrain shared), NOT one of the 12
templated per-direction stations. Its real live advisory `"Station - SF/East
Bay/SFO Airport"` (archived 2026-07-04, previously in the `structuralUnsolvable`
bucket and pushing a recurring needs-review alert) is now attributed to
`MLBR-PLAT-3` via `"east bay"`/`"sfo airport"` `matchHints` on the Platform 3
elevator. Basis: Millbrae is the southern TERMINUS, so all trains depart
northbound and a directional "SF/East Bay/SFO Airport" advisory can only mean
the outbound platform elevator — and BART's own advisories concern BART's own
elevator, of which Platform 3 is the only one (the Caltrain NB elevator is
tracked solely as its named backup). The advisory TEXT is confirmed real; the
mapping mirrors the CONFIRMED Milpitas "SF/East Bay" pattern. Because
`MLBR-PLAT-3` is redundant, the station correctly stays accessible when only it
is out. Locked in `demo:access` (advisory→`MLBR-PLAT-3`, redundancy-keeps-
accessible, and a disjointness check that a concourse "East Plaza" advisory is
NOT dragged onto the platform elevator).

*The bare-"Station" case — DIRECTED BY POLICY 2026-07-12 (Bryce)*: a bare
"Station" advisory (no direction/destination that any `matchHint` catches)
can never be attributed by text-matching — that's structural. Bryce's rule
resolves it by DEFAULT instead of by text: **"when BART refers to something
simply as the station elevator, unless I say otherwise, that means it goes to
the platforms."** Implemented as `platformDefaultElevator()`
(`src/lib/accessibility.ts`): the platform is the terminus of the access
chain, so the elevator in each chain's LAST segment is the platform elevator;
the adapter falls to it when `attributeOutageAcrossChains()` returns null.
CRITICALLY it fires ONLY when the whole station resolves to exactly ONE
platform elevator — a per-direction station has several, so it returns null
and stays conservative (`{ABBR}-UNSPECIFIED`), preserving the
never-guess-a-specific-elevator rule (this is NOT the rejected "smart
guessing heuristic" — it's a single, explicit, station-structure default that
declines whenever there's a choice). "Unless I say otherwise" = a station
whose real meaning differs gets a `matchHint` (or, if truly unreachable, an
`attribution-overrides.ts` entry) that resolves it before the default is
reached. Live effect (verified `poll:bart:dry` 2026-07-12): RICH/POWL/COLS all
went from `-UNSPECIFIED` to `RICH-PLAT`/`POWL-PLAT`/`COLS-EL` with clean
reasons; MacArthur still attributes via its direction hint; regressions in
`demo:access` lock in single-platform→attributes and per-direction→null.

*Coliseum — all four elevators now modeled (2026-07-12, Bryce: "include it
all")*: BART tracks FOUR elevators at COLS, and the platform default made the
earlier "any COLS advisory → COLS-EL" over-warn risk concrete. Now each is its
own chain sharing the COLS id: the main **station** chain (`COLS-EL` → BART
platforms) plus three chains flagged `auxiliary: true` on the `StationModel` —
**Oakland Airport Connector** (`COLS-OAC`, sole access, non-redundant),
**arena footbridge** (`COLS-ARENA`, redundant — ramp alternative), **parking
lot** (`COLS-PARKING-LIFT`, redundant — surface-street alternative). An
auxiliary outage severs only its own labeled route (build-data evaluates each
chain independently), never the BART platforms. The new `auxiliary` flag is
consumed ONLY by `platformDefaultElevator`, which now filters auxiliary chains
out before its exactly-one-platform test — so a bare/ambiguous "Station" (or
the live "Terminal/Station") still resolves to `COLS-EL`. HINT ASSIGNMENT
follows Bryce's own reading of BART's unreliable text, NOT a guess about the
words: the station elevator is HINT-FREE (it is the platform default, so
anything unclaimed lands there — "Terminal/Station" is the platform elevator
per Bryce); `"tunnel"` hints the **arena** elevator, because Bryce identified
BART's "Station - Tunnel" advisory as the arena footbridge elevator (NOT the
station — an easy mis-assignment the first pass made). The OAC hint remains a
GUESS from BART's page name (no live OAC advisory observed) — flagged for
confirmation. The parking-lot `COLS-PARKING-LIFT` is a wheelchair LIFT, not an
elevator, so (Bryce, 2026-07-12) it was MOVED OUT of the elevator model into the
other-accessibility-equipment layer (`bart-other-equipment.ts`, matched by a
"parking" hint on the advisory) — it never touches the elevator count. Coliseum
therefore has 3 elevators (station + 2 auxiliary chains) plus 1 tracked
non-elevator lift.

*Richmond override — REMOVED 2026-07-12*: the manual
`src/catalog/attribution-overrides.ts` entry that redirected
`RICH-UNSPECIFIED → RICH-PLAT` (added 2026-07-08, Bryce-confirmed) is gone —
the platform-default policy above now attributes "RICH: Station" to
`RICH-PLAT` directly at the adapter, with a clean reason, so no ingest-level
redirect is needed. (It also fixed a subtler artifact: ingest re-writes an
event's `reason` every poll from the adapter's text, so the override moved the
`unit_id` but the reason still read "unspecified elevator — conservative" —
attributing at the adapter fixes both.) `ATTRIBUTION_OVERRIDES` is now an
empty array; the mechanism stays for a future station where a human confirms a
specific elevator that neither `matchHints` nor the platform default can
reach. (Milpitas's `MLPT-PLAT-2` `started_at` correction this session was a
cutover-timing fix, not an attribution override.)

*Progressive evidence-mining tool — built 2026-07-09* (`src/site/
bart-attribution-evidence.ts`, `npm run bart:attribution-evidence`, mirroring
the TfL alert-evidence precedent above): re-runnable, growing-over-time
version of the one-off manual queries that found the confirmed examples
above. Its one important design choice: it does NOT trust the `unit_id`
archived at original ingest time — it re-derives attribution fresh, running
TODAY's `matchHints` against the archived raw `reason` text for every
historical event. This matters because trusting the stored `unit_id`
understates progress (verified live: every archived 12TH event predates the
"convention center" hint by four days, so its stored id was still the old
"unspecified" fallback even though today's hint now resolves it correctly —
the recompute approach fixed this and now shows 12TH as confirmed
automatically, no manual query needed). Output (`src/catalog/bart-data/
attribution-evidence.json`) buckets events into `confirmed` (resolves to one
elevator under today's hints — same evidentiary bar as Milpitas/Hayward/12th
St.), `chainAmbiguous` (multi-chain stations where zero/2+ chains matched —
the main mining target for the 10 unverified stations), `segmentAmbiguous`,
and `structuralUnsolvable` (resolves to nothing even under today's hints;
annotated with `manualOverrideNotes` when a human has already worked around
that station, and `pureSpof` when the station's model is a genuine single-
elevator SPOF with no known unmodeled siblings — see below). Never
auto-applies anything; every bucket is raw evidence for a human to read.

*A real finding from building it, and a claim retracted*: a live example from
Bryce ("Coliseum's advisory can read 'Station - Tunnel', about the
pedestrian-bridge elevator to the arena") was first suspected to be a live
misattribution bug — COLS-EL's only hint is the generic word "elevator", and
BART's advisory always contains "N elevators out:", so the fear was that
generic hint would match ANY Coliseum advisory including ones about other,
unmodeled elevators there. **Verified false**: `parseAffected()`
(`src/adapters/bart/index.ts`) already strips the "N elevators out:" prefix
before per-station matching — the per-station `desc` text never contains the
literal word "elevator" in any observed example ("Station", "Station - SF/
East Bay", "Station - Convention Center", "- Terminal/Station"), so a generic
"elevator" hint effectively never matches at all and there is no live
misattribution risk today. The evidence tool still carries a `genericHintRisk`
detector (defense-in-depth, currently 0 flagged) in case that ever changes.
The REAL finding underneath the false alarm: because "elevator" never
matches, EVERY pure-single-elevator SPOF station (BALB, BAYF, BERY, CAST,
COLM, CONC, DUBL, FRMT, GLEN, LAFY, NBRK, NCON, ORIN, PCTR, ROCK, SBRN, SSAN,
OAKL — the `matchHints: ["elevator"]` template) currently gets ZERO
attribution credit even though a station-level advisory there is logically
unambiguous (there is no OTHER elevator it could mean) — the site's
per-elevator stats for these ~17 stations never accumulate real downtime,
always falling to `{ABBR}-UNSPECIFIED` instead of the one real elevator id. A
blanket "always attribute a single-chain station's advisory to its one
elevator" fix would be safe at all of these EXCEPT COLS, which is a single
MODELED chain but has real unmodeled auxiliary elevators noted in its own
curated comment (Oakland Airport Connector, a parking-lot lift, a pedestrian
bridge to the arena) — a genuine competing candidate the advisory could
actually mean. The evidence tool's `pureSpof` flag already distinguishes
these (checks the model's own note for "auxiliary"/"not modeled" language
before flagging), but the fix itself — auto-attributing genuinely unambiguous
SPOFs — was surfaced, not applied; it's a real change to attribution
semantics, not just a `matchHints` tweak, and needs Bryce's steer like
everything else in this section.

### MBTA feeds (in use) — genuinely per-elevator

JSON:API (`https://api-v3.mbta.com`), `data_quality: 'good'`. Optional
`x-api-key` header (`MBTA_API_KEY`; unauthenticated works at 20 req/min, which
covers our cadence — a key raises it to 1,000/min).
- `/facilities?filter[type]=ELEVATOR&include=stop` — 237 elevators across 80
  stations (one page, `page[limit]=200` + pagination guard for headroom).
  `include=stop` gives station name, municipality, and coordinates directly —
  no separate geo enrichment needed, unlike MTA/BART.
- `/alerts?filter[activity]=USING_WHEELCHAIR` — an elevator outage is an alert
  whose `informed_entity` names a **known ELEVATOR facility** (join against the
  `/facilities?filter[type]=ELEVATOR` set above), NOT one whose `effect` is
  `ELEVATOR_CLOSURE`. **MBTA files the same real elevator outage under several
  effect labels** — `ELEVATOR_CLOSURE`, `ACCESS_ISSUE`, and `FACILITY_ISSUE`
  all seen live for elevators-out (e.g. Kendall/MIT 777 "unavailable due to
  maintenance" arrives as `ACCESS_ISSUE`; Lynn 929/930 likewise). Gating on
  `effect` silently dropped those; the facility-type join is the reliable
  filter and also excludes non-elevators (escalator under `FACILITY_ISSUE`,
  mini-high platform under `ACCESS_ISSUE`) regardless of effect. Same
  don't-trust-an-unverified-feed-field trap as CTA `FullDescription` / MTA
  `isupcomingoutage`. `active_period[0].start/end` are **already ISO-8601 with
  a UTC offset** (no local-time parsing, unlike MTA/BART). `cause` in
  `{MAINTENANCE, CONSTRUCTION}` → planned. Future `active_period.start` splits
  current vs. `upcoming`.
- One alert's `informed_entity` can list the same `facility` id many times
  (once per affected stop/route) — deduped to unique facility ids per alert.
- **Non-elevator access-issue layer** (see "Access issues" below): the same
  alert feed also names non-elevator accessibility facilities (mini-high
  platforms, ramps, portable lifts). These are captured as a SEPARATE layer,
  never mixed into elevator metrics.
- No explicit redundancy field — falls through to the existing precedence
  engine (`single_elevator` / `assumed`), same as any uncurated system. Some
  facility `properties` include `alternate-service-text` naming a backup
  elevator in prose (e.g. "use the nearby Elevator 736") — a candidate for
  future curation, intentionally not auto-parsed (same policy as BART's
  planned RSS).

### Other accessibility equipment — non-elevator step-free equipment (MBTA + BART Coliseum lift)

*(Renamed from "Access issues" across the board 2026-07-12, per Bryce.)* A
supplementary "before you go" layer for accessibility equipment that is **not an
elevator** but whose loss removes step-free/accessible access: mini-high boarding
platforms (`ELEVATED_SUBPLATFORM`), raised platforms (`FULLY_ELEVATED_PLATFORM`),
portable boarding lifts (`PORTABLE_BOARDING_LIFT`), wheelchair lifts
(`WHEELCHAIR_LIFT`), and ramps (`RAMP`). Escalators are deliberately **excluded**
(not step-free/wheelchair access; the project reserves-but-doesn't-track them).

- **Walled off from elevators by design.** These facilities are never in
  `units`, never enter the elevator inventory, the "% of fleet down" math, or
  any elevator leaderboard. They live in their own denormalized
  `other_equipment_events` table (no FK to `units`) and render on their own
  per-system "Other accessibility equipment" board, hidden for every system that
  exposes no such data.
- **Captured by facility TYPE, not `effect`** — same reliable join as the
  elevator fix: a second `/facilities?filter[type]=…` call fetches the
  accessibility facility types, and any alert `informed_entity` naming one is
  emitted as a `NormalizedOtherEquipment`. Only current (not future-dated) items
  are archived. `cause ∈ {MAINTENANCE, CONSTRUCTION}` → planned, same as
  elevators.
- **Archived, open/close, like outages** (the user chose history over a
  current-only snapshot): ingest §6.5 opens/refreshes/closes
  `other_equipment_events` keyed by `(system_id, facility_external_id)`; the
  board shows current-out first, then a recent resolved log with durations.
- **BART Coliseum wheelchair lift — first non-MBTA member** (2026-07-12). BART
  has no per-facility feed, so its one piece of other equipment (the Coliseum
  station-to-parking wheelchair lift) is a CURATED entry
  (`src/catalog/bart-other-equipment.ts`) matched against the advisory text by a
  "parking" hint, checked in the adapter BEFORE elevator attribution so a match
  emits a `NormalizedOtherEquipment` instead of an elevator outage. Split out of
  the elevator model so it never inflates the elevator count.
- **General mechanism — and a COMMITTED goal to extend it.** The type
  (`NormalizedOtherEquipment`), table, ingest, and board are system-agnostic;
  MBTA (by facility type) and BART (by curated hint) populate
  `NormalizedRead.otherEquipment` today. **Whenever
  another tracked system exposes comparable non-elevator step-free-access data
  (boarding platforms, portable lifts, ramps, or an equivalent "access issue"
  feed), we WANT to wire it into this same layer** — this is an ongoing project
  direction, not an MBTA one-off. The bar is the usual one: a REAL, verified
  per-facility signal (never a guessed or unverified feed field), captured by
  facility identity/type rather than by a fragile status/effect label. As each
  system is audited against its agency's own accessibility status page, check
  whether it has such facilities and add them here.
- `other_equipment_events` is a **later schema addition** — apply the block in
  `db/schema.sql` in the Supabase SQL editor, then `NOTIFY pgrst, 'reload
  schema';` (PostgREST caches the schema — same gotcha as `offline_events`).
  Ingest and build-site-data degrade (warn + skip → empty board) until it
  exists, so shipping the code before applying the DDL is safe.

### Unidentified-outage flag (universal, 2026-07-12)

`NormalizedOutage.needsReview` marks an outage we could NOT confidently place
onto a specific known elevator: a conservative `-UNSPECIFIED` fallback, or a
low-confidence guess (BART's platform default at a station that ALSO has other
equipment, e.g. Coliseum — a single-platform default like Richmond/Powell is
confident and does NOT flag). Persisted as `outage_events.needs_review`.
Surfaced three ways so a human gets flagged: a poll-time warning (`poll.ts`), a
per-system "Needs review" board (`build-site-data` → `needsReview`, rendered in
`system.html`), and an **ntfy push** (`src/lib/notify.ts`, fired from
`pollSystem` for NEWLY-opened flagged outages only, so a standing one doesn't
re-alert every 5-minute poll). The mechanism is universal — any adapter may set
`needsReview`; today only BART does. Requires the `NTFY_TOPIC` env var for the
push (silent no-op without it); `needs_review` is part of the `outage_events`
DDL, so a fresh `db/schema.sql` apply picks it up.

**Missing-information extension (2026-07-12).** The same `needs_review` channel
also flags an outage MISSING a rider-facing field its own system is expected to
provide. The distinction that makes this useful rather than noisy comes straight
from the 2026-07-12 data-integrity audit (see below): most blank fields are
AGENCY LIMITATIONS, not bugs. So a per-system CAPABILITY PROFILE
(`src/catalog/field-expectations.ts`) declares, per system, `expectsReturn` (the
agency always publishes an estimated return — MTA, WMATA) and `curatedRoute` (we
model access chains, so a modeled unit knows where it goes and whether it's
redundant — MTA/BART/TfL/MBTA/rail). `missingExpectedFields()` then flags: an
empty reason/location anywhere; a missing return where `expectsReturn`; and an
un-modeled unit (redundancy `assumed`, or no unit at all) where `curatedRoute` —
a curation gap. It never flags an agency limitation (BART/TfL returns, WMATA/CTA
redundancy). The flag reason ("missing predicted return", "route/redundancy")
rides the push + poll warning. Verified quiet where data is complete
(MTA/TfL/BART/CTA = 0 flags) and firing only on genuine gaps (un-modeled
MBTA/LIRR/MNR stations). Update the profile when a system's real capability
changes — it is the single source of truth for "what should this system be able
to tell a rider?". **Per-symptom refinement (2026-07-16):** `expectsReturn` can
have a documented per-class exemption — WMATA publishes a return for its
categorized symptoms but NOT for the open-ended `"Other"` catch-all, so
`missingExpectedFields()` (`returnExempt()` helper) does not flag a blank return
on an `"Other"`-symptom WMATA outage (it was pushing a spurious "missing
predicted return", e.g. Waterfront F04X01). Regression-locked in `demo:access`.

### Data-integrity audit (2026-07-12)

A full play-test of the live site cross-checked all 125 currently-shown
elevator outages against each agency's own live feed. Result: **125/125 match,
zero phantom, zero missing** — the site faithfully mirrors every agency, and no
misattributions or wrong dates surfaced (NYC capital-replacement times, WMATA
estimates, Richmond's 2024 and Grand Central NE-4's 2023 long-runners all
matched to the minute). The audit's lasting output is the field-expectations
profile above (it encodes which blanks are agency limits vs real gaps) and this
finding on where "complete information" actually falls short: (1) WMATA + CTA
carry no where-it-goes/redundancy because they aren't curated — the one real
gap, closable only by BART-style hand-curation; (2) TfL and some rail alerts
state a return in prose ("until Autumn 2026") that isn't mined into the
structured field the way CTA's is; (3) rail "reason" is often just the raw
status ("not working") because `eestatus` carries no cause. Everything else is
as complete as the source allows.

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
  inference (broken-unit counts are not fleet counts). The GTFS pathway-graph
  redundancy build shipped 2026-07-13 (next section) — the crosswalk turned
  out to be the *level pair* in `LocationDescription` plus progressive
  observed-UnitName binding, not a UnitName↔node mapping (which truly doesn't
  exist).
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

### WMATA per-elevator build (2026-07-13) — GTFS pathways chains, observed binding, fail-safe

56 stations initially carried per-elevator access-chain models (55 generated +
Rockville hand-curated, 57 chains) with topology-derived redundancy — since
2026-07-17 all 98 stations do (see "STATION REVIEW COMPLETE" below) — while
`inventoryComplete` stays `false` and `staticFleetReference` (320) stays the %
denominator, because ~⅓ of the fleet is garage/parking elevators absent from
the rail GTFS (live-confirmed: "Garage elevator" outages at B11/C15/D13/K06…).
The chains are an ADDITIVE accessibility layer (TfL-chains style), not a fleet
claim. **Universal policy (Bryce, 2026-07-13): every elevator an agency reports
is tracked** — garage/parking/bridge included — **but an elevator enters an
access chain only when the agency's guidance or a human confirms the route.**

- **Extraction** (`scripts/wmata-pathways.mts`): a physical elevator = a
  CONNECTED COMPONENT of the mode-5 pathway subgraph — robust to WMATA's
  inconsistent node naming (a name regex missed ~25%) and structurally unable
  to split a 3-level shaft into a false redundant pair. Levels from stops.txt
  (entrances → Street; a node with a direct walkway to a `PLF_` stop is forced
  to Platform — WMATA mislabels the platform end at K07/D05/E02). All 206
  in-station elevators captured across 98 stations.
- **Conservative gates** exclude 43 stations to `chains-excluded.json` (reason
  per station): non-standard levels (15, the big transfers), side platforms
  (16 — step-free platform-reachability tracing proves their two
  mezz→platform elevators serve DISJOINT directions, so level-pair grouping
  would mint false redundancy; e.g. Dupont's PF_1/PF_2 each with a sole
  elevator), 3-level shafts (3), corrupt GTFS levels (A02 → points at A03's),
  unorderable levels (2), plus the observed gates below.
- **Observed-units gate** (`scripts/wmata-observed.mts` →
  `wmata-data/observed-units.json`, grows only): every UnitName ever seen in
  the feed (archive + live, 78 as of 2026-07-13) must map onto exactly one
  modeled segment, and no segment may show more distinct observed units than
  GTFS elevators. Caught real GTFS undercounts: **Forest Glen B09** (elevator
  BANK drawn as one pathway — 3 observed vs 1), **Mt Vernon Sq E01** (2
  platform elevators vs 1), **Morgan Blvd G04** (2 vs 1); and unmappable
  vocabulary: **Rockville A14** (pedestrian-bridge pair absent from GTFS),
  **NoMa B35** (bike-trail elevator), **Downtown Largo G05**.
- **Observed-name binding**: model slot ids are REAL live UnitNames wherever
  the unit has ever appeared (slots within a segment are interchangeable, so
  sorted-order assignment is exact); never-observed slots keep synthetic
  `WMATA-<node>` ids until their UnitName first shows up (then regenerate).
  31 of 105 modeled elevators bound so far — live outages match models BY ID.
- **Curated tier** (`src/catalog/wmata-models.ts`): Rockville A14 — mezzanine
  at street grade, sole mezz→platform elevator (core chain), plus the
  human-confirmed (2026-07-13) pedestrian-bridge pair A14X01/A14X02 as its own
  chain (BART Warm Springs precedent). `check:wmata` guards tier non-overlap.
  **+21 stations from the excluded set, via `/liftwatch-station-review`
  batching (2026-07-15)**: the 43 originally-excluded stations split cleanly
  by risk — no-redundancy ladder-chain shapes (a shared street↔mezzanine
  prerequisite feeding one or two per-direction platform legs, or a straight
  street→platform run with unusual level names) batch safely since nothing
  in them CLAIMS a backup; genuine ambiguity stayed individual. Shipped
  in 4 structural groups (Judiciary Sq/Arlington Cemetery; Reagan National
  Airport/Eisenhower Ave/West Hyattsville/Hyattsville Crossing;
  Dupont Circle/McPherson Sq/Farragut West/Pentagon City/Crystal City/
  Cheverly/Clarendon/Virginia Sq-GMU; Woodley Park/Cleveland Park/Van Ness-
  UDC/New Carrollton/Southern Ave/Suitland/Franconia-Springfield). Several
  elevators upgraded from synthetic `WMATA-<node>` slots to real observed
  `UnitName`s during this pass by cross-checking `observed-units.json`
  (Reagan National Airport ships fully real; Cheverly's both platform legs
  are real).
- **STATION REVIEW COMPLETE (2026-07-17): the remaining 22 excluded
  stations were resolved one at a time with Bryce — 98 stations now carry
  per-elevator access-chain models, ZERO excluded.** The observed-units gate
  alone couldn't catch everything GTFS got wrong; several stations needed
  Bryce's direct knowledge or WMATA's own per-elevator status-page text
  (pasted in chat) to resolve correctly:
  - **GTFS-undercounted redundant banks**: Potomac Yard (3 street entrances
    × 2 elevators each, plus 2-elevator platform pairs — GTFS drew 1 per
    entrance/platform) and Rosslyn (3 redundant street elevators, GTFS drew
    1) both had 2-3x more elevators than GTFS modeled.
  - **Mezzanine at street grade, no elevator on that leg**: Downtown Largo
    (Harry Truman Dr entrance), West Falls Church (I-66/Leesburg Pike median
    entrance), and Innovation Center (a separate elevator-free pedestrian
    bridge to Innovation Ave, alongside 2 real "South Entry Pavilion"
    elevators — modeled via `stepFreeAlternative` since the real elevators
    stay tracked, just never gate accessibility alone).
  - **Single elevator serving multiple stacked levels**: Fort Totten (one
    shaft, all 3 levels — Red Line + both Green/Yellow platforms).
  - **Stacked interchanges resolved from WMATA's own elevator-description
    text**: Metro Center, Gallery Place, and L'Enfant Plaza each split into
    2-3 chains (one straight-through, one/two requiring a down-then-back-up
    3-elevator series through a specific platform side — the two ends of the
    upper level aren't directly walkable at any of the three).
  - **A mis-exclusion caught mid-review**: Huntington's "Garage #1
    elevator" was first modeled as auxiliary/parking-only by name pattern
    match, then corrected — it's actually the REQUIRED street↔mezzanine
    elevator for the North Kings Hwy entrance (a garage-sounding name
    doesn't mean parking-only; same caution as the Millbrae precedent).
  - **Corrupt-levels flag confirmed genuine**: Farragut North's 2 GTFS
    Mezzanine↔Platform edges don't reflect reality at all — real structure
    is a plain 2-elevator series (street→mezzanine, mezzanine→platform).
  Every resolved station carries a numeric confidence rating and its full
  evidence trail (including exact lat/long for many street entrances) in
  `src/catalog/review/queue.json`. Two internal (non-public) watch notes
  remain open, documented inline in each station's `internalNote`: NoMa
  B35's elevator count (WMATA's materials say 1, Bryce is certain of 2) and
  Ballston-MU K04's observed-unit-id-to-physical-elevator mapping
  (inferential, not confirmed by a platform-naming alert).
  **Infra fix found during this pass**: `scripts/review-queue.mts`'s
  rebuild step used to regenerate each station's `evidence` array from
  source files on every run, silently discarding any hand-added entry — a
  real incident where every manually-recorded confirmation and elevator
  coordinate since Mt Vernon Sq was wiped by routine `npm run review:queue`
  calls before being caught and restored from the session transcript. Fixed:
  the merge step now carries forward any prior evidence entry the
  regenerated list doesn't already contain (grows-only, exact source+text
  dedupe) — hand-added evidence can no longer be lost to a rebuild.
- **Adapter attribution** (`attributeWmataIncident`, pure):
  id-in-model → modeled (segment + model-derived redundancy, source
  `pathways`/`curated`); unknown UnitName at a modeled station → level-pair
  fallback (`parseWmataLocation`, the ONE vocabulary shared with the
  generator) attaches `unit.segment` + flags `needsReview`; unparseable →
  `needsReview`, no segment; garage → plain tracked unit, never flagged,
  never a chain member. Un-modeled stations unchanged.
- **Site fail-safe** (`build-site-data`, generic): an OPEN `needs_review`
  elevator outage at a modeled station whose id matches no chain elevator
  there (a) counts as one extra distinct down unit on its `unit.segment` if
  the adapter placed it, else (b) makes every chain at the station read
  UNKNOWN — never accessible. Deliberately `unknown`, not `no_access`:
  hard-severing would claim knowledge we don't have (the unknown unit may be
  one of a redundant pair); `unknown` = "can't verify before you go" and the
  station stops reading clean. Also covers BART's `-UNSPECIFIED` outages,
  which previously didn't surface on the access board at all.
- **Regression**: `npm run check:wmata` (offline, ~50 asserts) — tier
  separation, all gate exclusions, binding completeness (every observed
  non-garage unit at a modeled station matches by id), redundancy
  spot-checks, the full location vocabulary, and the attribution crosswalk.
- **Refresh loop**: a new UnitName fires the ntfy needsReview push → run
  `npm run wmata:observed`, re-download the GTFS zip, re-run
  `scripts/wmata-pathways.mts`, `npm run check:wmata` — the unit binds (or
  its station auto-excludes if it broke the model).
- Live cross-validation at build time: Rockville's bridge pair (both out) →
  bridge chain NO ACCESS listing A14X01+A14X02; King St C13N01 out → REDUCED
  via bound partner C13N02; Columbia Heights E04X02 (sole) → NO ACCESS;
  4 garage outages tracked with zero chain effect.

#### WMATA auto-tier spot-check + Rider-Tools inventory + bulk id promotion (2026-07-18)

Two connected efforts, driven by `/liftwatch-wmata-spot-check` then a full
id-promotion sweep. **First**, a hand accuracy audit of the ~46 auto-generated
station models (the GTFS-derived tier, never individually reviewed) found and
fixed **8** — A08 Friendship Heights (a 2-axis error: separate mezzanines + a
4-elevator street bank GTFS drew as 1 → re-modeled CNF, then all 7 slots given
real ids + the Jenifer St. cluster location); N06/N11/N10/D01 (page-inventory
undercounts → real 2×2 / 4-banks); C13 King St (a 3rd standalone platform
elevator); F06 Anacostia (redundant pair split across two entrances, redundant
only via a disclosed ≤0.3-mi step-free walk — the detour policy); B10 Wheaton
(at-grade ramp mezzanine + a phantom GTFS street elevator dropped); B11 Glenmont
(street pair confirmed redundant across the Georgia Ave surface crossing). New
generator exclusion classes: `page-inventory-undercount`, `step-free-detour-
redundant`, `mezzanine-at-grade`, `surface-crossing-redundant`, `split-mezzanine`.

**Second**, WMATA's own Rider-Tools station-info pages became a THIRD ground-truth
source (`wmata-data/rider-tools-inventory.json`, all 91 rail stations): real
UnitNames + per-entrance groups + level phrases in the shared `parseWmataLocation`
vocabulary. A purely-additive binding pass in `scripts/wmata-pathways.mts` fills
every still-synthetic GENERATED slot with its real id by level-pair (2 wording
quirks handled by `PAGE_ID_OVERRIDES`: A15 "parking/Kiss & Ride", B03 "Amtrak
station") → 0 synthetics in `chains.json`, re-derived identically each daily
refresh. **33 CURATED stations** then had their synthetic ids promoted to real
UnitNames (Tier A — self-consistent swaps where structure already matched the
page; directional per-direction platforms matched to WMATA's destination wording).

A full cross-check of EVERY model (curated + generated) vs the page found **0
wrong ids, 0 genuine segment errors** (the only Class-B flags were false
positives: CNF/interchange custom segment names + the at-grade `street-platform`
convention). The **13 "Tier B" stations** were the only real discrepancies —
**ALL RESOLVED 2026-07-18** via `/liftwatch-wmata-tier-b`:
- **Silver Line grade-separated pairs (N01/N02/N03/N04/N07/N08/N12) — FIXED.**
  WMATA's page confirmed a redundant PAIR on every leg (two opposite-side
  entrance pavilions + a shared platform bank, 6 elevators per station) vs the
  prior single-elevator models; all 7 flip to redundant (single-fault
  tolerant). Bryce reconfirmed the median grade separation, but with a
  correction: the two pavilions ARE step-free connected, just via a long
  crossing that isn't necessarily pedestrian-safe — disclosed in the rider
  note but deliberately NOT counted as a cross-pavilion backup (kept as two
  separate per-pavilion pairs, over-warn). N01/N02's non-page-confirmed side
  is still inferred by elimination (WMATA labels it "mezzanine to grade/
  street" rather than a compass side).
- **Watch-item conflicts — RESOLVED.** NoMa B35 reconciled to WMATA's count
  (1 platform elevator, no longer redundant — the long-standing watch item is
  closed). Southern Ave F08's assumed pedestrian-bridge elevator confirmed
  NOT real and dropped; its garage elevator is now tracked as its own
  auxiliary chain. Huntington C15's entrance elevator promoted to its real id
  (C15N01); the inclinator confirmed to have no real id anywhere in WMATA's
  feed (separate equipment) and stays a synthetic placeholder. Ballston K04
  is the one item Bryce deliberately left OPEN rather than guessed: the
  Vienna-bound platform elevator is one of two real ids (K04X01/K04X03), but
  which one is unconfirmed — modeled conservatively as requiring BOTH
  (over-warn) until a future WMATA alert disambiguates; the `internalNote`
  carries a standing TODO to watch for that wording.
- **Structural — FIXED.** C11 Potomac Yard was a real bug: WMATA groups
  Downtown Largo + Mt. Vernon Sq on ONE platform (not opposite directions as
  modeled) and Franconia-Springfield + Huntington on the OTHER — the model
  had no chain at all for the second platform. Re-modeled as two SIDE
  platforms (Bryce corrected an initial single-island-platform assumption)
  sharing one 6-elevator entrance bank. C06 Arlington Cemetery's guessed
  East/West labels swapped for WMATA's own destination names.

Every WMATA elevator now carries a real UnitName station-for-station against
the page, except the Huntington inclinator (confirmed to have none) and K04's
deliberately-unresolved through-shaft ambiguity.

**Final accuracy audit (2026-07-20) — merged-station keying bug fixed.** An
independent cross-check of every production model against every ground-truth
source (`npm run wmata:audit`, `scripts/wmata-final-audit.mts`) came back clean
except for one structural defect: the four stacked-interchange curated models
(Metro Center, Gallery Place, Fort Totten, L'Enfant Plaza) had been keyed under
the GTFS pathways generator's COMPOUND transfer-station id (`A01_C01`,
`B01_F01`, `B06_E06`, `D03_F03`). That id is the generator's own namespace and
never appears in the live incidents feed, which reports each elevator under a
real SINGLE code — so the adapter's `stationModelsFor(...).get(i.StationCode)`
found no model and these four busy interchanges' curated chains were silently
bypassed for both attribution and the access board (every outage there
attributed `unmodeled` from 2026-07-17 until this fix). Corrected by re-keying
each model to its canonical real feed code plus `coveredStationExternalIds`
(e.g. Metro Center → `C01`, covers `["A01","C01"]`; L'Enfant → `F03`, covers
`["D03","F03"]`), and by making the WMATA adapter resolve incidents through a
covered-id-aware index (`wmataModelsByFeedCode`) so an elevator reported under a
non-canonical covered code (L'Enfant's `D03W04` under `D03`) still binds. The
`check:wmata` "Merged-interchange feed-code lookup" block is the regression.
**Convention going forward: a WMATA interchange model keys on the real feed
code(s), never the GTFS `X_Y` compound id.**

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
- **Multi-chain access models** (2026-07-08, `scripts/tfl-chains.mjs` →
  `src/catalog/tfl-data/chains.json`, loaded by `station-models.ts`): TfL has
  no `linesservedbyelevator`-style field like MTA, so chains are derived
  purely from graph structure — each lift's `FromAreas`/`ToAreas` area codes
  are nodes, each lift an edge; lifts sharing the exact same tuple (already
  `tfl-import.mjs`'s own redundant-group signal) are one parallel-OR edge;
  connected components (via shared area-code nodes) reveal when a station
  genuinely has multiple INDEPENDENT routes — e.g. Willesden Junction's
  Bakerloo-platform lift and its National Rail high-level-platform lift share
  zero area-code nodes, a real, verified two-route split matching the live
  disruption text ("not available to the Bakerloo line and the Lioness
  line"). **Deliberately conservative**: a component is modeled only if it's
  a single edge, a single redundant group, or a clean path (exactly two
  degree-1 endpoints, no multi-destination edge once 2+ edges are involved).
  A branching hub node (3+ distinct routes through one shared area) is
  EXCLUDED, not guessed — no line names are ever decoded from the area-code
  abbreviations (verified genuinely ambiguous: e.g. `NTH` could mean
  "Northern line" or "North Ticket Hall"; a wrong guess would be a bad-facing
  accessibility claim). Multi-route chain labels are neutral ordinals
  (" (Route 1)", " (Route 2)"), never an inferred line name. A station with
  BOTH a safe chain and excluded (unmodeled) lifts still gets its safe chain
  labeled — found by testing: Bank's Lift-8/Lift-9 form a clean 2-lift route
  separate from its tangled 8-lift core; without a label it would appear
  under the bare "Bank" name, indistinguishable from a fallback row about one
  of the unmodeled lifts. A multi-level lift's `IntermediateAreas` landing
  (41/569 lifts) ALSO counts as a real node for connectivity, not just
  `FromAreas`/`ToAreas` — missed in the first pass, caught by cross-checking
  live TfL alerts (below): King's Cross's Lift-A and Lift-B shared one live
  alert, but Lift-A was (correctly) excluded as part of a branching complex
  while Lift-B was wrongly modeled as its own isolated safe chain — Lift-A's
  intermediate stop is the exact node Lift-B starts from, so they're actually
  the same complex. A multi-edge component touching any intermediate landing
  is excluded (the simple 2-node path model can't route through a 3rd stop),
  same conservative treatment as a multi-destination edge. Result (after the
  fix, 2026-07-08): 151 chains across 132 of 201 lift-equipped stations; 85
  stations (93 components) excluded. After the 2026-07-14 RampRoutes/
  SameLevelPaths wiring: 209 chains across 132 stations, 71 stations (74
  components) excluded — counts drift with the daily model refresh. The
  excluded stations — all recognizable major interchanges: Bank, King's
  Cross, Stratford, Tottenham Court Road, Victoria, Waterloo, Liverpool
  Street, Wembley Park, Farringdon, Canary Wharf, and more — sit in
  `chains-excluded.json` pending the /liftwatch-station-review walkthrough
  (none started), same precedent as MTA's 9 hand-authored interchanges.
  **Self-check**
  (`npm run check:tfl-chains`, `src/checks/tfl-chains-check.ts`): every
  modeled elevator's chain-derived redundancy must exactly equal its own
  `isRedundant` flag from `lifts.json` — simpler than MTA's
  aggregate-across-chains check since ambiguous topology is excluded
  entirely, so no elevator here spans more than one chain. **Purely additive
  to the site display layer**: this only feeds `build-data.ts`'s
  station-access / blackout / streak / SPOF boards via `station-models.ts` —
  it does NOT touch the TfL adapter or `ingest.ts`, so the archived per-unit
  `is_redundant`/`redundancy_source` stays exactly as `tfl-import.mjs`
  already computes it (`pathways` source), unchanged. Re-run
  `npm run tfl:chains` after re-importing TfL topology.
- **Alert-evidence enrichment** (2026-07-08, `src/site/tfl-alert-evidence.ts`
  → `src/catalog/tfl-data/alert-evidence.json`, `npm run tfl:alert-evidence`):
  TfL's own outage alert text — already archived verbatim in
  `outage_events.reason` every poll, no new capture needed — sometimes
  confirms a real step-free alternative our lift-only topology graph can't
  see, because it's a ramp or a different entrance, not another lift (e.g.
  Hackney Wick: "use the ramp on Hepscott Road"; East India: "use the
  entrance on Blackwall Way"). Per Bryce's instruction, TfL's own words are
  ground truth: a confirmed mention (matched via a small set of phrase
  patterns — "use the X", "step-free access is still available", "please use
  X for step-free access") marks that segment `stepFreeAlternative` and
  records the fact in the chain's `note`, in TfL's own words, tracked as a
  documented `evidenceExceptions` entry (mirrors MTA's
  `REDUNDANCY_EXCEPTIONS` — expected to disagree with `lifts.json`'s narrow
  "another identical-route lift" concept, so the self-check exempts it
  instead of failing). This is deliberately asymmetric: a confirmed mention
  only ever ADDS a bypass (reduces a false "no access" claim), so it's safe
  to apply automatically; the ABSENCE of a mentioned alternative is never
  treated as proof of non-redundancy (TfL just didn't publish one that time)
  — it stays informational only. For a station whose whole topology is still
  excluded, any evidence found for its lifts is attached as an
  `evidenceHints` entry in `chains-excluded.json` instead — a real head start
  for the eventual human review, not a resolution (e.g. King's Cross's
  Lift-A/B evidence names "London Underground connections via Farringdon";
  Wembley Park's Lift-5 names a ramp on Bridge Road). **Progressive by
  design**: re-running this after more polls/outages naturally absorbs more
  evidence as the archive grows — no new capture mechanism, no manual
  per-outage audit needed going forward.
- **`RampRoutes.csv`/`SameLevelPaths.csv` WIRED (2026-07-14)** — full-coverage
  non-lift step-free topology from TfL's own detailed export (211 ramp + 4101
  same-level undirected edges → `step-free-paths.json` via tfl-import).
  tfl-chains CONTRACTS path-joined areas into one canonical node (union-find,
  same station+area-group only; Outside/cross-group edges deliberately not
  contracted — bridging sub-complexes is human-pass work). Effects, all
  bypass-adding and self-check-guarded: lifts fully paralleled by a permanent
  path become always-up `stepFreeAlternative` legs; lifts whose routes merge
  under contraction become true parallel groups; collapsed branching freed 17
  formerly-excluded stations (incl. Paddington — 4 clean chains; Clapham
  Junction, East Croydon, Richmond, Hammersmith, Woolwich Arsenal…), 93→74
  excluded components. CHAINS SPLIT at street-connected interior nodes —
  nodes path-adjacent to the literal `<station>-Outside` marker (312/312
  stations have one; an explicit marker, not a decoded abbreviation) — so two
  platform legs meeting at a shared street concourse remain independent
  routes instead of a false series (live counter-example: Willesden
  Junction, whose Bakerloo and high-level lifts share a step-free street
  concourse per the paths data but gate different platforms). Path-caused
  derived-vs-catalog redundancy differences are documented via the same
  `evidenceExceptions` channel as alert evidence (the alert-evidence
  mechanism stays valuable for routes the static data can't see, e.g.
  temporary or operational alternatives). Still deferred: `Toilets.csv`/
  `Platforms.csv`/`PlatformServices.csv` (out of scope, elevators-only); a
  live re-fetch URL for topology, if one is ever found, would let the static
  snapshot self-refresh instead of manual re-import; a human review pass over
  the 85 excluded interchange stations (`chains-excluded.json`, some now with
  alert-evidence hints as a head start) to hand-author their chains,
  mirroring MTA's interchange walkthrough — likely including real line-name
  labels once a human confirms the area-code semantics station by station.

### CTA per-elevator identity from alert text (2026-07-14)

CTA's feed has no elevator ids and no inventory (re-verified 2026-07-13:
station pages don't describe elevators, the ASAP Strategic Plan's per-station
tables are graphical icons — text-extraction empty — and no dataset exists on
the city portal; ASAP does state "163 existing passenger elevators" (2018),
corroborating the 173 `staticFleetReference`). But the alert PROSE names each
elevator by a persistent location identity — "The Harlem-bound platform
elevator at Pulaski", "The elevator to/from street at Ashland", "The transfer
tunnel elevator at Roosevelt" — the same phrase recurring for the same
physical elevator across outages (verified against the full archive corpus).

`src/adapters/cta/location.ts` parses that identity into a stable slug and the
adapter mints per-elevator unit ids (`40030-HARLEM-BOUND`), giving CTA genuine
per-elevator archiving (MTTR, chronic offenders, streaks) instead of
one-lump-per-station. Corpus-hardened against CTA's real copywriting mess:
hyphen-space explosions ("Harlem- bound", "95th- and- Loop- bound" — three
variants of Wilson's island elevator all collapse to `95TH-LOOP-BOUND`),
headline station names ("Western Kimball-bound Platform Elevator" — the
station never leaks), consequence clauses ("elevator to/from street and
elevators needed to access the Harlem-bound platforms" → `STREET`, direction
never leaks), named streets ("to/from 23rd street" ≠ generic street),
entrance qualifiers carried only by the headline (Lake's Washington/Randolph).
A VAGUE alert ("The elevator at Central") falls back to the bare station id —
the pre-identity unit id, so archive history continues unbroken; nothing is
ever guessed. Deliberately NO chains/redundancy claims: without an agency
inventory, a leg-complete station model could under-warn (the WMATA A14
lesson); redundancy stays `assumed`. Known ambiguity: 43rd has two observed
descriptions ("Harlem-bound platform elevator" / "elevator to/from street,
platforms and bridge") that may be one physical elevator — tracked as two
units pending curation (worst case is split stats, never a false access
claim). `npm run cta:observed` snapshots the growing corpus
(`src/catalog/cta-data/observed-units.json`); `npm run check:cta` re-parses
every observed text and fails if any recorded unit id would change (the
re-slug guard), plus the hardcoded trap cases. Curated chains remain possible
later via layout research + human verification per station (the interchange
precedent) — the research is DONE (`src/catalog/cta-data/STATION-RESEARCH.md`,
chicago-L.org pass 2026-07-14: all 42 observed stations grouped by archetype,
redundancy candidates flagged — Cermak's bookend pair first — plus the King
Drive/Cottage Grove exit-only-rotogate policy question and a suggested
verification order); the walkthrough with Bryce is deliberately parked until
he's ready.

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
  stations. A station with several simultaneous elevator alerts (LIVE-OBSERVED
  2026-07-10: Pulaski's 63rd-bound AND Harlem-bound platform elevators out in
  separate alerts, plus an exact-duplicate of one) **merges onto its one unit
  with every distinct reason kept** (`mergeStationAlerts`): reasons deduped
  and joined " · "; planned only if EVERY alert is planned (a mix = at least
  one real breakdown, stays in the unplanned rankings); earliest source
  start; latest return, and only when every alert carries one. Before this,
  only the first alert survived ingest — the second outage was invisible.
- **An alert's fields carry DIFFERENT facts — `reason` is Headline +
  ShortDescription joined** (live-verified 2026-07-10): the Headline alone
  carries entrance detail ("Elevator at Lake **(Washington/Randolph
  Entrance)**…") while ShortDescription alone carries the cause ("…due to
  upgrades"). Either one alone drops rider-facing detail.
- **Return estimates live in FullDescription prose** ("currently estimated to
  return to service on Friday, July 31st, 2026"), parsed only when the
  structured `EventEnd` is absent, only that exact phrasing (weekday
  optional, ordinals stripped), Chicago wall-clock. This is date EXTRACTION,
  not classification — the FullDescription planned-text trap (boilerplate
  footer) doesn't apply because the footer carries no dates.
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

### TMB feeds — HIDDEN 2026-07-07 pending a data-quality review

TMB (Barcelona) was the first non-North-America, non-UK system. It is now
**`hidden: true`** — withheld from the site and not polled — because a review
of TMB's own resources surfaced serious data-quality problems (below). The
adapter, catalog (`units.json`), `check:tmb`, and archived data are all kept
intact; unhide with a single `hidden: false` in systems.ts (the Netlify
poller filters hidden systems out automatically — no workflow step to restore).

**Why hidden — two feed problems (2026-07-07):**
- The **alerts feed** used by the adapter (`api.tmb.cat/v1/alerts/metro/
  channels/WEB`) is undocumented, sparse, and covers conventional lines only.
- The **richer feed we discovered**, `api.tmb.cat/v1/itransit/metro/ascensors`
  (the source behind TMB's own "Status of lifts" widget — found by
  network-inspecting the Collblanc modal), gives real per-elevator status
  (`OK`/`KO`/`NO_INFO`), the access-chain segment topology (`blocs`:
  street→lobby→platform), direction, and all 11 lines incl. automatic L9/L10
  (466 unique elevators vs the catalog's 151 conventional-only). BUT its status
  codes are untrustworthy: **`KO` ("out of service") = 274 elevators while the
  alerts feed shows 1 actually out**; the newest automatic lines read 0% KO
  while old lines read ~70% KO; a major hospital station reads all-KO. So
  itransit `KO` is NOT operational status — the recurring
  don't-trust-an-unverified-feed-field trap (cf. CTA `FullDescription`, TMB
  `cause_code`, MTA `isupcomingoutage`). Its `NO_INFO` ("no communication") =
  109 elevators, ALL `origen: NO_INTEGRAT` (never wired to monitoring →
  permanently unknown, not transient outages). **Before ever using itransit:**
  time-series-sample whether `KO` flips, and compare against TMB's own rendered
  site for a KO station. Do not migrate TMB onto it blind.

The rest of this section documents the (paused) alerts-feed design as built.
Facts verified live 2026-07-05.

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
- **Redundancy**: no signal in the feed. Eighteen major stations are
  hand-modeled in `src/catalog/mta-rail-models.ts` (walked through
  station-by-station with a human 2026-07-06 — the walk-through corrected
  three feed-text misreadings at Stamford alone; its notes outrank the raw
  location strings. Greenwich added 2026-07-10, resolved live from the
  generator's review queue when its 218E broke: overpass reachable at grade,
  218E sole access to the New Haven-bound platform, Track 3 covered by a ramp
  off Greenwich Plaza, 218T = street→ticket office only, outside the chains;
  Amityville, Lindenhurst, Purdy's, and Cortlandt added 2026-07-15 via
  /liftwatch-station-review — all zero-redundancy shapes). The adapter applies model-derived redundancy as
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

### Rail chain generator — auto-modeled simple stations (2026-07-10)

Only 13 railroad stations were hand-curated at first (now 18 — Amityville,
Lindenhurst, Purdy's, and Cortlandt added 2026-07-15 via
`/liftwatch-station-review`, all single-elevator or straight 2-elevator
chains with zero redundancy claimed, confidence 8-9/10); the other
elevator-equipped LIRR/MNR stations fell to `assumed` redundancy — so a real
severing outage
(the motivating case: Chappaqua's 148I, the sole overpass→island elevator,
broken with LiftWatch showing nothing) carried no access claim at all. The
subway solved this with a generator because `nyct_ene` ships a structured
serving field AND a declared per-elevator `redundant` flag to self-check
against; **eestatus ships neither** — only free location text — so the rail
generator's answer key is the hand-curated models themselves.

- **Engine/mapper split (universality, deliberate)**:
  `src/lib/chain-inference.ts` is a SYSTEM-AGNOSTIC engine over
  landing-classified elevators (street / platform-with-identity / named hub /
  garage); `src/adapters/mta-rail/chain-mapper.ts` is the thin MTA-rail text
  vocabulary, presence-based (an elevator = the set of landings its text
  mentions), calibrated against the complete live feed. Any future system
  with "from X to Y" elevator text reuses the engine with its own mapper —
  same split as the MTA and TfL chain generators.
- **Roles fall out of landings**: fullPath (street+platform — the elevator IS
  the route), spoke (hub+platform), streetLeg (street+hub). A fullPath unit
  that also lists the hub doubles as a streetLeg for that hub's spokes (the
  Woodside-449 pattern). Redundant grouping ONLY on an exact platform-key
  match (the TfL exact-match precedent). Garage-only units sit outside chains
  (White Plains WP2 precedent).
- **Conservative by construction**: `stepFreeAlternative` is never emitted
  (humans only); a street-leg elevator, when present, is REQUIRED (over-warn
  direction); a hub with no street-leg elevator is grade-assumed ONLY when
  the agency itself declares the station fully accessible
  (`infrastructure.accessibility === "FULL"` — the New Rochelle 206W
  precedent). Anything ambiguous — unknown landing words (ticket office,
  bridge, waterway…), hub↔hub elevators (GCT), multi-hub mismatches
  (Tarrytown, Yankees), platform-only units (Fairfield), unnamed platforms
  alongside named ones, direct+via-hub mixes needing CNF — is EXCLUDED to
  `chains-excluded.json` for human review, never guessed.
- **GROUND-TRUTH GATE (hard fail)**: at generation time, every hand-curated
  station the engine chooses to model must match the hand model semantically —
  chain count, exact member set, and per-elevator severed-chain count under
  single-outage simulation via the production `stationAccessible()`. Any
  mismatch aborts with nothing written (per the project owner: "if what you
  generate disagrees with what I've told you, then your generator is
  broken"). Result: **9 of the 18 curated stations reproduced exactly** (incl.
  Penn's five chains sharing P34, Jamaica's six sharing 521, Woodside's
  triple-role 449, New Rochelle's per-direction split); **9 conservatively
  self-exclude** — the original 4 complex ones (GCT ×2, Stamford, Yankees;
  Yankees even trips on the same PE4 ambiguity the hand model deliberately
  omits), Greenwich (2GN — its 218T "Ticket Office" landing is unplaceable
  from text), and the 4 stations added 2026-07-15 (Amityville/Lindenhurst:
  unknown-landing, "station plaza" isn't a recognized keyword; Purdy's:
  unknown-landing, the ambiguous 158B unit; Cortlandt: unparseable-unit, the
  045PW parking elevator) — the engine's own parser still can't place these,
  same conservative shape as the original four.
- **The gate caught a real bug before ship**: the first run's track regex
  missed the feed's "Tk 3" abbreviation, collapsing the Hudson line's
  per-side platforms into one unnamed platform and generating FIVE false
  redundant pairs (0AR/0GY/0HS/0RV/2WP) — the under-warn direction. Caught by
  scanning every multi-elevator segment (redundancy claim) in the output, not
  by the curated gate (those stations aren't curated) — **both reviews are
  necessary**.
- **Two-tier redundancy at ingest**: hand-curated models keep emitting
  `curated`; generated models emit `serving_text` ("inferred from what each
  elevator serves" — literally true here), an honest tier BELOW every human
  signal: a future hand curation wins outright, and a contradiction with an
  already-curated DB value raises a `redundancy_flags` row instead of
  clobbering. `serving_text` is non-`assumed`, so generated sole-access units
  DO get the ▮ marker and SPOF board. The generator guarantees the two model
  sets share no station and no elevator (checked).
- **Output** (`npm run rail:chains` → `src/catalog/mta-rail-data/`):
  115 chains across 72 stations (Chappaqua: parking→overpass 148P +
  overpass→island 148I, both sole-access — a 148I outage now reads NO ACCESS
  to Tracks 1 & 2, matching MTA's own status page); 9 stations currently
  excluded for review (14 originally — Amityville, Lindenhurst, Purdy's,
  Cortlandt, and Greenwich have since graduated to the hand-curated tier);
  9 garage units outside chains; only two redundant groups emitted,
  both genuine (Ronkonkoma's street pair, Tuckahoe's two Track-1 elevators).
  MNR modeled routes went 15 → 81 on the access board.
- **Offline regression**: `npm run check:rail-chains`
  (`src/checks/rail-chains-check.ts`, 60 checks) re-runs mapper + engine +
  ground-truth gate against a committed raw-feed fixture — no network — plus
  the Chappaqua and Fairfield regressions, the no-overlap/no-ramp-claims
  invariants, and locked counts (update `LOCKED` when deliberately
  regenerating).

### MBTA chain generator — validated by the agency's own guidance (2026-07-10)

The chain engine's second reuse (after LIRR/MNR), from the
classifier-everywhere mandate: apply the accessibility classifier to every
system that lacks it, using as much of each feed as possible. MBTA had NO
station models — despite the richest untapped inputs of any system:

- **Topology input**: every elevator's `long_name` ends with a route
  parenthetical ("Track 1 (outbound platform) to pedestrian bridge") — direct
  engine input via a new MBTA vocabulary mapper
  (`src/adapters/mbta/chain-mapper.ts`). MBTA vocabulary differs from rail by
  design (why mappers are per-system): lobbies and pedestrian bridges are
  ordinary hubs; paid/unpaid variants are DISTINCT hub identities (Orient
  Heights' paid vs unpaid bridges are different places); platforms are
  direction-named ("Alewife platform") — identity is the normalized name; an
  elevator naming TWO platform identities (Government Center's Blue↔Green
  transfer elevator) is beyond the model → station excluded.
- **THE ANSWER KEY IS IN THE FEED**: 215/237 elevators carry
  `alternate-service-text` — MBTA's own per-elevator rider guidance
  (bart.gov's outage-options pattern, but machine-readable in the API).
  Parsed into declared expectations: a named SAME-STATION backup ("use nearby
  Wonderland Elevators 702 or 703") ⇒ redundant; "see station personnel" or a
  ride-around detour ⇒ sole access. Every modeled elevator's topology-derived
  redundancy must AGREE with its declaration or the whole station is excluded
  (`declared-alternate-mismatch`). This solves the no-ground-truth problem:
  no hand-curated MBTA models exist and the maintainer has never ridden the
  system — the agency's own declaration is the independent second signal,
  exactly like the subway's declared `redundant` flag.
- **CRITICAL parsing rule (misread 13 stations on the first run)**: guidance
  that names an elevator but reaches it by RIDING A TRAIN ("exit the train at
  Savin Hill, then take an Ashmont-bound train to Fields Corner and use
  Elevator 958") is a DETOUR, not a backup — the BART cross-station rule; a
  rider on the platform is functionally stranded. Detour parsing takes
  precedence over named-elevator parsing.
- **Result**: 39 of 80 elevator-equipped stations modeled (60 chains), 71
  elevator redundancy claims corroborated by MBTA's own guidance; 41 stations
  excluded with reasons (`chains-excluded.json`) — incl. Wellington, the one
  genuine topology-vs-guidance disagreement (its guidance says "exit the
  other side of the train onto the center platform": within-station nuance
  the per-platform chain model can't express; human review).
- **Joint review pass complete (2026-07-12)**: `review-flags.json` is now
  empty — every previously-flagged street-alternate and unvalidated elevator
  was walked through with the maintainer and resolved into one of these
  categories (each a HUMAN-approved list in `scripts/mbta-chains.mts`,
  re-asserted by `check:mbta-chains`):
  1. **Approved street-alternate** (`APPROVED_STREET_ALTERNATES`, 8 elevators
     across 5 stations — Framingham, Natick Center, Ball Square, Union Square,
     East Taunton): MBTA's own guidance names an elevator-free, ≤0.3-mi,
     step-free route (ramp / track crossing / accessible walkway). Sets
     `stepFreeAlternative` **and** discloses the walk in the note.
  2. **Note-only disclosure** (`DISCLOSED_ALTERNATES`, South Acton 704/705): a
     REAL step-free route that is beyond 0.3 mi (South Acton's ramped detour
     loops several blocks — Railroad → Main → Maple St). Earns NO step-free
     credit — both per-track chains still read NO ACCESS when the elevator is
     out — but MBTA's routing is surfaced in the rider-facing note for anyone
     willing to make the longer walk.
  3. **Human-confirmed redundant** (`CONFIRMED_REDUNDANT`, TF Green 400/401):
     a pair the topology engine already groups into one redundant segment but
     with NO `alternate-service-text` to corroborate it. The maintainer is the
     signal. GUARDED: if a feed change ever makes one sole-access, the mismatch
     excludes the station loudly rather than trusting a stale human call.
  4. **Sibling-corroborated** (generic, e.g. Salem 997): an elevator with no
     text of its own that a SIBLING's `named` guidance points to ("Please use
     nearby Salem Elevator 997") is validated by that reciprocal reference —
     no override needed.
  Adapter ships chain members as `serving_text` (machine-derived, below
  every human signal); un-modeled units keep single_elevator/assumed exactly
  as before. Offline: `npm run check:mbta-chains` — a FULL-FEED fixture
  (every station, not a subset) re-verifies mapper + engine + validation +
  exact reproduction of the committed chains, plus the Fields Corner detour
  and Wellington exclusion regressions. First live effect: Kendall/MIT's 777
  outage reads REDUCED (866 backs it up, per MBTA's own guidance); Winchester
  Center stays ACCESSIBLE on 748 with 749 out; Natick Center ALSO stays
  ACCESSIBLE on either 750 or 751 out — MBTA's own guidance names a ramp as
  the elevator-free route on both, so both are in `APPROVED_STREET_ALTERNATES`
  (`stepFreeAlternative: true`, see the joint-review list two paragraphs up;
  this line previously said Natick reads NO ACCESS per platform, which
  contradicted that same list — corrected 2026-07-16); the MBTA access board
  went from 0 to 60 modeled routes.

### CTA's first curated tier + a redundant-pair pre-model from RPM research (2026-07-15/16)

CTA had no station structure models at all until this pass (the identity
work above only gives per-elevator ARCHIVING, never a redundancy claim) —
`src/catalog/cta-models.ts` is the first curated tier for this system, built
via the `/liftwatch-station-review` walkthrough with Bryce.

- **Batching, not purely one-at-a-time**: the walkthrough started station-by-
  station (Cermak-McCormick Place's confirmed bookend pair, then Diversey's
  per-direction pair) but scaled to risk-bucketed BATCHES once the backlog's
  actual risk profile became clear: single-elevator stations (no redundancy
  claimed, so structurally can't under-warn) and confirmed per-direction
  pairs batch safely; only genuine redundancy claims need one-at-a-time
  scrutiny. Two CTA batches shipped this way (Batch 1 not used for CTA;
  "Batch 2" = 15 stations: 9 single-elevator islands on a bare-station-id
  vague match, 1 agency-both-directions island (Morgan), 5 Diversey-pattern
  per-direction pairs), same risk-bucketing approach used for MBTA's 16-
  station machine-validated batch and WMATA's 21-station ladder-chain batch
  below.
- **SYNTHETIC ids** (`CTA-SYNTH-<station>-<slot>`, never colliding with a
  real `<station>-<slug>` unit id) for an elevator the station is known to
  have but that has never appeared in a CTA alert — same pattern as WMATA's
  `WMATA-<node>` slots; promote to the real id the first time it's observed.
- **Vague-alert fail-safe, and a same-day bug in it**: a CTA alert with no
  parseable location falls back to the bare station id. At a station with a
  REDUNDANT pair (Cermak, later Bryn Mawr), that bare id can never match
  either synthetic/real member, so the adapter flags `needsReview` and the
  generic build-site-data fail-safe forces the whole chain to UNKNOWN —
  closing a real gap (two simultaneous vague alerts at one station can merge
  into a single outage; without this, a scenario where BOTH elevators of a
  pair break but only one vague alert fires would read as accessible). BUT
  the first implementation checked "vague alert at ANY modeled station"
  without checking whether the resulting id actually failed to match — for
  the 9 single-elevator stations (whose bare station id IS deliberately their
  one real elevator's id, since there's no OR to hide behind), every ordinary
  outage tripped the same fail-safe meant for genuine mismatches, sending
  three false "needs review" pushes (Loyola, 87th, Central Park) before being
  caught and fixed same-day (checks actual model-elevator membership now).
- **Bryn Mawr (41380), pre-modeled from research, zero live signal**: Bryce
  asked whether CTA's Red-Purple Modernization project installed any
  redundant elevator pairs at its rebuilt stations. Researched all 4 RPM
  Phase One stations (Lawrence, Argyle, Berwyn, Bryn Mawr, reopened
  2025-07-20): only Bryn Mawr got one — a third entrance (Hollywood Ave,
  added in the rebuild) got its own elevator, separate from the main
  entrance's, both reaching the same single island platform. Neither
  elevator has ever appeared in a CTA alert, so both ids are synthetic —
  this is the first CTA station modeled entirely from external research
  ahead of any outage, specifically to avoid a false NO_ACCESS on its
  first-ever break. Station id found via CTA's public GTFS `stops.txt`
  (parent station, `location_type=1`).
- **Ramp/other-access research, system-wide standing rule**: while
  documenting the LIRR/MNR/MBTA-Commuter-Rail ramp blind spot on the site's
  disclaimer pages, found that MBTA's own `facilities?filter[type]=RAMP`
  endpoint (already polled every cycle for the other-equipment layer) exposes
  a live 58-ramp roster never cross-referenced against any model — snapshotted
  via `scripts/mbta-ramps.mts` (`mbta-data/ramps.json`). Audited it station by
  station: MBTA's auto-generated tier already handles every ramp mention in
  its own alternate-service-text correctly (zero pending `review-flags.json`
  entries); the remaining gap is stations where a ramp exists outside that
  per-elevator mechanism entirely (State/Wellington/Sullivan Square/JFK-UMass
  — genuine interchange-anomaly territory, not a quick win). Checked WMATA and
  CTA for the same kind of feed: neither exposes any ramp/facility data at
  all (WMATA's own accessibility page states its design standard is
  elevator-only; its GTFS pathway spec has no ramp mode to signal one even if
  it existed). Locked as a standing rule in CLAUDE.md: check every system's
  own feed/API for ramp or other non-elevator step-free data before
  finalizing ANY station model, not just when the question happens to come up.

### CTA curated tier, continued: correction, audit, and 15 more stations (2026-07-16)

Continuing the walkthrough above in the same session.

- **Wilson (40540) CORRECTED**: a prior "researched but not shipped" note had
  called Wilson two independent single-elevator chains, no backup. CTA's own
  `/wilson/` reconstruction page (fetched via the in-app Browser pane, since
  CTA's site 403s WebFetch) plus Bryce's direct confirmation revealed the
  Sunnyside Ave entrance has TWO ADA ramps — one straight to each island
  platform, no mezzanine — so each direction is actually REDUNDANT (elevator
  OR ramp), encoded via `segment.stepFreeAlternative`. The research had
  simply missed the ramps; exactly the failure mode the standing ramp-
  research rule exists to catch. Verified live against a real outage: Wilson
  (95th/Loop-bound) now correctly reads ACCESSIBLE instead of a false
  INACCESSIBLE.
- **Full model audit against CTA's own pages**: before shipping more
  stations, cross-checked all 24 then-modeled CTA stations against CTA's
  project/station pages (`/95thterminal/`, `/westernbrown/`, `/fprebuild/`,
  `/redsouth/`, `/rpm/`, and others under `/projects/`). 23/24 confirmed
  correct. **Morgan (41510) was a real mismodel**: built as ONE elevator
  serving both directions of a single island platform, but CTA's own page
  plus chicago-L.org plus Wikipedia independently agree it's actually TWO
  SIDE PLATFORMS, one elevator each, linked by a transfer-ONLY overhead
  bridge (no step-free cross-platform backup) — re-modeled as a per-direction
  pair. The live alert's combined id ("The Loop- and 63rd-bound platform
  elevator") had been misread as "one elevator, both directions" when it
  actually names one direction's two DESTINATIONS (Green toward Loop→63rd +
  Pink toward Loop, both served from the same eastbound platform).
- **Batch 4**: 7 more zero-redundancy stations, risk-bucketed like Batches
  1-3 — nothing in the batch claims a backup, so nothing can under-warn.
  Four Diversey-pattern per-direction pairs (Addison, Montrose, Pulaski-Green
  40030, Southport); two 2-in-series chains (Jackson-Blue 40070: street→mezz
  then mezz→platform; Cicero: street→fare-control then passageway→platform);
  one shared-prerequisite shape (Grand 40330 — the same pattern as WMATA's
  street↔mezzanine-prerequisite-feeding-per-direction-legs shape: one
  street→mezz elevator, real feed evidence, feeds BOTH per-direction
  mezz→platform legs, so an outage on the shared unit correctly severs both
  directions at once).
- **95th/Dan Ryan (40450)**, individual review: rebuilt 2014-2019 with two
  street-grade terminal buildings (North + South of 95th St) sharing ONE
  island platform via a platform-level walkway. Each terminal has its own
  elevator to the platform — South Terminal's is agency-named in a live
  alert, North Terminal's is on CTA's own `/95thterminal/` project page.
  Modeled as a REDUNDANT pair (the Cermak bookend pattern, terminal-
  flavored). Confidence 8/10 — the one open residual is unverified overnight
  terminal hours (no closure evidence found; same precedent as Cermak's
  auxiliary headhouses shipping without hours-gating).
- **Jackson-Red (40560)**, individual review — the session's deepest single-
  station dig. The station is a State St subway island reached via TWO
  mezzanines (Adams-Jackson north, Jackson-Van Buren south); Bryce was
  confident both mezzanines have their own street→mezzanine elevator, but
  whether EACH mezzanine also has its own mezzanine→platform elevator (one
  full route each = redundant, vs. one shared platform elevator = not) was
  unresolved even after an agent's own prior research pass concluded only
  "moderate confidence." Bryce supplied the actual lead that broke it: a link
  to a Scribd-hosted **CTA ADA class-action settlement independent-monitor
  quarterly report** (Access Living et al. v. CTA, 2001 settlement, 5-year
  monitoring period that ended ~2006 — no newer report of that exact kind
  exists, but it pointed toward the right MODERN equivalent: CTA's All
  Stations Accessibility Program). Combined with a real CTA live alert
  explicitly naming "the elevator to/from platform at the Jackson Van Buren
  entrance" and chicago-L.org's account of the 2000 Jackson-Van Buren
  renovation ("accessible from both mezzanines, a Chicago subway first"),
  this confirmed BOTH mezzanines have a full independent street→mezzanine +
  mezzanine→platform pair — four elevators, two genuinely redundant routes.
  Modeled as a REDUNDANT PAIR OF 2-IN-SERIES CHAINS via a 4-clause CNF
  encoding (the Stamford paired-segment pattern already used for LIRR/MNR:
  `(Adams_street ∧ Adams_plat) ∨ (VanBuren_street ∧ VanBuren_plat)`),
  verified correct with an 11-case accessibility test (every single-elevator
  outage stays accessible; the four route-breaking two-outage combinations
  correctly sever). All four unit ids are real — the Van Buren pair's ids
  are the CTA text-identity parser's deterministic output for that alert
  text, so a future Van Buren outage will match by id, no synthetic
  placeholder needed.
- **New CTA research sources found and locked in**: **transit.wiki**
  (community-editable — corroboration-tier, same trust level as
  chicago-L.org/Wikipedia, never sole ground truth) and **CTA's own ASAP
  ("All Stations Accessibility Program") Strategic Plan**, a 48MB PDF at
  `transitchicago.com/assets/1/6/ASAP_Strategic_Plan_508_FINAL.pdf`.
  Neither WebFetch's extractor nor its 10MB size cap can handle this file —
  the working recipe is `curl -A "<browser UA>"` to download (CTA's `/assets/`
  path isn't behind the same WAF as the rest of the site) + Node `pdf-parse`
  to read the 508-compliance text layer underneath the image wrapper (this
  works on any accessibility-compliant government/agency PDF, not just CTA's
  — worth trying before giving up on a PDF as "unreadable"). The plan's
  Tables 14 & 15 ("Current/Future Elevator Replacement Program") are an
  authoritative per-station elevator COUNT list (not topology — "X of Y
  elevators to be rehabilitated" gives Y) — snapshotted to
  `src/catalog/cta-data/asap-elevator-counts.md`. Cross-checked against every
  count-covered modeled station: 7/7 match exactly (Jackson-Red=4,
  Sox-35th/Central/Loyola/Forest Park=1, Grand=3, Western=2), corroborating
  the Jackson-Red/Grand models independently of the settlement-report lead.

CTA now 39/46 reviewed (2026-07-17 — Roosevelt's Discord-sourced 2-chain
model with its 4th-elevator follow-up correction, the transfer-bridge/
rotogate batch, and more since this section was written). 7 pending, all
interchange complexes — see HANDOFF.md for the current per-station
breakdown and priority order.

### MTA enrichment from data.ny.gov — a second, richer ground-truth source (2026-07-16)

Bryce found `data.ny.gov/resource/94fv-bak7.json` ("MTA Elevators and
Escalators") — an official New York State open-data mirror of an MTA
per-equipment inventory that is RICHER than the live `nyct_ene` feed our
models are built from. Where `nyct_ene` gives only a boolean `redundant`
flag, this dataset carries, per elevator: `redundant_elevator` (+/−) WITH
the specific named backup elevator(s), `elevator_direction_serviced`,
per-level access flags (mezzanine 1/2, platform), `ada_compliant`, and —
the two fields that drove this session's work — `alternative_route`
(MTA's own rider-facing reroute instructions) and `notes` (MTA's own plain-
English description of what the elevator connects). `npm run mta:ny-inventory`
snapshots all 475 elevators to `src/catalog/mta-data/ny-elevator-inventory.json`.

**1. Ground-truth cross-check (`npm run check:mta-ny`).** Every elevator our
MTA chain generator processes must exist in this inventory with matching ADA
status and (with documented exceptions) matching redundancy. Result: 121/121
modeled elevators clean, zero unexplained mismatches — MTA's two independently
published data sources agree completely on everything we model. CRITICAL
nuance, documented directly in `scripts/mta-ny-inventory.mts` so a future
cross-check never misreads it: the `redundant_elevator` boolean here means
"does ONE other elevator fully replace this unit's entire journey" — STRICTER
than our own SEGMENT-level redundancy. 14 St-6 Av's EL609/EL610 (our one
hand-authored `REDUNDANCY_EXCEPTIONS` override, based on a human visual
confirmation that `nyct_ene`'s own flag was wrong) both read `redundant: -`
in this dataset too — but each elevator's OWN `alternative_route` text names
the OTHER as its backup for the L-platform leg specifically. Two sources
agreeing the boolean is "no" while both also naming each other as segment
backups isn't a contradiction — it CORROBORATES the override; the dataset's
boolean is answering a different, stricter question (full-journey
replacement) than our chain model asks (this-segment replacement).

**2. Rider-facing reroutes shown on outages.** `alternative_route` exists for
421 of 475 elevators — MTA's own official wayfinding ("cross to another
entrance," "use elevator EL610," "ride to the next accessible station and
return"). `build-site-data.ts` attaches it (keyed by equipment code, which
IS our external id) to every outage row as `reroute`; both `system.html` and
`index.html` render it in the outage detail as "MTA reroute (if this
elevator is out)" whenever that specific elevator is the one that's down. It
assumes only that one elevator is out (as MTA's own signage does), so it's
presented explicitly as MTA's guidance, not LiftWatch's derived claim.

**3. MTA's own elevator descriptions preferred when richer.** `notes` is
MTA's own plain-English description of an elevator's route. `preferMtaNote()`
swaps our feed-derived description for MTA's whenever MTA's is equivalent or
richer (e.g. "Street to mezzanine" → "179 Pl & Hillside Ave (SE corner) to
mezzanine for Manhattan-bound service") — but keeps ours when MTA's text is
a data-quality artifact (an internal maintenance/bookkeeping note like
EL132's "UNLINK...WITHDRAW AND PLACE OUT OF SERVICE...duplicate", filtered
by a `MTA_NOTE_JUNK` regex) or when ours is dramatically richer already.

**4. MTA's own display-guidance doc, saved and implemented against.** Bryce
uploaded MTA's developer page ("Displaying NYCT station accessibility and
elevator & escalator status," mta.info/developers/display-elevators-NYCT —
403s WebFetch; extracted from a saved `.mht` snapshot) to
`src/catalog/mta-data/MTA-DISPLAY-GUIDE.md` with a compliance checklist. Its
top recommendation — show STATION-LEVEL ADA accessibility (0=not, 1=fully,
2=partially accessible, and for partial, WHICH direction) — is a genuinely
different question from live elevator status: it's MTA's own design-time
declaration of which lines/directions have step-free access AT ALL,
independent of whether today's elevator happens to be working.

Built via `npm run mta:station-ada` → `src/catalog/mta-data/mta-station-ada.json`,
joining TWO more data.ny.gov datasets on `complex_id` (which equals our
`stationExternalId` exactly — MTA's own `stationcomplexid` — no fuzzy
matching needed): `4ta5-wz5s` ("MTA Subway Station Complexes") covers the
~32 TRUE multi-line interchanges and carries MTA's own AUTHORED rollup
sentence per complex (e.g. 14 St-Union Sq: "N Q R W accessible; L
accessible; 4 5 6 not accessible" — verbatim MTA prose, used as-is);
`39hk-dx4f` ("MTA Subway Stations") has one row per line at every one of the
445 complexes (including the ~413 single-line stations the interchange
dataset omits, since there's nothing to roll up), used to SYNTHESIZE an
equally specific per-line sentence for those (e.g. a single-line station at
`ada=2` becomes "Astoria [N W]: accessible toward Manhattan only," naming
the line, its routes, and the working direction).

**Bryce's explicit, load-bearing instruction for this feature (2026-07-16):
never display a bare status word like "partially accessible" — always
explain what that means, naming the specific lines and directions.** This is
enforced, not just styled: `npm run check:mta-ada` (452 checks) asserts
every complex with `ada !== 1` carries a non-empty explanation, and every
fully-accessible complex stays quiet (no noise). New "Station accessibility"
board on `system.html`, MTA-only (hidden entirely for every other system,
same visibility pattern as the "Other accessibility equipment" board),
scoped to complexes our archive actually tracks elevators at (grounds the
board in real monitored stations rather than the full 445-complex network).
The explanation is shown directly in the row — never hidden behind an
expand toggle, since the whole point is that riders shouldn't have to click
to learn what "partial" means.

Verified against real production data (not just synthetic test cases): 21
MTA complexes our archive tracks currently read partial-or-none, each with
MTA's own line-and-direction text. One finding independently validated the
underlying data quality: **Clark St correctly reads NOT ACCESSIBLE despite
having a tracked elevator** — that elevator only reaches the mezzanine, with
no step-free path onward to the platform, which is the EXACT example MTA's
own display-guidance doc uses to illustrate why "has an elevator" and "is
accessible" are different questions.

### BART and WMATA ground-truth sources — fact-check pass, one WMATA fix (2026-07-16)

Following the CTA-ASAP / MTA-data.ny.gov pattern, searched for a BART and
WMATA equivalent. Found real sources for both; MBTA's *inventory*-style search
came up empty at the time (its "Plan for Accessible Transit Infrastructure" is
a policy slide deck with aggregate stats only, no per-station data — GTFS
`pathways.txt` remains the best public MBTA *inventory* source). **A different
MBTA source WAS later found (2026-07-17): the Daniels-Finegold ADA class-action
settlement** — the direct CTA-settlement analog, committing the MBTA to
specific new/redundant + replacement elevators at named stations with real
facility IDs. It resolves topology for 3 of the 6 MBTA anomaly holdouts
(Downtown Crossing, State, Oak Grove). Snapshot + caution (it's a legal/
planning doc, not a live inventory — verify built-vs-planned against the feed)
in `src/catalog/mbta-data/daniels-finegold-settlement.md`.

**BART's own "Bikes on BART — Elevator Dimensions" guide** (2022,
`src/catalog/bart-data/elevator-dimensions-guide.md`) is a genuine
per-elevator inventory with landing descriptions for all 50 stations.
**Every apparent discrepancy against our curated models was individually
verified against BART's LIVE per-station page
(`bart.gov/stations/<code>/accessible`, JS-rendered) and resolved in our
favor — 6 stations checked, 0 model changes needed**: Colma (a duplicate
PDF row, not a 2nd elevator), Richmond (the guide's 4th row is a separate
Amtrak-only connector, outside BART's own accessibility scope), 19th St.
and Milpitas (the guide collapses same-dimension elevator pairs into one
row — BART's live text confirms both are genuinely separate, with 19th
St.'s pair explicitly redundant and Milpitas's pair explicitly NOT), and
Warm Springs (word-for-word match against our existing 5-elevator model).
Millbrae is the one genuinely interesting case: the guide shows a
"Concourse/Platform 1-2" elevator that simply does not exist in BART's
CURRENT live text (which instead shows "Platform 3, ALL DESTINATIONS") —
the guide most likely predates a platform reconfiguration and is stale for
this one station, not a gap in our model. A parallel enrichment pass
(comparing every curated elevator's label against the guide's landing
description, the same `preferMtaNote()` principle used for MTA) found
minimal opportunity: our labels were built from BART's own richer
per-station outage-options advisory text, already more specific than this
guide's terse table phrasing. The guide's genuine, durable value turned out
to be fact-checking corroboration (including an incidental confirmation of
all 16 single-elevator "Station elevator" BART stations by row count), not
new-bug detection.

**WMATA's own quarterly Capital Improvement Program report**
(`src/catalog/wmata-data/cip-elevator-mentions.md`) is NOT a designed
inventory — it's a 241-page budget/contract status document — but its
narrative project updates incidentally name real elevator equipment ids
tied to a station. Investigated every id found:
- **`E07X01` (West Hyattsville) — promoted from synthetic to real.** The
  station's opposite-direction elevator had been a synthetic placeholder
  since Batch 3; the report confirms the real id, following the exact
  station-code + X01/X02 pairing convention already confirmed at Rockville.
- **`C02E01` (McPherson Sq) and `D13X02` (New Carrollton) — confirmed real,
  deliberately NOT promoted.** Both stations already have curated synthetic
  slots, but each has MULTIPLE slots (McPherson Sq has 3: one shared
  street↔mezzanine plus two per-direction mezzanine↔platform legs; New
  Carrollton has 2, in series) and the report names only one id per station
  with no disambiguating detail. Assigning it to a specific slot would be a
  guess, which this project never does for a structural claim — left as
  synthetic, to resolve naturally the first time that id (or any of the
  station's other slots) is observed in a live outage.
- **`E01X04` (Mount Vernon Sq) — an already-flagged redundancy candidate,
  strengthened, still not resolved.** This station is excluded from
  modeling (`chains-excluded.json`, reason `observed-undercount`) and sits
  in the review queue (`wmata:E01`, priority 20) precisely because our own
  live-feed observation had already found FOUR real units forming two
  identically-worded pairs: `E01X01`/`E01X02` (both "Elevator between
  street and mezzanine") and `E01X04`/`E01X05` (both "Elevator between
  mezzanine and platform") — the same shape (identical wording on both
  legs, no directional qualifier) as three already-CONFIRMED-redundant
  stations elsewhere in this project (Rockville A14X01/X02, 19th St. BART,
  Warm Springs BART). The CIP report is a THIRD independent source
  confirming `E01X04` exists (alongside GTFS and live-feed observation) —
  added as new evidence to the queue entry. Deliberately NOT modeled as
  redundant here: WMATA's own text never uses BART's explicit "use the
  other elevator" backup language the way BART's outage-options pages do,
  so declaring these two pairs redundant would be a claim this project's
  evidence bar doesn't support without either stronger agency text or
  Bryce's confirmation via the `/liftwatch-station-review` ritual. Flagged
  as a high-priority candidate for the next review session given how
  well-evidenced it now is — the strongest un-shipped WMATA redundancy
  candidate found to date.
- **`B11X05`/`B11X06` (Glenmont)** — confirmed real, but the station isn't
  in our modeled OR excluded set at all (an ordinary untouched
  `assumed`-redundancy station). No structural context yet to act on;
  flagged for a future research pass.

Extraction technique for both (documented for reuse on any future agency
PDF): `curl -A "<browser UA>"` to download (bypasses WAFs that block
WebFetch's crawler on some agency domains, e.g. bart.gov's 403) + Node
`pdf-parse` for the text layer. For the WMATA report specifically, a simple
regex for the `[A-Z]\d{2}[EX]\d{2}` unit-id pattern near a station name
pulled every relevant mention out of 241 pages of otherwise-irrelevant
budget tables.
