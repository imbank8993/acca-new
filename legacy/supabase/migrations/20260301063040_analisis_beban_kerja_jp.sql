-- Add jumlah_jp to master_tugas_tambahan
ALTER TABLE master_tugas_tambahan ADD COLUMN IF NOT EXISTS jumlah_jp INTEGER DEFAULT 0;

-- Create master_jp_mapel for dynamic JTM mapping
CREATE TABLE IF NOT EXISTS master_jp_mapel (
    id SERIAL PRIMARY KEY,
    nama_mapel TEXT NOT NULL,
    tingkat_kelas TEXT NOT NULL,
    tahun_ajaran TEXT NOT NULL,
    semester TEXT NOT NULL,
    jumlah_jp INTEGER DEFAULT 0,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_master_jp_mapel_unique 
    ON master_jp_mapel (nama_mapel, tingkat_kelas, tahun_ajaran, semester);

ALTER TABLE master_jp_mapel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to anyone" ON master_jp_mapel FOR SELECT USING (true);
CREATE POLICY "Allow all access to authenticated users" ON master_jp_mapel FOR ALL USING (auth.role() = 'authenticated');

-- Create ploting_beban_kerja for saving simulations/plotting drafts
CREATE TABLE IF NOT EXISTS ploting_beban_kerja (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    nip TEXT NOT NULL,
    nama_guru TEXT NOT NULL,
    tahun_ajaran TEXT NOT NULL,
    semester TEXT NOT NULL,
    total_jp_mapel INTEGER DEFAULT 0,
    total_jp_tugas INTEGER DEFAULT 0,
    total_jp INTEGER DEFAULT 0,
    rincian_mapel JSONB DEFAULT '[]'::jsonb,
    rincian_tugas JSONB DEFAULT '[]'::jsonb,
    status_memenuhi BOOLEAN DEFAULT false,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ploting_beban_kerja_unique 
    ON ploting_beban_kerja (nip, tahun_ajaran, semester);

ALTER TABLE ploting_beban_kerja ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access to anyone" ON ploting_beban_kerja FOR SELECT USING (true);
CREATE POLICY "Allow all access to authenticated users" ON ploting_beban_kerja FOR ALL USING (auth.role() = 'authenticated');
