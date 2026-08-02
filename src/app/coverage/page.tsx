import Link from "next/link";

import { requireManager } from "@/auth/guards";
import { WeekNav } from "@/features/coverage/components/week-nav";
import {
  buildWeek,
  formatMissing,
  formatWeekRange,
  groupShiftsByDay,
  resolveWeekStart,
  WEEK_LENGTH,
} from "@/features/coverage/week";
import { formatShiftTimeRange } from "@/features/shifts/format";
import { getShiftDateBounds, listShiftsInRange } from "@/features/shifts/service";
import {
  computeStaffing,
  type StaffingStatus,
} from "@/features/shifts/staffing";
import { addDays, startOfWeek } from "@/lib/time";

export const dynamic = "force-dynamic";

const STATUS_DOT: Record<StaffingStatus, string> = {
  empty: "bg-red-500",
  partial: "bg-amber-500",
  full: "bg-emerald-500",
};

const STATUS_CARD: Record<StaffingStatus, string> = {
  empty: "border-red-500/30 bg-red-500/[0.03]",
  partial: "border-amber-500/30 bg-amber-500/[0.03]",
  full: "border-emerald-500/30 bg-emerald-500/[0.03]",
};

/** UTC "today". Shift times are timezone-naive, so a fixed zone keeps the
 *  default week deterministic regardless of where the server runs. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function CoveragePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  await requireManager();

  const [{ week }, bounds] = await Promise.all([searchParams, getShiftDateBounds()]);

  const today = todayUtc();
  const weekStart = resolveWeekStart(week, today, bounds);
  const weekEnd = addDays(weekStart, WEEK_LENGTH); // exclusive

  const shifts = await listShiftsInRange(weekStart, weekEnd);

  const staffed = shifts.map((shift) => ({
    shift,
    staffing: computeStaffing(shift.requirements, shift.claims),
  }));
  const byDay = groupShiftsByDay(staffed.map((s) => ({ ...s, startsAt: s.shift.startsAt })));
  const days = buildWeek(weekStart);

  const tally: Record<StaffingStatus, number> = { full: 0, partial: 0, empty: 0 };
  for (const { staffing } of staffed) tally[staffing.status]++;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Coverage</h1>
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              Week at a glance — {formatWeekRange(weekStart)}
            </p>
          </div>
          <Link
            href="/shifts"
            className="shrink-0 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Manage shifts
          </Link>
        </div>

        <WeekNav
          weekStart={weekStart}
          prevWeek={addDays(weekStart, -WEEK_LENGTH)}
          nextWeek={addDays(weekStart, WEEK_LENGTH)}
          todayWeek={startOfWeek(today)}
        />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
          <SummaryStat status="full" label="fully staffed" count={tally.full} />
          <SummaryStat status="partial" label="partial" count={tally.partial} />
          <SummaryStat status="empty" label="empty" count={tally.empty} />
          <span className="text-black/45 dark:text-white/45">
            {shifts.length} shift{shifts.length === 1 ? "" : "s"} this week
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((day) => {
          const items = byDay.get(day.date) ?? [];
          const isToday = day.date === today;
          return (
            <section
              key={day.date}
              className={`flex flex-col gap-2 rounded-lg border p-2.5 ${
                isToday
                  ? "border-foreground/30 bg-black/[0.02] dark:bg-white/[0.03]"
                  : "border-black/10 dark:border-white/10"
              }`}
            >
              <header className="flex items-baseline justify-between px-0.5">
                <span className="text-sm font-medium">{day.weekday}</span>
                <span className="text-xs text-black/45 dark:text-white/45">
                  {day.label}
                </span>
              </header>

              {items.length === 0 ? (
                <p className="px-0.5 py-3 text-xs text-black/30 dark:text-white/30">
                  No shifts
                </p>
              ) : (
                items.map(({ shift, staffing }) => (
                  <article
                    key={shift.id}
                    className={`rounded-md border p-2 ${STATUS_CARD[staffing.status]}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[staffing.status]}`}
                        aria-hidden
                      />
                      <span className="text-sm font-medium tabular-nums">
                        {formatShiftTimeRange(shift.startsAt, shift.endsAt)}
                      </span>
                    </div>

                    <ul className="mt-1.5 flex flex-wrap gap-1 text-xs">
                      {staffing.byProfession.map((p) => {
                        const met = p.filled >= p.required;
                        return (
                          <li
                            key={p.profession}
                            className={`rounded px-1.5 py-0.5 capitalize ${
                              met
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            }`}
                            title={`${p.profession}: ${p.filled} of ${p.required}`}
                          >
                            {p.profession.slice(0, 3)} {p.filled}/{p.required}
                          </li>
                        );
                      })}
                    </ul>

                    {staffing.status !== "full" ? (
                      <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                        Missing {formatMissing(staffing.missing)}
                      </p>
                    ) : null}
                  </article>
                ))
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}

function SummaryStat({
  status,
  label,
  count,
}: {
  status: StaffingStatus;
  label: string;
  count: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} aria-hidden />
      <span className="font-medium tabular-nums">{count}</span>
      <span className="text-black/55 dark:text-white/55">{label}</span>
    </span>
  );
}
