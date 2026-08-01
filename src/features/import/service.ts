import { desc, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  type ImportSummary,
  importBatches,
  importIssues,
  shiftRequirements,
  shifts,
  users,
} from "@/db/schema";
import { PROFESSIONS } from "@/features/shifts/validation";

import type { ImportPlan } from "./types";

/**
 * Execute an ImportPlan against the database and persist a report, all in one
 * transaction. Idempotent: staff upsert by email, shifts by external_id, so
 * re-running the seed or re-uploading the same CSV updates instead of
 * duplicating. (Bulk-load semantics — it does not re-validate existing claims on
 * a shift whose time changes; that's handled by the manual edit flow.)
 */
export async function runImport(params: {
  plan: ImportPlan;
  source: "seed" | "upload";
  filename?: string | null;
  /** Password hash assigned to newly-imported staff (existing keep theirs). */
  defaultPasswordHash: string;
}): Promise<{ batchId: string; summary: ImportSummary }> {
  const { plan, source, filename, defaultPasswordHash } = params;

  return db.transaction(async (tx) => {
    // --- Staff: upsert by email, never clobbering an existing password ---
    if (plan.staff.accepted.length > 0) {
      await tx
        .insert(users)
        .values(
          plan.staff.accepted.map((s) => ({
            email: s.email,
            name: s.name,
            profession: s.profession,
            role: "staff" as const,
            passwordHash: defaultPasswordHash,
          })),
        )
        .onConflictDoUpdate({
          target: users.email,
          set: {
            name: sql`excluded.name`,
            profession: sql`excluded.profession`,
          },
        });
    }

    // --- Shifts: upsert by external_id, then replace requirement rows ---
    if (plan.shifts.accepted.length > 0) {
      const upserted = await tx
        .insert(shifts)
        .values(
          plan.shifts.accepted.map((s) => ({
            externalId: s.externalId,
            startsAt: s.startsAt,
            endsAt: s.endsAt,
          })),
        )
        .onConflictDoUpdate({
          target: shifts.externalId,
          set: {
            startsAt: sql`excluded.starts_at`,
            endsAt: sql`excluded.ends_at`,
            updatedAt: sql`now()`,
          },
        })
        .returning({ id: shifts.id, externalId: shifts.externalId });

      const idByExternal = new Map(
        upserted.map((r) => [r.externalId, r.id] as const),
      );

      // Replace the requirement set for every upserted shift.
      const shiftIds = [...idByExternal.values()];
      await tx
        .delete(shiftRequirements)
        .where(inArray(shiftRequirements.shiftId, shiftIds));

      const requirementRows = plan.shifts.accepted.flatMap((s) => {
        const shiftId = idByExternal.get(s.externalId);
        if (!shiftId) return [];
        return PROFESSIONS.filter((p) => s.requirements[p] > 0).map((p) => ({
          shiftId,
          profession: p,
          requiredCount: s.requirements[p],
        }));
      });
      if (requirementRows.length > 0) {
        await tx.insert(shiftRequirements).values(requirementRows);
      }
    }

    // --- Persist the report ---
    const summary: ImportSummary = {
      staff: plan.staff.counts,
      shifts: plan.shifts.counts,
    };
    const [batch] = await tx
      .insert(importBatches)
      .values({ source, filename: filename ?? null, summary })
      .returning({ id: importBatches.id });

    const issueRows = [...plan.staff.issues, ...plan.shifts.issues].map((i) => ({
      batchId: batch.id,
      entity: i.entity,
      action: i.action,
      raw: i.raw,
      reason: i.reason,
    }));
    if (issueRows.length > 0) {
      await tx.insert(importIssues).values(issueRows);
    }

    return { batchId: batch.id, summary };
  });
}

/** The most recent import run with its issues, for the Import Report page. */
export async function getLatestImportBatch() {
  return db.query.importBatches.findFirst({
    orderBy: [desc(importBatches.createdAt)],
    with: { issues: true },
  });
}
