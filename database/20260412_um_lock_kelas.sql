-- =============================================
-- SQL: Ujian Madrasah - Lock Per Kelas
-- =============================================

-- Tabel lock per kelas (admin bisa kunci nilai per kelas aktif)
CREATE TABLE IF NOT EXISTS um_lock_kelas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kelas           TEXT NOT NULL,
    tahun_ajaran    TEXT NOT NULL,
    locked          BOOLEAN NOT NULL DEFAULT true,
    locked_at       TIMESTAMPTZ DEFAULT now(),
    locked_by       TEXT,
    UNIQUE(kelas, tahun_ajaran)
);

-- Index untuk performa
CREATE INDEX IF NOT EXISTS idx_um_lock_kelas_lookup ON um_lock_kelas(kelas, tahun_ajaran);

-- RLS: hanya admin yang bisa read/write
ALTER TABLE um_lock_kelas ENABLE ROW LEVEL SECURITY;

-- Policy: admin only
CREATE POLICY "UM Lock Kelas: admin only read" ON um_lock_kelas
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "UM Lock Kelas: admin only write" ON um_lock_kelas
    FOR ALL USING (auth.role() = 'authenticated');
