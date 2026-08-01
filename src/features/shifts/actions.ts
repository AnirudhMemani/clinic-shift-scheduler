"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireManager } from "@/auth/guards";

import { createShift, deleteShift, updateShift } from "./service";
import { shiftInputSchema } from "./validation";

export type ShiftFormState = {
  errors?: Record<string, string[] | undefined>;
  message?: string;
};

/** Pull the shift fields out of a submitted form into the schema's shape. */
function parseShiftForm(formData: FormData) {
  return shiftInputSchema.safeParse({
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    requirements: {
      doctor: formData.get("doctor") ?? 0,
      nurse: formData.get("nurse") ?? 0,
      receptionist: formData.get("receptionist") ?? 0,
    },
    notes: formData.get("notes") || undefined,
  });
}

export async function createShiftAction(
  _prevState: ShiftFormState,
  formData: FormData,
): Promise<ShiftFormState> {
  await requireManager();

  const parsed = parseShiftForm(formData);
  if (!parsed.success) {
    return {
      errors: z.flattenError(parsed.error).fieldErrors,
      message: "Please fix the highlighted fields.",
    };
  }

  await createShift(parsed.data);
  revalidatePath("/shifts");
  redirect("/shifts");
}

export async function updateShiftAction(
  shiftId: string,
  _prevState: ShiftFormState,
  formData: FormData,
): Promise<ShiftFormState> {
  await requireManager();

  const parsed = parseShiftForm(formData);
  if (!parsed.success) {
    return {
      errors: z.flattenError(parsed.error).fieldErrors,
      message: "Please fix the highlighted fields.",
    };
  }

  const updated = await updateShift(shiftId, parsed.data);
  if (!updated) {
    return { message: "That shift no longer exists." };
  }

  revalidatePath("/shifts");
  // If the new time forced anyone off, tell the manager on the list page.
  redirect(
    updated.releasedCount > 0
      ? `/shifts?released=${updated.releasedCount}`
      : "/shifts",
  );
}

/** Row-level delete. Plain action (no form state needed). */
export async function deleteShiftAction(formData: FormData): Promise<void> {
  await requireManager();

  const shiftId = formData.get("shiftId");
  if (typeof shiftId === "string" && shiftId.length > 0) {
    await deleteShift(shiftId);
    revalidatePath("/shifts");
  }
}
