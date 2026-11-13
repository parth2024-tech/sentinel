import {
  db,
  magicLinkTokensTable,
  idempotencyKeysTable,
  myReportsSessionsTable,
  suspectPayloadsTable,
  pairSessionsTable,
  withSystemScope,
} from "@workspace/db";
import { lt, or, and, isNotNull, inArray, sql } from "drizzle-orm";
import { logger } from "./logger.js";

/**
 * Background cleanup jobs for expired/used data.
 * Runs periodically with bounded batch deletes (LIMIT 1000) to prevent
 * unbounded table growth and database lock contention.
 */

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const BATCH_SIZE = 1000;

/**
 * Delete magic-link tokens that are:
 * - Used more than 30 days ago, OR
 * - Expired more than 7 days ago (whether used or not)
 */
async function cleanupMagicLinkTokens(): Promise<void> {
  try {
    const usedCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
    const expiredCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days

    let deletedTotal = 0;
    while (true) {
      const rows = await db
        .select({ token: magicLinkTokensTable.token })
        .from(magicLinkTokensTable)
        .where(
          or(
            and(
              isNotNull(magicLinkTokensTable.usedAt),
              lt(magicLinkTokensTable.usedAt, usedCutoff)
            ),
            lt(magicLinkTokensTable.expiresAt, expiredCutoff)
          )
        )
        .limit(BATCH_SIZE);

      if (rows.length === 0) break;

      const tokens = rows.map((r) => r.token);
      await db
        .delete(magicLinkTokensTable)
        .where(inArray(magicLinkTokensTable.token, tokens));

      deletedTotal += rows.length;
      if (rows.length < BATCH_SIZE || deletedTotal >= 10_000) break;
    }

    logger.debug({ deletedTotal }, "magic_link_token_cleanup_complete");
  } catch (err) {
    logger.error({ err }, "magic_link_token_cleanup_failed");
  }
}

/**
 * Delete expired sessions from my_reports_sessions in bounded batches.
 */
async function cleanupExpiredSessions(): Promise<void> {
  try {
    const now = new Date();
    let deletedTotal = 0;

    while (true) {
      const rows = await db
        .select({ token: myReportsSessionsTable.token })
        .from(myReportsSessionsTable)
        .where(lt(myReportsSessionsTable.expiresAt, now))
        .limit(BATCH_SIZE);

      if (rows.length === 0) break;

      const tokens = rows.map((r) => r.token);
      await db
        .delete(myReportsSessionsTable)
        .where(inArray(myReportsSessionsTable.token, tokens));

      deletedTotal += rows.length;
      if (rows.length < BATCH_SIZE || deletedTotal >= 10_000) break;
    }

    logger.debug({ deletedTotal }, "expired_sessions_cleanup_complete");
  } catch (err) {
    logger.error({ err }, "expired_sessions_cleanup_failed");
  }
}

/**
 * Delete idempotency keys older than 24 hours in bounded batches.
 */
async function cleanupIdempotencyKeys(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
    let deletedTotal = 0;

    while (true) {
      const rows = await db
        .select({ key: idempotencyKeysTable.key })
        .from(idempotencyKeysTable)
        .where(lt(idempotencyKeysTable.createdAt, cutoff))
        .limit(BATCH_SIZE);

      if (rows.length === 0) break;

      const keys = rows.map((r) => r.key);
      await db
        .delete(idempotencyKeysTable)
        .where(inArray(idempotencyKeysTable.key, keys));

      deletedTotal += rows.length;
      if (rows.length < BATCH_SIZE || deletedTotal >= 10_000) break;
    }

    logger.debug({ deletedTotal }, "idempotency_key_cleanup_complete");
  } catch (err) {
    logger.error({ err }, "idempotency_key_cleanup_failed");
  }
}

/**
 * Purge aged-out suspect payloads older than 30 days in bounded batches.
 */
async function cleanupSuspectPayloads(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
    let deletedTotal = 0;

    while (true) {
      const rows = await db
        .select({ id: suspectPayloadsTable.id })
        .from(suspectPayloadsTable)
        .where(lt(suspectPayloadsTable.createdAt, cutoff))
        .limit(BATCH_SIZE);

      if (rows.length === 0) break;

      const ids = rows.map((r) => r.id);
      await db
        .delete(suspectPayloadsTable)
        .where(inArray(suspectPayloadsTable.id, ids));

      deletedTotal += rows.length;
      if (rows.length < BATCH_SIZE || deletedTotal >= 10_000) break;
    }

    logger.debug({ deletedTotal }, "suspect_payloads_cleanup_complete");
  } catch (err) {
    logger.error({ err }, "suspect_payloads_cleanup_failed");
  }
}

/**
 * Delete expired or used pair sessions older than 24 hours in bounded batches.
 */
async function cleanupPairSessions(): Promise<void> {
  try {
    const expiredCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
    let deletedTotal = 0;

    while (true) {
      const rows = await db
        .select({ code: pairSessionsTable.code })
        .from(pairSessionsTable)
        .where(
          or(
            lt(pairSessionsTable.expiresAt, expiredCutoff),
            and(
              isNotNull(pairSessionsTable.usedAt),
              lt(pairSessionsTable.usedAt, expiredCutoff)
            )
          )
        )
        .limit(BATCH_SIZE);

      if (rows.length === 0) break;

      const codes = rows.map((r) => r.code);
      await db
        .delete(pairSessionsTable)
        .where(inArray(pairSessionsTable.code, codes));

      deletedTotal += rows.length;
      if (rows.length < BATCH_SIZE || deletedTotal >= 10_000) break;
    }

    logger.debug({ deletedTotal }, "pair_sessions_cleanup_complete");
  } catch (err) {
    logger.error({ err }, "pair_sessions_cleanup_failed");
  }
}

/**
 * One-time startup migration: Purge legacy non-hashed plaintext sessions
 * to ensure no unhashed tokens remain valid.
 */
async function purgeLegacyPlaintextTokens(): Promise<void> {
  try {
    await db.execute(sql`
      DELETE FROM my_reports_sessions
      WHERE length(token) != 64 OR token !~ '^[a-f0-9]{64}$'
    `);
    await db.execute(sql`
      DELETE FROM magic_link_tokens
      WHERE length(token) != 64 OR token !~ '^[a-f0-9]{64}$'
    `);
    logger.debug("legacy_plaintext_tokens_purged");
  } catch (err) {
    logger.error({ err }, "legacy_plaintext_tokens_purge_failed");
  }
}

/**
 * Runs all cleanup jobs in sequence under an administrative system bypass scope.
 */
async function runAllCleanups(): Promise<void> {
  await withSystemScope(async () => {
    await cleanupMagicLinkTokens();
    await cleanupExpiredSessions();
    await cleanupIdempotencyKeys();
    await cleanupSuspectPayloads();
    await cleanupPairSessions();
  });
}

/**
 * Start the periodic cleanup scheduler.
 * Runs once on startup after a short delay, then every hour.
 */
export function startCleanupScheduler(): void {
  setTimeout(async () => {
    await purgeLegacyPlaintextTokens();
    await runAllCleanups();
  }, 10_000);

  setInterval(() => {
    void runAllCleanups();
  }, CLEANUP_INTERVAL_MS);

  logger.info("cleanup_scheduler_started");
}
