import { and, eq, inArray } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";

import { db } from "@/db";
import { claims, shifts, users } from "@/db/schema";
import { createShift, updateShift } from "@/features/shifts/service";

import { claimShift, releaseClaim } from "./service";

/**
 * Integration tests against the real database. Focused on the concurrency and
 * business-rule guarantees that unit tests can't cover. Run: pnpm test:integration
 */

const createdShiftIds: string[] = [];
const createdUserIds: string[] = [];

async function makeNurse(tag: string) {
  const [user] = await db
    .insert(users)
    .values({
      email: `it-${tag}-${createdUserIds.length}@clinic.test`,
      name: `IT Nurse ${tag}`,
      passwordHash: "x",
      role: "staff",
      profession: "nurse",
    })
    .returning();
  createdUserIds.push(user.id);
  return user.id;
}

async function makeShift(
  date: string,
  startTime: string,
  endTime: string,
  nurse = 1,
) {
  const shift = await createShift({
    date,
    startTime,
    endTime,
    requirements: { doctor: 0, nurse, receptionist: 0 },
  });
  createdShiftIds.push(shift.id);
  return shift.id;
}

afterEach(async () => {
  if (createdShiftIds.length)
    await db.delete(shifts).where(inArray(shifts.id, createdShiftIds.splice(0)));
  if (createdUserIds.length)
    await db.delete(users).where(inArray(users.id, createdUserIds.splice(0)));
});

it("lets only ONE of two simultaneous claims take the last slot", async () => {
  const shiftId = await makeShift("2026-09-01", "09:00", "17:00", 1);
  const [n1, n2] = await Promise.all([makeNurse("a"), makeNurse("b")]);

  // Fire both claims at the same time — the row lock must serialize them.
  const [r1, r2] = await Promise.all([
    claimShift({ userId: n1, shiftId }),
    claimShift({ userId: n2, shiftId }),
  ]);

  const succeeded = [r1, r2].filter((r) => r.ok);
  const failed = [r1, r2].filter((r) => !r.ok);
  expect(succeeded).toHaveLength(1);
  expect(failed).toHaveLength(1);
  expect(failed[0].ok === false && failed[0].code).toBe("capacity");

  const rows = await db.select().from(claims).where(eq(claims.shiftId, shiftId));
  expect(rows).toHaveLength(1); // never over capacity
});

it("rejects a claim that overlaps another shift the user holds", async () => {
  const nurse = await makeNurse("ov");
  const shiftA = await makeShift("2026-09-02", "09:00", "17:00");
  const shiftB = await makeShift("2026-09-02", "16:00", "20:00"); // overlaps 16-17

  expect((await claimShift({ userId: nurse, shiftId: shiftA })).ok).toBe(true);

  const second = await claimShift({ userId: nurse, shiftId: shiftB });
  expect(second.ok).toBe(false);
  expect(second.ok === false && second.code).toBe("overlap");
});

it("allows back-to-back shifts (no overlap at the boundary)", async () => {
  const nurse = await makeNurse("b2b");
  const shiftA = await makeShift("2026-09-03", "09:00", "13:00");
  const shiftB = await makeShift("2026-09-03", "13:00", "17:00");

  expect((await claimShift({ userId: nurse, shiftId: shiftA })).ok).toBe(true);
  expect((await claimShift({ userId: nurse, shiftId: shiftB })).ok).toBe(true);
});

it("releases a now-overlapping claim when a shift's time is edited", async () => {
  const nurse = await makeNurse("rev");
  const shiftA = await makeShift("2026-09-04", "09:00", "12:00");
  const shiftB = await makeShift("2026-09-04", "13:00", "16:00");

  await claimShift({ userId: nurse, shiftId: shiftA });
  await claimShift({ userId: nurse, shiftId: shiftB });

  // Move B to 11:00-14:00 so it now overlaps A (09:00-12:00).
  const result = await updateShift(shiftB, {
    date: "2026-09-04",
    startTime: "11:00",
    endTime: "14:00",
    requirements: { doctor: 0, nurse: 1, receptionist: 0 },
  });
  expect(result?.releasedCount).toBe(1);

  // The claim on B is gone; the claim on A survives.
  const onB = await db.select().from(claims).where(eq(claims.shiftId, shiftB));
  const onA = await db.select().from(claims).where(eq(claims.shiftId, shiftA));
  expect(onB).toHaveLength(0);
  expect(onA).toHaveLength(1);
});

it("releaseClaim frees a slot so it can be re-claimed", async () => {
  const shiftId = await makeShift("2026-09-05", "09:00", "17:00", 1);
  const n1 = await makeNurse("rc1");
  const n2 = await makeNurse("rc2");

  expect((await claimShift({ userId: n1, shiftId })).ok).toBe(true);
  // Full now — n2 rejected.
  expect((await claimShift({ userId: n2, shiftId })).ok).toBe(false);
  // n1 releases; n2 can take it.
  await releaseClaim({ shiftId, userId: n1 });
  expect((await claimShift({ userId: n2, shiftId })).ok).toBe(true);

  const rows = await db
    .select()
    .from(claims)
    .where(and(eq(claims.shiftId, shiftId)));
  expect(rows).toHaveLength(1);
});
