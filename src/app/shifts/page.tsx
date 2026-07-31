import Link from "next/link";

import { requireManager } from "@/auth/guards";
import { DeleteShiftButton } from "@/features/shifts/components/delete-shift-button";
import { formatRequirements, formatShiftWhen } from "@/features/shifts/format";
import { listShifts } from "@/features/shifts/service";

export default async function ShiftsPage() {
  await requireManager();
  const shifts = await listShifts();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Shifts</h1>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Create and manage clinic shifts.
          </p>
        </div>
        <Link
          href="/shifts/new"
          className="shrink-0 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          New shift
        </Link>
      </div>

      {shifts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/15 px-6 py-16 text-center text-sm text-black/50 dark:border-white/20 dark:text-white/50">
          No shifts yet. Create the first one.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {shifts.map((shift) => (
            <li
              key={shift.id}
              className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/15"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {formatShiftWhen(shift.startsAt, shift.endsAt)}
                </p>
                <p className="mt-0.5 text-sm text-black/60 dark:text-white/60">
                  {formatRequirements(shift.requirements)}
                </p>
                {shift.notes ? (
                  <p className="mt-1 text-sm text-black/50 dark:text-white/50">
                    {shift.notes}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/shifts/${shift.id}/edit`}
                  className="rounded-md border border-black/15 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                >
                  Edit
                </Link>
                <DeleteShiftButton shiftId={shift.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
