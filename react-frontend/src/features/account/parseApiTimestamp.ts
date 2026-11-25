/** A trailing `Z` or `±hh:mm` / `±hhmm` offset. */
const OFFSET = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;

/**
 * Read a timestamp from the API as the instant it means.
 *
 * The API stores times such as `last_changed_password_date` as naive UTC and
 * sends them without an offset (`2026-11-24T00:12:03.123456`). JavaScript
 * reads a date-time string with no offset as local time, which moves it by
 * the viewer's UTC offset, so one with a time and no offset is read as UTC.
 * A string that already carries an offset, or a date alone, is left as it
 * is. Returns null for a missing or unreadable value.
 */
export function parseApiTimestamp(
  value: string | null | undefined
): Date | null {
  if (!value) {
    return null;
  }
  const hasTime = value.includes('T');
  const date = new Date(hasTime && !OFFSET.test(value) ? `${value}Z` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}
