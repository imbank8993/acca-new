-- =====================================================
-- FIX: Disable RLS for Guru and Siswa (Match other tables)
-- =====================================================

-- This will make the tables "UNRESTRICTED" (Orange badge in Supabase)
-- This allows the API to access data without strict policy checks, solving the loading issue.

ALTER TABLE siswa DISABLE ROW LEVEL SECURITY;
ALTER TABLE guru DISABLE ROW LEVEL SECURITY;
