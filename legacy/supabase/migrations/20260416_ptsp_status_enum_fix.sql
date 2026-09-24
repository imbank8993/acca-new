-- Cek RLS dan policies di ptsp_master_tracking

SELECT
    relname AS table_name,
    relrowsecurity AS rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ptsp_master_tracking') AS policy_count
FROM pg_class
WHERE relname = 'ptsp_master_tracking' AND relnamespace = 'public'::regnamespace;
