-- ============================================================
-- Fix RLS on users table to ensure API access
-- Problem: users table was created via Dashboard, RLS may block
-- service role client queries in API routes
-- ============================================================

-- Disable RLS on users table (internal admin table, accessed via API)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Grant permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO anon;
GRANT ALL ON users TO service_role;

-- Also ensure izin_guru table is accessible (RLS disabled per existing migration)
ALTER TABLE izin_guru DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON izin_guru TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON izin_guru TO anon;
GRANT ALL ON izin_guru TO service_role;
