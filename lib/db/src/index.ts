import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import * as schema from "./schema";

const { Pool, Client } = pg;

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

/**
 * Creates a dedicated persistent pg.Client with TCP keep-alives configured
 * for long-lived LISTEN subscriptions outside the connection pool.
 */
export function createDedicatedClient(): pg.Client {
  return new Client({
    connectionString: process.env.DATABASE_URL,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });
}

/**
 * Execute operations within a tenant-scoped transaction.
 * Sets PostgreSQL session variable `app.current_org_id` locally within the transaction
 * to enforce database-level Row Level Security (RLS) across tenant-scoped queries.
 */
export async function withTenantScope<T>(
  orgId: string,
  fn: (tx: typeof db) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, true)`);
    return await fn(tx as unknown as typeof db);
  });
}

/**
 * Execute operations within a user-scoped transaction.
 * Sets PostgreSQL session variable `app.current_user_id` locally within the transaction
 * to enforce database-level Row Level Security (RLS) across user-claimed queries.
 */
export async function withUserScope<T>(
  userId: string,
  fn: (tx: typeof db) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_user_id', ${userId}, true)`);
    return await fn(tx as unknown as typeof db);
  });
}

/**
 * Execute administrative operations within a system-level bypass scope.
 * Sets PostgreSQL session variable `app.bypass_rls = 'on'` locally within the transaction
 * for background cleanup jobs, global telemetry aggregations, and administrative tasks.
 */
export async function withSystemScope<T>(
  fn: (tx: typeof db) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.bypass_rls', 'on', true)`);
    return await fn(tx as unknown as typeof db);
  });
}

export * from "./schema";
