-- =====================================================
-- Jadwal Piket Table
-- =====================================================

CREATE TABLE IF NOT EXISTS jadwal_piket (
    id BIGSERIAL PRIMARY KEY,
    hari TEXT NOT NULL CHECK (hari IN ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat')),
    jam_ke INTEGER NOT NULL CHECK (jam_ke >= 1 AND jam_ke <= 14),
    waktu TEXT NOT NULL,
    kelas TEXT NOT NULL,
    kode_guru TEXT,
    nip TEXT,
    berlaku_mulai DATE NOT NULL,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jadwal_piket_kelas ON jadwal_piket(kelas, hari, aktif);
CREATE INDEX IF NOT EXISTS idx_jadwal_piket_kode ON jadwal_piket(kode_guru, hari, aktif);
CREATE INDEX IF NOT EXISTS idx_jadwal_piket_berlaku ON jadwal_piket(berlaku_mulai, aktif);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_jadwal_piket_updated_at ON jadwal_piket;
CREATE TRIGGER update_jadwal_piket_updated_at
    BEFORE UPDATE ON jadwal_piket
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
