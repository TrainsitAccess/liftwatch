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

## Unit ids confirmed real, with station (fully investigated 2026-07-16)

| Unit id | Station | Status vs our models |
|---|---|---|
| `A14X01` | Rockville | Already hand-curated (pedestrian-bridge pair A14X01/A14X02) — this report independently corroborates it. |
| `E07X01` | West Hyattsville | **Was a synthetic placeholder** (`WMATA-E07_MZ_ELV_W`) for the unobserved opposite-direction elevator — **promoted to the real id 2026-07-16** (`wmata-models.ts`) based on this report, since the station-code + X01/X02 pairing convention matches Rockville's confirmed pattern. |
| `C02E01` | McPherson Sq | **Modeled but AMBIGUOUS which slot.** C02 has 3 synthetic slots (`WMATA-C02_E_MZ_ELE` shared street↔mezzanine, `WMATA-C02_E_ELE1`/`WMATA-C02_E_ELE2` per-direction mezz↔platform legs) — the report names only ONE id with no disambiguating detail, so it can't be assigned to a specific slot without guessing. NOT promoted. Will resolve naturally the first time C02E01 (or any of the three) is observed in a live outage. |
| `D13X02` | New Carrollton | **Modeled but AMBIGUOUS which slot.** D13 is a straight 2-elevator series (`WMATA-D13_MZ_ELV1` street/mezz→NW mezz, `WMATA-D13_MZ_ELV2` NW mezz→platform) — "X02" plausibly maps to the 2nd (platform) leg by numbering convention, but that's a guess, not confirmed the way West Hyattsville's pairing was. NOT promoted. |
| `E01X04` | Mt Vernon Sq | **Already flagged, now strengthened — a genuine redundancy candidate.** E01 is EXCLUDED from modeling (`chains-excluded.json`, reason `observed-undercount`) and sits in the review queue (`wmata:E01`, priority 20) because our own live-feed observation already found FOUR real units: `E01X01`/`E01X02` (both "Elevator between street and mezzanine", identically worded) and `E01X04`/`E01X05` (both "Elevator between mezzanine and platform", identically worded) — the same identical-wording-both-legs shape as Rockville/19th-St-BART/Warm-Springs-BART, all confirmed-redundant stations elsewhere in this project. This report independently corroborates E01X04 as real (3rd source, alongside GTFS + live observation) — added as new evidence to the `wmata:E01` queue entry 2026-07-16. **NOT modeled here** — WMATA's own text never says these back each other up (unlike BART's outage-options page, which uses explicit "use the other elevator" language), so this is a redundancy CLAIM that needs the `/liftwatch-station-review` ritual (Bryce's verdict or a stronger agency-guidance signal), not something to ship unilaterally. Flagging as a HIGH-PRIORITY candidate for the next review session given how well-evidenced it now is. |
| `B11X05`, `B11X06` | Glenmont | **Not modeled or excluded at all** — doesn't appear in `wmata-models.ts` or `chains-excluded.json`. Outside the current curated/reviewed set entirely (an ordinary un-touched `assumed`-redundancy station). Confirmed real ids, but no structural context yet to know what they connect — would need a fresh research pass, not just an id assignment. |
| `C93X01` | Alexandria Yard | Non-passenger rail yard facility — not relevant to station accessibility modeling. |

## Caveat

This is an incidental byproduct of a budget report, not a designed
inventory — coverage is whatever happened to be under construction/repair
during this one quarter, not comprehensive. Treat a unit id found here as
"confirmed real," but treat its ABSENCE from this report as no signal
either way (most WMATA elevators simply weren't mentioned because they
weren't under active work this quarter).
