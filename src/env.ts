import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Validated, type-safe environment variables.
 *
 * Import from `@/env` instead of touching `process.env` directly — that keeps
 * access type-safe and guarantees every variable has passed validation.
 *
 * Validation runs at build time (imported in `next.config.ts`) so a missing or
 * malformed variable fails the build rather than surfacing as a runtime crash.
 */
export const env = createEnv({
  /**
   * Server-only variables. Never exposed to the browser; accessing any of these
   * from client code throws.
   */
  server: {
    DATABASE_URL: z.url({
      protocol: /^postgres(ql)?$/,
      error: "DATABASE_URL must be a valid Postgres connection string",
    }),
    // Secret used by Auth.js to sign/encrypt the session JWT. Generate with
    // `openssl rand -base64 33`. Required in every environment.
    AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  /**
   * Client variables. Must be prefixed with `NEXT_PUBLIC_` and listed in
   * `runtimeEnv` below. None yet.
   */
  client: {},

  /**
   * Client variables have to be destructured manually so Next.js can inline
   * them into the bundle. Server variables are read from `process.env`
   * automatically and don't belong here.
   */
  experimental__runtimeEnv: {},

  /**
   * Treat empty strings (`FOO=`) as undefined so they fail `required` checks
   * instead of sneaking through as valid values.
   */
  emptyStringAsUndefined: true,

  /**
   * Set `SKIP_ENV_VALIDATION=1` to bypass validation — useful for Docker builds
   * or linting where the real secrets aren't present.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
