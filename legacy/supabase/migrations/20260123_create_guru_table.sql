-- Migration: Create guru table
-- RAW DATA: Guru (Data Induk)
CREATE TABLE IF NOT EXISTS guru (
    guru_id TEXT PRIMARY KEY, -- NIP or Custom ID
    nama_lengkap TEXT NOT NULL,
    tempat_lahir TEXT,
    tanggal_lahir DATE,
    golongan TEXT, -- e.g. III/a, IV/b
    pangkat TEXT, -- e.g. Penata Muda, Pembina
    tmt_tugas DATE, -- Tanggal Mulai Tugas
    pendidikan_terakhir TEXT, -- S1, S2, etc. display
    
    -- Riwayat Pendidikan (JSONB for flexibility: [{level: 'SD', detail: '...'}, {level: 'S1', detail: '...'}])
    riwayat_pendidikan JSONB DEFAULT '[]'::JSONB,
    
    alamat TEXT,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_guru_nama ON guru(nama_lengkap);

-- RLS
ALTER TABLE guru ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read guru') THEN
        CREATE POLICY "Public read guru" ON guru FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated insert guru') THEN
        CREATE POLICY "Authenticated insert guru" ON guru FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated update guru') THEN
        CREATE POLICY "Authenticated update guru" ON guru FOR UPDATE TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated delete guru') THEN
        CREATE POLICY "Authenticated delete guru" ON guru FOR DELETE TO authenticated USING (true);
    END IF;
END $$;
