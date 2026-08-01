import type { Profession } from "@/db/schema";
import {
  computeShiftInstants,
  isValidCalendarDate,
  isValidTime,
} from "@/lib/time";

import type { CleanShift, ShiftRowResult, StaffRowResult } from "./types";

/**
 * Pure, per-row cleaning for the dirty CSVs. No DB, no dedup (that's `plan.ts`).
 * Every rule here is unit-tested against the real garbage in Project/*.csv.
 */

// ---------------------------------------------------------------------------
// Profession
// ---------------------------------------------------------------------------

const PROFESSION_SYNONYMS: Record<string, Profession> = {
  doctor: "doctor",
  physician: "doctor",
  md: "doctor",
  nurse: "nurse",
  rn: "nurse",
  "registered nurse": "nurse",
  receptionist: "receptionist",
  reception: "receptionist",
  recep: "receptionist",
};

/** Canonicalize a messy role string to a Profession, or null if unknown. */
export function normalizeProfession(raw: string): Profession | null {
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/\.+$/, "") // "recep." -> "recep"
    .replace(/\s+/g, " ");
  return PROFESSION_SYNONYMS[key] ?? null;
}

// ---------------------------------------------------------------------------
// Dates — separator decides the ordering (slash = DD/MM, dash = MM-DD)
// ---------------------------------------------------------------------------

/** Parse ISO / DD-MM-mixed dates to a canonical "YYYY-MM-DD", or null. */
export function parseFlexibleDate(raw: string): string | null {
  const value = raw.trim();

  let iso: string | null = null;
  let m: RegExpMatchArray | null;

  if ((m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
    iso = `${m[1]}-${m[2]}-${m[3]}`; // already ISO
  } else if ((m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/))) {
    iso = `${m[3]}-${m[2]}-${m[1]}`; // DD/MM/YYYY
  } else if ((m = value.match(/^(\d{2})-(\d{2})-(\d{4})$/))) {
    iso = `${m[3]}-${m[1]}-${m[2]}`; // MM-DD-YYYY
  }

  if (!iso || !isValidCalendarDate(iso)) return null;
  return iso;
}

// ---------------------------------------------------------------------------
// Times — "HH:MM" with optional "+1" next-day marker
// ---------------------------------------------------------------------------

export type ParsedTime = { time: string; nextDay: boolean };

export function parseFlexibleTime(raw: string): ParsedTime | null {
  const m = raw.trim().match(/^(\d{2}:\d{2})(\+1)?$/);
  if (!m || !isValidTime(m[1])) return null;
  return { time: m[1], nextDay: Boolean(m[2]) };
}

// ---------------------------------------------------------------------------
// Requirements — "nurses=3;doctors=1;receptionists=0"
// ---------------------------------------------------------------------------

const REQUIREMENT_KEYS: Record<string, Profession> = {
  nurses: "nurse",
  doctors: "doctor",
  receptionists: "receptionist",
};

/**
 * Parse the requirements string. Returns per-profession counts, or null if the
 * format is unparseable (e.g. free text "two nurses and a doctor").
 */
export function parseRequirements(
  raw: string,
): Record<Profession, number> | null {
  const counts: Record<Profession, number> = {
    doctor: 0,
    nurse: 0,
    receptionist: 0,
  };

  const parts = raw
    .trim()
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  for (const part of parts) {
    const m = part.match(/^([a-z]+)=(\d+)$/i);
    if (!m) return null; // not key=int -> unparseable

    const profession = REQUIREMENT_KEYS[m[1].toLowerCase()];
    if (!profession) return null; // unknown key
    counts[profession] = Number(m[2]);
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Row cleaning
// ---------------------------------------------------------------------------

export type RawStaffRow = {
  staff_id?: string;
  full_name?: string;
  role?: string;
  email?: string;
};

export function cleanStaffRow(row: RawStaffRow): StaffRowResult {
  const name = (row.full_name ?? "").trim().replace(/\s+/g, " ");
  if (!name) return { action: "rejected", reason: "Missing name" };

  const rawEmail = (row.email ?? "").trim();
  if (!rawEmail) return { action: "rejected", reason: "Missing email" };

  // Repair the one known obfuscation, then validate.
  const repaired = rawEmail.replace(/\(at\)/gi, "@");
  const email = repaired.toLowerCase();
  const wasRepaired = repaired !== rawEmail;
  if ((email.match(/@/g) ?? []).length !== 1) {
    return { action: "rejected", reason: `Invalid email: "${rawEmail}"` };
  }

  const profession = normalizeProfession(row.role ?? "");
  if (!profession) {
    return {
      action: "rejected",
      reason: `Unknown profession: "${(row.role ?? "").trim()}"`,
    };
  }

  const externalId = (row.staff_id ?? "").trim() || null;
  const value = { externalId, email, name, profession };

  return wasRepaired
    ? { action: "repaired", value, reason: `Email repaired from "${rawEmail}"` }
    : { action: "accepted", value };
}

export type RawShiftRow = {
  shift_id?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  requirements?: string;
};

export function cleanShiftRow(row: RawShiftRow): ShiftRowResult {
  const externalId = (row.shift_id ?? "").trim();
  if (!externalId) return { action: "rejected", reason: "Missing shift id" };

  const date = parseFlexibleDate(row.date ?? "");
  if (!date) {
    return { action: "rejected", reason: `Invalid date: "${(row.date ?? "").trim()}"` };
  }

  const start = parseFlexibleTime(row.start_time ?? "");
  if (!start) {
    return {
      action: "rejected",
      reason: `Invalid start time: "${(row.start_time ?? "").trim()}"`,
    };
  }
  const end = parseFlexibleTime(row.end_time ?? "");
  if (!end) {
    return {
      action: "rejected",
      reason: `Invalid end time: "${(row.end_time ?? "").trim()}"`,
    };
  }

  // Equal same-day times are a zero-length (impossible) shift.
  if (start.time === end.time && !end.nextDay) {
    return {
      action: "rejected",
      reason: `Impossible time: starts and ends at ${start.time}`,
    };
  }

  const requirements = parseRequirements(row.requirements ?? "");
  if (!requirements) {
    return {
      action: "rejected",
      reason: `Unparseable requirements: "${(row.requirements ?? "").trim()}"`,
    };
  }
  const total =
    requirements.doctor + requirements.nurse + requirements.receptionist;
  if (total === 0) {
    return { action: "rejected", reason: "No staffing requirements" };
  }

  const { startsAt, endsAt } = computeShiftInstants(
    date,
    start.time,
    end.time,
    end.nextDay,
  );

  const value: CleanShift = { externalId, startsAt, endsAt, requirements };
  return { action: "accepted", value };
}
