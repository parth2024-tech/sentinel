import type { Logger } from "pino";
import { db, magicLinkTokensTable } from "@workspace/db";
import { and, eq, gt, isNull, lte } from "drizzle-orm";
import crypto from "node:crypto";
import {
  MAGIC_LINK_REMINDER_LEAD_MIN,
  MAGIC_LINK_REMINDER_POLL_MS,
  MAGIC_LINK_TTL_MIN,
} from "./magicLinkConstants.js";
import { buildMagicLinkLoginEmail } from "./email/templates/magicLinkLogin.js";
import { sendTransactionalEmail } from "./email/resendMailer.js";
import { isResendConfigured } from "./email/config.js";

function newToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Polls for unused magic-link tokens that expire within the next
 * `MAGIC_LINK_REMINDER_LEAD_MIN` minutes and sends a single reminder email each.
 */
export function startMagicLinkReminderScheduler(logger: Logger): NodeJS.Timeout {
  return setInterval(() => {
    void runMagicLinkReminderTick(logger);
  }, MAGIC_LINK_REMINDER_POLL_MS);
}

async function runMagicLinkReminderTick(logger: Logger): Promise<void> {
  if (!isResendConfigured()) {
    return;
  }

  const now = new Date();
  const horizon = new Date(
    now.getTime() + MAGIC_LINK_REMINDER_LEAD_MIN * 60 * 1000
  );

  try {
    const rows = await db
      .select({
        oldHash: magicLinkTokensTable.token,
        email: magicLinkTokensTable.email,
      })
      .from(magicLinkTokensTable)
      .where(
        and(
          isNull(magicLinkTokensTable.usedAt),
          isNull(magicLinkTokensTable.reminderSentAt),
          gt(magicLinkTokensTable.expiresAt, now),
          lte(magicLinkTokensTable.expiresAt, horizon)
        )
      )
      .limit(25);

    for (const row of rows) {
      try {
        const freshToken = newToken();
        const freshHash = hashToken(freshToken);
        const freshExpiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MIN * 60 * 1000);

        // Atomically rotate token hash in DB to freshHash and mark reminderSentAt
        const updated = await db
          .update(magicLinkTokensTable)
          .set({
            token: freshHash,
            reminderSentAt: new Date(),
            expiresAt: freshExpiresAt,
          })
          .where(
            and(
              eq(magicLinkTokensTable.token, row.oldHash),
              isNull(magicLinkTokensTable.reminderSentAt),
              isNull(magicLinkTokensTable.usedAt)
            )
          )
          .returning({ email: magicLinkTokensTable.email });

        // If another worker already rotated or consumed it, skip sending
        if (updated.length === 0) {
          continue;
        }

        const { subject, html, text } = buildMagicLinkLoginEmail(
          freshToken,
          "reminder"
        );
        await sendTransactionalEmail({
          to: row.email,
          subject,
          html,
          text,
        });
        logger.info({ email: row.email }, "magic_link_reminder_sent");
      } catch (err) {
        logger.error({ err, email: row.email }, "magic_link_reminder_failed");
      }
    }
  } catch (err) {
    logger.error({ err }, "magic_link_reminder_scan_failed");
  }
}
