import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// ── Explicit pool configuration (#15) ─────────────────────────────────────────
// Drizzle's default pg pool settings may not be appropriate for server concurrency.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                     // Maximum number of clients in the pool
  idleTimeoutMillis: 30_000,   // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5_000, // Fail fast if can't connect in 5 seconds
});

export const db = drizzle(pool, { schema });

export * from "./schema";
