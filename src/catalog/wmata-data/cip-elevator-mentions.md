# WMATA Capital Improvement Program — elevator equipment-id mentions

**Source**: WMATA's own **FY2026 Q3 Capital Improvement Program Progress
Report** ("WMATA FY26 Q3 Capital Improvement Program Project Pages.pdf",
`wmata.com/content/dam/wmata-com/about/capital-improvement-program-documents/`),
241 pages. NOT a per-station elevator inventory — it's a budget/contract
status report — but its narrative project updates name specific real
elevator equipment ids (WMATA's `UnitName` format, e.g. `A14X01`) tied to a
station, which is a genuine ground-truth signal for confirming or promoting
unit ids in our curated models. Newer quarterly editions (Q1/Q2/Q3 FY2026,
and presumably future quarters) exist at the same URL pattern — re-check when
chasing an unconfirmed synthetic id.

**Extraction method**: `curl -A "<browser UA>" -o report.pdf <url>` (no WAF
on this path, unlike bart.gov) + Node `pdf-parse` for the text layer, then
`grep`/regex for the `[A-Z]\d{2}[EX]\d{2}` unit-id pattern near a station
name. Full report re-extraction not committed here (241 pages, mostly
budget/contract tables irrelevant to redundancy modeling) — only the
elevator-relevant mentions are kept below. Re-run the extraction fresh from
a new quarter's PDF if chasing a specific unconfirmed station.

## Elevator-relevant excerpts (FY2026 Q3, as of the report's writing)

**(CIP0072) Elevator Rehabilitation Program** — "During FY26 Q3, the
Elevator Rehabilitation Program completed three units at McPherson Square
(C02E01), Glenmont (B11X06), and New Carrollton (D13X02). Construction
remained in progress at Mount Vernon (E01X04). Additional locations moved
into the next phase of delivery, with construction pending at Glenmont
(B11X05), Alexandria Yard (C93X01), and Rockville (A14X01)."

**(CIP0132) Escalator and Elevator Overhaul Program** — "The West
Hyattsville Station E07X01 modernization project was also completed."

## Unit ids confirmed real, with station

| Unit id | Station | Status vs our models |
|---|---|---|
| `A14X01` | Rockville | Already hand-curated (pedestrian-bridge pair A14X01/A14X02) — this report independently corroborates it. |
| `E07X01` | West Hyattsville | **Was a synthetic placeholder** (`WMATA-E07_MZ_ELV_W`) for the unobserved opposite-direction elevator — **promoted to the real id 2026-07-16** (`wmata-models.ts`) based on this report, since the station-code + X01/X02 pairing convention matches Rockville's confirmed pattern. |
| `C02E01` | McPherson Square | Not currently in our modeled/synthetic set — noted for a future review pass. |
| `B11X05`, `B11X06` | Glenmont | Not currently in our modeled/synthetic set — noted for a future review pass. |
| `D13X02` | New Carrollton | Not currently in our modeled/synthetic set — noted for a future review pass. |
| `E01X04` | Mount Vernon | Not currently in our modeled/synthetic set — noted for a future review pass. |
| `C93X01` | Alexandria Yard | Non-passenger facility (rail yard) — not relevant to station accessibility modeling. |

## Caveat

This is an incidental byproduct of a budget report, not a designed
inventory — coverage is whatever happened to be under construction/repair
during this one quarter, not comprehensive. Treat a unit id found here as
"confirmed real," but treat its ABSENCE from this report as no signal
either way (most WMATA elevators simply weren't mentioned because they
weren't under active work this quarter).
