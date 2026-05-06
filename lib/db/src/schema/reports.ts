import {
  pgTable,
  text,
  jsonb,
  boolean,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { organizationsTable } from "./organizations";

export const reportsTable = pgTable(
  "reports",
  {
    id: text("id").primaryKey(),
    algoVersion: integer("algo_version").notNull().default(1),
    claimToken: text("claim_token"),
    shareToken: text("share_token"),
    claimed: boolean("claimed").notNull().default(false),
    userId: text("user_id").references(() => usersTable.id),
    orgId: text("org_id").references(() => organizationsTable.id),
    consentAt: timestamp("consent_at", { withTimezone: true }),
    ipHash: text("ip_hash"),
    legacy: boolean("legacy").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("reports_user_id_idx").on(t.userId),
    index("reports_org_id_idx").on(t.orgId),
    index("reports_created_at_idx").on(t.createdAt),
    index("reports_share_token_idx").on(t.shareToken),
  ],
);

export type Report = typeof reportsTable.$inferSelect;
export type InsertReport = typeof reportsTable.$inferInsert;
