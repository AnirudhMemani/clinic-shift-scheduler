/**
 * Time helpers for shifts.
 *
 * Shift times are naive clinic-local wall-clock values stored as
 * "YYYY-MM-DD HH:MM:SS" strings (see the schema). Everything here is pure and
 * timezone-free: no `Date` is ever interpreted in the host's local zone. Date
 * arithmetic goes through `Date.UTC`, which is deterministic regardless of where
 * the code runs. The importer reuses these helpers.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** True if `date` ("YYYY-MM-DD") is a real calendar date (rejects 2026-02-30). */
export function isValidCalendarDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  // Round-trips only if the components form a real date (JS would otherwise roll
  // over, e.g. Feb 30 -> Mar 2).
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/** True if `time` is a valid 24h "HH:MM". */
export function isValidTime(time: string): boolean {
  return TIME_RE.test(time);
}

/** Add `days` to a "YYYY-MM-DD" string, returning a "YYYY-MM-DD" string. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * Resolve a shift's date + start/end wall-clock times into absolute
 * "YYYY-MM-DD HH:MM:SS" instants. If the end time is not after the start time it
 * is treated as the next day (overnight shift, e.g. 22:00 -> 06:00), so the
 * result always satisfies endsAt > startsAt.
 *
 * `nextDayEnd` forces the end onto the following day even when end > start —
 * used for the importer's explicit "+1" notation (e.g. "08:00" -> "10:00+1").
 */
export function computeShiftInstants(
  date: string,
  startTime: string,
  endTime: string,
  nextDayEnd = false,
): { startsAt: string; endsAt: string } {
  const rollsOver = nextDayEnd || endTime <= startTime;
  const endDate = rollsOver ? addDays(date, 1) : date;
  return {
    startsAt: `${date} ${startTime}:00`,
    endsAt: `${endDate} ${endTime}:00`,
  };
}

/**
 * Split a "YYYY-MM-DD HH:MM:SS" instant into its date and "HH:MM" parts — the
 * inverse of the `${date} ${time}:00` assembly, used to repopulate edit forms.
 */
export function splitInstant(instant: string): { date: string; time: string } {
  const [date, time = "00:00:00"] = instant.split(" ");
  return { date, time: time.slice(0, 5) };
}

/**
 * Half-open interval overlap: true if [aStart, aEnd) and [bStart, bEnd) intersect.
 * Back-to-back shifts (one ends exactly when the next starts) do NOT overlap.
 * Operates on the "YYYY-MM-DD HH:MM:SS" strings, which sort chronologically.
 */
export function intervalsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}
