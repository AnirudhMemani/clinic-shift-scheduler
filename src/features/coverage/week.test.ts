import { describe, expect, it } from "vitest";

import type { ProfessionStaffing } from "../shifts/staffing";
import {
  buildWeek,
  formatMissing,
  formatWeekRange,
  groupShiftsByDay,
  resolveWeekStart,
} from "./week";

describe("buildWeek", () => {
  it("produces 7 labelled days Monday→Sunday", () => {
    const days = buildWeek("2026-08-03");
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ date: "2026-08-03", weekday: "Mon", label: "Aug 3" });
    expect(days[6]).toEqual({ date: "2026-08-09", weekday: "Sun", label: "Aug 9" });
  });

  it("spans month boundaries", () => {
    const days = buildWeek("2026-08-31");
    expect(days.map((d) => d.date)).toEqual([
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-06",
    ]);
  });
});

describe("formatWeekRange", () => {
  it("collapses a shared month", () => {
    expect(formatWeekRange("2026-08-03")).toBe("Aug 3 – 9, 2026");
  });

  it("shows both months when the week spans two", () => {
    expect(formatWeekRange("2026-08-31")).toBe("Aug 31 – Sep 6, 2026");
  });
});

describe("groupShiftsByDay", () => {
  it("buckets shifts by their start day, preserving input order", () => {
    const shifts = [
      { id: "a", startsAt: "2026-08-03 09:00:00" },
      { id: "b", startsAt: "2026-08-03 22:00:00" },
      { id: "c", startsAt: "2026-08-05 08:00:00" },
    ];
    const byDay = groupShiftsByDay(shifts);
    expect(byDay.get("2026-08-03")?.map((s) => s.id)).toEqual(["a", "b"]);
    expect(byDay.get("2026-08-05")?.map((s) => s.id)).toEqual(["c"]);
    expect(byDay.has("2026-08-04")).toBe(false);
  });

  it("places an overnight shift on its start day", () => {
    const byDay = groupShiftsByDay([
      { id: "night", startsAt: "2026-08-29 22:00:00" }, // ends 2026-08-30
    ]);
    expect(byDay.get("2026-08-29")?.map((s) => s.id)).toEqual(["night"]);
    expect(byDay.has("2026-08-30")).toBe(false);
  });
});

describe("formatMissing", () => {
  const staffing = (
    p: ProfessionStaffing["profession"],
    required: number,
    filled: number,
  ): ProfessionStaffing => ({ profession: p, required, filled });

  it("describes the shortfall with pluralization", () => {
    expect(formatMissing([staffing("doctor", 1, 0), staffing("nurse", 3, 1)])).toBe(
      "1 doctor, 2 nurses",
    );
  });

  it("is empty when nothing is missing", () => {
    expect(formatMissing([])).toBe("");
  });
});

describe("resolveWeekStart", () => {
  const bounds = { min: "2026-08-03", max: "2026-08-30" };

  it("uses the week of an explicit param date", () => {
    expect(resolveWeekStart("2026-08-19", "2026-08-02", bounds)).toBe("2026-08-17");
  });

  it("ignores an invalid param and falls back to today", () => {
    // today 2026-08-17 (a Monday) is within bounds → its own week.
    expect(resolveWeekStart("not-a-date", "2026-08-17", bounds)).toBe("2026-08-17");
  });

  it("clamps today up to the first data week when today precedes the range", () => {
    // today 2026-08-02 < min → anchor on min (2026-08-03, a Monday).
    expect(resolveWeekStart(undefined, "2026-08-02", bounds)).toBe("2026-08-03");
  });

  it("clamps today down to the last data week when today follows the range", () => {
    // today 2027-01-01 > max → anchor on max (2026-08-30, a Sunday) → week 08-24.
    expect(resolveWeekStart(undefined, "2027-01-01", bounds)).toBe("2026-08-24");
  });

  it("uses today's own week when there is no data", () => {
    expect(resolveWeekStart(undefined, "2026-08-02", null)).toBe("2026-07-27");
  });
});
