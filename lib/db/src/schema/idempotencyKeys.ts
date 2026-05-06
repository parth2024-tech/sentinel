import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const idempotencyKeysTable = pgTable("idempotency_keys", {
  key: text("key").primaryKey(),
  reportId: text("report_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type IdempotencyKey = typeof idempotencyKeysTable.$inferSelect;
