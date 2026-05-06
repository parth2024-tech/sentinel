-- Migration: Add legacy column to reports table
-- This column flags reports submitted via the old paste-based ingestion flow
-- as opposed to the direct PowerShell -DirectUpload path.

ALTER TABLE reports ADD COLUMN IF NOT EXISTS legacy BOOLEAN NOT NULL DEFAULT FALSE;
