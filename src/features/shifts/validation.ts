import { z } from "zod";

import type { Profession } from "@/db/schema";
import { isValidCalendarDate, isValidTime } from "@/lib/time";

/** Professions a shift can require, in display order. */
export const PROFESSIONS = ["doctor", "nurse", "receptionist"] as const satisfies readonly Profession[];

const MAX_PER_PROFESSION = 50;

/**
 * Validates a manager's shift create/edit input. Keeps the raw wall-clock fields
 * (date + start/end times) — resolving them into instants is the service's job
 * via `computeShiftInstants`, so the same shape works for create and edit.
 */
export const shiftInputSchema = z
  .object({
    date: z
      .string()
      .refine(isValidCalendarDate, "Enter a valid calendar date"),
    startTime: z.string().refine(isValidTime, "Enter a valid start time"),
    endTime: z.string().refine(isValidTime, "Enter a valid end time"),
    requirements: z.object({
      doctor: z.coerce.number().int().min(0).max(MAX_PER_PROFESSION),
      nurse: z.coerce.number().int().min(0).max(MAX_PER_PROFESSION),
      receptionist: z.coerce.number().int().min(0).max(MAX_PER_PROFESSION),
    }),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.startTime !== v.endTime, {
    message: "Start and end time cannot be the same",
    path: ["endTime"],
  })
  .refine(
    (v) =>
      v.requirements.doctor + v.requirements.nurse + v.requirements.receptionist >
      0,
    {
      message: "A shift needs at least one staffing requirement",
      path: ["requirements"],
    },
  );

export type ShiftInput = z.infer<typeof shiftInputSchema>;
export type ShiftRequirementCounts = ShiftInput["requirements"];
