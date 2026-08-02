import { readFileSync } from "node:fs";
import { join } from "node:path";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";

import { db } from "@/db";
import { importBatches, shifts, users } from "@/db/schema";

import { buildImportPlan } from "./plan";
import { getLatestImportBatch, runImport } from "./service";

const plan = buildImportPlan(
  readFileSync(join(process.cwd(), "Project/staff.csv"), "utf8"),
  readFileSync(join(process.cwd(), "Project/shifts.csv"), "utf8"),
);

async function count(table: typeof users | typeof shifts | typeof importBatches) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(table);
  return n;
}

async function reset() {
  await db.delete(shifts);
  await db.delete(users);
  await db.delete(importBatches);
}

beforeAll(reset);
afterAll(reset);

it("imports the real CSVs, persists a report, and is idempotent", async () => {
  const first = await runImport({
    plan,
    source: "seed",
    defaultPasswordHash: "test-hash",
  });

  // Cleaned data landed.
  expect(await count(users)).toBe(34);
  expect(await count(shifts)).toBe(112);

  // Report persisted with the right tallies.
  expect(first.summary.staff).toEqual({
    accepted: 32,
    repaired: 2,
    merged: 4,
    rejected: 3,
  });
  expect(first.summary.shifts).toMatchObject({
    accepted: 112,
    merged: 1,
    rejected: 4,
  });

  const batch = await getLatestImportBatch();
  expect(batch?.source).toBe("seed");
  // Issues persisted: staff (2 repaired + 4 merged + 3 rejected) + shifts (1 + 4).
  expect(batch?.issues).toHaveLength(2 + 4 + 3 + 1 + 4);

  // Idempotent: a second run upserts, doesn't duplicate rows.
  await runImport({ plan, source: "seed", defaultPasswordHash: "test-hash" });
  expect(await count(users)).toBe(34);
  expect(await count(shifts)).toBe(112);
  expect(await count(importBatches)).toBe(2); // but a new report each run
});
