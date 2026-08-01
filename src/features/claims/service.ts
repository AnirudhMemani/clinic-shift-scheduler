import { and, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { type Claim, claims, shiftRequirements, shifts, users } from "@/db/schema";

/**
 * Claim service — the single, shared enforcement point for the business rules,
 * used by staff self-claims, manager assignments, AND shift-edit re-validation.
 *
 * Concurrency model (the crux of the brief):
 * Every claim runs in a transaction that locks the **user row then the shift
 * row** with `SELECT ... FOR UPDATE`, always in that order.
 *   - Locking the shift row serializes all claims to a shift, so the
 *     per-profession capacity count can't be read stale by two racers.
 *   - Locking the user row serializes a single user's claims, so they can't
 *     win two overlapping shifts at once.
 *   - The fixed user-before-shift order means no lock-ordering cycle, so no
 *     deadlock. This is why the DB client uses the Neon WebSocket Pool driver
 *     (interactive transactions), not the HTTP driver.
 */

export type ClaimErrorCode =
  | "not_found"
  | "forbidden"
  | "duplicate"
  | "capacity"
  | "overlap";

export class ClaimError extends Error {
  constructor(
    public readonly code: ClaimErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ClaimError";
  }
}

export type ClaimOutcome =
  | { ok: true; claim: Claim }
  | { ok: false; code: ClaimErrorCode; message: string };

export type ClaimInput = {
  userId: string;
  shiftId: string;
  /** The manager who assigned this person, or null/undefined for a self-claim. */
  assignedById?: string | null;
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Core claim logic. MUST run inside a transaction. Throws `ClaimError` on any
 * rule violation (rolling the transaction back and releasing the locks).
 */
async function executeClaim(tx: Tx, input: ClaimInput): Promise<Claim> {
  const { userId, shiftId, assignedById } = input;

  // 1. Lock the user row first (consistent order → deadlock-free).
  const [user] = await tx
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .for("update");
  if (!user) {
    throw new ClaimError("not_found", "That staff member no longer exists.");
  }
  if (user.role !== "staff" || !user.profession) {
    throw new ClaimError(
      "forbidden",
      "Only staff can be assigned to shifts.",
    );
  }
  const profession = user.profession;

  // 2. Then lock the shift row.
  const [shift] = await tx
    .select()
    .from(shifts)
    .where(eq(shifts.id, shiftId))
    .for("update");
  if (!shift) {
    throw new ClaimError("not_found", "That shift no longer exists.");
  }

  // 3. Already claimed by this person? (Also guarded by a unique constraint.)
  const [duplicate] = await tx
    .select({ id: claims.id })
    .from(claims)
    .where(and(eq(claims.shiftId, shiftId), eq(claims.userId, userId)));
  if (duplicate) {
    throw new ClaimError(
      "duplicate",
      "This shift is already claimed by this person.",
    );
  }

  // 4. Capacity: enough of this profession already? (Count is accurate because
  //    we hold the shift lock — no concurrent claim to this shift can commit.)
  const [requirement] = await tx
    .select({ requiredCount: shiftRequirements.requiredCount })
    .from(shiftRequirements)
    .where(
      and(
        eq(shiftRequirements.shiftId, shiftId),
        eq(shiftRequirements.profession, profession),
      ),
    );
  const required = requirement?.requiredCount ?? 0;

  const [{ filled }] = await tx
    .select({ filled: sql<number>`count(*)::int` })
    .from(claims)
    .innerJoin(users, eq(claims.userId, users.id))
    .where(and(eq(claims.shiftId, shiftId), eq(users.profession, profession)));

  if (filled >= required) {
    throw new ClaimError(
      "capacity",
      required === 0
        ? `This shift doesn't need a ${profession}.`
        : `This shift already has enough ${profession}s (${filled} of ${required} filled).`,
    );
  }

  // 5. Overlap: does this person already hold another shift overlapping this
  //    time window? (Accurate because we hold the user lock.)
  const [conflict] = await tx
    .select({ startsAt: shifts.startsAt, endsAt: shifts.endsAt })
    .from(claims)
    .innerJoin(shifts, eq(claims.shiftId, shifts.id))
    .where(
      and(
        eq(claims.userId, userId),
        ne(claims.shiftId, shiftId),
        lt(shifts.startsAt, shift.endsAt),
        gt(shifts.endsAt, shift.startsAt),
      ),
    )
    .limit(1);
  if (conflict) {
    throw new ClaimError(
      "overlap",
      "This overlaps another shift this person has already claimed.",
    );
  }

  // 6. All clear — record the claim.
  const [claim] = await tx
    .insert(claims)
    .values({ shiftId, userId, assignedById: assignedById ?? null })
    .returning();
  return claim;
}

/**
 * Claim a shift for a user, enforcing all business rules atomically. Returns a
 * typed outcome instead of throwing for expected rule violations.
 */
export async function claimShift(input: ClaimInput): Promise<ClaimOutcome> {
  try {
    const claim = await db.transaction((tx) => executeClaim(tx, input));
    return { ok: true, claim };
  } catch (error) {
    if (error instanceof ClaimError) {
      return { ok: false, code: error.code, message: error.message };
    }
    throw error;
  }
}

/** Release a user's claim on a shift. Returns true if a claim was removed. */
export async function releaseClaim(input: {
  shiftId: string;
  userId: string;
}): Promise<boolean> {
  const deleted = await db
    .delete(claims)
    .where(
      and(eq(claims.shiftId, input.shiftId), eq(claims.userId, input.userId)),
    )
    .returning({ id: claims.id });
  return deleted.length > 0;
}

/**
 * After a shift's time changes, release any claim on it whose owner now overlaps
 * another shift they hold — an overlap is physically impossible, unlike mere
 * over-staffing. Runs inside the shift-update transaction. Returns released user
 * ids. (Capacity is intentionally NOT re-validated: over-staffing is allowed and
 * kept, per the edit policy.)
 */
export async function releaseOverlappingClaims(
  tx: Tx,
  shiftId: string,
  startsAt: string,
  endsAt: string,
): Promise<string[]> {
  const otherClaims = alias(claims, "other_claims");
  const otherShifts = alias(shifts, "other_shifts");

  const conflicting = await tx
    .selectDistinct({ userId: claims.userId })
    .from(claims)
    .innerJoin(
      otherClaims,
      and(
        eq(otherClaims.userId, claims.userId),
        ne(otherClaims.shiftId, shiftId),
      ),
    )
    .innerJoin(otherShifts, eq(otherShifts.id, otherClaims.shiftId))
    .where(
      and(
        eq(claims.shiftId, shiftId),
        lt(otherShifts.startsAt, endsAt),
        gt(otherShifts.endsAt, startsAt),
      ),
    );

  const userIds = conflicting.map((row) => row.userId);
  if (userIds.length === 0) return [];

  await tx
    .delete(claims)
    .where(and(eq(claims.shiftId, shiftId), inArray(claims.userId, userIds)));
  return userIds;
}

/** Staff available to be assigned, ordered by name (for the manager UI). */
export async function listStaff() {
  return db
    .select({
      id: users.id,
      name: users.name,
      profession: users.profession,
    })
    .from(users)
    .where(eq(users.role, "staff"))
    .orderBy(users.name);
}
