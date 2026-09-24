-- Create table for student documents
CREATE TABLE IF NOT EXISTS dokumen_siswa (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nisn TEXT NOT NULL, -- We don't enforce FK strictly if data is messy, but ideally references siswa(nisn)
    judul TEXT NOT NULL,
    file_url TEXT NOT NULL, -- Public URL or Signed URL path
    file_path TEXT NOT NULL, -- Storage path
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by TEXT -- Optional: username/email of uploader
);

-- Index for faster lookup by NISN
CREATE INDEX IF NOT EXISTS idx_dok_siswa_nisn ON dokumen_siswa(nisn);

-- Enable RLS
ALTER TABLE dokumen_siswa ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Admin (authenticated) can manage everything
-- Adjust 'service_role' or specific roles if needed, but 'authenticated' covers logged in users (admins/teachers)
CREATE POLICY "Admin manage dokumen_siswa" ON dokumen_siswa
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 2. Public Read (for students via API)
-- Since verification happens at API level using Secret Key or Service Role, 
-- we might not need public RLS. But if we want `akademik-app` to fetch directly:
-- CREATE POLICY "Public read dokumen_siswa" ON dokumen_siswa FOR SELECT USING (true);
-- For now, keep it restricted. `akademik-app` will use a secure API route.

-- STORAGE BUCKET CONFIGURATION (Idempotent-ish)
-- Note: Creating buckets via SQL is specific to Supabase implementation and might require `storage` schema access.
-- We will try to insert into storage.buckets if permissions allow, otherwise we handle via client.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('dokumen-siswa', 'dokumen-siswa', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
-- Policy for inserting objects (authenticated users)
CREATE POLICY "Admin insert dokumen-siswa" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'dokumen-siswa');

-- Policy for reading objects (public because we set bucket to public, but let's be explicit)
CREATE POLICY "Public read dokumen-siswa" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'dokumen-siswa');

-- Policy for deleting objects (authenticated)
CREATE POLICY "Admin delete dokumen-siswa" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'dokumen-siswa');
