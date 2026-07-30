import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import { env } from "@/env";

import * as schema from "./schema";

/**
 * Database client.
 *
 * We use the Neon **WebSocket Pool** driver (`neon-serverless`), not the HTTP
 * driver (`neon-http`). The HTTP driver is faster for one-shot queries but only
 * supports single round-trip requests — it cannot hold an interactive
 * transaction open. The claim business rules require exactly that: within one
 * transaction we `SELECT ... FOR UPDATE` to lock a row, run application logic
 * (count claims, check overlaps), then conditionally insert. That read-decide-
 * write cycle is only possible over a real session, which the Pool provides.
 *
 * Node 22 exposes a global `WebSocket`, so the driver needs no `ws` shim here.
 *
 * The pool is cached on `globalThis` in development so Next.js hot-reloads reuse
 * one pool instead of leaking a new set of connections on every edit.
 */
const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

const pool = globalForDb.pool ?? new Pool({ connectionString: env.DATABASE_URL });

if (env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema, casing: "snake_case" });

export { schema };
