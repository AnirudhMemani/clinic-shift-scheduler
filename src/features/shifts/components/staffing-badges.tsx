import type { ShiftStaffing } from "../staffing";

const STATUS_LABEL = {
  empty: "Empty",
  partial: "Partially staffed",
  full: "Fully staffed",
} as const;

const STATUS_DOT = {
  empty: "bg-red-500",
  partial: "bg-amber-500",
  full: "bg-emerald-500",
} as const;

/** A status dot + per-profession "filled/required" chips. */
export function StaffingBadges({ staffing }: { staffing: ShiftStaffing }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
      <span className="inline-flex items-center gap-1.5 font-medium">
        <span
          className={`h-2 w-2 rounded-full ${STATUS_DOT[staffing.status]}`}
          aria-hidden
        />
        {STATUS_LABEL[staffing.status]}
      </span>
      {staffing.byProfession.map((p) => {
        const met = p.filled >= p.required;
        return (
          <span
            key={p.profession}
            className={`rounded-full px-2 py-0.5 capitalize ${
              met
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
            }`}
          >
            {p.profession} {p.filled}/{p.required}
          </span>
        );
      })}
    </div>
  );
}
