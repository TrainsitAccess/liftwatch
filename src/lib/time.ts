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

export function nowUtcIso(): string {
  // UTC-now is always a valid instant, so toISO() never returns null here.
  return DateTime.utc().toISO() as string;
}
