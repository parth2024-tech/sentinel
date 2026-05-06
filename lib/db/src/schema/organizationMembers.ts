import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { organizationsTable } from "./organizations";

export const organizationMembersTable = pgTable(
  "organization_members",
  {
    orgId: text("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // admin, member, viewer
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.orgId, t.userId] }),
  ]
);

export type OrganizationMember = typeof organizationMembersTable.$inferSelect;
export type InsertOrganizationMember = typeof organizationMembersTable.$inferInsert;
