import { pgTable, text, integer, numeric, timestamp, index } from "drizzle-orm/pg-core";

export const scansTable = pgTable(
  "scans",
  {
    id: text("id").primaryKey(),
    deviceFingerprint: text("device_fingerprint").notNull(),
    deviceModel: text("device_model"),
    scannedAt: timestamp("scanned_at", { withTimezone: true }).defaultNow().notNull(),
    batteryHealth: numeric("battery_health"),
    batteryCycles: integer("battery_cycles"),
    maxTempC: numeric("max_temp_c"),
    throttleEvents: integer("throttle_events"),
    ssdWearPct: numeric("ssd_wear_pct"),
    ssdReallocSectors: integer("ssd_realloc_sectors"),
    ssdFreePct: numeric("ssd_free_pct"),
    memUsedPct: numeric("mem_used_pct"),
    cpuLoadPct: numeric("cpu_load_pct"),
    algoVersion: integer("algo_version").notNull().default(1),
    consentGiven: text("consent").default("anonymous"),
  },
  (t) => [
    index("scans_device_fingerprint_idx").on(t.deviceFingerprint),
    index("scans_scanned_at_idx").on(t.scannedAt),
    index("scans_device_model_idx").on(t.deviceModel),
  ],
);

export type Scan = typeof scansTable.$inferSelect;
export type InsertScan = typeof scansTable.$inferInsert;
