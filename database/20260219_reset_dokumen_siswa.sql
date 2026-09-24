-- Reset dokumen_siswa Table
-- This script will DROP the existing table and recreate it from scratch.

-- 1. Drop existing table (and dependent constraints)
DROP TABLE IF EXISTS "public"."dokumen_siswa" CASCADE;

-- 2. Create table with all columns
CREATE TABLE "public"."dokumen_siswa" (
    "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "nisn" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "uploaded_at" TIMESTAMPTZ DEFAULT NOW(),
    "uploaded_by" TEXT,
    "kategori" TEXT DEFAULT 'Umum' -- Added from the separate migration
);

-- 3. Add Foreign Key Constraint (Explicitly to public.siswa)
ALTER TABLE "public"."dokumen_siswa"
ADD CONSTRAINT "fk_dokumen_siswa_nisn"
FOREIGN KEY ("nisn")
REFERENCES "public"."siswa"("nisn")
ON DELETE CASCADE;

-- 4. Create Index
CREATE INDEX IF NOT EXISTS "idx_dok_siswa_nisn" ON "public"."dokumen_siswa"("nisn");

-- 5. Enable RLS
ALTER TABLE "public"."dokumen_siswa" ENABLE ROW LEVEL SECURITY;

-- 6. Re-apply Policies
DROP POLICY IF EXISTS "Admin manage dokumen_siswa" ON "public"."dokumen_siswa";
CREATE POLICY "Admin manage dokumen_siswa" ON "public"."dokumen_siswa"
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Comments
COMMENT ON COLUMN "public"."dokumen_siswa"."kategori" IS 'Nama folder atau kategori dokumen (misal: Rapor Semester 1, Ijazah)';
