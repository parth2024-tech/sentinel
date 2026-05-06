import { db, magicLinkTokensTable, idempotencyKeysTable } from "@workspace/db";
import { lt, or, and, isNotNull } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Background cleanup jobs for expired/used data (#9, #17).
 * Runs periodically to prevent unbounded table growth.
 */

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Delete magic-link tokens that are:
 * - Used more than 30 days ago, OR
 * - Expired more than 7 days ago (whether used or not)
 *
 * This prevents the magic_link_tokens table from becoming a permanent
 * log of all authentication attempts including email addresses (#9).
 */
async function cleanupMagicLinkTokens(): Promise<void> {
  try {
    const usedCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
    const expiredCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days

    await db
      .delete(magicLinkTokensTable)
      .where(
        or(
          and(
            isNotNull(magicLinkTokensTable.usedAt),
            lt(magicLinkTokensTable.usedAt, usedCutoff)
          ),
          lt(magicLinkTokensTable.expiresAt, expiredCutoff)
        )
      );

    logger.debug("magic_link_token_cleanup_complete");
  } catch (err) {
    logger.error({ err }, "magic_link_token_cleanup_failed");
  }
}

/**
 * Delete idempotency keys older than 24 hours (#17).
 * The dedup window is 24h, so keys older than that are no longer useful.
 */
async function cleanupIdempotencyKeys(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours

    await db
      .delete(idempotencyKeysTable)
      .where(lt(idempotencyKeysTable.createdAt, cutoff));

    logger.debug("idempotency_key_cleanup_complete");
  } catch (err) {
    logger.error({ err }, "idempotency_key_cleanup_failed");
  }
}

/**
 * Runs all cleanup jobs in sequence.
 */
async function runAllCleanups(): Promise<void> {
  await cleanupMagicLinkTokens();
  await cleanupIdempotencyKeys();
}

/**
 * Start the periodic cleanup scheduler.
 * Runs every hour plus once on startup after a short delay.
 */
export function startCleanupScheduler(): void {
  // Run once on startup (delayed to avoid blocking server start)
  setTimeout(() => void runAllCleanups(), 10_000);

  // Then every hour
  setInterval(() => {
    void runAllCleanups();
  }, CLEANUP_INTERVAL_MS);

  logger.info("cleanup_scheduler_started");
}
