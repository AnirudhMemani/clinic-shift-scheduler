import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { shiftRequirements, shifts } from "@/db/schema";
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
 * NOTE: re-validating existing claims when a shift's time changes (releasing a
 * claimant who would now overlap another of their shifts) is added in
 * `feat/claiming`, alongside the shared validation engine and real claim data.
 * Until then, edits preserve claims and deletes cascade them (FK `onDelete`).
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

/** Update a shift and replace its requirement set. Returns null if not found. */
export async function updateShift(shiftId: string, input: ShiftInput) {
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
    return shift;
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

/** All shifts, earliest first, with their requirement rows. */
export async function listShifts() {
  return db.query.shifts.findMany({
    with: { requirements: true },
    orderBy: [asc(shifts.startsAt)],
  });
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
