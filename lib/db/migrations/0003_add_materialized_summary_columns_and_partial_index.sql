-- Migration: Add partial index for active reports and denormalize summary columns for sub-millisecond live feed queries
ALTER TABLE reports ADD COLUMN IF NOT EXISTS overall_score INTEGER;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS grade VARCHAR(8);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS os VARCHAR(64);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS battery_health REAL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS reports_active_created_at_idx
  ON reports (created_at DESC)
  WHERE deleted_at IS NULL;
