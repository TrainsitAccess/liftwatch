# CTA station research dossier (chicago-L.org pass, 2026-07-14)

**Status (2026-07-17): mostly consumed.** The curated-chains pass this
dossier was written to seed has largely happened — 39 of 46 queue stations
are now modeled in `src/catalog/cta-models.ts`, each walked through with
Bryce via `/liftwatch-station-review`. The live tracker is
`src/catalog/review/queue.json`; this file is kept as research provenance
and as background for the 7 remaining interchange complexes.

Layout research for every station in the observed outage corpus (42), compiled
from chicago-L.org station histories to support an eventual curated-chains
pass. **Nothing here ships without a human walkthrough** — chicago-L.org is a
third-party (excellent, but historical) source; pages may predate renovations,
and elevator counts inferred from prose are not an agency signal. The project
rule stands: chains only with agency guidance or Bryce's confirmation.
`observed:` lists LiftWatch's per-elevator unit ids seen in the live feed so
far (src/catalog/cta-data/observed-units.json).

Additional fallback source (Bryce, 2026-07-16): **transit.wiki** (the Transit
Wiki, transit.wiki/<Station>) — check it when the agency + chicago-L.org +
Wikipedia don't settle a detail. It is **open-sourced / community-editable**, so
don't trust it completely: corroboration only, never ground truth, never the
sole basis for a redundancy claim (it helped confirm Jackson/State's Van Buren
platform elevator, but only alongside a real CTA alert + chicago-L.org).

Legend: ✚ = redundancy candidate worth verifying (rare for CTA); ⚠ = open
question that blocks modeling.

## Archetype A — island platform, single elevator (simple SPOF chain if confirmed)

These look like one-elevator stations: street/fare → island platform. A chain
would be one sole-access segment — accurate but only if the elevator count is
truly 1 (⚠ verify per station; an unlisted second elevator would over-warn
only, never under-warn, since the single one severs everything).

- **40190 Sox-35th (Red)** — island; elevator added 2000. observed: vague only.
- **40280 Central (Green/Lake)** — island on embankment; one elevator added
  1994-96 from street-level station house. observed: vague.
- **40390 Forest Park (Blue)** — island; one elevator, in service Dec 1982
  (transit center). observed: vague.
- **40780 Central Park (Pink)** — island; one elevator tower (Douglas rehab).
  observed: vague.
- **40910 63rd (Red)** — island, fare controls ON the platform; elevator added
  in south Red upgrades. observed: vague.
- **40990 69th (Red)** — island; "new elevators at 47th and 69th" (2006) —
  ⚠ plural is per-project, likely one per station; verify count. observed: vague.
- **41120 35th-Bronzeville-IIT (Green)** — center island (1960s config); one
  elevator added in rehab. observed: vague.
- **41130 Halsted (Orange)** — island; one elevator. observed: vague.
- **41200 Argyle (Red)** — rebuilt with a single 520-ft platform; presumably
  one elevator (⚠ verify in rebuilt station). observed: vague.
- **41230 47th (Red)** — island; new elevator(s) 2006 (⚠ same plural as 69th).
  observed: vague.
- **41300 Loyola (Red)** — island, elongated; the elevator BISECTS the platform
  (opens both sides, north/south berths separated around it) — still ONE
  elevator. observed: vague.
- **41430 87th (Red)** — island; elevator added in south Red upgrades.
  observed: vague.
- **41660 Lake (Red/State subway)** — island (the record-length State St
  platform); accessible via the Washington/Randolph mezzanine end. observed:
  WASHINGTON-RANDOLPH-PLATFORM. ⚠ is there ALSO a street→mezzanine elevator
  (subway stations usually need one per leg — see Grand)? If so this is a
  2-in-series chain, not one elevator.

## Archetype B — side platforms, one elevator per platform (per-direction chains)

The CTA norm for rebuilt elevated stations. Each direction is its own chain
with a sole-access elevator — exactly the observed directional ids. The
per-direction split is REAL (confirmed by the feed's own "X-bound" phrasing).

- **40030 Pulaski (Green/Lake)** — dual side platforms; station house + elevator
  per platform (Blue-Green Program rebuild). observed: 63RD-BOUND,
  HARLEM-BOUND ✓ both.
- **40530 Diversey (Brown)** — side platforms; "elevators to each platform…
  outboard of the stairs" (Brown Line expansion). observed: LOOP-BOUND.
- **40710 Chicago (Brown)** — side platforms; SEPARATE station houses, fare
  controls, and elevator per platform along Chicago Ave. observed: LOOP-BOUND.
- **41030 Polk (Pink)** — side platforms; "dual elevators provide ADA
  accessibility" — one per platform. observed: 54TH-BOUND.
- **41080 47th (Green)** — dual side platforms; "elevators, one to each
  platform" (1994-96). observed: HARLEM-BOUND.
- **41440 Addison (Brown)** — dual side platforms; dual elevator towers (the
  Ron Santo box-score ones). observed: KIMBALL-BOUND, LOOP-BOUND ✓ both.
- **41480 Western (Brown)** — side platforms; ADA since 1981 (among CTA's first
  elevator stations); elevator cabs being replaced 2024-26 (explains the
  long planned outage). observed: KIMBALL-BOUND.
- **41500 Montrose (Brown)** — dual side platforms; "a set of stairs and an
  elevator… to each platform". observed: KIMBALL-BOUND, LOOP-BOUND ✓ both.

### B′ — side platforms WITH an overhead transfer bridge (✚ possible cross-redundancy)

Green Line rebuilds where elevator towers on each platform are LINKED by an
overhead bridge. ✚ If the bridge is inside fare control and each tower runs
street(or fare level)↔bridge↔platform, then EITHER tower may reach BOTH
platforms — a genuine redundant pair, rare for CTA. ⚠ Verify: is the bridge
paid-side, and do both towers serve all three levels?

- **41270 43rd (Green)** — dual side platforms; TWO stainless elevator towers +
  overhead bridge (1994-96). observed: HARLEM-BOUND *and*
  STREET-PLATFORMS-BRIDGE — the second alert text ("elevator to/from street,
  platforms and bridge") reads like one tower serving street+bridge+platform,
  which supports the cross-redundant reading. The two observed ids may be the
  same physical elevator described two ways, or the two towers. ⚠ resolve.
- **40170 Ashland (Green/Lake)** — side platforms; all entry via the inbound
  side, outbound reached by the overhead transfer bridge; two elevator towers
  on the paid side. observed: STREET. ⚠ same bridge question; also which
  tower the "to/from street" alert means.
- **41670 Conservatory (Green/Lake)** — twin station houses, side platforms,
  elevator towers + overhead transfer bridge (2001, Homan relocation).
  observed: 63RD-BOUND.
- **41360 California (Green/Lake)** — side platforms; single fare control at
  track level on the INBOUND (south) side; street elevator at the corner + dual
  elevators flanking the platforms with crossbridge structures. observed:
  STREET (incl. the compound alert confirming the street elevator gates the
  Harlem-bound platform). Likely 3 elevators: street + one per platform.
  ⚠ confirm outbound access path.

### B″ — side platforms with EXIT-ONLY outbound elevators (wheelchair rotogates)

63rd St corridor pattern (explicitly described for both): fare controls exist
ONLY on one platform; the outbound platform's elevator is EGRESS-ONLY through
wheelchair-accessible high-barrier rotogates — you cannot board there.
⚠ How does an accessible rider BOARD outbound? (Ride inbound to a crossover
station and return?) This asymmetry (boarding vs exiting accessibility) doesn't
fit the current segment model cleanly — needs a policy decision.

- **41140 King Drive (Green)** — fare-control platform + exit-only outbound
  elevator/rotogates. observed: HARLEM-BOUND.
- **40720 Cottage Grove (Green)** — same design ("installed here and at
  Cottage Grove"). observed: STREET.

## Archetype C — multi-elevator complexes (interchange tier — model WITH Bryce)

- **40330 Grand (Red)** — subway, dual side platforms + mezzanine: street→mezz
  elevator (NW corner kiosk) PLUS a new elevator to EACH platform (2000s
  rehab). 3 elevators: series street→mezz then per-direction mezz→platform —
  same shape as WMATA's E01. observed: 95TH-BOUND ✓ fits.
- **40070 Jackson (Blue/Dearborn)** — subway island; accessible via the
  Adams-Jackson mezzanine: street→mezz elevator (1991, replaced NE stair) +
  mezz→platform elevator. 2 in series. observed: STREET ✓ fits.
- **40560 Jackson (Red/State)** — subway island; Adams-Jackson mezzanine got
  street→mezz + mezz→platform elevators; the Jackson-Van Buren mezzanine also
  had elevators installed (1996-2000) — ⚠ if BOTH mezzanines have full elevator
  pairs, this is a redundant-pair-of-series-chains ✚. observed:
  ADAMS-JACKSON-PLATFORM (the feed distinguishes the entrance!).
- **41400 Roosevelt (Red)** — subway island: street→mezz elevator (main) plus
  the TRANSFER TUNNEL elevator to the elevated (Orange/Green). The tunnel
  elevator gates the accessible subway↔elevated transfer, not street access.
  observed: TRANSFER-TUNNEL ✓ distinct. Two chains (street access; transfer).
- **40450 95th/Dan Ryan (Red)** — island in the expressway, rebuilt 2014-19
  with NORTH and SOUTH terminal buildings; observed SOUTH-TERMINAL-PLATFORM
  implies at least a north twin ✚ (two street↔platform paths → possibly
  redundant). ⚠ verify the north terminal has its own elevator.
- **40900 Howard (Red/Purple/Yellow)** — DUAL island platforms; paid area over
  the tracks with stairs/escalators/elevators down to each island + accessible
  entrance elevators (Paulina side). Multiple chains (per island) sharing the
  entrance leg. observed: 95TH-LOOP-BOUND (the Red island) ✓ fits.
- **40540 Wilson (Red/Purple)** — rebuilt 2017, dual island platforms,
  elevators from the main station house to each island. observed:
  95TH-LOOP-BOUND ✓ (island phrasing — one elevator serves both directions).
- **40380 Clark/Lake (Blue + Loop elevated)** — super-station: 203 N. LaSalle
  building (street↔basement mezz via TWO elevators ✚), the SOIC side, subway
  mezzanine passage, plus elevated-platform elevators. The observed id
  (203-N-LASALLE) is entrance-specific. Genuinely tangled — MTA-interchange
  tier.
- **40730 Washington/Wells (Loop)** — thin data on chicago-L (station opened
  1995; multiple vertical accessways along Wells). observed:
  BROWN-LINE-PLATFORM implies per-platform elevators. ⚠ needs another source
  (CTA press releases mention elevator replacement here — see ASAP Table 1,
  which lists Washington/Wells as a funded replacement).
- **40230 Cumberland (Blue)** — island in the Kennedy median; mezzanine over
  the expressway; elevators: one inside the bus-terminal side + platform
  access; observed BUS-TERMINAL-GARAGE and PLATFORM as SEPARATE units ✓ (two
  elevators, different legs — likely series: terminal/garage→mezz→platform).
  ⚠ confirm topology.
- **40480 Cicero (Green/Lake)** — two-story station house: street→2nd-floor
  fare (elevator #1) → mezzanine passageway over the street → island platform
  (elevator #2). TWO IN SERIES. observed: STREET ✓ fits elevator #1.
- **40470 Racine (Blue/Congress)** — island reached by SLOPING enclosed
  passageway/RAMPS from the Racine and Loomis overpasses (original 1950s
  design) — ✚ possible genuine stepFreeAlternative! Renovation plans add an
  elevator at Racine + an ADA ramp at Loomis. ⚠ verify current as-built state
  and ramp gradient/status before ANY step-free credit.
- **41690 Cermak-McCormick Place (Green)** — rebuilt 2015: column-free ISLAND
  platform with "elevators bookending each end" ✚ + two entrances (Cermak main,
  23rd St unstaffed HBG-only) connected by a ground-level walkway. If both end
  elevators reach the platform from connected fare areas, this is a REDUNDANT
  PAIR — would be CTA's clearest redundancy. observed: 23RD-STREET ✓ (the 23rd
  St end elevator). ⚠ verify both elevators are inside compatible fare paths
  (23rd is farecard-only HBG).
- **40150 Pulaski (Pink)** — chicago-L page (pulaski-met) is mostly the
  historic Met station (dual side platforms, 1900s); the Douglas rehab
  (2004-05) rebuilt it — ⚠ thin data; Douglas-rehab stations typically got an
  island platform + one elevator (like Central Park), verify. observed: vague.
- **40510 "Garfield" quirk** — the feed attached a "Garfield (Red Line)" alert
  to 40510, which is GREEN Garfield's station id (Red Garfield is 41170).
  Red Garfield: island, elevator added in south Red upgrades. Green Garfield:
  1994-96 rebuild w/ elevators. ⚠ CTA's ServiceId labeling is unreliable for
  same-name stations — treat cross-name alerts at 40510/41170 with suspicion;
  the HARLEM-BOUND observed unit under 40510 is Green-consistent, the vague
  "Garfield (Red)" text is not. Flag any future recurrence.

## Suggested verification order (value ÷ effort)

1. **Cermak-McCormick Place** — likely CTA's only clean redundant pair; one
   station, huge payoff (a REDUCED state instead of NO ACCESS).
2. **The Brown Line B-archetype batch** (Diversey/Addison/Montrose/Western/
   Chicago) — five near-identical per-direction stations, one pattern decision.
3. **Grand / Jackson×2 / Roosevelt** — subway series-chains, WMATA-E01 shape.
4. **43rd + Ashland + Conservatory + California** — the transfer-bridge
   cross-redundancy question (one answer covers four stations).
5. **King Drive + Cottage Grove** — needs the boarding-vs-exiting policy call.
6. Islands (Archetype A) — simple, but verify single-elevator assumption.
7. Clark/Lake, Howard, Wilson, 95th — true interchange tier, walkthrough each.
