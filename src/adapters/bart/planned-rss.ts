import { DateTime } from "luxon";
import { attributeOutageAcrossChains } from "../../lib/accessibility.js";
import type { StationModel } from "../../lib/accessibility.js";

// BART's planned-elevator-advisories RSS (bart.gov/rss/news/
// planned-elevator-advisories.xml) — the ONLY source of scheduled elevator
// work for BART (the real-time cmd=elev advisory is all-unplanned by
// definition). SPEC.md deferred this feed as "brittle prose", which is true:
// items are free-text paragraphs. This parser is deliberately conservative —
// anything it can't confidently extract degrades to null/unattributed, never
// a guess (same rule as the live-advisory attribution).
//
// Live item shape (observed 2026-07-09):
//   title: "24th St. Mission Station elevator out of service July 13 to
//           August 10"
//   description: "The street to concourse level elevator at 24th St. Mission
//           Station will be out of service from Monday, July 13 to Monday,
//           August 10, 2026 for emergency repairs...During this outage...
//           The platform to concourse level elevator will remain in service..."
//
// Two traps this code is shaped around (both from the real item above):
// - The description mentions BOTH the affected elevator AND its siblings
//   ("...will remain in service"), so hint-matching the WHOLE text is always
//   ambiguous. Only the SUBJECT CLAUSE (everything before "will be out of
//   service") names just the affected elevator — attribution runs on that.
// - BART strips HTML without preserving spacing, so sentences run together
//   ("...tank unit.During this outage...") — never assume ". " separators.
//
// bart.gov (www, not api) sits behind a bot WAF that 403s non-browser
// user agents — same workaround as the elevator-pages scrape (SPEC.md):
// a plain fetch with a browser UA works fine.

export interface PlannedAdvisory {
  title: string;
  stationAbbr: string;
  stationName: string;
  // Resolved conservative unit id: a specific elevator when the subject
  // clause attributed uniquely, else `${abbr}-UNSPECIFIED`.
  unitExternalId: string;
  attributed: boolean;
  segmentId?: string;
  startUtc?: string; // ISO UTC; undefined when the prose defeated parsing
  endUtc?: string;
  reason: string; // title + a compact slice of the description
}

const RSS_URL = "https://www.bart.gov/rss/news/planned-elevator-advisories.xml";
const BART_TZ = "America/Los_Angeles";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const MONTH_RE = MONTHS.join("|");

function decodeEntities(s: string): string {
  let out = s;
  // The feed double-escapes some entities ("&amp;amp;nbsp;") — collapse
  // &amp; repeatedly before resolving the rest.
  for (let i = 0; i < 3 && out.includes("&amp;"); i++) out = out.replaceAll("&amp;", "&");
  return out
    .replaceAll("&nbsp;", " ")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'");
}

function tagText(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return "";
  return decodeEntities(m[1]!.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "")).trim();
}

interface DateRange {
  startUtc?: string;
  endUtc?: string;
}

// "from Monday, July 13 to Monday, August 10, 2026" (description, has year)
// or "July 13 to August 10" (title, no year — resolved against pubDate).
function parseDateRange(text: string, pubYear: number, pubMonth: number): DateRange {
  const re = new RegExp(
    `(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:,\\s*(\\d{4}))?\\s+(?:to|through|until)\\s+(?:\\w+day,\\s*)?(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:,\\s*(\\d{4}))?`,
    "i",
  );
  const m = text.match(re);
  if (!m) return {};
  const startMonth = MONTHS.indexOf(m[1]!.toLowerCase()) + 1;
  const endMonth = MONTHS.indexOf(m[4]!.toLowerCase()) + 1;
  const startDay = Number(m[2]);
  const endDay = Number(m[5]);
  // Year resolution, conservative: explicit years win; otherwise anchor the
  // END to the publication year (bumping across New Year if the end month
  // reads as earlier than publication), and the START to the end's year
  // (backing up one year for a Dec->Jan span).
  let endYear = m[6] ? Number(m[6]) : pubYear + (endMonth < pubMonth - 6 ? 1 : 0);
  let startYear = m[3] ? Number(m[3]) : endYear - (startMonth > endMonth ? 1 : 0);
  const toUtc = (y: number, mo: number, d: number): string | undefined => {
    const dt = DateTime.fromObject({ year: y, month: mo, day: d }, { zone: BART_TZ });
    return dt.isValid ? (dt.toUTC().toISO() as string) : undefined;
  };
  return { startUtc: toUtc(startYear, startMonth, startDay), endUtc: toUtc(endYear, endMonth, endDay) };
}

export async function fetchPlannedAdvisories(
  stations: { abbr: string; name: string }[],
  models: Map<string, StationModel[]>,
): Promise<PlannedAdvisory[]> {
  const res = await fetch(RSS_URL, {
    headers: {
      // bart.gov's WAF 403s non-browser agents (see header comment).
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      accept: "application/rss+xml, application/xml, text/xml",
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`BART planned-advisories RSS returned HTTP ${res.status}`);
  const xml = await res.text();

  const advisories: PlannedAdvisory[] = [];
  for (const [, itemBlock] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const title = tagText(itemBlock!, "title");
    const description = tagText(itemBlock!, "description");
    if (!title) continue;

    // Attribution + station matching both use ONLY the subject clause
    // (before "will be out of service") or the title — NEVER the full
    // description, whose later prose names sibling elevators that "remain in
    // service" AND recommends alternative STATIONS ("we recommend using the
    // 16th St. Mission Station ... instead"), either of which poisons
    // matching. Live-verified: full-description station matching attributed
    // the real 24th St. item to 16TH (equal-length names, tie broken by
    // feed order) before this was narrowed.
    const subject = description.split(/will be (?:out of service|closed|unavailable|taken out of service)/i)[0] ?? "";

    // Station: longest cmd=stns name in the TITLE (headlines name the subject
    // station); subject clause as fallback. Longest wins so a shorter name
    // can never shadow a longer sibling.
    const byName = (text: string) =>
      stations
        .filter((s) => text.toLowerCase().includes(s.name.toLowerCase()))
        .sort((a, b) => b.name.length - a.name.length)[0];
    const matched = byName(title) ?? byName(subject);
    if (!matched) continue; // unrecognizable station — skip, never guess

    const abbr = matched.abbr.toUpperCase();
    const attr = attributeOutageAcrossChains(subject || title, models.get(abbr) ?? []);

    // pubDate anchors year-less title dates; format observed: "07.02.26".
    const pubRaw = tagText(itemBlock!, "pubDate");
    const pubDot = pubRaw.match(/(\d{2})\.(\d{2})\.(\d{2})/);
    const pubParsed = pubDot ? { year: 2000 + Number(pubDot[3]), month: Number(pubDot[1]) } : undefined;
    const nowLocal = DateTime.now().setZone(BART_TZ);
    const pubYear = pubParsed?.year ?? nowLocal.year;
    const pubMonth = pubParsed?.month ?? nowLocal.month;

    // Prefer the description (carries the explicit year); title as fallback.
    const range = ((): DateRange => {
      const fromDesc = parseDateRange(description, pubYear, pubMonth);
      return fromDesc.startUtc ? fromDesc : parseDateRange(title, pubYear, pubMonth);
    })();

    advisories.push({
      title,
      stationAbbr: abbr,
      stationName: matched.name,
      unitExternalId: attr?.elevatorExternalId ?? `${abbr}-UNSPECIFIED`,
      attributed: !!attr?.elevatorExternalId,
      segmentId: attr?.segmentId,
      startUtc: range.startUtc,
      endUtc: range.endUtc,
      reason: title,
    });
  }
  return advisories;
}
