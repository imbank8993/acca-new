-- =====================================================
-- FIX: Re-apply RLS Policies safely (Drop & Recreate)
-- =====================================================

-- 1. Reset Policies for 'siswa'
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON "siswa";
DROP POLICY IF EXISTS "Enable update for authenticated users" ON "siswa";
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON "siswa";
DROP POLICY IF EXISTS "Public read siswa" ON "siswa";

-- Re-create for Siswa
CREATE POLICY "Public read siswa" ON "siswa" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON "siswa" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON "siswa" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete for authenticated users" ON "siswa" FOR DELETE TO authenticated USING (true);


-- 2. Reset Policies for 'guru' (Just in case)
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON "guru";
DROP POLICY IF EXISTS "Enable update for authenticated users" ON "guru";
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON "guru";
DROP POLICY IF EXISTS "Public read guru" ON "guru";

-- Re-create for Guru
CREATE POLICY "Public read guru" ON "guru" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON "guru" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON "guru" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete for authenticated users" ON "guru" FOR DELETE TO authenticated USING (true);

-- Ensure RLS is enabled
ALTER TABLE siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE guru ENABLE ROW LEVEL SECURITY;
