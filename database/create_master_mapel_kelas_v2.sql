-- =============================================
-- SQL: Master Mapel per Kelas (Dengan Guru)
-- =============================================

-- Hapus tabel lama jika ingin reset struktur totoal
DROP TABLE IF EXISTS master_mapel_kelas;

CREATE TABLE IF NOT EXISTS master_mapel_kelas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mapel_kode      TEXT NOT NULL REFERENCES master_mapel(kode) ON DELETE CASCADE,
    kelas_nama      TEXT NOT NULL,
    tahun_ajaran    TEXT NOT NULL,
    guru_nip        TEXT REFERENCES master_guru(nip) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),

    -- Unique per Mapel + Kelas + TA + Guru
    CONSTRAINT master_mapel_kelas_unique UNIQUE (mapel_kode, kelas_nama, tahun_ajaran, guru_nip)
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_mapel_kelas_nama ON master_mapel_kelas(kelas_nama, tahun_ajaran);

-- RLS
ALTER TABLE master_mapel_kelas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mapel Kelas: authenticated can read" ON master_mapel_kelas
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Mapel Kelas: authenticated can write" ON master_mapel_kelas
    FOR ALL USING (auth.role() = 'authenticated');
