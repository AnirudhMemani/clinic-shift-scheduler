import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Integration tests run against a real database (Neon). They load `.env`
 * themselves and run serially so shared-table setup/teardown doesn't collide.
 * Invoked via `pnpm test:integration`, kept out of the default `pnpm test`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    fileParallelism: false,
    setupFiles: ["dotenv/config"],
  },
});
