# CTA per-station elevator COUNTS — from the ASAP Strategic Plan

Authoritative CTA source for **how many elevators a station has** (not topology).
Extracted 2026-07-16 from CTA's **All Stations Accessibility Program (ASAP)
Strategic Plan** (`transitchicago.com/assets/1/6/ASAP_Strategic_Plan_508_FINAL.pdf`,
current version — text references 2023–2024 data), **Tables 14 & 15 "Elevator
Replacement Program"**. The "X of Y elevators" / "the only elevator" / "both" /
"all N" phrasing gives Y = the station's total elevator count.

**How to use:** this is an AGENCY count, a strong constraint on a model — but it
is NOT topology/redundancy. 2 elevators can be a redundant pair OR two
independent per-direction chains OR a 2-in-series route; combine the count with
the observed alert ids + chicago-L.org before modeling. Extraction method (so
this is repeatable for any CTA 508 PDF): `curl -A "<browser UA>"` the
`/assets/` PDF (bypasses the WebFetch 10 MB cap), then Node `pdf-parse` to pull
the 508 text layer (WebFetch's own extractor fails on these).

**Coverage caveat:** these tables list only stations in the elevator
*replacement* program (existing accessible stations with aging elevators).
A station's ABSENCE here is not "no elevators" — it may have newer elevators
(RPM / recent rebuilds) or not be accessible yet.

## Counts (LiftWatch station id where known)

| Station | Line | Elevators | LiftWatch id | vs our model |
|---|---|---:|---|---|
| Clark/Lake | Loop transfer | 4 | 40380 | pending |
| Washington/Wells | Loop transfer | 2 | 40730 | pending |
| Washington/Wabash | Loop | 4 | — | (not tracked) |
| Harold Washington Library | Loop | 3 | — | (not tracked) |
| Jackson | Red (State) | 4 | 40560 | ✓ confirms redundant 4-elevator model |
| Loyola | Red | 1 | 41300 | ✓ confirms single |
| Lake | Red (State) | 3 | 41660 | pending |
| Chicago | Red (State) | 2–3* | — | (Chicago Brown 40710 is separate) |
| Addison | Red | 1 | — | (Addison Brown 41440 is separate) |
| Granville | Red | 1 | — | not tracked |
| Sox-35th | Red | 1 | 40190 | ✓ confirms single |
| Fullerton | Red | 2 | — | not tracked |
| Grand | Red (State) | 3 | 40330 | ✓ confirms 3-elevator shared-prerequisite |
| Belmont | Red | 2 | — | not tracked |
| Roosevelt | Red/Orange/Green | 3 | 41400 | pending |
| Forest Park | Blue | 1 | 40390 | ✓ confirms single |
| O'Hare | Blue | 1 | — | not tracked |
| Cumberland | Blue | 2 | 40230 | pending |
| Midway | Orange | 2 | — | not tracked |
| 35th/Archer | Orange | 1 | — | not tracked |
| Western | Orange | 1 | — | (Western Brown 41480 is separate) |
| 18th | Pink | 2 | — | not tracked |
| Western | Brown | 2 | 41480 | ✓ confirms per-direction pair (2) |
| King Drive | Green | 2 | 41140 | pending |
| Cottage Grove | Green | 2 | 40720 | pending |
| Ashland | Green/Pink | 3 | 40170 | pending |
| Central | Green | 1 | 40280 | ✓ confirms single |

\* Tables 14 and 15 disagree on Chicago/State (Red): "both" (2) vs "1 of 3" (3) —
an internal ASAP inconsistency; not tracked by LiftWatch, flagged for honesty.
