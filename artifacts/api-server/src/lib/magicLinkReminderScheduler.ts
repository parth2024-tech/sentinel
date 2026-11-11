/**
 * DECOMMISSIONED:
 * Per Sentinel API security architecture, 15-minute magic links are single-use,
 * short-lived authentication credentials stored at rest as SHA-256 digests.
 * Polling and emailing reminders for 15-minute magic links has been retired
 * to prevent inbox fatigue, spam-score penalties, and security ambiguity.
 */
import type { Logger } from "pino";

export function startMagicLinkReminderScheduler(_logger: Logger): NodeJS.Timeout | null {
  // Decommissioned: no background polling
  return null;
}
