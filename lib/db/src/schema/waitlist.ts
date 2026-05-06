import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const waitlistTable = pgTable("waitlist", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  confirmed: boolean("confirmed").default(false).notNull(),
});

export const insertWaitlistSchema = createInsertSchema(waitlistTable)
  .omit({ id: true, createdAt: true, confirmed: true })
  .extend({
    email: z.email(),
  });

export type InsertWaitlist = z.infer<typeof insertWaitlistSchema>;
export type Waitlist = typeof waitlistTable.$inferSelect;
