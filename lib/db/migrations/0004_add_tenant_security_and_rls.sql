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
-- 1. Anonymous & personal reports (org_id IS NULL) are freely accessible
-- 2. Administrative jobs (cleanup, global stats) can set app.bypass_rls = 'on'
-- 3. Tenant-scoped transactions strictly isolate rows matching app.current_org_id
-- 4. User-scoped transactions permit claimed reports matching app.current_user_id (even if org_id is set)
DROP POLICY IF EXISTS tenant_isolation_policy_reports ON reports;
CREATE POLICY tenant_isolation_policy_reports ON reports
  FOR ALL
  USING (
    org_id IS NULL 
    OR current_setting('app.bypass_rls', true) = 'on' 
    OR org_id = current_setting('app.current_org_id', true)
    OR (user_id IS NOT NULL AND user_id = current_setting('app.current_user_id', true))
  )
  WITH CHECK (
    org_id IS NULL 
    OR current_setting('app.bypass_rls', true) = 'on' 
    OR org_id = current_setting('app.current_org_id', true)
    OR (user_id IS NOT NULL AND user_id = current_setting('app.current_user_id', true))
  );

-- Devices policy:
-- 1. Unclaimed/consumer devices (org_id IS NULL) are freely accessible
-- 2. Administrative jobs can set app.bypass_rls = 'on'
-- 3. Enterprise fleet devices strictly isolate rows matching app.current_org_id
-- 4. User-scoped devices permit claimed devices matching app.current_user_id
DROP POLICY IF EXISTS tenant_isolation_policy_devices ON devices;
CREATE POLICY tenant_isolation_policy_devices ON devices
  FOR ALL
  USING (
    org_id IS NULL 
    OR current_setting('app.bypass_rls', true) = 'on' 
    OR org_id = current_setting('app.current_org_id', true)
    OR (user_id IS NOT NULL AND user_id = current_setting('app.current_user_id', true))
  )
  WITH CHECK (
    org_id IS NULL 
    OR current_setting('app.bypass_rls', true) = 'on' 
    OR org_id = current_setting('app.current_org_id', true)
    OR (user_id IS NOT NULL AND user_id = current_setting('app.current_user_id', true))
  );

-- Organizations policy:
-- Strictly isolates organization records to matching current_setting('app.current_org_id', true)
-- or administrative jobs with app.bypass_rls = 'on'
DROP POLICY IF EXISTS tenant_isolation_policy_organizations ON organizations;
CREATE POLICY tenant_isolation_policy_organizations ON organizations
  FOR ALL
  USING (
    current_setting('app.bypass_rls', true) = 'on' 
    OR id = current_setting('app.current_org_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on' 
    OR id = current_setting('app.current_org_id', true)
    OR current_setting('app.current_org_id', true) IS NULL
    OR current_setting('app.current_org_id', true) = ''
  );
