# BART ADA settlement — per-elevator ground truth (2026-07-20)

The BART analog to CTA's and MBTA's ADA settlements: **_Senior and Disability
Action v. San Francisco Bay Area Rapid Transit District_, No. 3:17-cv-01876-LB
(N.D. Cal.)** — a class action under ADA Title II / §504 / California law, filed
2017, **final approval 2024-04-18**. It commits BART to a strategic maintenance
+ renovation program for its **87 station elevators** (8 renovated/year; 40
highest-priority by 2039). BART denies liability.

**Why it matters for LiftWatch:** BART's live `cmd=elev` advisory is free-text
and **station-level** — it has no per-elevator ids anywhere (our long-standing
structural gap; our elevator ids were invented, e.g. `MLBR-PLAT-3`). This
settlement's exhibits are a genuine **per-elevator inventory with BART's own
real asset ids + function**, covering **all ~50 stations including eBART**. It's
the same class of source as MTA's data.ny.gov inventory and MBTA's
Daniels-Finegold facility ids.

## The document + extraction

- Settlement Agreement PDF (Dkt. 145-1, 310 pp., 8.8 MB):
  `https://dralegal.org/wp-content/uploads/2023/12/145-1_Settlement_Agreement.pdf`
  (hosted by Disability Rights Advocates; case page:
  `dralegal.org/press/bart-settlement/`, docket: clearinghouse.net case 45228).
- WebFetch can't parse it (image-wrapped). Extract per the playbook:
  `curl -A "<browser UA>"` (already saved) → `pdftotext -layout`. Text layer is
  clean underneath.
- **Exhibit E** (~p. 66) — *Systemwide Elevator Renovation Program*: per-elevator
  rows with the real id ("Alias", e.g. `M16-63`), station, a renovation
  priority ranking, and target year. NOTE: pdftotext shifts its
  Station/County + Platform/Station columns — treat E's function column as
  unreliable; use Exhibit F for function.
- **Exhibit F** (~p. 76) — *Elevator Strategic Maintenance schedule*: the
  authoritative per-elevator table. Each row's equipment descriptor encodes
  **function + position** in its type suffix:
  - `HYD-S` → street/station-level entrance elevator
  - `HYD-P` / `HYD-P1..P5` → platform elevator (with BART's platform index)
  - `HYD-SP` → a single shaft spanning street→platform (single-elevator station)
  - `TRA-G` → parking-garage elevator (tracked unit, not a chain member)
  - `HYD-AMTRAK` → Amtrak-only connector (outside BART's step-free scope)
- Exhibit D is the Strategic Maintenance Program memo (narrative, MAXIMO/CMMS,
  no per-elevator table beyond E/F). A later section (~p. 8560 of the extract)
  carries per-station **outage-options / alternate-elevator** guidance — a
  redundancy corroboration source that echoes `bart.gov/stations/<code>/accessible`.

Structured extract committed alongside this doc as
`settlement-elevator-inventory.json` (94 elevators, 49 station codes; id, abbr,
station, function, position, replacedBy/notes).

## Id scheme

`<stationAssetCode>-<n>` — the prefix is BART's internal station asset code and
cross-checks the station name on every row: `M16`=Embarcadero, `W40`=Millbrae,
`R10`=Ashby, `Y10`=SFIA, `H10`=OAC, `E30`=Antioch, `E20`=Pittsburg Center, etc.
These are **asset-management ids**, NOT live-feed ids — the live advisory stays
station-level, so this does not by itself enable live per-elevator attribution.
We adopt them as our elevator `externalId`s (replacing invented ids) and use the
function/position to validate structure.

## Reconciliation vs our models + live pages (3-way, 2026-07-20)

Cross-checked the 50 curated models against this inventory AND our 2026-07-08
scrape of BART's live `/accessible` pages (`elevator-pages.json`). **Our models'
counts are overwhelmingly correct and match the live pages.** Exhibit E is a
renovation *program* list (incomplete — omits some elevators, includes some
replacements/duplicates); **Exhibit F is complete and authoritative** and
resolved every flagged discrepancy:

- **19th St** — E listed 2, F has 3 (`K20-25` platform + `K20-24`/`K20-163`
  street). Live pages 3, model 3. ✓ (E undercounted.)
- **Warm Springs** — E listed 4, F has 5 (`S20-146`/`147` platform +
  `S20-148`/`149`/`162` street). Pages 5, model 5. ✓ (E undercounted.)
- **Richmond** — BART platform chain 3: `R60-51` (platform), `R60-61`/`R60-80`
  (street). `R60-58` is the **Amtrak connector** (matches the dimensions-guide
  note) — in scope, modeled as a separate Richmond AUXILIARY chain to the Amtrak
  platform (Bryce, 2026-07-20), so it never joins the BART platform chain and a
  bare RICH advisory still defaults to the BART platform elevator. ✓
- **Colma / Daly City** — E over-listed (2/4); live pages + F effective =
  1 / (3 real). Kept model counts (live-validated).
- **San Bruno** — F has 3, but `W30-105`/`W30-106` are **garage** (`TRA-G`);
  only `W30-104` (platform) is the chain elevator. Model 1. ✓
- **West Dublin** — settlement lists only the 1 station elevator `L20-132`;
  our 4 garage elevators aren't in the settlement (garages excluded from the
  87). Model keeps garages as tracked non-chain units.
- **eBART** — Antioch (`E30-159` street, `E30-160` platform) and Pittsburg
  Center (`E20-158` street) ARE in the settlement, contrary to first assumption.

## Caveats (per the playbook — verify built-vs-current)

- Asset ids, not live-feed ids (above).
- 2023 snapshot: some ids are mid-replacement (`R50-50`→`R50-164`,
  `R50-49`→`R50-165` at El Cerrito del Norte) — `replacedBy` recorded.
- Exhibit E's function column is column-shifted; only Exhibit F's suffix is
  trusted for function.
- Where a station has ≥2 same-function elevators (e.g. per-direction platform
  pairs), the id↔physical-side mapping is by position index and is
  **inferential** — noted in the model `internalNote`, same discipline as WMATA
  synthetic-slot assignment.
