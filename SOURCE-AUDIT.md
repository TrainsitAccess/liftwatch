# LiftWatch Source Audit — 2026-07-21

What data sources each system has, where systems are missing a resource type their
peers have, and what fresh outside research turned up to fill those gaps. Produced
by an 8-system inventory pass + 8 web-research investigations (each finding
live-verified before it was recorded). This is a **research/reference doc**, not a
model change — nothing here has been wired in yet.

Legend: ✓ have · `~` partial / caveated · ✗ missing · **★ research found a NEW fillable source** (see Findings).

## The gap matrix

| Resource type | MTA sub | LIRR/MNR | BART | MBTA | WMATA | TfL | CTA | TMB |
|---|---|---|---|---|---|---|---|---|
| Live **per-elevator** status | ✓ | ✓ eestatus | ✗ station-level | ✓ | ✓ broken-only | ✓ | ✗ text→synthetic | `~`→**★** itransit |
| Official **inventory w/ real ids** | ✓ | ✗ | ✓ settlement | ✓ | ✓ | ✓ | ✗ counts only ·**★** roster | ✓ units.json |
| **Topology / pathways** graph | ✓ tsdataclinic | ✗ | ✗→**★** 511 RG | ✓ GTFS | ✓ GTFS | ✓ area codes | ✗ *(verified none)* | ✗→**★** itransit |
| **ADA settlement** (ids/roadmap) | `~` roadmap | `~` roadmap | ✓ ids | ✓ ids | ✗ *(none exists)* | n/a | `~` policy-only | ✗ |
| **Ramp / other-equip** feed | ✗ ruled out | ✗ | `~` curated | ✓ RAMP | ✗ ruled out | ✓ RampRoutes | ✗ ruled out | ✗ |
| **Rider backup guidance** text | ✓ | `~` camsys | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| **Station-ADA rollup** | ✓ | ✗→**★** wxmd-5cpm | `~` uniform | ✗→**★** GTFS | `~` uniform | ✗→**★** StopPoint | ✗→**★** 8pix-ypme | ✗ |
| **Capital/budget doc** | ✗ | `~` capital | ✗ | ✗ | ✓ CIP ·**★** ELES | ✗ | ✓ ASAP | ✗ |
| **Elevator dimensions** guide | ✗ | ✗ | ✓ Bikes-on-BART | ✗ | ✗ | ✗ | ✗ | ✗ |
| Official **per-elevator redundancy flag** | ✓ | ✗ | ✗ | ✗ | ✗ | `~` derived | ✗ | ✗ *(itransit enables)* |

**The standout asymmetries** (a resource one+ systems have and a peer lacks, where
research could plausibly help):

- **CTA & LIRR/MNR** have *no* official per-elevator inventory-with-ids the way
  MTA/BART/MBTA/WMATA/TfL do. CTA's identity is synthetic-from-alert-text; the
  railroads have only the raw eestatus feed.
- **BART & CTA & LIRR/MNR** have *no* topology/pathways graph (MBTA/WMATA got theirs
  from GTFS `pathways.txt`; MTA from tsdataclinic; TfL from area codes).
- **WMATA** is the one big US system with *no* ADA legal settlement (every peer —
  MTA, BART, MBTA, CTA — yielded one).
- **LIRR/MNR** are the only systems with *no* station-ADA rollup, while the subway
  renders a whole board off one.
- **TMB** is the thinnest system and is *hidden* precisely because its live feed was
  judged unreliable.

Elevator-dimensions guide (BART only) is genuinely niche — not worth chasing for
others. Ramp feeds are already correctly ruled out for MTA/WMATA/CTA (elevator-only
agencies).

---

## Findings — new & actionable (ranked)

### 1. ★★★ TMB's `itransit/metro/ascensors` feed is actually reliable — with the right trust gate  ·  could un-hide TMB
- **Endpoint:** `https://api.tmb.cat/v1/itransit/metro/ascensors?app_id=…&app_key=…&locale=en` (LiftWatch already holds `TMB_APP_ID`/`TMB_APP_KEY`).
- **Fresh live read (2026-07-21):** 859 elevator entries across all 11 lines — 587 OK, **24 KO (→ 15 unique elevators, all on conventional lines L1/L2/L3/L5, 0 KO on automatic lines)**, 248 NO_INFO. The 248 NO_INFO == exactly the non-`INTEGRAT` elevators.
- **The key insight:** the `origen` field is the trust gate. Where `origen=='INTEGRAT'` the elevator is wired to monitoring and `estat_ascensor` (OK/KO) is *real* operational status. `NO_INTEGRAT`/`DE_TERCERS` elevators report `NO_INFO` = never monitored = permanently unknown (mostly the automatic lines).
- **Ground-truth check:** elevator `532.10` reads `KO` in the feed **and** renders as "Elevator 10 / Not available" on the live www.tmb.cat El Carmel page; Sagrada Família's elevators read OK and render "Lifts work correctly." The feed's KO/OK is exactly what TMB shows riders as red/green. The per-station panel on tmb.cat is built from `…/ascensors?estacio=216&linia=2`.
- **Bonus:** the `via → itinerari → bloc` tree gives per-direction / per-access / per-segment **topology** — TMB's catalog currently has none, so redundancy falls to `assumed`. This feed enables real redundancy modeling.
- **⚠ Directly contradicts a documented decision.** CLAUDE.md/SPEC.md say "itransit KO is NOT operational status (274 KO vs 1 out)." The old "274" ≈ 24 KO + 248 NO_INFO — i.e. the earlier analysis appears to have counted NO_INFO as KO. The correct read is **"trust `estat_ascensor` only where `origen==INTEGRAT`."** *(Note: the safety classifier was unavailable when this agent's work was auto-reviewed — I've read its output and it's a legitimate inspection of TMB's own public API/site, but this is exactly the kind of feed-field trap the project warns about, so verify with time-series sampling before acting, per the recommendation below.)*
- **Caveat to resolve before wiring:** `units.json` keys elevators off `ID_ACCES_FISIC` (`'720'`, `'662'`) from a *different* id space than itransit's `codi_ascensor` (`'216.1'`, `'532.10'`) — needs a re-key or a join, plus a `check:tmb` update.

### 2. ★★ LIRR + Metro-North station-ADA rollup  ·  data.ny.gov `wxmd-5cpm`  ·  conf 9
- **`https://data.ny.gov/resource/wxmd-5cpm.json`** ("MTA Rail Stations") — 238 rows = 126 LIRR + 112 MNR, one per station, with `accessibility` = **FULL (197) / PARTIAL (18) / NONE (23)**, plus `code`, `station_name`, `branch`, `zone`, lat/lon, `station_url`.
- This is the **railroad analog to the subway's `mta-station-ada.json`** — the exact "station accessibility" layer LiftWatch lacks for its two thinnest systems. Verified live (238 rows, group-by railroad + accessibility confirmed); grep shows it's not yet used anywhere in the repo.
- Not per-elevator and no redundancy flag — but PARTIAL vs FULL is a real station-granularity coverage signal.
- **Join:** the `code` field. Clean for LIRR (3-letter codes match the adapter's `ATL`/`HVL`/`JAM`/`NYK` prefixes exactly). **MNR needs a crosswalk** — its codes carry a numeric/zone prefix (Harlem-125=`0HL`, Cold Spring=`0CS`) that won't match the adapter's MNR codes (Stamford `2SM`); fall back to `station_name` or GTFS `stop_id`.

### 3. ★★ CTA official station roster + station-ADA  ·  data.cityofchicago.org `8pix-ypme`  ·  conf 9–10
- **`https://data.cityofchicago.org/resource/8pix-ypme.json`** ("List of 'L' Stops") — one row per platform, with `map_id` (the 4xxxx station-complex parent id), `station_name`, per-line booleans, lat/lon, and a per-station **`ada` boolean**. Verified live.
- Two wins: (a) an authoritative **station-complex roster keyed by `map_id`** — better than parsing station names out of alert text, and a stable list independent of GTFS; (b) a **design-time station-ADA board** for CTA (aggregate `ada` to parent via `map_id`).
- Does **not** solve CTA's missing per-elevator identity — that stays synthetic-from-alert-text (see dead-ends).

### 4. ★★ TfL station-ADA with "why partial"  ·  StopPoint Accessibility props  ·  conf 9
- **`https://api.tfl.gov.uk/StopPoint/{naptan}`** → `additionalProperties` (category Accessibility): `AccessViaLift`, `Lifts` (count), `LimitedCapacityLift`, `SpecificEntranceRequired`, `Escalators`. Verified live at King's Cross (`AccessViaLift=Yes, Lifts=10, LimitedCapacityLift=No, SpecificEntranceRequired=No, Escalators=19`).
- This is the **richest station-ADA source of any system** — it encodes *why* a station is only partially step-free (limited-capacity lift, specific-entrance-only, step-free-to-platform vs to-train), which the MTA subway board can't even express.
- A dedicated **TfL step-free + toilet dataset** (successor to lrad-v2.xml; step height, platform-train gap, step-free-to-platform vs to-train) exists via techforum.tfl.gov.uk data-drops but its current download URL couldn't be fetched (tfl.gov.uk 403s WebFetch) — confirm in a browser if you want the deeper spec.

### 5. ★ BART topology — the first it's ever had  ·  511 Regional GTFS pathways  ·  conf 7
- **`https://api.511.org/transit/datafeeds?api_key=…&operator_id=RG`** — the MTC/511 regional GTFS zip includes **`pathways.txt` + `levels.txt` + location_type 3/4 stops** for ~18 named BART stations (Embarcadero, Montgomery, Powell, Civic Center, both Oakland 12th/19th, MacArthur, El Cerrito del Norte, Richmond, Millbrae, Daly City, Union City, Walnut Creek, Pleasant Hill, Dublin/Pleasanton, Warm Springs, Coliseum, Milpitas — the busy/interchange set).
- BART's *own* GTFS still has no pathways (re-confirmed). This regional feed supplies a real pathway/level graph for exactly the stations where topology matters most.
- Free 511 token required; endpoint confirmed live + token-gated. The pathways' presence in the *current* RG zip is blog-corroborated but not byte-inspected (couldn't open the token-gated zip) — **verify the zip contents before building on it.**

### 6. ★ WMATA 2025 elevator-modernization scope  ·  ELES news release  ·  conf 8
- **`wmata.com/news/metro-starting-new-elevator-modernization-project-updating-27-elevators.html`** — commits 27 elevators across "more than a dozen locations," names 3 dated active stations (Archives-Navy Memorial, Benning Road, Dupont Circle's Connecticut Ave & Q St NW street elevator) + ~14 future locations/garages (Capitol Heights, Courthouse, Gallery Place, Glenmont Garage, Huntington, Hyattsville Crossing, McPherson Sq, Minnesota Ave Garage, Mount Vernon Sq, New Carrollton ×2, Pentagon City, Rockville, Wheaton).
- Closest WMATA analog to a settlement's per-station commitments. **No unit ids** — so it's commitment/context enrichment (reconcile the physical-location descriptions against the rider-tools inventory to tag which modeled elevators are under modernization), not an identity source.

---

## Confirmed dead-ends (documented so nobody re-chases them)

- **CTA GTFS has no `pathways.txt` / `levels.txt`.** Downloaded the 67.9 MB zip and `unzip -l`'d it: 11 files, no pathways, no levels. `transfers.txt` is stop-pairs only (no walk graph). CTA will never get topology or per-elevator ids from GTFS.
- **CTA has no Exhibit-F equivalent.** The underlying case is *Access Living of Metropolitan Chicago v. CTA* (filed 2000, settled 2001-09-20). The stipulation is a scanned/image PDF with **general policy only** (rehab every 10-yr-old elevator, install activators) — no per-station lists, counts, or ids. The single settlement-monitor report already in the repo remains the best granular historical corroboration; a fuller official monitor set doesn't exist publicly.
- **LIRR/MNR have no per-elevator inventory-with-redundancy anywhere, and no GTFS pathways/levels.** Both railroad GTFS zips (`rrgtfsfeeds.s3.amazonaws.com/gtfslirr.zip` / `gtfsmnr.zip`) confirmed to lack pathways/levels. The two data.ny.gov E/E datasets (LIRR `9hjt-526f`, MNR `ax67-8386`) are **aggregate branch-level availability KPIs only** — no per-elevator records, ids, redundancy, or level fields. Useless for modeling.
- **BART real-time per-elevator status doesn't exist.** `cmd=elev` stays station-level; 511's GTFS-RT alerts (`?agency=BA`) just re-wrap the same station-level advisory. Keep the station-level approach + the settlement Exhibit-F identity mapping.
- **WMATA ADA settlement doesn't exist.** Metrorail is fully accessible by design, so the peer legal analog was never created. The ELES modernization release (finding #6) is the closest official per-station signal.

## Test-first leads (unconfirmed — pull once and inspect before investing)

- **BART GTFS-RT alerts** `http://api.bart.gov/gtfsrt/alerts.aspx` (no key) — *might* carry `effect=ACCESSIBILITY_ISSUE`, but BART's per-elevator advisory has always lived in the legacy `bsa.aspx?cmd=elev`. Couldn't inspect the protobuf (BART 403s WebFetch). Pull it once; only pursue if it beats the current endpoint.
- **WMATA GTFS-RT alerts** `https://api.wmata.com/gtfs/rail-gtfsrt-alerts.pb` (needs key) — lower priority; `Incidents.svc ElevatorIncidents` (already used) is authoritative. Unlikely to add per-unit signal.
- **MBTA station-ADA board** from GTFS `stops.txt` `wheelchair_boarding` + `facilities.txt` — the adapter already pulls `/facilities` live for units; the *design-time* rollup for a board would be new, low effort.

---

## Recommended next steps (prioritized)

1. **TMB — verify then un-hide.** Write a snapshot script polling `itransit/metro/ascensors` for ~3–5 days; confirm KO is stable/realistic over time (guards against the historical bad-state note). If it holds: adapter treats `KO && origen==INTEGRAT` = OUT, `OK && INTEGRAT` = working, `NO_INFO`/non-INTEGRAT = UNKNOWN/untracked; re-key `units.json` off `codi_ascensor` (or build a join); update `check:tmb`; correct the CLAUDE.md/SPEC.md TMB note; then `hidden: false`. Highest impact — brings a whole system back.
2. **LIRR/MNR station-ADA boards** — snapshot `wxmd-5cpm` → `rail-station-ada.json` (mirror `scripts/mta-station-ada.mts`), split by railroad, join LIRR on `code` and MNR via a name/stop_id crosswalk, add the walled-off MTA-style board. Biggest upgrade to the two thinnest systems.
3. **CTA station layer** — snapshot `8pix-ypme` → roster keyed by `map_id` (validate alert-parsed station names against it) + a station-ADA board from the `ada` flag.
4. **TfL station-ADA board** — ingest StopPoint Accessibility `additionalProperties`; the only system that can show *why* a station is partial.
5. **BART topology** — register a free 511 token, snapshot `operator_id=RG` pathways/levels/stops filtered to BART stop_ids (verify the zip actually contains pathways first). First topology BART has ever had in LiftWatch.
6. **WMATA** — snapshot the ELES modernization station list as commitment/context enrichment (not identity).
