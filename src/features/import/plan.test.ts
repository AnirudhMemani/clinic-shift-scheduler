import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildImportPlan } from "./plan";

/**
 * End-to-end (but DB-free) check against the real dirty CSVs shipped in Project/.
 * If the fixtures change, these expected counts are the source of truth to update.
 */
const staffCsv = readFileSync(join(process.cwd(), "Project/staff.csv"), "utf8");
const shiftsCsv = readFileSync(join(process.cwd(), "Project/shifts.csv"), "utf8");
const plan = buildImportPlan(staffCsv, shiftsCsv);

describe("staff import plan (real staff.csv)", () => {
  it("accepts the unique valid staff and dedupes the rest", () => {
    // 41 rows: 34 kept (2 via email repair), 4 merged dupes, 3 rejected.
    expect(plan.staff.accepted).toHaveLength(34);
    expect(plan.staff.counts).toEqual({
      accepted: 32,
      repaired: 2,
      merged: 4,
      rejected: 3,
    });
  });

  it("rejects janitor, empty email, and empty name", () => {
    const rejected = plan.staff.issues.filter((i) => i.action === "rejected");
    expect(rejected).toHaveLength(3);
    expect(rejected.map((i) => i.reason).join(" | ")).toMatch(/profession/i);
    expect(rejected.some((i) => /email/i.test(i.reason))).toBe(true);
    expect(rejected.some((i) => /name/i.test(i.reason))).toBe(true);
  });

  it("emails are unique among accepted staff", () => {
    const emails = plan.staff.accepted.map((s) => s.email);
    expect(new Set(emails).size).toBe(emails.length);
  });
});

describe("shift import plan (real shifts.csv)", () => {
  it("accepts valid shifts and reports the garbage", () => {
    // 117 rows: 112 accepted, 1 merged dupe (5020), 4 rejected.
    expect(plan.shifts.accepted).toHaveLength(112);
    expect(plan.shifts.counts).toMatchObject({
      accepted: 112,
      merged: 1,
      rejected: 4,
    });
  });

  it("every accepted shift ends strictly after it starts", () => {
    for (const s of plan.shifts.accepted) {
      expect(s.endsAt > s.startsAt).toBe(true);
    }
  });

  it("rejects the four known-bad shift rows", () => {
    const rejected = plan.shifts.issues.filter((i) => i.action === "rejected");
    expect(rejected).toHaveLength(4);
    expect(rejected.some((i) => /date/i.test(i.reason))).toBe(true);
    expect(rejected.some((i) => /requirements/i.test(i.reason))).toBe(true);
    expect(rejected.some((i) => /time/i.test(i.reason))).toBe(true);
  });
});
