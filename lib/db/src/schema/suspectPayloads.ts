import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const suspectPayloadsTable = pgTable(
  "suspect_payloads",
  {
    id: text("id").primaryKey(),
    rawJson: jsonb("raw_json").notNull(),
    failureReason: text("failure_reason").notNull(),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  }
);

export type SuspectPayload = typeof suspectPayloadsTable.$inferSelect;
export type InsertSuspectPayload = typeof suspectPayloadsTable.$inferInsert;
