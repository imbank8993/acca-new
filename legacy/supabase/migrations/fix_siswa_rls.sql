-- =====================================================
-- FIX: Add INSERT/UPDATE Policies for 'siswa' table
-- =====================================================

-- Allow authenticated users to INSERT new students
CREATE POLICY "Enable insert for authenticated users" ON "public"."siswa"
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to UPDATE students
CREATE POLICY "Enable update for authenticated users" ON "public"."siswa"
AS PERMISSIVE FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to DELETE students (Optional, but good for management)
CREATE POLICY "Enable delete for authenticated users" ON "public"."siswa"
AS PERMISSIVE FOR DELETE
TO authenticated
USING (true);
