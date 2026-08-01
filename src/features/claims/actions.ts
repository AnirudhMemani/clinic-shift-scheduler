"use server";

import { revalidatePath } from "next/cache";

import { requireManager, requireStaff } from "@/auth/guards";

import { claimShift, releaseClaim } from "./service";

export type ClaimActionState = { error?: string };

/**
 * Staff self-claim. The user id comes from the session, never the client, so a
 * staff member can only ever claim for themselves.
 */
export async function claimAction(
  shiftId: string,
  _prevState: ClaimActionState,
  _formData: FormData,
): Promise<ClaimActionState> {
  const user = await requireStaff();

  const outcome = await claimShift({ userId: user.id, shiftId });
  if (!outcome.ok) return { error: outcome.message };

  revalidatePath("/shifts");
  return {};
}

/** Staff release their own claim. */
export async function unclaimAction(formData: FormData): Promise<void> {
  const user = await requireStaff();

  const shiftId = formData.get("shiftId");
  if (typeof shiftId === "string" && shiftId.length > 0) {
    await releaseClaim({ shiftId, userId: user.id });
    revalidatePath("/shifts");
  }
}

/**
 * Manager assigns a specific staff member. The same business rules apply — a
 * manager cannot over-fill a profession or create an overlap.
 */
export async function assignAction(
  shiftId: string,
  _prevState: ClaimActionState,
  formData: FormData,
): Promise<ClaimActionState> {
  const manager = await requireManager();

  const userId = formData.get("userId");
  if (typeof userId !== "string" || userId.length === 0) {
    return { error: "Choose a staff member to assign." };
  }

  const outcome = await claimShift({
    userId,
    shiftId,
    assignedById: manager.id,
  });
  if (!outcome.ok) return { error: outcome.message };

  revalidatePath("/shifts");
  return {};
}

/** Manager removes anyone's claim. */
export async function removeClaimAction(formData: FormData): Promise<void> {
  await requireManager();

  const shiftId = formData.get("shiftId");
  const userId = formData.get("userId");
  if (
    typeof shiftId === "string" &&
    shiftId.length > 0 &&
    typeof userId === "string" &&
    userId.length > 0
  ) {
    await releaseClaim({ shiftId, userId });
    revalidatePath("/shifts");
  }
}
