# LiftWatch — Expansion Research & Plan

**Status:** research complete 2026-07-11. Grades transit systems worldwide by
elevator-outage feed quality against the tiers below, and ranks them by
(data quality ÷ integration effort) for adding to LiftWatch.

**Evidence note.** Every "CONFIRMED LIVE" system below was probed hands-on with
`curl` on 2026-07-11 — the actual endpoint returned the described JSON that day.
Systems marked "research-only" come from a web-research sweep whose adversarial
verification pass did not run (ran out of model credits mid-run), so treat their
specifics as leads to confirm, not established fact. The don't-trust-a-feed-field
rule (TMB `KO`, CTA `FullDescription`) applies doubly to research-only entries.

## Tiers (what LiftWatch needs)

- **Tier 1 (MTA/TfL grade)** — documented feed with full per-elevator
  inventory + live per-elevator status, stable equipment IDs, ideally
  serves-text or a redundancy signal, machine-readable timestamps/reasons/ETA.
  One feed doubles as inventory (denominator) + outage source.
- **Tier 2 (MBTA grade)** — per-elevator inventory + outages via GTFS-RT
  alerts or REST, no redundancy flag (inferred from free text / GTFS
  `pathways.txt`).
- **Tier 3 (WMATA grade)** — outage-only feed with per-elevator IDs, no full
  inventory (units discovered as they break).
- **Tier 4 (BART/CTA grade)** — station-level advisories only, no per-elevator
  ID. Viable ONLY if the agency also publishes BART-style per-elevator rider
  workaround pages usable to hand-curate access-chain models.
- **Not viable** — PDF/social-only, or static facility inventory with no live
  status.

---

## CONFIRMED LIVE (probed 2026-07-11)

### 1. Île-de-France Mobilités (Paris) — **TIER 1. Top pick.**
The single best find. Live per-elevator status feed for the whole Paris region,
multimodal, no API key.

- **Endpoint (keyless):** `https://data.smartidf.services/api/records/1.0/search/?dataset=etat-des-ascenseurs1&rows=1000`
  (OpenDataSoft records API v1; v2.1 explore API is the same data at
  `/api/explore/v2.1/catalog/datasets/etat-des-ascenseurs1/records`). Also
  mirrored on `prim.iledefrance-mobilites.fr` behind a free key (403 keyless),
  but the smartidf host needs none.
- **944 lifts**, one record each — feed IS the inventory and the status source.
- **Per record:** `liftid` (stable), `zdcid`/`zdcname` (station id + name),
  `liftmode` (`Metro` / `RapidTransit` = RER / `Tramway` / `LocalTrain` =
  Transilien), `liftstatus` (`available` / `notavailable` / `unknown`),
  `liftstate` (`1` up / `2` down / `0` unknown), `liftsituation` (serves-text,
  e.g. "Salle d'accès <> Quai"), `liftdirection`, `liftstateupdate` (timestamp),
  lat/lon, `privateelevatorid`, `severity`.
- **Sample now:** 355 available / 35 notavailable / ~10 unknown per 400 sampled.
- **Data-quality caveat (TMB lesson):** treat ONLY `liftstate:2`/`notavailable`
  as a confirmed outage. `unknown`/`undefined` (~2–3%) is genuine "no signal,"
  NOT down — map to our offline/UNKNOWN concept, never to an open outage.
- **Diversity win:** first France, first continental Western Europe, biggest
  network of any candidate (Métro + RER + Tram + Transilien in one feed).
- **Adapter sketch:** closest to **TfL** in shape (one rich per-unit feed) but
  simpler — status is a field on the inventory row, no separate outage call.
  `redundancy_source` starts `assumed`; `liftsituation` serves-text is later
  minable for chains like MBTA/rail. Timestamps are ISO local (Europe/Paris) →
  `parseZonedToUtcIso`.

### 2. Wiener Linien (Vienna) — **TIER ~1.5 (outage feed) + static inventory. Strong.**
- **Live outage feed (keyless):**
  `https://www.wienerlinien.at/ogd_realtime/trafficInfoList?name=aufzugsinfo`
  — returns only elevators currently *out*, with excellent structured fields:
  `station`, `location`/`description` (serves-text), `attributes.reason` (free
  text, German), `ausVon`/`ausBis` + `time.start`/`time.end` (ISO+offset start
  & estimated end), `status` ("außer Betrieb"), `relatedLines`, `relatedStops`.
- **Denominator:** separate static open dataset (Wiener Linien OGD
  stops/steps/elevators geodata on data.gv.at) supplies the full elevator
  inventory. So: MBTA-style split (static inventory file + live outage feed).
- **Note:** feed record id is `ftazS_<n>` (a *disruption* id, not a stable
  elevator id) — key outages by `station` + `location`, mapped to the static
  inventory, same way BART/CTA map station-level text to curated units.
- **Diversity win:** first Austria; second non-English system after Barcelona.
- **Adapter sketch:** **MBTA-like** (inventory from a versioned static file
  built by an import script; live feed = alerts). No key. Timestamps carry
  offset → no tz math.

### 3. TTC (Toronto) — **TIER 3. Clean, easy.**
- **Live feed (keyless):** `https://alerts.ttc.ca/api/alerts/list` → top-level
  `accessibility[]` array. Elevator entries carry `routeType:"Elevator"`,
  `elevatorCode` (e.g. "1"), station in `headerText`, `title` = serves-text
  ("between concourse and Line 5 centre platform"), `effect`
  (`ACCESSIBILITY_ISSUE`), `effectDesc` ("Out of service"), `cause`
  (`TECHNICAL_PROBLEM`), `alertType` (Planned/Unplanned), `activePeriod`
  start/end, `lastUpdated`. Escalators too (`escalatorCode`).
- **Outage-only** (no full inventory) → WMATA tier: `inventoryComplete:false`,
  units discovered as they break, station-qualified ids (`STATION-elevatorCode`,
  exactly like LIRR/MNR).
- **Diversity win:** first Canada.
- **Adapter sketch:** **WMATA + LIRR hybrid** — discovered inventory, planned
  flag straight from `alertType`, reason from `cause`/`title`. Undocumented-ish
  alerts API (like LIRR/TMB) but clean and stable-looking.

### 4. SEPTA (Philadelphia) — **TIER 3–4. Easy, plus curatable pages.**
- **Live feed (keyless):** `https://www3.septa.org/api/elevator/index.php` →
  `meta.elevators_out` + `meta.updated` (timestamp) and `results[]` with `line`,
  `station`, `elevator` (descriptive name, e.g. "13th Street Westbound MFL
  Platform"), `message`/`message_html`, and **`alternate_url`** → SEPTA's
  BART-style alternate-transportation pages (curatable for access chains).
- **Weaknesses:** per-elevator by NAME only (no stable numeric id), no reason
  code, no ETA. Outage-only, no inventory feed. Covers MFL/BSL subway, trolley,
  Regional Rail.
- **Adapter sketch:** **CTA-like** (station/name-level, `inventoryComplete:false`,
  no per-elevator id) — but better than CTA because `alternate_url` gives real
  per-station workaround guidance to curate from.

### 5. Deutsche Bahn FaSta (all Germany) — **TIER 1 behind a free key. High value.**
- **Endpoint (free key required):**
  `https://apis.deutschebahn.com/db-api-marketplace/apis/fasta/v2/facilities?type=ELEVATOR,ESCALATOR`
  (legacy `api.deutschebahn.com/fasta/v2/facilities` redirects here). Returned
  **401** keyless — needs DB API Marketplace registration + free plan (same
  posture as WMATA/MBTA keys).
- **Per facility:** `equipmentnumber` (stable id), `stationnumber`, `type`,
  `state` (`ACTIVE`/`INACTIVE`/`UNKNOWN`), `stateExplanation`, `description`
  (serves-text "zu Gleis 1"), geocoordinates. Nationwide, all DB stations —
  feed IS inventory + status.
- **Data-quality caveat:** `UNKNOWN` → UNKNOWN, not down (same as IDFM).
- **Diversity win:** first Germany; nationwide (hundreds of stations) in one
  feed — potentially the largest denominator of any system here.
- **Adapter sketch:** **TfL-grade**, key handling like MBTA/WMATA. Gate behind
  obtaining the key. `brokenlifts.org` (Berlin) is a stale community middleman
  over this same DB data — go direct to FaSta, don't depend on it.

---

## CURATABLE (BART-style — needs human curation, no clean live feed)

- **San Diego MTS** — `sdmts.com/rider-info/accessibility/elevators`: BART-style
  per-station workaround guidance (alternate bus routes/stops) + a static
  "no elevator alerts" status line. 26 elevators, no machine feed, no per-unit
  ids. Curate a small station-model set; live status is weak/absent → low
  priority unless a JSON behind the page turns up.
- **SEPTA** (also listed above) — hybrid: has a live feed AND `alternate_url`
  curation pages. Do the feed first, curate chains later.

## NEEDS A FREE KEY — CONFIRM STATUS THEN PROMOTE (research-only)

- **NS (Dutch Railways)** — `gateway.apiportal.ns.nl/disruptions/v3` returned
  401 (needs free NS API key). Disruptions API reportedly includes lift outages;
  confirm per-elevator granularity + a station facilities/inventory endpoint
  before grading. Likely Tier 2–3. First Netherlands.
- **ODPT (Tokyo — Metro/Toei/JR East)** — `developer.odpt.org` free
  registration. The overview page names only realtime train data + GTFS; it does
  **not** advertise elevator/facility status. Search the ODPT catalog
  (`ckan.odpt.org`) for a facility/elevator dataset before investing — may be
  "not viable." Would be first Asia if a real feed exists.

## NOT VIABLE / REVISIT LATER

- **TfNSW (Sydney)** — the facilities dataset is STATIC inventory and its
  Gateway API resource is deprecated; no confirmed real-time lift status.
  Revisit if a live Facilities/Trip-Planner status API surfaces.
- **MTR (Hong Kong)** — DATA.GOV.HK publishes barrier-free facilities as a
  STATIC CSV (routes/fares/facilities) + a webpage search; no real-time lift
  status feed found. Not viable for live monitoring today.
- **brokenlifts.org (Berlin/VBB)** — community scraper, GitHub unmaintained
  since 2022, data itself scraped from DB. Skip; integrate DB FaSta directly.
- **Latin America (CDMX, São Paulo, Santiago, Buenos Aires, Medellín)** — no
  elevator-status feed surfaced in the sweep. Revisit case-by-case.
- **Untested this round** (candidates from the brief with no probe yet — worth a
  quick GTFS-RT-alert check each, MBTA pattern): NJ Transit, PATH, MARTA, LA
  Metro, Sound Transit, TriMet, RTD, Metro Transit MN, Miami-Dade, DART,
  Houston, St. Louis, Baltimore MTA, VTA, PATCO, STM Montreal (status page
  errored keyless), TransLink Vancouver, OC Transpo, Calgary, Edmonton; and
  Europe/APAC: BVG/HVV/MVG (BVG `v6.bvg.transport.rest` responded 200 — a
  community REST wrapper worth checking for a `/facilities` route), Madrid,
  Lisbon, GVB, STIB, SL, Ruter, Copenhagen, Zurich/SBB, Milan, Rome, Prague,
  Warsaw, Budapest, Dublin, Glasgow SPT, Tyne & Wear, Merseyrail, UK National
  Rail (Knowledgebase Lift & Escalator API — wiki was behind Cloudflare),
  Seoul, Singapore LTA, Taipei, PTV Melbourne, Brisbane, Auckland, Wellington,
  Delhi.

---

## Ranked "do first" list

1. **IDFM Paris** — Tier 1, no key, one feed = everything, huge multimodal
   network, first France. Best quality-to-effort ratio on the board. **Start here.**
2. **DB FaSta (Germany)** — Tier 1, free key, nationwide, first Germany. Blocked
   only on getting the key.
3. **Wiener Linien (Vienna)** — no key, rich outage feed + static inventory,
   first Austria. MBTA-shaped adapter.
4. **TTC (Toronto)** — no key, clean per-elevator outage feed, first Canada.
   WMATA/LIRR-shaped adapter.
5. **SEPTA (Philadelphia)** — no key, simple outage feed + curatable workaround
   pages. CTA-shaped adapter.

Each of 1–5 is one new adapter + one `SystemCatalogEntry` + registry binding, no
new normalized types required. IDFM and FaSta also advance the "sole-access"
model since their serves-text supports later chain inference.
