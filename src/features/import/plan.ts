import Papa from "papaparse";

import {
  type RawShiftRow,
  type RawStaffRow,
  cleanShiftRow,
  cleanStaffRow,
} from "./cleaning";
import type {
  CleanShift,
  CleanStaff,
  EntityPlan,
  ImportPlan,
  RowIssue,
} from "./types";

/**
 * Turn raw CSV text into an ImportPlan: cleaned rows to upsert plus a full list
 * of reportable issues (rejected / merged / repaired). Pure — no DB. The seed
 * and the manager upload both feed their result to the execution service.
 */

function parseCsv<T>(text: string): T[] {
  const result = Papa.parse<T>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return result.data;
}

const rawStaff = (r: RawStaffRow) =>
  [r.staff_id, r.full_name, r.role, r.email].map((x) => x ?? "").join(",");

const rawShift = (r: RawShiftRow) =>
  [r.shift_id, r.date, r.start_time, r.end_time, r.requirements]
    .map((x) => x ?? "")
    .join(",");

export function buildStaffPlan(rows: RawStaffRow[]): EntityPlan<CleanStaff> {
  const accepted: CleanStaff[] = [];
  const issues: RowIssue[] = [];
  const counts = { accepted: 0, repaired: 0, merged: 0, rejected: 0 };
  const seenEmail = new Map<string, string>(); // email -> kept name

  for (const row of rows) {
    const result = cleanStaffRow(row);

    if (result.action === "rejected") {
      counts.rejected++;
      issues.push({ entity: "staff", raw: rawStaff(row), action: "rejected", reason: result.reason });
      continue;
    }

    const kept = seenEmail.get(result.value.email);
    if (kept) {
      counts.merged++;
      issues.push({
        entity: "staff",
        raw: rawStaff(row),
        action: "merged",
        reason: `Duplicate email (${result.value.email}); kept "${kept}"`,
      });
      continue;
    }

    seenEmail.set(result.value.email, result.value.name);
    accepted.push(result.value);
    if (result.action === "repaired") {
      counts.repaired++;
      issues.push({ entity: "staff", raw: rawStaff(row), action: "repaired", reason: result.reason ?? "Repaired" });
    } else {
      counts.accepted++;
    }
  }

  return { accepted, issues, counts };
}

export function buildShiftPlan(rows: RawShiftRow[]): EntityPlan<CleanShift> {
  const accepted: CleanShift[] = [];
  const issues: RowIssue[] = [];
  const counts = { accepted: 0, repaired: 0, merged: 0, rejected: 0 };
  const seenId = new Set<string>();

  for (const row of rows) {
    const result = cleanShiftRow(row);

    if (result.action === "rejected") {
      counts.rejected++;
      issues.push({ entity: "shift", raw: rawShift(row), action: "rejected", reason: result.reason });
      continue;
    }

    if (seenId.has(result.value.externalId)) {
      counts.merged++;
      issues.push({
        entity: "shift",
        raw: rawShift(row),
        action: "merged",
        reason: `Duplicate shift id (${result.value.externalId})`,
      });
      continue;
    }

    seenId.add(result.value.externalId);
    accepted.push(result.value);
    counts.accepted++;
  }

  return { accepted, issues, counts };
}

export function buildImportPlan(
  staffCsv: string,
  shiftsCsv: string,
): ImportPlan {
  return {
    staff: buildStaffPlan(parseCsv<RawStaffRow>(staffCsv)),
    shifts: buildShiftPlan(parseCsv<RawShiftRow>(shiftsCsv)),
  };
}

const emptyEntityPlan = <T>(): EntityPlan<T> => ({
  accepted: [],
  issues: [],
  counts: { accepted: 0, repaired: 0, merged: 0, rejected: 0 },
});

export type CsvKind = "staff" | "shifts";

/**
 * Build a plan from a single uploaded CSV, auto-detecting whether it's a staff
 * or shifts export from its headers. Returns null if neither is recognized.
 * (The other entity is left empty so the same `runImport` handles it.)
 */
export function buildSingleEntityPlan(
  csvText: string,
): { kind: CsvKind; plan: ImportPlan } | null {
  const parsed = Papa.parse<RawStaffRow & RawShiftRow>(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const fields = parsed.meta.fields ?? [];

  if (fields.includes("staff_id") || fields.includes("email")) {
    return {
      kind: "staff",
      plan: {
        staff: buildStaffPlan(parsed.data as RawStaffRow[]),
        shifts: emptyEntityPlan(),
      },
    };
  }
  if (fields.includes("shift_id") || fields.includes("requirements")) {
    return {
      kind: "shifts",
      plan: {
        staff: emptyEntityPlan(),
        shifts: buildShiftPlan(parsed.data as RawShiftRow[]),
      },
    };
  }
  return null;
}
