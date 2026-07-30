// Load .env first — drizzle-kit runs outside Next.js, which won't populate it.
// This side-effect import must stay above the env import so DATABASE_URL is
// present by the time validation runs.
import "dotenv/config";

import { defineConfig } from "drizzle-kit";

// Reuse the same validated env — running any db:* script fails fast if
// DATABASE_URL is missing or malformed, exactly like the app does.
import { env } from "./src/env";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: env.DATABASE_URL },
  casing: "snake_case",
  strict: true,
  verbose: true,
});
