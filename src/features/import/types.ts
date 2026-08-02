import type { Profession } from "@/db/schema";

/** What happened to a source row during import. */
export type RowAction = "accepted" | "repaired" | "merged" | "rejected";

/** A cleaned staff record ready to upsert. */
export type CleanStaff = {
  externalId: string | null;
  email: string;
  name: string;
  profession: Profession;
};

/** A cleaned shift record ready to upsert (instants already resolved). */
export type CleanShift = {
  externalId: string;
  startsAt: string;
  endsAt: string;
  requirements: Record<Profession, number>;
};

/** Per-row outcome, carrying the cleaned value when the row was kept. */
export type StaffRowResult =
  | { action: "accepted" | "repaired"; value: CleanStaff; reason?: string }
  | { action: "rejected"; reason: string };

export type ShiftRowResult =
  | { action: "accepted"; value: CleanShift }
  | { action: "rejected"; reason: string };

/** A reportable issue: any row that wasn't a clean accept. */
export type RowIssue = {
  entity: "staff" | "shift";
  /** Original row as text, for the Import Report. */
  raw: string;
  action: Exclude<RowAction, "accepted">;
  reason: string;
};

export type EntityPlan<T> = {
  accepted: T[];
  issues: RowIssue[];
  counts: { accepted: number; repaired: number; merged: number; rejected: number };
};

export type ImportPlan = {
  staff: EntityPlan<CleanStaff>;
  shifts: EntityPlan<CleanShift>;
};
