-- 1. Create the master_tugas_tambahan table
CREATE TABLE IF NOT EXISTS master_tugas_tambahan (
    id SERIAL PRIMARY KEY,
    nama_tugas TEXT NOT NULL,
    tahun_ajaran TEXT NOT NULL,
    semester TEXT NOT NULL,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Create unique index to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_master_tugas_tambahan_unique 
    ON master_tugas_tambahan (nama_tugas, tahun_ajaran, semester);

-- 3. Enable RLS
ALTER TABLE master_tugas_tambahan ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies
-- Allow anyone to read
CREATE POLICY "Allow read access to anyone" ON master_tugas_tambahan FOR SELECT USING (true);

-- Allow authenticated users to write (insert, update, delete)
CREATE POLICY "Allow all access to authenticated users" ON master_tugas_tambahan FOR ALL USING (auth.role() = 'authenticated');
