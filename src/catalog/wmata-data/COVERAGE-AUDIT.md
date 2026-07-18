# WMATA station model — data-coverage & accuracy audit

_Audit pass 2026-07-17. All 98 modeled WMATA stations, both tiers. "rev" = individually confirmed with Bryce via /liftwatch-station-review; "auto" = built from GTFS pathways by scripts/wmata-pathways.mts, never human-reviewed. This report answers two questions: (1) for each station, what do we actually know vs. infer vs. lack; (2) do the auto-generated models hold up against the lessons learned during the manual review?_

## 1. Coverage at a glance

- **98 stations** — 43 reviewed, 55 auto-generated.
- **Notes**: 98/98 carry both a public `note` and an `internalNote`. Auto-tier notes are template-generated (composePublicNote) and read consistently.
- **Elevator ids confirmed live**: only 50/98 stations have at least one REAL observed `UnitName`; 48 are entirely synthetic (structure modeled, exact ids unconfirmed until a first live outage).
- **Physical street-elevator locations**: recorded for only **16/98 stations** (38 of 146 street elevators). The rest carry the elevator's role/direction but not where it physically sits. Largest single data gap.
- **Redundancy claimed**: 28 stations (15 reviewed, 13 auto). The auto-tier redundancy claims are the main accuracy risk — see section 3.

## 2. Per-station coverage

Legend — **Loc**: physical location recorded for street elevators (n/total; — = no distinct street-elevator segment). **Red**: redundancy claimed. **Alt**: non-elevator step-free alternative. **N**: both notes present.

| Code | Station | Tier | Ch | Els | Real | Syn | Loc | Red | Alt | N |
|---|---|:--:|--:|--:|--:|--:|:--:|:--:|:--:|:--:|
| A01_C01 | Metro Center | rev | 3 | 7 | 3 | 4 | 0/3 ⚠ | Y | · | ✓ |
| A02 | Farragut North | rev | 1 | 2 | 0 | 2 | 1/1 | · | · | ✓ |
| A03 | Dupont Circle | rev | 2 | 4 | 0 | 4 | 0/2 ⚠ | · | · | ✓ |
| A04 | Woodley Park | rev | 1 | 2 | 0 | 2 | 0/1 ⚠ | · | · | ✓ |
| A05 | Cleveland Park | rev | 1 | 2 | 0 | 2 | 0/1 ⚠ | · | · | ✓ |
| A06 | Van Ness-UDC | rev | 1 | 2 | 0 | 2 | 0/1 ⚠ | · | · | ✓ |
| A07 | Tenleytown-AU | auto | 1 | 1 | 1 | 0 | 0/1 ⚠ | · | · | ✓ |
| A08 | Friendship Heights | auto | 1 | 4 | 0 | 4 | 0/2 ⚠ | Y | · | ✓ |
| A09 | Bethesda | auto | 1 | 2 | 1 | 1 | 0/1 ⚠ | · | · | ✓ |
| A10 | Medical Center | auto | 1 | 2 | 1 | 1 | 0/1 ⚠ | · | · | ✓ |
| A11 | Grosvenor-Strathmore | auto | 1 | 1 | 0 | 1 | — | · | · | ✓ |
| A12 | North Bethesda | auto | 1 | 1 | 0 | 1 | 0/1 ⚠ | · | · | ✓ |
| A13 | Twinbrook | auto | 1 | 1 | 0 | 1 | 0/1 ⚠ | · | · | ✓ |
| A14 | Rockville | rev | 2 | 3 | 2 | 1 | — | Y | · | ✓ |
| A15 | Shady Grove | auto | 1 | 2 | 0 | 2 | 0/1 ⚠ | · | · | ✓ |
| B01_F01 | Gallery Place | rev | 3 | 9 | 6 | 3 | 0/6 ⚠ | Y | · | ✓ |
| B02 | Judiciary Sq | rev | 2 | 2 | 1 | 1 | 0/2 ⚠ | · | · | ✓ |
| B03 | Union Station | auto | 1 | 2 | 0 | 2 | 0/1 ⚠ | · | · | ✓ |
| B04 | Rhode Island Av | auto | 1 | 1 | 0 | 1 | 0/1 ⚠ | · | · | ✓ |
| B05 | Brookland-CUA | auto | 1 | 2 | 0 | 2 | 0/1 ⚠ | · | · | ✓ |
| B06_E06 | Fort Totten | rev | 1 | 1 | 0 | 1 | 0/1 ⚠ | · | · | ✓ |
| B07 | Takoma | auto | 1 | 1 | 0 | 1 | 0/1 ⚠ | · | · | ✓ |
| B08 | Silver Spring | auto | 1 | 1 | 0 | 1 | 0/1 ⚠ | · | · | ✓ |
| B09 | Forest Glen | rev | 1 | 6 | 3 | 3 | — | Y | · | ✓ |
| B10 | Wheaton | auto | 1 | 2 | 1 | 1 | 0/1 ⚠ | · | · | ✓ |
| B11 | Glenmont | auto | 1 | 3 | 2 | 1 | 0/2 ⚠ | Y | · | ✓ |
| B35 | NoMa-Gallaudet U | rev | 2 | 3 | 1 | 2 | — | Y | · | ✓ |
| C02 | McPherson Sq | rev | 2 | 4 | 0 | 4 | 0/2 ⚠ | · | · | ✓ |
| C03 | Farragut West | rev | 2 | 4 | 0 | 4 | 0/2 ⚠ | · | · | ✓ |
| C04 | Foggy Bottom-GWU | auto | 1 | 2 | 1 | 1 | 0/1 ⚠ | · | · | ✓ |
| C05 | Rosslyn | rev | 2 | 7 | 6 | 1 | 6/6 | Y | · | ✓ |
| C06 | Arlington Cemetery | rev | 2 | 2 | 0 | 2 | 0/2 ⚠ | · | · | ✓ |
| C07 | Pentagon | rev | 3 | 7 | 0 | 7 | — | Y | · | ✓ |
| C08 | Pentagon City | rev | 2 | 4 | 2 | 2 | 0/2 ⚠ | · | · | ✓ |
| C09 | Crystal City | rev | 2 | 4 | 0 | 4 | 0/2 ⚠ | · | · | ✓ |
| C10 | Ronald Reagan Washington National Airport | rev | 2 | 2 | 2 | 0 | 0/2 ⚠ | · | · | ✓ |
| C11 | Potomac Yard | rev | 2 | 16 | 0 | 16 | — | Y | · | ✓ |
| C12 | Braddock Rd | auto | 1 | 1 | 0 | 1 | 1/1 | · | · | ✓ |
| C13 | King St-Old Town | auto | 1 | 2 | 2 | 0 | 0/2 ⚠ | Y | · | ✓ |
| C14 | Eisenhower Av | rev | 2 | 2 | 1 | 1 | 2/2 | · | · | ✓ |
| C15 | Huntington | rev | 3 | 5 | 2 | 3 | 1/1 | Y | · | ✓ |
| D01 | Federal Triangle | auto | 1 | 2 | 2 | 0 | 0/1 ⚠ | · | · | ✓ |
| D02 | Smithsonian | rev | 2 | 3 | 3 | 0 | 2/2 | · | · | ✓ |
| D03_F03 | L'Enfant Plaza | rev | 3 | 7 | 7 | 0 | 3/3 | · | · | ✓ |
| D04 | Federal Center SW | auto | 1 | 2 | 0 | 2 | 0/1 ⚠ | · | · | ✓ |
| D05 | Capitol South | auto | 1 | 2 | 1 | 1 | 0/1 ⚠ | · | · | ✓ |
| D06 | Eastern Market | auto | 1 | 2 | 1 | 1 | 0/1 ⚠ | · | · | ✓ |
| D07 | Potomac Av | auto | 1 | 2 | 1 | 1 | 0/1 ⚠ | · | · | ✓ |
| D08 | Stadium-Armory | auto | 1 | 2 | 1 | 1 | 0/1 ⚠ | · | · | ✓ |
| D09 | Minnesota Av | auto | 1 | 2 | 0 | 2 | 0/1 ⚠ | · | · | ✓ |
| D10 | Deanwood | auto | 1 | 2 | 1 | 1 | 0/1 ⚠ | · | · | ✓ |
| D11 | Cheverly | rev | 2 | 4 | 2 | 2 | 0/2 ⚠ | · | · | ✓ |
| D12 | Landover | auto | 1 | 1 | 1 | 0 | 0/1 ⚠ | · | · | ✓ |
| D13 | New Carrollton | rev | 1 | 2 | 0 | 2 | 0/1 ⚠ | · | · | ✓ |
| E01 | Mt Vernon Sq | rev | 1 | 5 | 4 | 1 | 3/3 | Y | · | ✓ |
| E02 | Shaw-Howard U | auto | 1 | 2 | 0 | 2 | 0/1 ⚠ | · | · | ✓ |
| E03 | U St | rev | 1 | 2 | 0 | 2 | 1/1 | · | · | ✓ |
| E04 | Columbia Heights | auto | 1 | 2 | 2 | 0 | 0/1 ⚠ | · | · | ✓ |
| E05 | Georgia Av-Petworth | auto | 1 | 2 | 1 | 1 | 0/1 ⚠ | · | · | ✓ |
| E07 | West Hyattsville | rev | 2 | 2 | 2 | 0 | 0/2 ⚠ | · | · | ✓ |
| E08 | Hyattsville Crossing | rev | 2 | 2 | 0 | 2 | 0/2 ⚠ | · | · | ✓ |
| E09 | College Park-U of Md | auto | 1 | 3 | 0 | 3 | 0/2 ⚠ | Y | · | ✓ |
| E10 | Greenbelt | rev | 1 | 1 | 0 | 1 | — | · | · | ✓ |
| F02 | Archives | auto | 1 | 2 | 2 | 0 | 0/1 ⚠ | · | · | ✓ |
| F04 | Waterfront | auto | 1 | 2 | 2 | 0 | 0/1 ⚠ | · | · | ✓ |
| F05 | Navy Yard-Ballpark | rev | 1 | 8 | 8 | 0 | 2/4 ⚠ | Y | · | ✓ |
| F06 | Anacostia | auto | 1 | 2 | 0 | 2 | 0/2 ⚠ | Y | · | ✓ |
| F07 | Congress Heights | auto | 1 | 2 | 2 | 0 | 0/1 ⚠ | · | · | ✓ |
| F08 | Southern Av | rev | 1 | 2 | 0 | 2 | 2/2 | · | · | ✓ |
| F09 | Naylor Rd | auto | 1 | 1 | 1 | 0 | 1/1 | · | · | ✓ |
| F10 | Suitland | rev | 1 | 2 | 0 | 2 | 0/2 ⚠ | · | · | ✓ |
| F11 | Branch Av | auto | 1 | 1 | 1 | 0 | 0/1 ⚠ | · | · | ✓ |
| G01 | Benning Rd | auto | 1 | 2 | 2 | 0 | 1/1 | · | · | ✓ |
| G02 | Capitol Heights | auto | 1 | 2 | 1 | 1 | 0/1 ⚠ | · | · | ✓ |
| G03 | Addison Rd | auto | 1 | 1 | 0 | 1 | 1/1 | · | · | ✓ |
| G04 | Morgan Blvd | rev | 1 | 2 | 2 | 0 | 2/2 | Y | · | ✓ |
| G05 | Downtown Largo | rev | 4 | 6 | 1 | 5 | — | Y | · | ✓ |
| J02 | Van Dorn St | auto | 1 | 1 | 0 | 1 | 0/1 ⚠ | · | · | ✓ |
| J03 | Franconia-Springfield | rev | 1 | 2 | 1 | 1 | 0/1 ⚠ | · | · | ✓ |
| K01 | Court House | auto | 1 | 2 | 0 | 2 | 0/1 ⚠ | · | · | ✓ |
| K02 | Clarendon | rev | 2 | 4 | 0 | 4 | 0/2 ⚠ | · | · | ✓ |
| K03 | Virginia Sq-GMU | rev | 2 | 4 | 0 | 4 | 0/2 ⚠ | · | · | ✓ |
| K04 | Ballston-MU | rev | 2 | 10 | 6 | 4 | 9/9 | Y | · | ✓ |
| K05 | East Falls Church | auto | 1 | 1 | 1 | 0 | 0/1 ⚠ | · | · | ✓ |
| K06 | West Falls Church | rev | 5 | 5 | 1 | 4 | — | · | · | ✓ |
| K07 | Dunn Loring | auto | 1 | 1 | 0 | 1 | 0/1 ⚠ | · | · | ✓ |
| K08 | Vienna | auto | 1 | 1 | 0 | 1 | 0/1 ⚠ | · | · | ✓ |
| N01 | McLean | auto | 1 | 3 | 1 | 2 | 0/2 ⚠ | Y | · | ✓ |
| N02 | Tysons | auto | 1 | 3 | 2 | 1 | 0/2 ⚠ | Y | · | ✓ |
| N03 | Greensboro | auto | 1 | 3 | 1 | 2 | 0/2 ⚠ | Y | · | ✓ |
| N04 | Spring Hill | auto | 1 | 3 | 0 | 3 | 0/2 ⚠ | Y | · | ✓ |
| N06 | Wiehle-Reston East | auto | 1 | 2 | 2 | 0 | 0/1 ⚠ | · | · | ✓ |
| N07 | Reston Town Center | auto | 1 | 3 | 0 | 3 | 0/2 ⚠ | Y | · | ✓ |
| N08 | Herndon | auto | 1 | 3 | 0 | 3 | 0/2 ⚠ | Y | · | ✓ |
| N09 | Innovation Center | rev | 1 | 4 | 0 | 4 | — | Y | Y | ✓ |
| N10 | Washington Dulles International Airport | auto | 1 | 2 | 0 | 2 | 0/2 ⚠ | Y | · | ✓ |
| N11 | Loudoun Gateway | auto | 1 | 2 | 0 | 2 | 0/1 ⚠ | · | · | ✓ |
| N12 | Ashburn | auto | 1 | 3 | 0 | 3 | 0/2 ⚠ | Y | · | ✓ |

## 3. Accuracy findings (auto-generated tier vs. review lessons)

### 3a. FALSE REDUNDANCY at grade-separated stations (under-warn — highest priority)

GTFS marks a street→mezzanine leg redundant whenever two elevators both reach the mezzanine. Where the two street entrances sit on **opposite sides of a highway or rail corridor** and cannot be reached from each other at street level, that is false: if one entrance's elevator fails, riders arriving on that side are stranded, yet the model reads the station fully accessible. Same class as the side-platform exclusions the review made by hand.

**Confirmed grade-separated (recommend remodel to per-entrance, no cross-redundancy):**
- **N01 McLean, N02 Tysons, N03 Greensboro, N04 Spring Hill, N07 Reston Town Center, N08 Herndon, N12 Ashburn** — Silver Line, elevated in a highway median, single island platform, North & South entrance pavilions on opposite sides (Wikipedia-confirmed for Spring Hill and McLean; identical corridor design; labels say N_PAV / S_PAV).
- **E09 College Park-U of Md** — island platform, entrances on both sides of the rail corridor feeding a shared underground concourse; no step-free street-level crossing.

**Milder (surface-street crossing exists — Bryce's call):**
- **B11 Glenmont** — two street elevators flank Georgia Ave (Route 97), a signalized surface road crossable at grade. Defensible as redundant but not agency-confirmed; per over-warn policy, lean non-redundant.

**Redundancy that IS sound (leave as-is):**
- **C13 King St-Old Town** (live-validated: C13N01 out → chain correctly REDUCED via C13N02), **F06 Anacostia**, **N10 Dulles Airport** — two elevators from a shared mezzanine/concourse to one ISLAND platform; rider is already paid-side and can walk between them.
- ~~**A08 Friendship Heights** — redundant on both legs; urban, both street entrances on the same Wisconsin Ave sidewalk. Plausibly real; all ids still synthetic.~~ **RESOLVED 2026-07-17 (spot-check) — the 2×2 was WRONG on two axes.** WMATA's own Rider Tools page shows 7 elevators across two SEPARATE mezzanines (Jenifer St. north: 4 street + 1 platform; Western Ave. south: 1 street + 1 platform); Bryce confirmed the mezzanines aren't connected. Re-modeled per-entrance CNF (Navy Yard F05 shape) with a 4-elevator Jenifer St. street bank (Forest Glen/Rosslyn undercount). Curated in `wmata-models.ts`, excluded via `split-mezzanine`; see `spot-check-log.md`.

### 3b. Note phrasing artifact
- **D10 Deanwood** — note reads "One elevator connects the street-level mezzanine to the mezzanine…", a level-naming collision confusing to a rider. Worth a manual level/label fix.

### 3c. Checks that came back CLEAN
- **Garage-name mis-exclusion (Huntington lesson)**: no auto station routes a chain through a garage-named elevator; extra observed garage units at A12/B11/K08 are correctly outside the chains.
- **GTFS undercount of a redundant bank (Potomac Yard lesson)**: no auto station shows more observed in-station elevators than modeled (all OBS>modeled cases were garage elevators).
- **Note consistency**: uniform templates per structural shape; no contradictory or malformed public notes besides D10.

## 4. Actions

**DONE (2026-07-17, this pass):** the 8 grade-separated stations (3a) were
remodeled to per-entrance chains — each entrance's street elevator is its own
sole-access leg, sharing one mezzanine/concourse→platform elevator, with **no
cross-entrance redundancy**. Each carries a rider note disclosing that the far
entrance is still usable *if you can reach the other side of the highway/tracks*
(there is no step-free crossing at the station). Moved out of the auto tier via
`CURATED_GRADE_SEPARATED` in `scripts/wmata-pathways.mts`; curated in
`wmata-models.ts`; locked by a regression in `check:wmata`. Verified end-to-end:
a single street-elevator outage now reads that entrance down (partial) instead
of fully accessible; the shared platform elevator failing takes down both.

**DONE (2026-07-17, bulk audit follow-up):** the entire remaining auto tier
(46 stations) was audited against WMATA's own Rider Tools station-page
inventory (`rider-tools-inventory.json`, real unit ids + entrance groups) —
see `spot-check-log.md`. 38 confirmed; 4 fixed as `page-inventory-undercount`
curated models (N06 Wiehle-Reston East 2×2, N11 Loudoun Gateway 2×2, N10
Dulles Airport 4-bank, D01 Federal Triangle platform pair); new open items
C13 King St-Old Town (3rd elevator C13S01) and B10 Wheaton (street-leg
mystery) and F06 Anacostia (per-entrance pair connectivity) added below.

**Still open:**
1. **Glenmont (B11)** — decide whether the two entrances flanking Georgia Ave
   (a surface street crossable at grade) count as redundant. Left as-is
   (redundant) pending your call. (2026-07-17 audit: both street ids +
   locations page-confirmed — B11X01 east/bus bay, B11X02 west/Kiss & Ride.)
2. **D10 Deanwood** — fix the "street-level mezzanine to the mezzanine" note /
   level-naming artifact. (2026-07-17 audit: structure page-confirmed as a
   plain 2-series — phrasing-only fix.)
3. **C13 King St-Old Town** — WMATA's page lists a THIRD platform elevator
   (C13S01) beyond the modeled N-pair; N/S prefixes suggest two mezzanines.
   Needs Bryce: separate south mezzanine (A08-style CNF) or connected (3-bank)?
4. **F06 Anacostia** — the modeled redundant pair is split across two named
   entrances (F06S01 Howard Rd, F06N01 Kiss & Ride). Redundancy holds only if
   the entrances are mutually reachable step-free at street level. Needs Bryce.
5. **B10 Wheaton** — WMATA's page lists NO in-station street→mezzanine
   elevator (only B10X01 platform + 4 "garage"), but GTFS drew one and the
   auto model includes it. Either GTFS invented the leg or a "garage" elevator
   is really the street entrance (reverse-Huntington). Needs investigation.
3. ~~**A08 Friendship Heights** — redundancy plausibly real (urban, same-sidewalk
   entrances) but all ids synthetic; confirm opportunistically.~~ **DONE
   2026-07-17 (spot-check)**: the 2×2 was wrong — separate mezzanines + a
   4-elevator Jenifer St. street bank. Re-modeled per-entrance CNF; see above
   and `spot-check-log.md`. (ids still synthetic.)
4. Backfill physical street-elevator locations (16/98 today) per the standing
   documentation rule.
