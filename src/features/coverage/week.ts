import type { Profession } from "@/db/schema";
import { addDays, isValidCalendarDate, splitInstant, startOfWeek } from "@/lib/time";

import type { ProfessionStaffing } from "../shifts/staffing";

/** Weeks on the dashboard run Monday → Sunday. */
export const WEEK_LENGTH = 7;

export type WeekDay = {
  /** "YYYY-MM-DD" for this day. */
  date: string;
  /** "Mon", "Tue", … */
  weekday: string;
  /** "Aug 3" — short month + day, for the column header. */
  label: string;
};

const WEEKDAY_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "UTC",
});
const DAY_LABEL_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const RANGE_END_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function asUtcDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** The 7 days of the week starting at `weekStart` (a Monday), with labels. */
export function buildWeek(weekStart: string): WeekDay[] {
  return Array.from({ length: WEEK_LENGTH }, (_, i) => {
    const date = addDays(weekStart, i);
    const utc = asUtcDate(date);
    return {
      date,
      weekday: WEEKDAY_FMT.format(utc),
      label: DAY_LABEL_FMT.format(utc),
    };
  });
}

/** "Aug 3 – 9, 2026", collapsing a shared month across the range. */
export function formatWeekRange(weekStart: string): string {
  const end = addDays(weekStart, WEEK_LENGTH - 1);
  const startUtc = asUtcDate(weekStart);
  const endUtc = asUtcDate(end);
  const sameMonth = weekStart.slice(0, 7) === end.slice(0, 7);
  const endLabel = sameMonth
    ? `${endUtc.getUTCDate()}, ${endUtc.getUTCFullYear()}`
    : RANGE_END_FMT.format(endUtc);
  return `${DAY_LABEL_FMT.format(startUtc)} – ${endLabel}`;
}

/**
 * Bucket shifts into the week's days, keyed by "YYYY-MM-DD". A shift is placed on
 * the day it *starts* (an overnight shift shows on its start day). Input shifts
 * are assumed already ordered by start time, so each bucket stays ordered.
 */
export function groupShiftsByDay<T extends { startsAt: string }>(
  shifts: T[],
): Map<string, T[]> {
  const byDay = new Map<string, T[]>();
  for (const shift of shifts) {
    const { date } = splitInstant(shift.startsAt);
    const bucket = byDay.get(date);
    if (bucket) bucket.push(shift);
    else byDay.set(date, [shift]);
  }
  return byDay;
}

const PROFESSION_LABEL: Record<Profession, string> = {
  doctor: "doctor",
  nurse: "nurse",
  receptionist: "receptionist",
};

/**
 * "1 doctor, 2 nurses" describing the *shortfall* of each still-missing
 * profession (required − filled). Empty string when nothing is missing.
 */
export function formatMissing(missing: ProfessionStaffing[]): string {
  return missing
    .map((m) => {
      const short = m.required - m.filled;
      const label = PROFESSION_LABEL[m.profession];
      return `${short} ${label}${short === 1 ? "" : "s"}`;
    })
    .join(", ");
}

/**
 * Resolve which week the dashboard should show. Prefers an explicit `week` query
 * param (any date within the target week). Otherwise defaults to the week
 * containing `today`, but clamped into the shift date range so the first load
 * lands on real data even when "today" is outside the seeded period.
 */
export function resolveWeekStart(
  week: string | undefined,
  today: string,
  bounds: { min: string; max: string } | null,
): string {
  if (week && isValidCalendarDate(week)) return startOfWeek(week);

  let anchor = today;
  if (bounds) {
    if (today < bounds.min) anchor = bounds.min;
    else if (today > bounds.max) anchor = bounds.max;
  }
  return startOfWeek(anchor);
}
