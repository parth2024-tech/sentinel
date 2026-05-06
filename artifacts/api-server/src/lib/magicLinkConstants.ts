/** Magic-link validity window (minutes). */
export const MAGIC_LINK_TTL_MIN = 15;

/** Remind users when the link expires within this many minutes (unused tokens only). */
export const MAGIC_LINK_REMINDER_LEAD_MIN = 5;

/** How often the reminder job scans the database (ms). */
export const MAGIC_LINK_REMINDER_POLL_MS = 60_000;
