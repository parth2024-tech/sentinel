import { db, rateLimitsTable } from "@workspace/db";
import { sql, lt } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Atomically increments the counter for `(key, windowStart)` and returns whether
 * this request is within `limit` for the window (inclusive). Uses a single
 * INSERT … ON CONFLICT … DO UPDATE … RETURNING round-trip to avoid check-then-act races.
 */
export async function consumeRateLimit(
  key: string,
  windowMinutes: number,
  limit: number
): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(
    Math.floor(now.getTime() / (windowMinutes * 60 * 1000)) * (windowMinutes * 60 * 1000)
  );

  const rows = await db
    .insert(rateLimitsTable)
    .values({ ip: key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimitsTable.ip, rateLimitsTable.windowStart],
      set: { count: sql`${rateLimitsTable.count} + 1` },
    })
    .returning({ count: rateLimitsTable.count });

  const count = rows[0]?.count;
  if (count == null) return false;
  return count <= limit;
}

// ── Rate-limit table cleanup (#3 short-term fix) ─────────────────────────────
// Runs every 30 minutes to delete expired rate-limit windows (older than 2 days).
// Prevents unbounded growth of the rate_limits table.
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

async function cleanupExpiredRateLimits(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    const result = await db
      .delete(rateLimitsTable)
      .where(lt(rateLimitsTable.windowStart, cutoff));
    logger.debug("rate_limit_cleanup_complete");
  } catch (err) {
    logger.error({ err }, "rate_limit_cleanup_failed");
  }
}

// Start cleanup on import (runs in the background, non-blocking)
setInterval(() => {
  void cleanupExpiredRateLimits();
}, CLEANUP_INTERVAL_MS);

// Run once on startup after a short delay
setTimeout(() => void cleanupExpiredRateLimits(), 5_000);
