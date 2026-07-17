# MBTA Daniels-Finegold ADA settlement — elevator provisions (ground truth)

**The MBTA analog to CTA's ADA class-action settlement.** Found 2026-07-17
while searching for an MBTA equivalent of CTA's ASAP plan / ADA settlement and
MTA's data.ny.gov inventory. *Joanne Daniels-Finegold, et al. v. MBTA*
(D. Mass. 1:02-cv-11504, filed 2002, settled 2006, amended 2018) is a
disability class action whose settlement **commits the MBTA to specific
new/redundant and replacement elevators at named stations, with real MBTA
facility elevator IDs** — the same id scheme as our live feed (e.g. State's
elevator `802`, which appears verbatim in `chains-excluded.json`).

## Sources & extraction

- **Original Settlement Agreement (2006)** — `cdn.mbta.com/sites/default/files/2025-06/2025-06-18-mbta-bcil-settlement-agreement-accessible.pdf`
- **Amended Settlement Agreement (2018)** — `cdn.mbta.com/sites/default/files/Accessibility/2018-12-04-mbta-bcil-amended-settlement-agreement-final.pdf`
- **Next Generation Accessibility Agreement (2025)** — same `/Accessibility/` path pattern; the 2025 successor that ended court oversight.
- Landing page: `mbta.com/accessibility/history` (links all three).
- Case docket: Civil Rights Litigation Clearinghouse `clearinghouse.net/case/9807`
  (403s WebFetch — use the in-app Browser; holds the docket + settlement, not
  per-station monitor reports).
- **Extraction**: `curl -A "<browser UA>"` to download, then `pdftotext -layout`
  (or Node `pdf-parse`). Both PDFs are text-layer, not image-wrapped.

## ¶55 — New/redundant elevators (the redundancy commitments)

Original (2006):
- **Porter Square** — two additional elevators (street→fare lobby, fare lobby→
  subway platform). Makes Porter's Red Line access redundant.
- **Harvard Square** — one additional elevator in the Brattle Square area.
- **Park Street** — one additional (surface→Green Line westbound platform) + one
  (center Red Line platform→Green Line WB); *if* the center RL platform is
  infeasible, an elevator on **each** of the two Red Line **side** platforms
  connecting to the Green Line WB.
- **Downtown Crossing** — additional elevators connecting the SB & NB Red Line
  platforms to the SB (Forest Hills) Orange Line platform.

Amended (2018) — Downtown Crossing was re-engineered (the "Corner Mall"
Red-NB↔Orange-SB connection was found technically infeasible). Current committed
topology, by connection:
- **OLS/RLS** (Orange Line South ↔ Red Line South): the Washington Street
  entrance elevator replaced and extended further below grade to the Red Line
  platform.
- **OLS/RLN** (Orange Line South ↔ Red Line North): Park Street elevator **808**
  relocated + replaced with a larger elevator connecting to an improved Winter
  Street Concourse; the other end of the concourse connects directly to the
  Orange Line.
- **OLN/RLN** (Orange Line North ↔ Red Line North): two new elevators at the
  Burnham Building.
- **OLN/RLS** (Orange Line North ↔ Red Line South): a new elevator at the corner
  of the Macy's building.

## ¶56 — Replacement elevators (real MBTA facility IDs — match our feed)

- Central Square — `861`
- Porter Square — `818`, `820`
- Park Street — `804`, `808`
- Harvard Square — `821`
- State Street — `802`   ← the exact id in our `State` holdout dossier

(Amended ¶56 kept Central `861` + Harvard `821`, folded Park St `808` into the
Downtown Crossing work above.)

## ¶59 — 20-year Elevator Replacement Plan review group

The amendment names a first review group: **Tufts Medical Center (New England
Medical Center), Chinatown, Oak Grove, South Station** — "determine which
existing elevators need replacing/enlarging and whether additional elevators
are needed." Oak Grove is one of our holdouts.

## Current redundant-elevator status (as of 2025, from MBTA news/project data)

**Eleven Red Line stations have redundant elevator service**; Quincy Adams is
the 11th (2025). Confirmed complete include Harvard (2012, $4.1M), Porter (2
redundant, $12M), Kendall/MIT (2025), Quincy Adams. **In design (not yet
built)**: Broadway, Chinatown, Davis, Mass Ave, North Station, **State**.
(No single authoritative enumerated list of all 11 was found on one page;
compile from the MBTA accessibility-improvements project updates when needed.)

## Direct relevance to our 6 MBTA anomaly holdouts

Three of the six are addressed head-on:
- **Downtown Crossing** — the amendment gives the agency's own authoritative
  Red↔Orange elevator topology (the four OL/RL connections above). This is
  exactly the topology the pathways generator couldn't resolve.
- **State** — elevator `802` confirmed as a real long-standing unit (replacement
  target); a redundant elevator is in design.
- **Oak Grove** — flagged in the ¶59 elevator-replacement review group.
Park Street, Harvard, and Porter (already modeled) are corroborated.

## Trust tier & the critical caution

This is a **legal commitment / planning document (2006 & 2018)**, NOT a live
inventory — the same caution as WMATA's CIP report or CTA's ASAP plan. It states
what the MBTA *agreed to build*, some of which is complete and some still "in
design." **Always cross-check the current live feed before modeling**: an
elevator described here as "new/redundant" may not exist yet (e.g. State's
redundant elevator is in design as of 2025, so State is NOT yet redundant in
reality). Use it as: (1) the agency's authoritative topology for the hard
interchanges, and (2) a checklist of which stations are *supposed* to become
redundant — verified against the feed, never as sole ground truth for a
present-day redundancy claim. High trust for the topology/id facts; time-
sensitive for the built-vs-planned status.
