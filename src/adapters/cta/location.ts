// CTA alert text → stable per-elevator identity. CTA's feed has NO elevator
// ids and no inventory, but its alert prose names each elevator by a PERSISTENT
// location identity — "The Harlem-bound platform elevator at Pulaski", "The
// elevator to/from street at Ashland", "The transfer tunnel elevator at
// Roosevelt" — the same physical elevator gets the same phrase across outages
// (verified against the full 2026-07 archive corpus). Parsing that identity
// into a stable slug upgrades CTA from one-lump-per-station tracking to real
// per-elevator archiving (MTTR, chronic offenders, streaks), the same
// text-identity move as WMATA's LocationDescription crosswalk.
//
// DELIBERATELY CONSERVATIVE: a vague alert ("The elevator at Central") yields
// NO slug — the adapter falls back to the bare station id, which is exactly
// the pre-2026-07-14 unit id, so history continuity is preserved and nothing
// is ever guessed. No redundancy/chain claims are made anywhere here: CTA
// publishes no inventory or backup guidance (re-verified 2026-07-13 — ASAP
// plan tables are graphical, no per-station elevator roster exists), so
// per-elevator identity is the parity ceiling until that changes.
//
// Corpus quirks this parser MUST survive (all live-observed):
//   "The Harlem- bound platform elevator…"           (space after hyphen)
//   "The 95th- and- Loop- bound platform elevator…"  (fully exploded)
//   "The 95th-bound and Loop-bound platform elevator…"
//   "The Loop- and 63rd-bound platform elevator…"     (reversed order)
//   "The Harlem-bound elevator at King Drive…"        (no "platform")
//   "The elevator to/from street and elevators needed to access the
//    Harlem-bound platforms at California…"           (consequence clause —
//    the unit is the STREET elevator; "Harlem-bound" must NOT be extracted)
//   "The elevator to/from 23rd street at Cermak…"     (named street ≠ street)
//   "Elevator at Lake (Washington/Randolph Entrance)…" (entrance in HEADLINE)

const slugify = (s: string): string =>
  s
    .toUpperCase()
    .replace(/\bAND\b/g, " ")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Parse one alert's combined text (Headline + ShortDescription) into a stable
 * identity slug, or null when the text is too vague to identify an elevator. */
export function parseCtaElevatorIdentity(text: string): string | null {
  // Normalize the hyphen-space explosions: "Harlem- bound" → "Harlem-bound",
  // "95th- and- Loop- bound" → "95th and Loop bound".
  const t = text
    .replace(/-\s+/g, "-")
    .replace(/\s+/g, " ")
    // "-and-" (fully exploded) and "-and " (reversed order, e.g. "Loop- and
    // 63rd-bound") both reduce to " and " so direction order never matters.
    .replace(/-and[- ]/gi, " and ")
    // "95th-bound and Loop-bound…" → "95th and Loop-bound…" so every
    // multi-direction phrasing reduces to one and-list before "bound".
    .replace(/[- ]bound and /gi, " and ")
    .trim();

  const tokens: string[] = [];

  // (1) Entrance / named-location qualifiers — the strongest identity.
  //     "(Washington/Randolph Entrance)" (headline), "at the Adams-Jackson
  //     entrance", "at 203 N. LaSalle (…)", "The South Terminal elevator".
  const entParen = /\(([^)]*?)\s+Entrance\)/i.exec(t);
  if (entParen) tokens.push(slugify(entParen[1]!));
  const entAt = /at the ([A-Za-z0-9/.'\- ]+?) entrance/i.exec(t);
  if (entAt && !entParen) tokens.push(slugify(entAt[1]!));
  const entAddr = /elevator at (\d+\s+[NSEW]\.?\s+[A-Za-z'\- ]+?)\s*\(/i.exec(t);
  if (entAddr) tokens.push(slugify(entAddr[1]!));
  const named = /The ([A-Za-z0-9'\- ]+? Terminal) elevator/i.exec(t);
  if (named) tokens.push(slugify(named[1]!));
  if (/transfer tunnel elevator/i.test(t)) tokens.push("TRANSFER-TUNNEL");

  // (2) Directions — ONLY from the "…-bound [platform] elevator" form, i.e. a
  //     direction phrase immediately qualifying the elevator itself; each
  //     direction word is the token directly joined to "bound" (or and-joined
  //     into that list), so a station name in a headline ("Western
  //     Kimball-bound Platform Elevator") or a consequence clause ("…needed
  //     to access the Harlem-bound platforms") can never leak in. All
  //     directions of a multi-direction island elevator are kept, SORTED, so
  //     every phrasing variant ("95th-bound and Loop-bound", "95th- and-
  //     Loop- bound") collapses to one id.
  const dirSet = new Set<string>();
  for (const m of t.matchAll(/((?:[A-Za-z0-9/']+ and )*[A-Za-z0-9/']+)[- ]bound (?:platform )?elevator/gi)) {
    for (const d of m[1]!.split(/ and /i)) dirSet.add(slugify(d.split(" ").at(-1)!));
  }
  const dirs = [...dirSet].sort();
  if (dirs.length) tokens.push(...dirs, "BOUND");

  // (3) Line-qualified platform elevator ("The Brown Line platform elevator
  //     at Washington/Wells") — identifies which side of a transfer station.
  const line = /The ([A-Za-z]+) Line platform elevator/i.exec(t);
  if (line) tokens.push(slugify(line[1]!), "LINE-PLATFORM");

  // (4) The to/from leg. A NAMED street ("to/from 23rd street") is an
  //     identity of its own, distinct from the generic street leg. Generic
  //     "platform" is dropped when a direction already identifies the
  //     elevator (directions imply the platform), kept otherwise.
  //     The lazy capture plus the " and elevators" stop keeps a consequence
  //     clause out: "to/from street and elevators needed to access…" → street.
  const leg = /to\/from ([\w, ]+?(?: and \w+)*?)(?: at | and elevators|$)/i.exec(t);
  if (leg) {
    const legSlug = slugify(leg[1]!.replace(/\s*,\s*/g, " "));
    if (!(legSlug === "PLATFORM" && dirs.length)) tokens.push(legSlug);
  }

  const slug = [...new Set(tokens)].join("-").replace(/-+/g, "-");
  return slug || null;
}
