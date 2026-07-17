# How WMATA stations work — a modeling guide

_Written 2026-07-17 from the 51 stations reviewed one-at-a-time with Bryce
(`wmata-models.ts`). This is the field guide I wish I'd had before starting:
how WMATA stations are physically built, how that maps to our access-chain
model, what GTFS reliably gets wrong, and how to decide redundancy. Read this
before modeling or auditing any WMATA station. Companion docs:
`COVERAGE-AUDIT.md` (per-station coverage), `cip-elevator-mentions.md` (a
ground-truth id source), CLAUDE.md's WMATA sections (the generator + gates)._

---

## 1. The mental model: a WMATA station is a vertical stack

Almost every WMATA station is a variation on three stacked levels:

```
STREET  ─┐
         │ (street→mezzanine elevator)
MEZZANINE┤ = fare control / concourse
         │ (mezzanine→platform elevator)
PLATFORM ┘
```

So the **default model is two elevators in series** (`street-mezzanine` then
`mezzanine-platform`), both sole-access, no redundancy. A station is step-free
only if **every** leg has a working elevator (AND of legs); a leg with two
elevators is up if **either** works (OR within a leg). Everything below is a
deviation from this baseline.

Key physical facts that drive the deviations:

- **Center island platform** (most WMATA): one platform elevator serves *both*
  directions → the baseline 2-in-series, one chain, no per-direction split.
- **Side platforms** (each direction its own platform): the mezzanine→platform
  leg splits per direction → per-direction chains (see §3D/§3E).
- **Deep Connecticut Ave stations** (Woodley Park A04, Cleveland Park A05,
  Van Ness A06): street → mezzanine → *intermediate passageway* → platform.
  Modeled as two elevator legs; the middle "mezzanine/intermediate passageway"
  is just how GTFS names the long escalator barrel.
- **WMATA's design standard is elevator-only** — no ramps at a normal station.
  So a `stepFreeAlternative` (non-elevator step-free path) is *rare* and only
  appears where a **mezzanine or entrance is at street grade** (§3C) or a
  **pedestrian bridge is at grade** (Innovation Center N09). Do not go looking
  for ramps; WMATA's own accessibility page says there aren't any.

---

## 2. Sources of truth, in trust order

1. **Bryce's direct knowledge, or WMATA's own per-elevator status-page text**
   (he pastes it). This is ground truth and settles everything — most of the
   hard interchanges were resolved this way.
2. **Live-observed `UnitName`s + their WMATA location descriptions**
   (`observed-units.json`). Real ids, real WMATA wording ("Elevator between
   street and mezzanine"). If two identically-worded units appear at one
   station, that is strong evidence of a redundant bank (§4).
3. **WMATA FY-quarter Capital Improvement Program report**
   (`cip-elevator-mentions.md`) — incidental real ids; corroboration only,
   and only promote a synthetic id from it when there's exactly one candidate.
4. **GTFS pathways** (the generator's input) — good for *topology*, but it
   **undercounts, mislabels, and corrupts** (§5). **Never take a redundancy
   claim from GTFS alone.**

Confidence calibration actually used (put "Confidence: N/10" on every proposal):
- **9/10** — Bryce confirmed + a real observed id + WMATA's own wording
  (Metro Center, Smithsonian, L'Enfant, Fort Totten, Farragut North, Rosslyn).
- **8/10** — Bryce confirmed but ids all synthetic, or a redundant bank inferred
  from an undercount (Gallery Place, Forest Glen, NoMa, Pentagon, Navy Yard).
- **6–7/10** — id-to-physical mapping inferential, or a direction unconfirmed
  (Ballston K04, West Falls Church K06).
- **4/10** — a redundant pair inferred with no strong outside fact
  (Morgan Blvd G04 — the floor; flagged to watch).

---

## 3. The archetypes (with the stations that taught them)

### A. Single shaft serves everything
One elevator spanning all levels, sole access for the whole station.
- **Fort Totten (B06_E06)** — one shaft, all 3 stacked levels (Red + Green/
  Yellow). GTFS couldn't tell "one shaft" from "naming quirk hiding several";
  Bryce confirmed genuinely one. If it breaks, nothing at the station is
  step-free.
- **Smithsonian (D02)**, one direction — a single continuous shaft street→
  platform (`D02S01`), while the *other* direction is 2-in-series.

### B. Two-in-series, no redundancy (the baseline — most common)
street→mezz + mezz→platform, both sole. Farragut North (A02), Woodley Park,
Cleveland Park, Van Ness, U St (E03), New Carrollton (D13), Franconia (J03).
The rider note: "…takes two elevators in a row… both must be working."

### C. Mezzanine (or an entrance) is at STREET GRADE → that leg needs no elevator
When the concourse is reachable step-free from the street without an elevator,
**omit that leg from the chain entirely** and state it in the public note as
informational. This is the mirror image of an undercount: GTFS models a
street→mezz elevator leg that doesn't gate anything.
- **Rockville (A14)** — mezzanine at street level; only the mezz→platform
  elevator gates the core chain (+ a separate pedestrian-bridge pair).
- **Downtown Largo (G05)** — mezzanine at grade via Harry Truman Drive; only
  the (redundant) platform elevators gate.
- **West Falls Church (K06)** — mezzanine at grade via the I-66/Leesburg Pike
  median entrance.
- **Huntington (C15)** — the Huntington Ave. entrance's mezzanine is at street
  level; no street→mezz elevator needed there.
- **Greenbelt (E10)** — GTFS read "Street/Mezzanine" on both ends of the one
  elevator; it's simply mezz→platform, sole access.
- **"Upper level doubles as the mezzanine"** (Metro Center Shady Grove-bound
  platform, Gallery Place Glenmont-bound platform): the street elevator lands
  *directly on the upper-line platform*, which is also the fare level — so
  that platform is a one-elevator, mezzanine-is-the-platform case.

### D. Shared street→mezzanine prerequisite + per-direction platform legs (side platforms)
One street→mezz elevator (shared), then a *separate* mezz→platform elevator per
direction. Model as **one chain per direction, both repeating the shared street
elevator id**. No redundancy (each direction has its own sole platform
elevator; the shared street elevator severs both if it fails).
- Dupont Circle (A03), McPherson Sq (C02), Farragut West (C03), Crystal City
  (C09), Pentagon City (C08), Cheverly (D11), Clarendon (K02), Virginia Sq (K03).
- Encoding: two `StationModel`s sharing `stationExternalId`, `chainLabel`
  `" (opposite direction 1/2)"`, the shared elevator id appearing in both.

### E. Per-direction independent (side platforms, no shared leg)
Each direction has its own street→platform elevator; nothing shared.
- Judiciary Sq (B02), Arlington Cemetery (C06 East/West), Hyattsville Crossing
  (E08 North/South), West Hyattsville (E07), Reagan National (C10).

### F. Stacked interchange — down-then-back-up series
Multi-line stations where reaching one line means riding to another platform
and back up. Each line/direction becomes a *series* chain of 2–3 elevators.
- **Metro Center (A01_C01)**, **Gallery Place (B01_F01)**, **L'Enfant Plaza
  (D03_F03)** — resolved almost entirely from WMATA's own pasted elevator
  descriptions. The two ends of the upper level often aren't directly walkable,
  which is why some chains route down to the lower line and back up.

### G. Genuine redundant BANK — GTFS undercounts (the highest-value trap)
Multiple elevators serve the *same* leg to the *same* destination. GTFS
frequently draws the whole bank as ONE pathway. Caught when
`observed-units.json` shows 2+ identically-worded units, or Bryce confirms.
- **Forest Glen (B09)** — 6 elevators mezz→platform (GTFS drew 1). Forest Glen
  and Wheaton are WMATA's only all-elevator, no-stairs/escalator stations —
  consistent with a deliberate deep-station bank.
- **Rosslyn (C05)** — 3 street elevators to the upper platform (GTFS drew 1).
- **Mt Vernon Sq (E01)** — 3 street→mezz + 2 mezz→platform.
- **Potomac Yard (C11)** — 6 street (3 entrances × 2) + 2 platform.
- **Innovation Center (N09)** — 2 + 2, plus an at-grade bridge alternative.
- **Pentagon (C07)** — the GTFS "Street↔Mezzanine" edge is really 2 bus-bay
  elevators (the Transit Center bus bay *is* the street entrance).

### H. Redundant pair on one leg
Two elevators, same leg, either works. Real redundancy.
- **Morgan Blvd (G04)** & **NoMa (B35)** — two center-platform elevators on
  opposite sides of the same island platform.
- **Huntington (C15)** — an ordinary elevator *and* an inclinator (inclined
  lift) both reach the same platform → a real redundant pair. Inclinators count.

### I. Redundant pair of 2-in-series chains (per-entrance, both reach the platform)
Two full entrance→platform routes, each 2-in-series; redundant *because both
lead to the same platform and a rider can use either*.
- **Navy Yard-Ballpark (F05)** — CNF: `(streetE AND platE) OR (streetW AND
  platW)`. The two mezzanines aren't connected, but the encoding never assumes
  a cross-side combination, so that's fine.

### J. Grade-separated entrances — per-entrance, NO cross-redundancy (§ the 2026-07-17 fix)
The dangerous inverse of §I. Two entrances on **opposite sides of a highway or
rail corridor**, each with its own street elevator, sharing one platform
elevator. GTFS treats the two street elevators as a redundant pair, but a rider
**cannot cross between the entrances step-free at street level**, so one
elevator failing strands riders on that side — a false-redundancy **under-warn**.
Model per-entrance (each street elevator its own sole leg, sharing the platform
elevator), with a note disclosing the far entrance is usable *only if you can
reach the other side*.
- The 7 **Silver Line median stations** (McLean N01, Tysons N02, Greensboro
  N03, Spring Hill N04, Reston Town Center N07, Herndon N08, Ashburn N12) and
  **College Park (E09)**.
- Contrast §I Navy Yard and §H: those entrances/elevators are mutually
  reachable (urban, same paid area or same sidewalk), so redundancy is real.

### K. Auxiliary / secondary access (own chain, never inflates the main route)
Pedestrian bridges, bike-trail elevators, garage elevators that are real
entrances — each modeled as its own chain, additive, never a backup for the
core route unless confirmed to reach the same platform.
- Rockville bridge pair (A14), NoMa bike-trail elevator (B35), Innovation
  Center bridge (N09), Southern Ave/Suitland ped-bridge-to-mezz (F08/F10),
  Huntington garages (C15), West Falls Church garages + bus bay (K06).

---

## 4. The redundancy decision (get this right — it's the whole point)

> **Over-warn, never under-warn. No redundancy without a real signal.**

Two elevators are **redundant** only if a rider *at the start of the leg* can
use *either one* to reach the *same destination*. Concretely:

| Situation | Redundant? | Example |
|---|---|---|
| Two elevators, same leg, same island platform, rider already there | **YES** | Morgan Blvd, NoMa, Forest Glen bank |
| Two street elevators, same entrance/paid area, either reaches mezz | **YES** | Rosslyn, Gallery Place, Mt Vernon Sq |
| Two full routes to the same platform, rider can pick either entrance | **YES** | Navy Yard (CNF) |
| Elevator **or** inclinator to the same platform | **YES** | Huntington |
| Two elevators serving **different directions** (side platforms) | **NO** | Dupont, all §3D/§3E |
| Two entrances on **opposite sides of a barrier**, can't cross at grade | **NO** | Silver Line median, College Park (§3J) |
| Cross-station "ride to the next station and come back" | **NO** (never) | (BART rule; applies here too) |

The signal that promotes a leg to redundant must be **real**: Bryce's word,
WMATA's own text, or 2+ identically-worded observed units. GTFS topology alone
is *not* a signal — it both invents redundancy (§3J) and hides it (§3G).

---

## 5. What GTFS reliably gets wrong (check every one)

1. **Undercounts redundant banks** — a bank drawn as one pathway (§3G). Cross-
   check `observed-units.json`: more distinct non-garage units observed than
   modeled ⇒ suspect a bank. The generator's `observed-undercount` gate catches
   the ones already seen live; unseen banks need Bryce.
2. **Invents redundancy at grade-separated entrances** (§3J) — the generator's
   `side-platforms` gate catches the platform side, but *not* the street/
   entrance side, which is why §3J is a manual `CURATED_GRADE_SEPARATED` list.
3. **Corrupt levels** — A02 Farragut North's `level_id` pointed at A03; its two
   "platform" edges were fictional (real = plain 2-in-series). Generator gate:
   `corrupt-levels`.
4. **Misleading/combined level names** — U St (E03) "East/West Mezzanine" + a
   `_W` suffix suggested a nonexistent east elevator; Greenbelt (E10) read
   "Street/Mezzanine" on both ends (`unorderable-levels`); West Falls Church
   (K06) elevators mislabeled "Platform" on both ends (a stops.txt quirk).
5. **Misses mezzanine-at-grade** — models a street→mezz elevator leg that
   doesn't actually gate anything (§3C).
6. **Garage-named ≠ parking-only** — Huntington's "Garage #1" is really the
   required North Kings Hwy street→mezzanine entrance elevator. Don't drop an
   elevator by its name; check what it actually connects.
7. **Single-shaft vs. multiple ambiguity** — Fort Totten's one shaft over 3
   levels (`multi-level-shaft` gate) needed Bryce to confirm it's genuinely one.

---

## 6. Encoding cheatsheet

- **One chain per independent route/direction**; `chainLabel` names it
  (`" (opposite direction 1)"`, `" (north entrance)"`, `" (Green/Yellow)"`).
- **Shared elevator** (a prerequisite used by several routes): repeat the same
  `externalId` in each chain — the model handles it (it's sole-access because
  its outage severs every chain it's in). Pattern: A03, Potomac Yard, the §3J
  stations' shared platform elevator.
- **Redundant leg**: put both elevators in one segment's `elevators` array
  (OR within a segment).
- **"Either full route" redundancy**: paired-segment CNF (Navy Yard) — an AND
  of segments each of which is an OR across the routes.
- **At-grade leg**: omit it from `segments`; mention it in the public `note`
  only (Downtown Largo, West Falls Church, Rockville, Innovation Center bridge).
- **Ids**: use the real observed `UnitName` wherever one exists; otherwise a
  `WMATA-<node>` synthetic placeholder, promotable on first live observation.
- **Notes**: public `note` = plain rider English (what the route is, what an
  outage means); `internalNote` = provenance, confidence, confirmation source,
  and any watch item. Never leak provenance into the public note.
- **Locations**: whenever Bryce gives an address/corner/lat-long, fold it into
  the elevator `label` (standing rule).

---

## 7. Open watch items (documented uncertainties to revisit)

- **NoMa (B35)** — WMATA's materials say 1 mezz→platform elevator; Bryce is
  certain there are 2. Modeled as 2; watch `observed-units.json` for a 2nd id.
- **Ballston-MU (K04)** — the K04X03/X04/X05 id→physical mapping is inferential
  (no alert text names a platform). Watch for contradicting alert wording.
- **Morgan Blvd (G04)** — redundant pair inferred, confidence 4/10 (no strong
  outside fact; ordinary elevated station). Exact id→side unconfirmed.
- **Potomac Yard (C11)** — station signage numbers "7"/"8" may not map to
  WMATA's unit-id scheme.
- **From the 2026-07-17 audit**, still to review with Bryce (see
  `COVERAGE-AUDIT.md` §4): Glenmont (B11) redundancy call, Deanwood (D10) note
  artifact. **Friendship Heights (A08) RESOLVED 2026-07-17** via
  /liftwatch-wmata-spot-check — the auto 2×2 was wrong: WMATA's own page shows
  7 elevators / two separate mezzanines (Jenifer St. north 4+1, Western Ave.
  south 1+1); re-modeled per-entrance CNF (F05 shape) with a 4-elevator street
  bank on the Jenifer St. leg. A first illustration of the **split-mezzanine +
  undercounted-bank** failure class (§3J's inverse-of-inverse: separate
  mezzanines like §3I, but with a §3G bank on one leg). See `spot-check-log.md`.

---

## 8. Checklist for the next WMATA station

1. Pull the GTFS-derived chain + `observed-units.json` + any WMATA text Bryce
   can paste. Note real vs. synthetic ids.
2. **Undercount check**: more distinct non-garage observed units than modeled?
   → suspect a redundant bank (§3G), don't ship the single-elevator model.
3. **Grade check**: is any "street→mezzanine" leg actually at street grade?
   → omit the leg, note it (§3C).
4. **Direction check**: island platform (one platform elevator, both dirs) or
   side platforms (per-direction chains)? (§3D/E)
5. **Entrance check**: multiple entrances? Can a rider reach the alternate one
   *step-free at street level*? Yes → maybe redundant (§I). No (barrier
   between) → per-entrance, no cross-redundancy (§3J).
6. **Name check**: any "garage"/oddly-named elevator that's actually a required
   entrance? (Huntington)
7. State **Confidence N/10** up front; record provenance + any watch item in
   `internalNote`; fold locations into labels; write the rider `note` in plain
   English.
8. Over-warn if unsure. The honest default for an unverified redundancy claim
   is **not redundant**.
