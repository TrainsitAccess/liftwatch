import { DateTime } from "luxon";

// MTA feeds report local wall-clock time in US format with no timezone, e.g.
// "09/30/2024 12:05:00 PM", implicitly America/New_York. Luxon handles DST
// correctly (fixed offsets would not). Returns ISO-8601 UTC, or undefined for
// blank/unparseable input.
const MTA_FORMAT = "MM/dd/yyyy hh:mm:ss a";

export function parseZonedToUtcIso(
  value: string | null | undefined,
  zone: string,
  format = MTA_FORMAT,
): string | undefined {
  if (!value || !value.trim()) return undefined;
  const dt = DateTime.fromFormat(value.trim(), format, { zone });
  if (!dt.isValid) return undefined;
  return dt.toUTC().toISO() ?? undefined;
}

// WMATA-style timestamps: ISO 8601 with NO offset ("2026-07-03T11:52:00"),
// implicitly local wall-clock in the given IANA zone. Luxon applies the zone
// then converts to UTC (DST-correct). Returns undefined for blank/unparseable.
export function parseIsoLocalToUtcIso(
  value: string | null | undefined,
  zone: string,
): string | undefined {
  if (!value || !value.trim()) return undefined;
  const dt = DateTime.fromISO(value.trim(), { zone });
  if (!dt.isValid) return undefined;
  return dt.toUTC().toISO() ?? undefined;
}

export function nowUtcIso(): string {
  // UTC-now is always a valid instant, so toISO() never returns null here.
  return DateTime.utc().toISO() as string;
}

// TMB-style timestamps: epoch milliseconds, already an absolute instant (no
// timezone ambiguity to resolve, unlike every wall-clock format above).
export function msToUtcIso(value: number | null | undefined): string | undefined {
  if (value === null || value === undefined || !Number.isFinite(value)) return undefined;
  const dt = DateTime.fromMillis(value, { zone: "utc" });
  if (!dt.isValid) return undefined;
  return dt.toISO() ?? undefined;
}
