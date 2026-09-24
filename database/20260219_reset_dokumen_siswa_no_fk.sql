-- Reset dokumen_siswa Table (NO FK VERSION)
-- Use this if the Foreign Key constraint is causing errors.

-- 1. Drop existing table
DROP TABLE IF EXISTS "public"."dokumen_siswa" CASCADE;

-- 2. Create table with all columns
CREATE TABLE "public"."dokumen_siswa" (
    "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "nisn" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "uploaded_by" TEXT,
    "kategori" TEXT DEFAULT 'Umum'
);

-- 3. Create Index (Good practice regardless of FK)
CREATE INDEX IF NOT EXISTS "idx_dok_siswa_nisn" ON "public"."dokumen_siswa"("nisn");

-- 4. Enable RLS
ALTER TABLE "public"."dokumen_siswa" ENABLE ROW LEVEL SECURITY;

-- 5. Re-apply Policies
DROP POLICY IF EXISTS "Admin manage dokumen_siswa" ON "public"."dokumen_siswa";
CREATE POLICY "Admin manage dokumen_siswa" ON "public"."dokumen_siswa"
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Comments
COMMENT ON COLUMN "public"."dokumen_siswa"."kategori" IS 'Nama folder atau kategori dokumen (misal: Rapor Semester 1, Ijazah)';
