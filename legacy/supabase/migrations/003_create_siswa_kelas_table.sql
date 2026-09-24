-- =====================================================
-- ACCA App: Tabel SISWA_KELAS
-- Migration: Create table untuk data siswa per kelas
-- =====================================================

-- Buat tabel siswa_kelas
CREATE TABLE IF NOT EXISTS siswa_kelas (
    id BIGSERIAL PRIMARY KEY,
    
    -- Identitas Siswa
    siswa_id TEXT,                  -- ID unik siswa (opsional, bisa di-generate)
    nisn TEXT NOT NULL,              -- NISN (WAJIB TEXT untuk leading zero)
    nama TEXT NOT NULL,              -- Nama lengkap siswa
    
    -- Data Kelas
    kelas TEXT NOT NULL,             -- Kelas (contoh: "X A", "XI IPA 1", "XII B")
    tahun_ajaran TEXT,               -- Tahun ajaran (contoh: "2024/2025")
    
    -- Status
    aktif BOOLEAN DEFAULT true,      -- Status aktif siswa
    
    -- Data Tambahan (opsional)
    jenis_kelamin TEXT,              -- L/P
    tempat_lahir TEXT,               -- Tempat lahir
    tanggal_lahir DATE,              -- Tanggal lahir
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint: NISN harus unik
    UNIQUE(nisn)
);

-- Index untuk performance
CREATE INDEX IF NOT EXISTS idx_siswa_kelas_nisn ON siswa_kelas(nisn);
CREATE INDEX IF NOT EXISTS idx_siswa_kelas_kelas ON siswa_kelas(kelas, aktif);
CREATE INDEX IF NOT EXISTS idx_siswa_kelas_nama ON siswa_kelas(nama);
CREATE INDEX IF NOT EXISTS idx_siswa_kelas_tahun_ajaran ON siswa_kelas(tahun_ajaran, kelas);

-- Trigger auto-update updated_at
CREATE TRIGGER update_siswa_kelas_updated_at
    BEFORE UPDATE ON siswa_kelas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE siswa_kelas IS 'Data siswa per kelas - untuk absensi dan nilai';
COMMENT ON COLUMN siswa_kelas.nisn IS 'NISN siswa (TEXT untuk preserve leading zero)';
COMMENT ON COLUMN siswa_kelas.kelas IS 'Kelas siswa (contoh: XI B, X IPA 1)';
COMMENT ON COLUMN siswa_kelas.aktif IS 'Status aktif siswa (true/false)';

-- =====================================================
-- Template untuk Import CSV/Excel
-- =====================================================
-- 
-- Header CSV/Excel yang harus ada (urutan bebas):
-- nisn, nama, kelas, aktif
--
-- Header opsional (bisa diabaikan):
-- siswa_id, tahun_ajaran, jenis_kelamin, tempat_lahir, tanggal_lahir
--
-- Contoh data:
-- nisn         | nama              | kelas | aktif
-- 0089123456   | Ahmad Fauzi       | XI B  | TRUE
-- 0089123457   | Budi Santoso      | XI B  | TRUE
-- 0089123458   | Citra Dewi        | XI C  | TRUE
--
-- ⚠️ PENTING:
-- - NISN harus format TEXT (jangan number) untuk preserve leading zero
-- - Aktif: TRUE/FALSE atau 1/0
-- - Kelas: sesuai dengan jadwal_guru yang sudah ada
--
