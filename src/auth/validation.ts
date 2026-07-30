import { z } from "zod";

/**
 * Login form schema. Email is trimmed and lowercased so it matches the
 * normalized form stored by the importer/seed.
 */
export const loginSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
