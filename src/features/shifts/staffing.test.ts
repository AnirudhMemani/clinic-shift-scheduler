import { describe, expect, it } from "vitest";

import { computeStaffing } from "./staffing";

const req = (doctor = 0, nurse = 0, receptionist = 0) =>
  [
    { profession: "doctor" as const, requiredCount: doctor },
    { profession: "nurse" as const, requiredCount: nurse },
    { profession: "receptionist" as const, requiredCount: receptionist },
  ].filter((r) => r.requiredCount > 0);

const claim = (profession: "doctor" | "nurse" | "receptionist") => ({
  user: { profession },
});

describe("computeStaffing", () => {
  it("reports empty when nothing is claimed", () => {
    const s = computeStaffing(req(1, 2), []);
    expect(s.status).toBe("empty");
    expect(s.missing.map((m) => m.profession)).toEqual(["doctor", "nurse"]);
  });

  it("reports partial when some but not all slots are filled", () => {
    const s = computeStaffing(req(1, 2), [claim("nurse")]);
    expect(s.status).toBe("partial");
    expect(s.byProfession.find((p) => p.profession === "nurse")).toMatchObject({
      required: 2,
      filled: 1,
    });
    expect(s.missing.map((m) => m.profession)).toEqual(["doctor", "nurse"]);
  });

  it("reports full when every requirement is met", () => {
    const s = computeStaffing(req(1, 2), [
      claim("doctor"),
      claim("nurse"),
      claim("nurse"),
    ]);
    expect(s.status).toBe("full");
    expect(s.missing).toHaveLength(0);
  });

  it("ignores professions the shift does not require", () => {
    const s = computeStaffing(req(0, 1), [claim("nurse")]);
    expect(s.byProfession.map((p) => p.profession)).toEqual(["nurse"]);
    expect(s.status).toBe("full");
  });
});
