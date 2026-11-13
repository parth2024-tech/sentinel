-- Migration: Add tenant security fields and PostgreSQL Row-Level Security (RLS) policies

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS api_key_hash TEXT UNIQUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_updated_at TIMESTAMPTZ;

ALTER TABLE devices ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS pending_claim_email TEXT;

-- Enable Row Level Security (RLS)
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners to prevent inadvertent cross-tenant leaks
ALTER TABLE reports FORCE ROW LEVEL SECURITY;
ALTER TABLE devices FORCE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;

-- Reports policy:
-- Allows global access when app.current_org_id is unset or empty (e.g. consumer scans, migrations, cleanups)
-- When app.current_org_id is populated, strictly restricts rows to the matching org_id
DROP POLICY IF EXISTS tenant_isolation_policy_reports ON reports;
CREATE POLICY tenant_isolation_policy_reports ON reports
  USING (
    current_setting('app.current_org_id', true) IS NULL 
    OR current_setting('app.current_org_id', true) = ''
    OR org_id = current_setting('app.current_org_id', true)
  )
  WITH CHECK (
    current_setting('app.current_org_id', true) IS NULL 
    OR current_setting('app.current_org_id', true) = ''
    OR org_id = current_setting('app.current_org_id', true)
  );

-- Devices policy:
DROP POLICY IF EXISTS tenant_isolation_policy_devices ON devices;
CREATE POLICY tenant_isolation_policy_devices ON devices
  USING (
    current_setting('app.current_org_id', true) IS NULL 
    OR current_setting('app.current_org_id', true) = ''
    OR org_id = current_setting('app.current_org_id', true)
  )
  WITH CHECK (
    current_setting('app.current_org_id', true) IS NULL 
    OR current_setting('app.current_org_id', true) = ''
    OR org_id = current_setting('app.current_org_id', true)
  );

-- Organizations policy:
DROP POLICY IF EXISTS tenant_isolation_policy_organizations ON organizations;
CREATE POLICY tenant_isolation_policy_organizations ON organizations
  USING (
    current_setting('app.current_org_id', true) IS NULL 
    OR current_setting('app.current_org_id', true) = ''
    OR id = current_setting('app.current_org_id', true)
  )
  WITH CHECK (
    current_setting('app.current_org_id', true) IS NULL 
    OR current_setting('app.current_org_id', true) = ''
    OR id = current_setting('app.current_org_id', true)
  );
