import type { Profession } from "@/db/schema";

import { PROFESSIONS } from "./validation";

export type ProfessionStaffing = {
  profession: Profession;
  required: number;
  filled: number;
};

export type StaffingStatus = "empty" | "partial" | "full";

export type ShiftStaffing = {
  /** One entry per profession the shift requires (requiredCount > 0). */
  byProfession: ProfessionStaffing[];
  status: StaffingStatus;
  /** Professions still short of their requirement. */
  missing: ProfessionStaffing[];
};

/**
 * Compute a shift's staffing from its requirements and current claims. Pure, so
 * it's unit-tested and shared by the claiming UI and the coverage dashboard.
 */
export function computeStaffing(
  requirements: { profession: Profession; requiredCount: number }[],
  claims: { user: { profession: Profession | null } }[],
): ShiftStaffing {
  const filledBy = new Map<Profession, number>();
  for (const claim of claims) {
    const p = claim.user.profession;
    if (p) filledBy.set(p, (filledBy.get(p) ?? 0) + 1);
  }

  const requiredBy = new Map<Profession, number>();
  for (const r of requirements) requiredBy.set(r.profession, r.requiredCount);

  const byProfession: ProfessionStaffing[] = PROFESSIONS.filter(
    (p) => (requiredBy.get(p) ?? 0) > 0,
  ).map((p) => ({
    profession: p,
    required: requiredBy.get(p) ?? 0,
    filled: filledBy.get(p) ?? 0,
  }));

  const missing = byProfession.filter((p) => p.filled < p.required);
  const anyFilled = byProfession.some((p) => p.filled > 0);

  const status: StaffingStatus =
    missing.length === 0 ? "full" : anyFilled ? "partial" : "empty";

  return { byProfession, status, missing };
}
