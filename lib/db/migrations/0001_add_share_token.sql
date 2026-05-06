-- Migration: Add share_token column to reports table
-- This column enables read-only public sharing of report results
-- without exposing email, claim token, raw JSON, or IP hash.

ALTER TABLE reports ADD COLUMN IF NOT EXISTS share_token TEXT;
CREATE INDEX IF NOT EXISTS reports_share_token_idx ON reports (share_token);
