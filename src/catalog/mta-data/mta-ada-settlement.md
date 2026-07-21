# MTA subway ADA settlement — station-level accessibility roadmap (corroboration)

**Source**: *Center for Independence of the Disabled, New York (CIDNY) v. MTA*
(NY State, filed 2017) and *De La Rosa v. MTA* (S.D.N.Y., filed 2019) — two
consolidated class actions, resolved by a **June 2022 settlement agreement**
(subject to approval by both courts, dismissed with prejudice on approval).
Settlement PDF (hosted by Disability Rights Advocates):
`https://dralegal.org/wp-content/uploads/2022/06/Final-Agreement-with-All-Signatures-ACC.pdf`.
Extracted 2026-07-21 via `curl -A "<browser UA>"` + `pdftotext -layout` (clean
text layer). Case page: `dralegal.org/press/mta-settlement/`.

## What it commits the MTA to

- Make **at least 95% of the MTA's 364 currently-inaccessible subway stations**
  step-free accessible (elevators/ramps) **by 2055**, on a capital-plan schedule:
  a minimum of **81 additional Accessible Stations** in the 2020-2024 plan
  (67 already-designated + 14), then roughly **+85 / +90 / +90** across the three
  subsequent five-year plans (≈166 → 256 → 346 accessible cumulative).
- Binds a **minimum share of each Transit capital plan** to accessibility work
  (~14% / 12% / 10% of successive plan amounts).
- Fixes the **station prioritization criteria** (not the specific stations):
  citywide geographic coverage, transfer options, ridership, senior/disabled
  population + poverty census data, residential density, and proximity to medical
  centers/schools/parks/business districts/cultural hubs/senior centers — weighted
  at the MTA's discretion under Title VI. Also commits to make accessible every
  station where stairs/escalators/platforms/mezzanines were newly built or altered
  from 2016-05-15 onward.

## Why it's CORROBORATION-tier only (and does NOT feed the elevator generator)

Unlike BART's *Senior & Disability Action* Exhibit F or MBTA's Daniels-Finegold
settlement — both of which name **specific elevators with real asset/facility
ids** — this agreement is a **buildout-commitment framework**. It contains **no
per-station list and no per-elevator commitments** (verified in the full text):
it defines *how many* stations become accessible *by when* and *how they're
prioritized*, not *which* ones or *which* elevators. So it can't gate or seed the
chain generator.

Its role here is **station-level context** for the existing MTA station-ADA layer
(`mta-station-ada.json` / `mta:station-ada`) — corroborating the trajectory of
which stations are/should be accessible over time. The authoritative per-elevator
ground truth for LiftWatch remains the live `nyct_ene` feed + the data.ny.gov
`94fv-bak7` inventory; tsdataclinic supplies topology (see
`tsdataclinic/PROVENANCE.md`). This doc is a research pointer, not a data source.
