import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Database schema for the clinic shift scheduler.
 *
 * Design notes:
 * - Times are stored as absolute `starts_at` / `ends_at` instants (naive
 *   clinic-local, no timezone). Overnight shifts (e.g. 22:00→06:00) and the
 *   CSV's `+1` next-day notation are resolved at import time by rolling the end
 *   into the following day, so `ends_at > starts_at` always holds. This makes
 *   overlap detection a plain range comparison instead of clock-arithmetic.
 * - Role requirements ("2 nurses + 1 doctor") are modelled as rows in
 *   `shift_requirements`, one per profession, rather than a JSON blob — this
 *   keeps coverage counting and the "which roles are missing" dashboard query
 *   in pure SQL.
 * - Business rules (profession capacity, overlap) are enforced in transactions
 *   at claim time, not by constraints, since "at most N of profession P" can't
 *   be expressed as a simple constraint. The unique/index definitions here exist
 *   to make those transactional checks correct and cheap.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Who a user is. Managers administer; staff claim shifts. */
export const roleEnum = pgEnum("role", ["manager", "staff"]);

/** The three staff professions the clinic schedules. */
export const professionEnum = pgEnum("profession", [
  "doctor",
  "nurse",
  "receptionist",
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/**
 * Users — both managers and staff. Auth-agnostic on purpose: it stores identity
 * and a password hash, so it works whether we later add custom sessions or an
 * auth library. `profession` is required for staff and null for managers,
 * enforced by a CHECK constraint.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull(),
    profession: professionEnum("profession"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // Staff must have a profession; managers must not.
    check(
      "users_role_profession_ck",
      sql`(${t.role} = 'staff' AND ${t.profession} IS NOT NULL) OR (${t.role} = 'manager' AND ${t.profession} IS NULL)`,
    ),
  ],
);

/**
 * A shift is a time window the clinic needs staffed. Its per-profession
 * staffing needs live in `shift_requirements`.
 */
export const shifts = pgTable(
  "shifts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    startsAt: timestamp("starts_at").notNull(),
    endsAt: timestamp("ends_at").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // Reject impossible windows at the DB level (supports import validation).
    check("shifts_time_order_ck", sql`${t.endsAt} > ${t.startsAt}`),
    // The coverage dashboard scans by week, so index the start instant.
    index("shifts_starts_at_idx").on(t.startsAt),
  ],
);

/**
 * One row per profession a shift needs, e.g. (shift, nurse, 2). A shift with no
 * rows for a profession simply doesn't need that profession.
 */
export const shiftRequirements = pgTable(
  "shift_requirements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),
    profession: professionEnum("profession").notNull(),
    requiredCount: integer("required_count").notNull(),
  },
  (t) => [
    // At most one requirement row per (shift, profession).
    unique("shift_requirements_shift_profession_uq").on(
      t.shiftId,
      t.profession,
    ),
    check("shift_requirements_count_positive_ck", sql`${t.requiredCount} > 0`),
  ],
);

/**
 * A staff member's claim on a shift. `assignedById` records the manager who
 * assigned the person, or is null for a self-claim. `createdAt` gives a stable
 * ordering for tie-breaking if a shift edit ever over-fills a profession
 * (earliest claimers keep their spot).
 */
export const claims = pgTable(
  "claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assignedById: uuid("assigned_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    // A user can hold a given shift at most once.
    unique("claims_shift_user_uq").on(t.shiftId, t.userId),
    // Overlap checks scan a user's claims; capacity checks scan a shift's.
    index("claims_user_idx").on(t.userId),
    index("claims_shift_idx").on(t.shiftId),
  ],
);

// ---------------------------------------------------------------------------
// Relations (for ergonomic joins via the query API)
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  claims: many(claims, { relationName: "claimant" }),
  assignments: many(claims, { relationName: "assigner" }),
}));

export const shiftsRelations = relations(shifts, ({ many }) => ({
  requirements: many(shiftRequirements),
  claims: many(claims),
}));

export const shiftRequirementsRelations = relations(
  shiftRequirements,
  ({ one }) => ({
    shift: one(shifts, {
      fields: [shiftRequirements.shiftId],
      references: [shifts.id],
    }),
  }),
);

export const claimsRelations = relations(claims, ({ one }) => ({
  shift: one(shifts, { fields: [claims.shiftId], references: [shifts.id] }),
  user: one(users, {
    fields: [claims.userId],
    references: [users.id],
    relationName: "claimant",
  }),
  assignedBy: one(users, {
    fields: [claims.assignedById],
    references: [users.id],
    relationName: "assigner",
  }),
}));

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Shift = typeof shifts.$inferSelect;
export type NewShift = typeof shifts.$inferInsert;
export type ShiftRequirement = typeof shiftRequirements.$inferSelect;
export type NewShiftRequirement = typeof shiftRequirements.$inferInsert;
export type Claim = typeof claims.$inferSelect;
export type NewClaim = typeof claims.$inferInsert;

export type Role = (typeof roleEnum.enumValues)[number];
export type Profession = (typeof professionEnum.enumValues)[number];
