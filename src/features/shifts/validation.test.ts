import { describe, expect, it } from "vitest";

import { shiftInputSchema } from "./validation";

const base = {
  date: "2026-08-28",
  startTime: "09:00",
  endTime: "17:00",
  requirements: { doctor: 1, nurse: 2, receptionist: 0 },
};

describe("shiftInputSchema", () => {
  it("accepts a well-formed shift", () => {
    const result = shiftInputSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("coerces string requirement counts (from form inputs)", () => {
    const result = shiftInputSchema.safeParse({
      ...base,
      requirements: { doctor: "1", nurse: "0", receptionist: "2" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requirements).toEqual({
        doctor: 1,
        nurse: 0,
        receptionist: 2,
      });
    }
  });

  it("rejects an impossible calendar date", () => {
    const result = shiftInputSchema.safeParse({ ...base, date: "2026-02-30" });
    expect(result.success).toBe(false);
  });

  it("rejects equal start and end times", () => {
    const result = shiftInputSchema.safeParse({
      ...base,
      startTime: "09:00",
      endTime: "09:00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a shift with no staffing requirements", () => {
    const result = shiftInputSchema.safeParse({
      ...base,
      requirements: { doctor: 0, nurse: 0, receptionist: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("allows overnight times (validation leaves ordering to the service)", () => {
    const result = shiftInputSchema.safeParse({
      ...base,
      startTime: "22:00",
      endTime: "06:00",
    });
    expect(result.success).toBe(true);
  });
});
