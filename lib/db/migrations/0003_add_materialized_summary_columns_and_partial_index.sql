-- Migration: Add partial covering index for active reports and denormalize summary columns for sub-millisecond live feed queries
ALTER TABLE reports ADD COLUMN IF NOT EXISTS overall_score INTEGER;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS grade VARCHAR(8);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS os VARCHAR(64);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS battery_health REAL;

-- Historical Backfill for existing production rows
UPDATE reports r
SET 
  overall_score = CASE 
    WHEN rp.result_json->>'overall' ~ '^-?[0-9]+(\.[0-9]+)?$' 
    THEN ROUND((rp.result_json->>'overall')::numeric)::integer 
    ELSE NULL 
  END,
  grade = rp.result_json->>'grade',
  os = rp.raw_json->'system'->>'os',
  battery_health = CASE 
    WHEN rp.raw_json->'battery'->>'health' ~ '^-?[0-9]+(\.[0-9]+)?$' 
    THEN (rp.raw_json->'battery'->>'health')::real 
    ELSE NULL 
  END
FROM report_payloads rp
WHERE rp.report_id = r.id AND r.overall_score IS NULL;

-- Drop previous non-covering partial index if present
DROP INDEX IF EXISTS reports_active_created_at_idx;

-- Covering partial index with INCLUDE clause for 100% Index-Only Scans
CREATE INDEX IF NOT EXISTS reports_active_created_at_covering_idx
  ON reports (created_at DESC)
  INCLUDE (overall_score, grade, os, battery_health)
  WHERE deleted_at IS NULL;
