import { notFound } from "next/navigation";

import { requireManager } from "@/auth/guards";
import { updateShiftAction } from "@/features/shifts/actions";
import {
  ShiftForm,
  type ShiftFormDefaults,
} from "@/features/shifts/components/shift-form";
import { getShiftById } from "@/features/shifts/service";
import { PROFESSIONS } from "@/features/shifts/validation";
import { splitInstant } from "@/lib/time";

export default async function EditShiftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireManager();
  const { id } = await params;

  const shift = await getShiftById(id);
  if (!shift) notFound();

  const start = splitInstant(shift.startsAt);
  const end = splitInstant(shift.endsAt);

  const requirements = Object.fromEntries(
    PROFESSIONS.map((profession) => [
      profession,
      shift.requirements.find((r) => r.profession === profession)
        ?.requiredCount ?? 0,
    ]),
  ) as ShiftFormDefaults["requirements"];

  const defaults: ShiftFormDefaults = {
    date: start.date,
    startTime: start.time,
    endTime: end.time,
    requirements,
    notes: shift.notes ?? "",
  };

  // Bind the shift id so the form's action keeps the (state, formData) shape.
  const action = updateShiftAction.bind(null, shift.id);

  return (
    <main className="mx-auto max-w-lg px-6 py-10">
      <h1 className="mb-8 text-2xl font-semibold">Edit shift</h1>
      <ShiftForm action={action} submitLabel="Save changes" defaults={defaults} />
    </main>
  );
}
