import { requireManager } from "@/auth/guards";
import { createShiftAction } from "@/features/shifts/actions";
import { ShiftForm } from "@/features/shifts/components/shift-form";

export default async function NewShiftPage() {
  await requireManager();

  return (
    <main className="mx-auto max-w-lg px-6 py-10">
      <h1 className="mb-8 text-2xl font-semibold">New shift</h1>
      <ShiftForm action={createShiftAction} submitLabel="Create shift" />
    </main>
  );
}
