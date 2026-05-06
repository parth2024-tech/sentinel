import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const myReportsSessionsTable = pgTable(
  "my_reports_sessions",
  {
    token: text("token").primaryKey(),
    email: text("email").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("my_reports_sessions_email_idx").on(t.email)],
);

export type MyReportsSession = typeof myReportsSessionsTable.$inferSelect;
