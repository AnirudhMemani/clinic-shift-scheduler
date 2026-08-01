import Link from "next/link";

import { requireUser } from "@/auth/guards";
import { ManagerShiftControls } from "@/features/claims/components/manager-shift-controls";
import { StaffClaimControls } from "@/features/claims/components/staff-claim-controls";
import { listStaff } from "@/features/claims/service";
import { DeleteShiftButton } from "@/features/shifts/components/delete-shift-button";
import { StaffingBadges } from "@/features/shifts/components/staffing-badges";
import { formatRequirements, formatShiftWhen } from "@/features/shifts/format";
import { listShifts } from "@/features/shifts/service";
import { computeStaffing } from "@/features/shifts/staffing";

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ released?: string }>;
}) {
  const user = await requireUser();
  const isManager = user.role === "manager";

  const [shifts, staff, params] = await Promise.all([
    listShifts(),
    isManager ? listStaff() : Promise.resolve([]),
    searchParams,
  ]);
  const releasedCount = Number(params.released) || 0;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Shifts</h1>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            {isManager
              ? "Create shifts and assign staff."
              : "Claim shifts that need your profession."}
          </p>
        </div>
        {isManager ? (
          <Link
            href="/shifts/new"
            className="shrink-0 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            New shift
          </Link>
        ) : null}
      </div>

      {releasedCount > 0 ? (
        <p className="mb-6 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300">
          {releasedCount} claim{releasedCount === 1 ? "" : "s"} released — the new
          shift time overlapped another shift the person had claimed.
        </p>
      ) : null}

      {shifts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/15 px-6 py-16 text-center text-sm text-black/50 dark:border-white/20 dark:text-white/50">
          No shifts yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {shifts.map((shift) => {
            const staffing = computeStaffing(shift.requirements, shift.claims);

            // Staff-facing eligibility (server still enforces on claim).
            const claimed = shift.claims.some((c) => c.user.id === user.id);
            const mine = staffing.byProfession.find(
              (p) => p.profession === user.profession,
            );
            const claimable = !claimed && !!mine && mine.filled < mine.required;
            const reason = !mine
              ? `Not needed for ${user.profession ?? "your role"}s`
              : mine.filled >= mine.required
                ? `${user.profession}s fully staffed`
                : undefined;

            // Manager-facing assignment options.
            const claimants = shift.claims.map((c) => ({
              userId: c.user.id,
              name: c.user.name,
              profession: c.user.profession,
            }));
            const needed = new Set(staffing.missing.map((m) => m.profession));
            const assignableStaff = staff.filter(
              (s) =>
                s.profession &&
                needed.has(s.profession) &&
                !claimants.some((c) => c.userId === s.id),
            );

            return (
              <li
                key={shift.id}
                className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/15"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <p className="font-medium">
                      {formatShiftWhen(shift.startsAt, shift.endsAt)}
                    </p>
                    <p className="text-sm text-black/60 dark:text-white/60">
                      {formatRequirements(shift.requirements)}
                    </p>
                    <StaffingBadges staffing={staffing} />
                    {shift.notes ? (
                      <p className="text-sm text-black/50 dark:text-white/50">
                        {shift.notes}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {isManager ? (
                      <>
                        <Link
                          href={`/shifts/${shift.id}/edit`}
                          className="rounded-md border border-black/15 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                        >
                          Edit
                        </Link>
                        <DeleteShiftButton shiftId={shift.id} />
                      </>
                    ) : (
                      <StaffClaimControls
                        shiftId={shift.id}
                        claimed={claimed}
                        claimable={claimable}
                        reason={reason}
                      />
                    )}
                  </div>
                </div>

                {isManager ? (
                  <div className="border-t border-black/10 pt-3 dark:border-white/10">
                    <ManagerShiftControls
                      shiftId={shift.id}
                      claimants={claimants}
                      assignableStaff={assignableStaff}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
