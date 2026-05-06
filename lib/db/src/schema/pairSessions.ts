import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { reportsTable } from "./reports";

export const pairSessionsTable = pgTable(
  "pair_sessions",
  {
    code: text("code").primaryKey(),
    reportId: text("report_id").references(() => reportsTable.id),
    claimToken: text("claim_token"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (t) => [
    index("pair_sessions_expires_at_idx").on(t.expiresAt),
    index("pair_sessions_report_id_idx").on(t.reportId),
  ],
);

export type PairSession = typeof pairSessionsTable.$inferSelect;
export type InsertPairSession = typeof pairSessionsTable.$inferInsert;
