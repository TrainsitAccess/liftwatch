# tsdataclinic/mta — NYC subway elevator topology (corroboration source)

**Source**: [github.com/tsdataclinic/mta](https://github.com/tsdataclinic/mta)
(Two Sigma Data Clinic), **Apache-2.0**, repository **archived 2025-01-09**
(read-only — this is a stable snapshot). Fetched 2026-07-21 via
`gh api -H "Accept: application/vnd.github.raw" repos/tsdataclinic/mta/contents/<path>`.

**Why it matters**: NYCT's GTFS has no `pathways.txt`, so — unlike WMATA/MBTA —
we had no elevator street→platform topology graph for the subway. This community
project reconstructed one. **Trust tier: CORROBORATION only** (community-built,
same tier as chicago-L.org / transit.wiki). It *proposes* and *corroborates*
structure; **MTA's own data (the live `nyct_ene` feed `redundant` flag + the
data.ny.gov `94fv-bak7` inventory) is always the gate.**

## The universal join key

Every elevator carries its MTA equipment id (`EL###`, sometimes `EL###X`),
identical across the live feed (`equipmentno`), data.ny.gov (`equipment_code`),
and these files (`equipment_id` / `Elevator`). data.ny.gov's `station_complex_mrn`
equals our `stationExternalId` (the feed's `stationcomplexid`), before our
`MERGES` ({318→164 Penn, 624→628 Fulton}) collapse the split complexes. So no
fuzzy name matching is needed — join on the EL id, group by complex mrn.

## Files (in this directory)

- `elevator_to_line_dir_station.csv` — per-elevator `line, direction, station`
  (direction ∈ manhattan/north/south/… — a per-elevator direction signal).
- `edgelist_w_pid.csv` — the elevator connection GRAPH as edges:
  `station_name, from, from_type, to, to_type` with node types Elevator / Street /
  Mezzanine / Platform. Street→…→Platform paths through elevators = the chains.
- `elevator-importance.csv` — `Station, Elevator, Importance, Perc. Importance,
  Betweenness`. **CAVEAT**: "Perc. Importance" is a continuous graph
  criticality/betweenness score, **NOT a binary redundancy flag** — importance
  <100% does NOT mean "redundant." Use only as context; never as a redundancy
  gate (data.ny.gov + the feed are the gate). Only the strong signal is
  meaningful: importance=100% = the graph routes all of a platform's paths
  through this one elevator.
- `Master_crosswalk.csv` — station-name reconciliation across MTA datasets
  (el/gtfs/turnstile names + `equipments` EL-id lists + `gtfs_stop_id`, lat/lon).
  Largely redundant given the EL-id join above; kept for name/GTFS corroboration.

The source `.graphml` (`mta-elevators-w-station-connections.graphml`) is the same
graph as `edgelist_w_pid.csv`; the CSV is the parseable form we consume.
