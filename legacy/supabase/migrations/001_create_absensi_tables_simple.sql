-- =====================================================
-- ACCA App: Modul Absensi (Kehadiran)
-- Migration: Kompatibel 100% dengan Google Apps Script
-- Versi: FINAL - Match dengan struktur existing
-- =====================================================

-- =====================================================
-- Tabel: jadwal_guru (Jadwal Mengajar Guru)
-- =====================================================
CREATE TABLE IF NOT EXISTS jadwal_guru (
    id BIGSERIAL PRIMARY KEY,
    guru_id TEXT NOT NULL,
    nama_guru TEXT NOT NULL,
    hari TEXT NOT NULL CHECK (hari IN ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu')),
    jam_ke TEXT NOT NULL,  -- Format: "1", "2-5", "3-4" (TEXT untuk support range)
    kelas TEXT NOT NULL,
    mata_pelajaran TEXT NOT NULL,
    tahun_ajaran TEXT NOT NULL DEFAULT '2024/2025',
    semester INTEGER NOT NULL DEFAULT 2 CHECK (semester IN (1, 2)),
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeks untuk jadwal_guru
CREATE INDEX IF NOT EXISTS idx_jadwal_guru_guru_id ON jadwal_guru(guru_id, hari, aktif);
CREATE INDEX IF NOT EXISTS idx_jadwal_guru_kelas ON jadwal_guru(kelas, hari, aktif);
CREATE INDEX IF NOT EXISTS idx_jadwal_guru_tahun_semester ON jadwal_guru(tahun_ajaran, semester, aktif);

-- =====================================================
-- Tabel: absensi_sesi (Sesi Pertemuan/Mengajar)
-- Match dengan sheet ABSENSI_SESI
-- =====================================================
CREATE TABLE IF NOT EXISTS absensi_sesi (
    id BIGSERIAL PRIMARY KEY,
    sesi_id TEXT NOT NULL UNIQUE,  -- UUID dari GAS, untuk kompatibilitas
    jadwal_id BIGINT REFERENCES jadwal_guru(id) ON DELETE SET NULL,
    
    -- Data sesi
    tanggal DATE NOT NULL,
    kelas TEXT NOT NULL,
    mapel TEXT NOT NULL,  -- Sesuai field "Mapel" di GAS
    jam_ke TEXT NOT NULL,  -- Format range: "2-5", "3-4" (TEXT)
    
    -- Data guru (snapshot)
    guru_id TEXT NOT NULL,
    nama_guru TEXT NOT NULL,  -- Snapshot nama saat sesi dibuat
    
    -- Status & Draft
    status_sesi TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status_sesi IN ('DRAFT', 'FINAL')),
    draft_type TEXT NOT NULL DEFAULT 'DRAFT_DEFAULT' CHECK (draft_type IN ('DRAFT_DEFAULT', 'DRAFT_GURU', 'FINAL')),
    
    -- Materi & catatan sesi
    materi TEXT,
    catatan TEXT,
    
    -- Tahun ajaran
    tahun_ajaran TEXT NOT NULL DEFAULT '2024/2025',
    semester INTEGER NOT NULL DEFAULT 2 CHECK (semester IN (1, 2)),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint: hindari duplikat sesi
    UNIQUE(kelas, tanggal, jam_ke, mapel)
);

-- Indeks untuk absensi_sesi
CREATE INDEX IF NOT EXISTS idx_absensi_sesi_sesi_id ON absensi_sesi(sesi_id);
CREATE INDEX IF NOT EXISTS idx_absensi_sesi_guru ON absensi_sesi(guru_id, tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_absensi_sesi_kelas ON absensi_sesi(kelas, tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_absensi_sesi_jadwal ON absensi_sesi(jadwal_id);
CREATE INDEX IF NOT EXISTS idx_absensi_sesi_status ON absensi_sesi(status_sesi, draft_type);

-- =====================================================
-- Tabel: absensi_detail (Detail Kehadiran Siswa)
-- Match dengan sheet ABSENSI_DETAIL
-- =====================================================
CREATE TABLE IF NOT EXISTS absensi_detail (
    id BIGSERIAL PRIMARY KEY,
    
    -- Link ke sesi  
    sesi_id TEXT NOT NULL,  -- Match dengan absensi_sesi.sesi_id (TEXT UUID)
    
    -- Data siswa (snapshot)
    nisn TEXT NOT NULL,  -- ⚠️ WAJIB TEXT karena leading zero (contoh: "00899")
    nama_snapshot TEXT NOT NULL,  -- Nama siswa saat absensi dibuat
    
    -- Status kehadiran
    status TEXT NOT NULL DEFAULT 'HADIR' CHECK (status IN ('HADIR', 'IZIN', 'SAKIT', 'ALPHA')),
    
    -- Logika otomatis vs manual
    otomatis BOOLEAN DEFAULT true,  -- true = auto-sync dari KETIDAKHADIRAN, false = manual guru
    
    -- Link ke ketidakhadiran (jika ada)
    ref_ketidakhadiran_id TEXT,  -- UUID link ke tabel ketidakhadiran (jika IZIN/SAKIT dari sana)
    
    -- Catatan/keterangan
    catatan TEXT,  -- Bisa diisi untuk semua status, tapi LOCK jika ada ref_ketidakhadiran_id
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint: satu record per siswa per sesi
    UNIQUE(sesi_id, nisn)
);

-- Indeks untuk absensi_detail
CREATE INDEX IF NOT EXISTS idx_absensi_detail_sesi ON absensi_detail(sesi_id);
CREATE INDEX IF NOT EXISTS idx_absensi_detail_nisn ON absensi_detail(nisn);
CREATE INDEX IF NOT EXISTS idx_absensi_detail_status ON absensi_detail(status);
CREATE INDEX IF NOT EXISTS idx_absensi_detail_ref ON absensi_detail(ref_ketidakhadiran_id) WHERE ref_ketidakhadiran_id IS NOT NULL;

-- =====================================================
-- Fungsi Helper
-- =====================================================

-- Fungsi untuk update timestamp updated_at otomatis
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger auto-update updated_at di jadwal_guru
CREATE TRIGGER update_jadwal_guru_updated_at
    BEFORE UPDATE ON jadwal_guru
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger auto-update updated_at di absensi_sesi
CREATE TRIGGER update_absensi_sesi_updated_at
    BEFORE UPDATE ON absensi_sesi
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger auto-update updated_at di absensi_detail
CREATE TRIGGER update_absensi_detail_updated_at
    BEFORE UPDATE ON absensi_detail
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Komentar Tabel
-- =====================================================

COMMENT ON TABLE jadwal_guru IS 'Jadwal mengajar guru - scope kelas/mapel/jam untuk setiap guru';
COMMENT ON TABLE absensi_sesi IS 'Sesi pertemuan/mengajar - satu record per pertemuan kelas';
COMMENT ON TABLE absensi_detail IS 'Record kehadiran siswa - kehadiran individual per sesi';

COMMENT ON COLUMN jadwal_guru.jam_ke IS 'Format TEXT untuk support range: "1", "2-5", "3-4"';
COMMENT ON COLUMN absensi_sesi.sesi_id IS 'UUID dari Google Apps Script untuk kompatibilitas';
COMMENT ON COLUMN absensi_sesi.status_sesi IS 'DRAFT = masih bisa diubah, FINAL = locked';
COMMENT ON COLUMN absensi_sesi.draft_type IS 'DRAFT_DEFAULT = baru dibuat, DRAFT_GURU = sudah diisi, FINAL = locked';
COMMENT ON COLUMN absensi_detail.nisn IS 'WAJIB TEXT karena bisa ada leading zero (contoh: 00899)';
COMMENT ON COLUMN absensi_detail.status IS 'HADIR/IZIN/SAKIT/ALPHA (kata lengkap, bukan kode)';
COMMENT ON COLUMN absensi_detail.otomatis IS 'true = auto dari KETIDAKHADIRAN, false = manual guru';
COMMENT ON COLUMN absensi_detail.ref_ketidakhadiran_id IS 'Link ke tabel ketidakhadiran jika status IZIN/SAKIT dari sana';
COMMENT ON COLUMN absensi_detail.catatan IS 'Keterangan absensi - LOCK jika ada ref_ketidakhadiran_id';

-- =====================================================
-- Catatan Migrasi
-- =====================================================
-- 
-- Schema ini 100% kompatibel dengan Google Apps Script existing:
-- 1. jam_ke = TEXT untuk support range ("2-5")
-- 2. sesi_id = TEXT UUID (dari GAS)
-- 3. nisn = TEXT (untuk leading zero)
-- 4. status = kata lengkap (HADIR/IZIN/SAKIT/ALPHA)
-- 5. Semua field penting ada: otomatis, ref_ketidakhadiran_id, status_sesi, draft_type
--
-- RLS sengaja tidak diaktifkan untuk development awal.
-- Akan ditambahkan di migration berikutnya.
