# MTA's guidance for displaying NYCT accessibility & elevator status

Source: MTA developer docs, "Displaying NYCT station accessibility and elevator
& escalator status" (https://www.mta.info/developers/display-elevators-NYCT,
updated Nov 21 2023). Saved 2026-07-16 (Bryce uploaded the page). mta.info 403s
scripted fetches; the text below is extracted from the saved page.

## 1. Is a station ADA accessible or not (station level)
- Canonical source: the **NYCT Station Location file** on the NY open data
  portal (data.ny.gov `39hk-dx4f`, "MTA Subway Stations"), per **GTFS Stop ID**.
  A separate **Station Complexes** file covers complex-level accessibility.
- **`ada` column: 0 = not accessible, 1 = fully accessible, 2 = partially
  accessible** (usually accessible in one direction only).
- When partial (2), the direction is given by `ada_northbound` / `ada_southbound`
  (0/1) + `north_direction_label` / `south_direction_label` (the docs describe
  this as an "ADA Direction Notes" field, e.g. 49 St = "Uptown & Queens" only).

## 2. What elevators/escalators exist & their status (two feeds, joined by equipmentno)
- **Equipment** feed = inventory (station, location, lines served, travel
  alternatives). We snapshot the richer NY open-data equivalent
  (`94fv-bak7` → `ny-elevator-inventory.json`).
- **Current Outages** feed = which are out, reason, estimated return. This is
  our live `nyct_ene` source.

## 3. Tips for displaying (MTA's own do's)
- **Short names**: elevators have no short names; MTA created a **Short
  Description** field as display-friendly names.
- **Show in-service too, not just outages** — riders (esp. wheelchair users)
  want to VERIFY an elevator is working. "You may want to show all elevators."
- **Expected return to service + travel alternatives** matter a lot; travel
  alternatives are the `alternativeroute` field.
- **Accessible-pathway flag**: not every elevator is part of a step-free path
  (e.g. Clark St 2/3 — elevators reach the mezzanine but there is no step-free
  path mezzanine→platform). MTA recommends showing the per-elevator `ADA` flag.

## How LiftWatch complies (2026-07-16)
- ✅ **Travel alternatives** — MTA's `alternative_route` shown verbatim per
  outage as "MTA reroute (if this elevator is out)" (build-site-data + both
  site pages).
- ✅ **Expected return to service** — shown on every outage.
- ✅ **Display-friendly names** — we prefer MTA's own elevator description
  (`notes`) over our feed text when equivalent/richer (`preferMtaNote`).
- ✅ **Accessible-pathway only** — the MTA chain generator includes only ADA
  elevators on the true step-free path, so a mezzanine-only elevator (Clark St
  pattern) is never presented as station access.
- ◻ **Station ADA status (0/1/2 + partial direction)** — data snapshotted to
  `ny-stations-ada.json`; display pending a reliable MRN↔GTFS crosswalk.
- ◻ **Show in-service elevators** — deferred; LiftWatch is outage/archive-first,
  so we surface outages, not a full live equipment roster (a possible future
  per-station "elevators here" view).
