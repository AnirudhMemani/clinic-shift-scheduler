import { describe, expect, it } from "vitest";

import {
  addDays,
  computeShiftInstants,
  intervalsOverlap,
  isoWeekday,
  isValidCalendarDate,
  isValidTime,
  splitInstant,
  startOfWeek,
} from "./time";

describe("isValidCalendarDate", () => {
  it("accepts real dates", () => {
    expect(isValidCalendarDate("2026-08-28")).toBe(true);
    expect(isValidCalendarDate("2024-02-29")).toBe(true); // leap year
  });

  it("rejects impossible or malformed dates", () => {
    expect(isValidCalendarDate("2026-02-30")).toBe(false); // from the dirty CSV
    expect(isValidCalendarDate("2026-13-01")).toBe(false);
    expect(isValidCalendarDate("2025-02-29")).toBe(false); // not a leap year
    expect(isValidCalendarDate("05/08/2026")).toBe(false); // wrong format
    expect(isValidCalendarDate("2026-8-5")).toBe(false); // unpadded
  });
});

describe("isValidTime", () => {
  it("accepts valid 24h times", () => {
    expect(isValidTime("00:00")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
    expect(isValidTime("07:30")).toBe(true);
  });

  it("rejects invalid times", () => {
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("12:60")).toBe(false);
    expect(isValidTime("9:00")).toBe(false); // unpadded
    expect(isValidTime("10:00+1")).toBe(false);
  });
});

describe("addDays", () => {
  it("advances across month and year boundaries", () => {
    expect(addDays("2026-08-28", 1)).toBe("2026-08-29");
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29"); // leap
  });
});

describe("computeShiftInstants", () => {
  it("keeps same-day shifts on the same date", () => {
    expect(computeShiftInstants("2026-08-28", "09:00", "17:00")).toEqual({
      startsAt: "2026-08-28 09:00:00",
      endsAt: "2026-08-28 17:00:00",
    });
  });

  it("rolls overnight shifts (end <= start) to the next day", () => {
    expect(computeShiftInstants("2026-08-29", "22:00", "06:00")).toEqual({
      startsAt: "2026-08-29 22:00:00",
      endsAt: "2026-08-30 06:00:00",
    });
  });

  it("treats a midnight end as the next day", () => {
    expect(computeShiftInstants("2026-08-28", "16:00", "00:00")).toEqual({
      startsAt: "2026-08-28 16:00:00",
      endsAt: "2026-08-29 00:00:00",
    });
  });

  it("honors explicit next-day end (importer '+1' notation)", () => {
    expect(computeShiftInstants("2026-08-21", "08:00", "10:00", true)).toEqual({
      startsAt: "2026-08-21 08:00:00",
      endsAt: "2026-08-22 10:00:00",
    });
  });

  it("always yields endsAt strictly after startsAt", () => {
    const cases: Array<[string, string, string]> = [
      ["2026-08-28", "09:00", "17:00"],
      ["2026-08-29", "22:00", "06:00"],
      ["2026-08-28", "16:00", "00:00"],
      ["2026-08-05", "07:30", "15:30"],
    ];
    for (const [date, start, end] of cases) {
      const { startsAt, endsAt } = computeShiftInstants(date, start, end);
      expect(endsAt > startsAt).toBe(true);
    }
  });
});

describe("splitInstant", () => {
  it("splits an instant into date and HH:MM, round-tripping computeShiftInstants", () => {
    const { startsAt } = computeShiftInstants("2026-08-28", "09:00", "17:00");
    expect(splitInstant(startsAt)).toEqual({ date: "2026-08-28", time: "09:00" });
  });

  it("handles the next-day end of an overnight shift", () => {
    const { endsAt } = computeShiftInstants("2026-08-29", "22:00", "06:00");
    expect(splitInstant(endsAt)).toEqual({ date: "2026-08-30", time: "06:00" });
  });
});

describe("isoWeekday", () => {
  it("maps Monday to 1 and Sunday to 7", () => {
    expect(isoWeekday("2026-08-03")).toBe(1); // Monday
    expect(isoWeekday("2026-08-08")).toBe(6); // Saturday
    expect(isoWeekday("2026-08-09")).toBe(7); // Sunday
  });
});

describe("startOfWeek", () => {
  it("returns the Monday of the containing week", () => {
    // The week of Mon 2026-08-03 … Sun 2026-08-09.
    expect(startOfWeek("2026-08-03")).toBe("2026-08-03"); // Monday itself
    expect(startOfWeek("2026-08-06")).toBe("2026-08-03"); // mid-week
    expect(startOfWeek("2026-08-09")).toBe("2026-08-03"); // Sunday
  });

  it("crosses month boundaries", () => {
    // Sun 2026-08-02 belongs to the week starting Mon 2026-07-27.
    expect(startOfWeek("2026-08-02")).toBe("2026-07-27");
  });
});

describe("intervalsOverlap", () => {
  const a = ["2026-08-28 09:00:00", "2026-08-28 17:00:00"] as const;

  it("detects genuine overlaps", () => {
    expect(intervalsOverlap(...a, "2026-08-28 16:00:00", "2026-08-28 20:00:00")).toBe(true);
    expect(intervalsOverlap(...a, "2026-08-28 08:00:00", "2026-08-28 10:00:00")).toBe(true);
    expect(intervalsOverlap(...a, "2026-08-28 10:00:00", "2026-08-28 12:00:00")).toBe(true); // contained
  });

  it("treats back-to-back shifts as non-overlapping", () => {
    expect(intervalsOverlap(...a, "2026-08-28 17:00:00", "2026-08-28 21:00:00")).toBe(false);
    expect(intervalsOverlap(...a, "2026-08-28 05:00:00", "2026-08-28 09:00:00")).toBe(false);
  });

  it("detects overlaps that cross midnight", () => {
    // 22:00->06:00 overnight vs a 05:00->09:00 next morning
    expect(
      intervalsOverlap(
        "2026-08-29 22:00:00",
        "2026-08-30 06:00:00",
        "2026-08-30 05:00:00",
        "2026-08-30 09:00:00",
      ),
    ).toBe(true);
  });
});
