# BART elevator dimensions guide — ground-truth per-elevator inventory

**Source**: BART's own "Bikes on BART — BART Elevator Dimensions" guide
(`bart.gov/sites/default/files/docs/BART_ElevatorDimensions_Guide.pdf`,
© 2022 BART). Built for bike-carrying riders to check elevator size before
boarding, but its byproduct is a genuine **per-elevator inventory with
landing descriptions** for every BART station — the only public document
found (2026-07-16 research pass) that lists BART's physical elevators
individually rather than station-level advisory text.

**Extraction method** (bart.gov blocks WebFetch's crawler with a 403 WAF, but
allows a plain fetch/curl with a spoofed browser User-Agent — see CLAUDE.md):
`curl -A "<browser UA>" -o guide.pdf <url>` then Node `pdf-parse` for the
text layer (3 pages, small file, clean extraction — no image-wrapping issues
unlike the CTA/MTA PDFs).

**How to use this**: a real signal, but NOT infallible — see "Known
non-issues" below for 6 cases where this guide's data looked like a
discrepancy against our curated models but, on verification against BART's
own LIVE per-station page, turned out to be a guide artifact (or, at
Millbrae, apparently STALE relative to a since-changed platform layout)
rather than a real gap. Treat every apparent mismatch the same way: verify
against `bart.gov/stations/<code>/accessible` (live, JS-rendered — use a
real browser, not WebFetch/curl) before changing a model. Never trust this
guide alone for a redundancy claim.

**Coverage note (2026-07-16 fact-check, 6 stations live-verified)**: every
station where this guide showed fewer rows than our curated model — COLM,
RICH, 19TH, MLPT, MLBR, WARM — was individually checked against BART's live
outage-options page and confirmed our existing model correct in every case.
The pattern is consistent: this bike-focused guide collapses same-dimension
elevator pairs into one row (19TH, MLPT), omits auxiliary/garage/bridge
elevators outside the core bike route (WARM's pedestrian bridge, and by the
same pattern presumably COLS's arena footbridge and DALY's pedestrian
tunnel — not individually re-verified but structurally consistent, see their
`auxiliary`/chain-note fields), and in at least one case (MLBR) appears to
describe a pre-2022 layout BART has since reconfigured. **WDUB and SFIA were
independently verified against bart.gov in a prior session** (see their
`internalNote` fields in the source) and not re-checked here.
**Conclusion: after this fact-check, every apparent discrepancy this guide
raised has been resolved — none required a model change. Its highest value
turned out to be corroboration, not new-bug detection** (contrast CTA's
ASAP plan / Morgan finding, or MTA's data.ny.gov, both of which surfaced a
real fix).

## Known non-issues (verified 2026-07-16, don't re-flag)

- **COLM (Colma)**: guide shows the platform elevator TWICE with byte-for-byte
  identical dimensions — a duplicate/typo row in the PDF, not a second
  physical elevator. BART's live page confirms exactly one elevator, no
  in-station backup (cross-station only, to Daly City/SSF). Our model
  (single elevator, no redundancy) is correct.
- **RICH (Richmond)**: guide shows 4 rows, one more than our 3-elevator model
  ("Concourse/Amtrak"). BART's live page lists only 3 elevators (Platform,
  Street East, Street West) — the 4th is a separate Amtrak-platform connector
  outside BART's own accessibility scope, not a 4th BART elevator we're
  missing. Our model is correct.
- **19TH (19th St. Oakland)**: guide collapses the two platform elevators
  into ONE "Concourse/All Platforms" row (same dimensions, so not
  distinguished). BART's live page explicitly names "PLATFORM ELEVATOR 1"
  and "PLATFORM ELEVATOR 2" as each other's backup. Our redundant-pair model
  is correct; the guide just isn't granular enough to show it.
- **MLPT (Milpitas)**: guide shows ONE row ("Street/All Platforms"), but our
  model has 2 separate per-direction platform elevators with NO backup
  claimed between them. BART's live page independently confirms: "PLATFORM
  1 ELEVATOR (Berryessa direction)" and "PLATFORM 2 ELEVATOR (Millbrae/
  SFO/Daly City/Richmond directions)" are two distinct elevators, each with
  only a cross-station detour as its fallback (never each other). Same
  same-dimension-collapse pattern as 19TH — our model is correct.
- **MLBR (Millbrae)**: guide shows 4 rows including a "Concourse/Platform
  1-2" elevator our model doesn't track at all. BART's LIVE page lists only
  4 elevators total (East Plaza street, Caltrain West Plaza, Platform 3
  "ALL DESTINATIONS", Caltrain concourse-to-northbound) — no "Platform 1-2"
  entry exists in the current text; "Platform 3" now explicitly serves
  every platform. The guide (2022) most likely predates a platform
  reconfiguration or renaming. Our model matches BART's CURRENT text
  exactly and is correct; the guide's extra row is stale, not a gap.
- **WARM (Warm Springs/South Fremont)**: guide collapses the two street
  elevators and two platform elevators into one row each (4 physical
  elevators → 2 rows), plus omits the pedestrian-bridge elevator entirely.
  BART's live page confirms all 5 (Street 1/2 mutually redundant, Platform
  1/2 mutually redundant, Pedestrian Bridge with entry-only limitation)
  word-for-word matching our model's existing text. Our model is correct.

## Enrichment pass (2026-07-16): minimal opportunity, and why

Surveyed every curated BART elevator's label against this guide's landing
description to see if any could be sharpened (the same `preferMtaNote()`
principle used for MTA). Conclusion: **not much to adopt** — our existing
labels were built from BART's own per-station outage-options advisory text
(richer, rider-facing, direction-named: e.g. "Platform 1 elevator (Berryessa
direction)"), which is already more specific than this guide's terse
table-cell phrasing (e.g. "Street/All Platforms"). The guide's genuine
enrichment value was the fact-check above, not label wording. Its one type
of data we don't otherwise capture — physical door/cab dimensions — is
preserved in the table below for a possible future capacity-facing feature,
but isn't wired into any current model field (out of this project's current
step-free-access scope).

As a byproduct, this pass also corroborates all 16 single-elevator "Station
elevator" BART stations (Balboa Park, Bay Fair, Berryessa, Castro Valley,
Concord, Dublin/Pleasanton, Fremont, Glen Park, Lafayette, North Berkeley,
North Concord, Orinda, Pittsburg Center, Rockridge, San Bruno, South San
Francisco) — each shows exactly one guide row, matching our model, no hidden
second elevator suggested.

## Full per-station elevator list (as published, 2022)

Station | Elevator segment (landing description) | Door | Width | Length | Diagonal
---|---|---|---|---|---
12th St./Oakland | Street at 14th Street/Concourse | 42" | 63" | 77" | 100"
12th St./Oakland | Street at 11th Street/Concourse | 36" | 51" | 67" | 84"
12th St./Oakland | Concourse/All Platforms | 47" | 61" | 66" | 90"
16th St. Mission | Street/Concourse | 42" | 56" | 67" | 85"
16th St. Mission | Concourse/All Platforms | 48" | 60" | 70" | 90"
19th St./Oakland | Street at 17th/Concourse | 35" | 57" | 63" | 83"
19th St./Oakland | Concourse/All Platforms | 47" | 61" | 67" | 88"
24th St. Mission | Street/Concourse | 42" | 56" | 67" | 85"
24th St. Mission | Concourse/All Platforms | 48" | 60" | 70" | 90"
Antioch | Street/Overpass | 48" | 64" | 92" | 110"
Antioch | Overpass/All Platforms | 48" | 64" | 90" | 109"
Ashby | Street/All Platforms | 42" | 60" | 90" | 105"
Ashby | Street/All Platforms | 39" | 61" | 61" | 85"
Ashby | Adeline Street/Station | 42" | 65" | 81" | 100"
Balboa Park | Street/All Platforms | 41" | 57" | 62" | 81"
Bay Fair | Street/All Platforms | 41" | 56" | 62" | 83"
Berryessa | Street/All Platforms | 42" | 68" | 76" | 101"
Castro Valley | Street/All Platforms | 40" | 66" | 99" | 120"
Civic Center | Street/Concourse | 34" | 56" | 62" | 82"
Civic Center | Concourse/All Platforms | 36" | 60" | 84" | 103"
Coliseum | Street/All Platforms | 42" | 56" | 63" | 83"
Coliseum/OAK | Street/Coliseum Platform/Connector | 42" | 66" | 83" | 98"
Colma | Street/All Platforms | 42" | 65" | 100" | 120"
Colma | Street/All Platforms *(duplicate row — see Known non-issues)* | 42" | 65" | 100" | 120"
Concord | Street/All Platforms | 36" | 56" | 63" | 83"
Daly City | Street/Platform for SF and East Bay | 35" | 55" | 61" | 81"
Daly City | Street/Platform to SFO/Millbrae | 36" | 57" | 61" | 82"
Downtown Berkeley | Street/Concourse | 36" | 53" | 78" | 92"
Downtown Berkeley | Concourse/All Platforms | 36" | 54" | 75" | 91"
Dublin/Pleasanton | Street/All Platforms | 42" | 68" | 99" | 118"
El Cerrito Del Norte | Street/Platform to Richmond | 42" | 65" | 79" | 101"
El Cerrito Del Norte | Street/Platform to all other destinations | 42" | 65" | 79" | 101"
El Cerrito Plaza | Street/Platform to Richmond | 36" | 44" | 61" | 75"
El Cerrito Plaza | Street/Platform to all other destinations | 36" | 44" | 61" | 75"
Embarcadero | Street/Concourse | 34" | 60" | 64" | 87"
Embarcadero | Concourse/All Platforms | 38" | 66" | 68" | 91"
Fremont | Street/All Platforms | 35" | 58" | 67" | 88"
Fruitvale | Street/Platform to Berryessa/DP | 38" | 56" | 61" | 81"
Fruitvale | Street/Platform to Richmond/SF | 38" | 56" | 61" | 81"
Glen Park | Street/Platform to Richmond/SF | 45" | 57" | 57" | 78"
Hayward | Street/Platform to Richmond/SF | 42" | 55" | 72" | 90"
Hayward | Station/Platform to Berryessa | 42" | 55" | 72" | 90"
Lafayette | Street/All Platforms | 43" | 55" | 63" | 83"
Lake Merritt | Street/Concourse | 40" | 57" | 65" | 83"
Lake Merritt | Concourse/All Platforms | 42" | 71" | 79" | 105"
MacArthur | Street/Platform to Richmond/PBP | 36" | 59" | 82" | 100"
MacArthur | Street/Platform to Berryessa/SF | 36" | 59" | 82" | 100"
Millbrae | East Side Street/Concourse | 42" | 60" | 100" | 120"
Millbrae | Caltrain/Concourse | 42" | 60" | 100" | 120"
Millbrae | Concourse/Platform 1-2 | 42" | 60" | 100" | 120"
Millbrae | Concourse/Platform 3 | 42" | 60" | 100" | 120"
Milpitas | Street/All Platforms | 42" | 66" | 90" | 110"
Montgomery | Street/Concourse | 34" | 56" | 63" | 83"
Montgomery | Concourse/All Platforms | 43" | 52" | 71" | 87"
North Berkeley | Street/All Platforms | 39" | 56" | 62" | 84"
North Concord | Street/All Platforms | 42" | 60" | 100" | 120"
OAK (Oakland Int'l Airport) | Street/All Platforms | 42" | 62" | 80" | 101"
Orinda | Street/All Platforms | 34.9" | 55" | 63" | 83"
Pittsburg Bay Point | Street/Concourse | 42" | 60" | 100" | 120"
Pittsburg Bay Point | Concourse/All Platforms | 42" | 60" | 100" | 120"
Pittsburg Center | Street/All Platforms | 48" | 67" | 90" | 111"
Pleasant Hill | Street/Platform to Antioch | 36" | 62" | 56" | 83"
Pleasant Hill | Street/Platform to SFO/Millbrae | 36" | 56" | 62" | 83"
Powell | Street/Concourse | 36" | 58" | 63" | 86"
Powell | Concourse/All Platforms | 48" | 52" | 71" | 88"
Richmond | Plaza Street/Concourse | 42" | 66" | 77" | 100"
Richmond | East Street/Concourse | 42" | 65" | 106" | 122"
Richmond | Concourse/All Platforms | 36" | 60" | 61" | 85"
Richmond | Concourse/Amtrak *(Amtrak-only connector — see Known non-issues)* | 42" | 67" | 84" | 100"
Rockridge | Street/All Platforms | 36" | 58" | 60" | 83"
San Bruno | Street/All Platforms | 42" | 65" | 100" | 120"
San Leandro | Street/Platform to SF/Richmond | 38" | 57" | 62" | 83"
San Leandro | Street/Platform to Berryessa/DP | 38" | 57" | 61" | 81"
SFO | Not necessary *(direct concourse-level connection, no elevator)* | — | — | — | —
South Hayward | Street/Platform to SF, Overpass to Berryessa | 35" | 57" | 63" | 85"
South Hayward | Overpass/Berryessa | 35" | 57" | 63" | 85"
South San Francisco | Street/All Platforms | 42" | 61" | 100" | 120"
Union City | Street/Platform to SF/Richmond | 42" | 69" | 79" | 102"
Union City | Street/Platform to Berryessa | 42" | 68" | 77" | 102"
Walnut Creek | Street/Platform to Antioch | 37" | 56" | 62" | 83"
Walnut Creek | Street/Platform to SFO/Millbrae | 37" | 56" | 62" | 83"
Warm Springs | Street/Concourse | 42" | 69" | 89" | 109"
Warm Springs | Concourse/All Platforms | 42" | 69" | 89" | 109"
West Dublin/Pleasanton | Concourse/All Platforms | 42" | 67" | 86" | 102"
West Oakland | Street/Platforms to East Bay | 35" | 56" | 62" | 83"
West Oakland | Street/Platforms to SFO/Millbrae | 35" | 56" | 62" | 83"
