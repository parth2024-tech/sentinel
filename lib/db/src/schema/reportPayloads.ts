import {
  pgTable,
  text,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { reportsTable } from "./reports";

export const reportPayloadsTable = pgTable(
  "report_payloads",
  {
    reportId: text("report_id")
      .primaryKey()
      .references(() => reportsTable.id, { onDelete: "cascade" }),
    rawJson: jsonb("raw_json").notNull(),
    resultJson: jsonb("result_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  }
);

export type ReportPayload = typeof reportPayloadsTable.$inferSelect;
export type InsertReportPayload = typeof reportPayloadsTable.$inferInsert;
