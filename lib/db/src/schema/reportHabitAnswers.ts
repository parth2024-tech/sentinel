import { pgTable, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { reportsTable } from "./reports";

export const reportHabitAnswersTable = pgTable("report_habit_answers", {
  reportId: text("report_id")
    .primaryKey()
    .references(() => reportsTable.id),
  answers: jsonb("answers").notNull(),
  habitScore: integer("habit_score").notNull(),
  combinedScore: integer("combined_score").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ReportHabitAnswers = typeof reportHabitAnswersTable.$inferSelect;
export type InsertReportHabitAnswers = typeof reportHabitAnswersTable.$inferInsert;
