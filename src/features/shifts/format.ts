import type { Profession, ShiftRequirement } from "@/db/schema";
import { splitInstant } from "@/lib/time";

/** "2026-08-28" -> "Fri, Aug 28, 2026", formatted in UTC to stay tz-neutral. */
export function formatShiftDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

/** e.g. "Fri, Aug 28, 2026 · 22:00–06:00 (+1)". */
export function formatShiftWhen(startsAt: string, endsAt: string): string {
  const start = splitInstant(startsAt);
  const end = splitInstant(endsAt);
  const overnight = end.date !== start.date;
  return `${formatShiftDate(start.date)} · ${start.time}–${end.time}${
    overnight ? " (+1)" : ""
  }`;
}

const PROFESSION_LABEL: Record<Profession, string> = {
  doctor: "doctor",
  nurse: "nurse",
  receptionist: "receptionist",
};

/** "1 doctor, 2 nurses" from requirement rows; "No requirements" if empty. */
export function formatRequirements(
  requirements: Pick<ShiftRequirement, "profession" | "requiredCount">[],
): string {
  if (requirements.length === 0) return "No requirements";
  return requirements
    .map((r) => {
      const label = PROFESSION_LABEL[r.profession];
      return `${r.requiredCount} ${label}${r.requiredCount === 1 ? "" : "s"}`;
    })
    .join(", ");
}
