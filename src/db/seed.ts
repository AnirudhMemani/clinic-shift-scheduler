import "dotenv/config";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { hashPassword } from "@/auth/password";
import { db } from "@/db";
import { users } from "@/db/schema";
import { buildImportPlan } from "@/features/import/plan";
import { runImport } from "@/features/import/service";

/**
 * Seed script (`pnpm db:seed`).
 *
 * Seeds the manager account(s) — who are NOT in the CSV — then runs the clinic's
 * dirty CSVs through the same importer the manager upload uses. Idempotent, so
 * it's safe to re-run against an existing database.
 *
 * All seeded accounts share one password for easy grading (documented in README).
 */

const DEFAULT_PASSWORD = "Clinic123!";

const MANAGERS = [{ email: "manager@clinic.test", name: "Morgan Bailey" }];

async function main() {
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);

  // 1. Managers (not present in staff.csv).
  await db
    .insert(users)
    .values(
      MANAGERS.map((m) => ({
        email: m.email,
        name: m.name,
        passwordHash,
        role: "manager" as const,
      })),
    )
    .onConflictDoNothing({ target: users.email });

  // 2. Import the clinic's staff + shifts CSVs via the shared importer.
  const plan = buildImportPlan(
    readFileSync(join(process.cwd(), "Project/staff.csv"), "utf8"),
    readFileSync(join(process.cwd(), "Project/shifts.csv"), "utf8"),
  );
  const { summary } = await runImport({
    plan,
    source: "seed",
    defaultPasswordHash: passwordHash,
  });

  const exampleStaff = plan.staff.accepted.slice(0, 3).map((s) => s.email);

  console.log("\n✅ Seed complete\n");
  console.log(`  Managers seeded: ${MANAGERS.length}`);
  console.log(
    `  Staff imported:  ${summary.staff.accepted + summary.staff.repaired} ` +
      `(${summary.staff.merged} merged, ${summary.staff.rejected} rejected)`,
  );
  console.log(
    `  Shifts imported: ${summary.shifts.accepted} ` +
      `(${summary.shifts.merged} merged, ${summary.shifts.rejected} rejected)`,
  );
  console.log("\n  Login (all seeded accounts share one password):");
  console.log(`    Password:      ${DEFAULT_PASSWORD}`);
  console.log(`    Manager:       ${MANAGERS[0].email}`);
  console.log(`    Example staff: ${exampleStaff.join(", ")}`);
  console.log("\n  See the Import Report page for the full accepted/rejected breakdown.\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
