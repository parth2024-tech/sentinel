-- ============================================================
--  Sentinel Full Schema Bootstrap
--  Run this against a fresh PostgreSQL database to create
--  all required tables. Uses IF NOT EXISTS everywhere so it is
--  safe to re-run on an existing database.
-- ============================================================

-- Users
CREATE TABLE IF NOT EXISTS users (
  id                 TEXT        PRIMARY KEY,
  email              TEXT        NOT NULL UNIQUE,
  name               TEXT,
  avatar_url         TEXT,
  stripe_customer_id TEXT        UNIQUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id                 TEXT        PRIMARY KEY,
  name               TEXT        NOT NULL,
  slug               TEXT        NOT NULL UNIQUE,
  owner_id           TEXT        REFERENCES users(id),
  plan               TEXT        NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT        UNIQUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organization Members
CREATE TABLE IF NOT EXISTS organization_members (
  org_id     TEXT        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
  id          TEXT        PRIMARY KEY,
  algo_version INTEGER    NOT NULL DEFAULT 1,
  claim_token TEXT,
  share_token TEXT,
  claimed     BOOLEAN     NOT NULL DEFAULT FALSE,
  legacy      BOOLEAN     NOT NULL DEFAULT FALSE,
  user_id     TEXT        REFERENCES users(id),
  org_id      TEXT        REFERENCES organizations(id),
  consent_at  TIMESTAMPTZ,
  ip_hash     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS reports_user_id_idx    ON reports (user_id);
CREATE INDEX IF NOT EXISTS reports_org_id_idx     ON reports (org_id);
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON reports (created_at);
CREATE INDEX IF NOT EXISTS reports_share_token_idx ON reports (share_token);

-- Add legacy column if it was missing (safe to run on existing DB)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS legacy BOOLEAN NOT NULL DEFAULT FALSE;
-- Add share_token column if it was missing
ALTER TABLE reports ADD COLUMN IF NOT EXISTS share_token TEXT;

-- Report Payloads
CREATE TABLE IF NOT EXISTS report_payloads (
  report_id  TEXT        PRIMARY KEY REFERENCES reports(id) ON DELETE CASCADE,
  raw_json   JSONB       NOT NULL,
  result_json JSONB      NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Report Habit Answers
CREATE TABLE IF NOT EXISTS report_habit_answers (
  report_id      TEXT        PRIMARY KEY REFERENCES reports(id) ON DELETE CASCADE,
  answers        JSONB       NOT NULL,
  habit_score    REAL        NOT NULL,
  combined_score REAL        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rate Limits
CREATE TABLE IF NOT EXISTS rate_limits (
  ip           TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count        INTEGER     NOT NULL DEFAULT 1,
  PRIMARY KEY (ip, window_start)
);

-- Idempotency Keys
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key        TEXT        PRIMARY KEY,
  report_id  TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Devices (for SentinelAgent pairing)
CREATE TABLE IF NOT EXISTS devices (
  id           TEXT        PRIMARY KEY,
  pair_token   TEXT        NOT NULL UNIQUE,
  device_token TEXT        NOT NULL UNIQUE,
  org_id       TEXT        REFERENCES organizations(id),
  claimed      BOOLEAN     NOT NULL DEFAULT FALSE,
  claimed_at   TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS devices_pair_token_idx   ON devices (pair_token);
CREATE INDEX IF NOT EXISTS devices_device_token_idx ON devices (device_token);
CREATE INDEX IF NOT EXISTS devices_org_id_idx       ON devices (org_id);

-- Pair Sessions
CREATE TABLE IF NOT EXISTS pair_sessions (
  code        TEXT        PRIMARY KEY,
  report_id   TEXT        REFERENCES reports(id),
  claim_token TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS pair_sessions_expires_at_idx  ON pair_sessions (expires_at);
CREATE INDEX IF NOT EXISTS pair_sessions_report_id_idx   ON pair_sessions (report_id);

-- My Reports Sessions (magic-link auth)
CREATE TABLE IF NOT EXISTS my_reports_sessions (
  token      TEXT        PRIMARY KEY,
  email      TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS my_reports_sessions_email_idx ON my_reports_sessions (email);

-- Magic Link Tokens
CREATE TABLE IF NOT EXISTS magic_link_tokens (
  token                TEXT        PRIMARY KEY,
  email                TEXT        NOT NULL,
  expires_at           TIMESTAMPTZ NOT NULL,
  reminder_sent_at     TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Waitlist
CREATE TABLE IF NOT EXISTS waitlist (
  id         TEXT        PRIMARY KEY,
  email      TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scans
CREATE TABLE IF NOT EXISTS scans (
  id         TEXT        PRIMARY KEY,
  device_id  TEXT        REFERENCES devices(id),
  org_id     TEXT        REFERENCES organizations(id),
  report_id  TEXT        REFERENCES reports(id),
  status     TEXT        NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS scans_device_id_idx ON scans (device_id);
CREATE INDEX IF NOT EXISTS scans_org_id_idx    ON scans (org_id);
