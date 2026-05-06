import type { Logger } from "pino";
import { db, magicLinkTokensTable } from "@workspace/db";
import { and, eq, gt, isNull, lte } from "drizzle-orm";
import {
  MAGIC_LINK_REMINDER_LEAD_MIN,
  MAGIC_LINK_REMINDER_POLL_MS,
} from "./magicLinkConstants";
import { buildMagicLinkLoginEmail } from "./email/templates/magicLinkLogin";
import { sendTransactionalEmail } from "./email/resendMailer";
import { isResendConfigured } from "./email/config";

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
        token: magicLinkTokensTable.token,
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
        const { subject, html, text } = buildMagicLinkLoginEmail(
          row.token,
          "reminder"
        );
        await sendTransactionalEmail({
          to: row.email,
          subject,
          html,
          text,
        });
        await db
          .update(magicLinkTokensTable)
          .set({ reminderSentAt: new Date() })
          .where(eq(magicLinkTokensTable.token, row.token));
        logger.info({ email: row.email }, "magic_link_reminder_sent");
      } catch (err) {
        logger.error({ err, email: row.email }, "magic_link_reminder_failed");
      }
    }
  } catch (err) {
    logger.error({ err }, "magic_link_reminder_scan_failed");
  }
}
