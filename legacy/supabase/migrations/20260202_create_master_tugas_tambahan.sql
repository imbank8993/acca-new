CREATE TABLE IF NOT EXISTS master_tugas_tambahan (
    id SERIAL PRIMARY KEY,
    nama_tugas TEXT NOT NULL,
    tahun_ajaran TEXT NOT NULL,
    semester TEXT NOT NULL,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_master_tugas_tambahan_unique 
    ON master_tugas_tambahan (nama_tugas, tahun_ajaran, semester);

ALTER TABLE master_tugas_tambahan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to anyone" ON master_tugas_tambahan FOR SELECT USING (true);
CREATE POLICY "Allow all access to authenticated users" ON master_tugas_tambahan FOR ALL USING (auth.role() = 'authenticated');
