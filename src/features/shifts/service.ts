import { and, asc, eq, gte, lt, max, min } from "drizzle-orm";

import { db } from "@/db";
import { shiftRequirements, shifts } from "@/db/schema";
import { releaseOverlappingClaims } from "@/features/claims/service";
import { computeShiftInstants } from "@/lib/time";

import {
  PROFESSIONS,
  type ShiftInput,
  type ShiftRequirementCounts,
} from "./validation";

/**
 * Shift service — the single place shift writes happen, each wrapped in a
 * transaction so a shift and its requirement rows are always consistent.
 *
 * On edit, existing claims are preserved (reducing a requirement just leaves the
 * shift over-staffed) EXCEPT that a time change re-validates overlaps: any
 * claimant who would now be double-booked is released inside the same
 * transaction via `releaseOverlappingClaims`. Deletes cascade claims (FK).
 */

/** Build requirement rows for the professions that need at least one person. */
function requirementRows(shiftId: string, counts: ShiftRequirementCounts) {
  return PROFESSIONS.filter((profession) => counts[profession] > 0).map(
    (profession) => ({
      shiftId,
      profession,
      requiredCount: counts[profession],
    }),
  );
}

export async function createShift(input: ShiftInput) {
  const { startsAt, endsAt } = computeShiftInstants(
    input.date,
    input.startTime,
    input.endTime,
  );

  return db.transaction(async (tx) => {
    const [shift] = await tx
      .insert(shifts)
      .values({ startsAt, endsAt, notes: input.notes ?? null })
      .returning();

    const rows = requirementRows(shift.id, input.requirements);
    if (rows.length > 0) {
      await tx.insert(shiftRequirements).values(rows);
    }
    return shift;
  });
}

export type UpdateShiftResult = {
  shift: typeof shifts.$inferSelect;
  /** Number of claims released because the new time overlapped another shift. */
  releasedCount: number;
};

/**
 * Update a shift and replace its requirement set. Re-validates overlaps and
 * releases any now-conflicting claims. Returns null if the shift is not found.
 */
export async function updateShift(
  shiftId: string,
  input: ShiftInput,
): Promise<UpdateShiftResult | null> {
  const { startsAt, endsAt } = computeShiftInstants(
    input.date,
    input.startTime,
    input.endTime,
  );

  return db.transaction(async (tx) => {
    const [shift] = await tx
      .update(shifts)
      .set({ startsAt, endsAt, notes: input.notes ?? null })
      .where(eq(shifts.id, shiftId))
      .returning();

    if (!shift) return null;

    // Simplest correct approach: replace the requirement set wholesale rather
    // than diffing. The set is tiny (<= 3 rows) so this is cheap.
    await tx
      .delete(shiftRequirements)
      .where(eq(shiftRequirements.shiftId, shiftId));

    const rows = requirementRows(shiftId, input.requirements);
    if (rows.length > 0) {
      await tx.insert(shiftRequirements).values(rows);
    }

    // The new time may put a claimant in conflict with another of their shifts.
    const released = await releaseOverlappingClaims(
      tx,
      shiftId,
      startsAt,
      endsAt,
    );
    return { shift, releasedCount: released.length };
  });
}

/** Delete a shift; its requirements and claims cascade. Returns null if absent. */
export async function deleteShift(shiftId: string) {
  const [deleted] = await db
    .delete(shifts)
    .where(eq(shifts.id, shiftId))
    .returning({ id: shifts.id });
  return deleted ?? null;
}

/** Claimant columns exposed to the UI (never the password hash). */
const claimantColumns = {
  with: {
    user: { columns: { id: true, name: true, profession: true } },
  },
} as const;

/** All shifts, earliest first, with requirements and claimants. */
export async function listShifts() {
  return db.query.shifts.findMany({
    with: { requirements: true, claims: claimantColumns },
    orderBy: [asc(shifts.startsAt)],
  });
}

/**
 * Shifts starting within the half-open date window [startDate, endDateExclusive)
 * — both "YYYY-MM-DD" — earliest first, with requirements and claimants. Backs
 * the coverage dashboard's week view (`shifts_starts_at_idx` serves the scan).
 */
export async function listShiftsInRange(
  startDate: string,
  endDateExclusive: string,
) {
  return db.query.shifts.findMany({
    where: and(
      gte(shifts.startsAt, `${startDate} 00:00:00`),
      lt(shifts.startsAt, `${endDateExclusive} 00:00:00`),
    ),
    with: { requirements: true, claims: claimantColumns },
    orderBy: [asc(shifts.startsAt)],
  });
}

/**
 * The earliest and latest shift *dates* ("YYYY-MM-DD"), or null when there are no
 * shifts. Lets the dashboard open on a week that actually has data.
 */
export async function getShiftDateBounds(): Promise<{
  min: string;
  max: string;
} | null> {
  const [row] = await db
    .select({ min: min(shifts.startsAt), max: max(shifts.startsAt) })
    .from(shifts);
  if (!row?.min || !row.max) return null;
  return { min: row.min.slice(0, 10), max: row.max.slice(0, 10) };
}

/** A single shift with its requirements, or undefined. */
export async function getShiftById(shiftId: string) {
  return db.query.shifts.findFirst({
    where: eq(shifts.id, shiftId),
    with: { requirements: true },
  });
}

export type ShiftWithRequirements = Awaited<
  ReturnType<typeof listShifts>
>[number];
