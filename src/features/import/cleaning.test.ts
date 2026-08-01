import { describe, expect, it } from "vitest";

import {
  cleanShiftRow,
  cleanStaffRow,
  normalizeProfession,
  parseFlexibleDate,
  parseFlexibleTime,
  parseRequirements,
} from "./cleaning";

describe("normalizeProfession", () => {
  it("canonicalizes every synonym seen in the data", () => {
    for (const s of ["Doctor", "Physician", "MD", "DOCTOR "])
      expect(normalizeProfession(s)).toBe("doctor");
    for (const s of ["NURSE", "RN", "Registered Nurse", " Nurse ", "nurse"])
      expect(normalizeProfession(s)).toBe("nurse");
    for (const s of ["receptionist", "Reception", "recep.", "Receptionist"])
      expect(normalizeProfession(s)).toBe("receptionist");
  });

  it("rejects unknown roles", () => {
    expect(normalizeProfession("Janitor")).toBeNull();
    expect(normalizeProfession("")).toBeNull();
  });
});

describe("parseFlexibleDate", () => {
  it("passes ISO through", () => {
    expect(parseFlexibleDate("2026-08-28")).toBe("2026-08-28");
  });
  it("reads slash dates as DD/MM/YYYY", () => {
    expect(parseFlexibleDate("29/08/2026")).toBe("2026-08-29");
    expect(parseFlexibleDate("05/08/2026")).toBe("2026-08-05");
  });
  it("reads dash dates as MM-DD-YYYY", () => {
    expect(parseFlexibleDate("08-13-2026")).toBe("2026-08-13");
    expect(parseFlexibleDate("08-27-2026")).toBe("2026-08-27");
  });
  it("rejects impossible / malformed dates", () => {
    expect(parseFlexibleDate("2026-02-30")).toBeNull();
    expect(parseFlexibleDate("not-a-date")).toBeNull();
  });
});

describe("parseFlexibleTime", () => {
  it("parses plain and +1 times", () => {
    expect(parseFlexibleTime("09:00")).toEqual({ time: "09:00", nextDay: false });
    expect(parseFlexibleTime("10:00+1")).toEqual({ time: "10:00", nextDay: true });
  });
  it("rejects empty or invalid times", () => {
    expect(parseFlexibleTime("")).toBeNull();
    expect(parseFlexibleTime("25:00")).toBeNull();
  });
});

describe("parseRequirements", () => {
  it("parses full and partial specs", () => {
    expect(parseRequirements("nurses=3;doctors=1;receptionists=0")).toEqual({
      doctor: 1,
      nurse: 3,
      receptionist: 0,
    });
    expect(parseRequirements("nurses=2")).toEqual({
      doctor: 0,
      nurse: 2,
      receptionist: 0,
    });
  });
  it("rejects free text", () => {
    expect(parseRequirements("two nurses and a doctor")).toBeNull();
  });
});

describe("cleanStaffRow", () => {
  it("accepts a clean row", () => {
    const r = cleanStaffRow({
      staff_id: "121",
      full_name: "Marcus Whitfield",
      role: "Doctor",
      email: "Marcus.Whitfield@clinicmail.test",
    });
    expect(r.action).toBe("accepted");
    expect(r.action !== "rejected" && r.value).toMatchObject({
      email: "marcus.whitfield@clinicmail.test",
      profession: "doctor",
    });
  });

  it("repairs (at) emails and flags them", () => {
    const r = cleanStaffRow({
      staff_id: "122",
      full_name: "Priya Weber",
      role: "Doctor",
      email: "priya.weber(at)clinicmail.test",
    });
    expect(r.action).toBe("repaired");
    expect(r.action !== "rejected" && r.value.email).toBe(
      "priya.weber@clinicmail.test",
    );
  });

  it("trims whitespace in name and role", () => {
    const r = cleanStaffRow({
      staff_id: "101",
      full_name: "  Karan ALI",
      role: " Nurse ",
      email: "karan.ali@clinicmail.test",
    });
    expect(r.action === "accepted" && r.value.name).toBe("Karan ALI");
    expect(r.action === "accepted" && r.value.profession).toBe("nurse");
  });

  it("rejects janitor, missing email, missing name", () => {
    expect(cleanStaffRow({ full_name: "X", role: "Janitor", email: "x@y.test" }).action).toBe("rejected");
    expect(cleanStaffRow({ full_name: "X", role: "Nurse", email: "" }).action).toBe("rejected");
    expect(cleanStaffRow({ full_name: "", role: "Doctor", email: "x@y.test" }).action).toBe("rejected");
  });
});

describe("cleanShiftRow", () => {
  it("resolves an overnight shift", () => {
    const r = cleanShiftRow({
      shift_id: "5103",
      date: "2026-08-29",
      start_time: "22:00",
      end_time: "06:00",
      requirements: "nurses=3;doctors=2;receptionists=1",
    });
    expect(r.action).toBe("accepted");
    expect(r.action === "accepted" && r.value).toMatchObject({
      startsAt: "2026-08-29 22:00:00",
      endsAt: "2026-08-30 06:00:00",
    });
  });

  it("accepts the long 15:00->09:00 overnight", () => {
    const r = cleanShiftRow({
      shift_id: "5109",
      date: "2026-08-12",
      start_time: "15:00",
      end_time: "09:00",
      requirements: "nurses=2;doctors=1",
    });
    expect(r.action === "accepted" && r.value.endsAt).toBe("2026-08-13 09:00:00");
  });

  it("rejects impossible date, zero-length, missing time, free-text reqs", () => {
    expect(cleanShiftRow({ shift_id: "5110", date: "2026-02-30", start_time: "08:00", end_time: "16:00", requirements: "nurses=1" }).action).toBe("rejected");
    expect(cleanShiftRow({ shift_id: "5112", date: "2026-08-15", start_time: "12:00", end_time: "12:00", requirements: "doctors=1" }).action).toBe("rejected");
    expect(cleanShiftRow({ shift_id: "5114", date: "2026-08-20", start_time: "", end_time: "16:00", requirements: "nurses=1;doctors=1" }).action).toBe("rejected");
    expect(cleanShiftRow({ shift_id: "5113", date: "2026-08-18", start_time: "08:00", end_time: "16:00", requirements: "two nurses and a doctor" }).action).toBe("rejected");
  });
});
