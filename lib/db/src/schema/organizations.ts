import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const organizationsTable = pgTable("organizations", {
  id: text("id").primaryKey(), // using text for uuids/cuid
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripePriceId: text("stripe_price_id"),
  status: text("status"), // active, trialing, past_due, canceled
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Organization = typeof organizationsTable.$inferSelect;
export type InsertOrganization = typeof organizationsTable.$inferInsert;
