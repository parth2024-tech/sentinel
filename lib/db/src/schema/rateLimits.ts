import { pgTable, text, timestamp, integer, primaryKey } from "drizzle-orm/pg-core";

export const rateLimitsTable = pgTable(
  "rate_limits",
  {
    ip: text("ip").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.ip, t.windowStart] })],
);

export type RateLimit = typeof rateLimitsTable.$inferSelect;
