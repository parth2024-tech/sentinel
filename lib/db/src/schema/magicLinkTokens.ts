import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const magicLinkTokensTable = pgTable("magic_link_tokens", {
  token: text("token").primaryKey(),
  email: text("email").notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  /** When set, a "link expiring soon" reminder was already emailed for this token. */
  reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
});

export type MagicLinkToken = typeof magicLinkTokensTable.$inferSelect;
