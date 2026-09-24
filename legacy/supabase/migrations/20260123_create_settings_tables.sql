-- =====================================================
-- PENGATURAN DATA: Relationship Tables
-- Updated: 2026-01-23 
-- =====================================================

-- 1. SISWA - KELAS
-- Header: id, nisn, nama_siswa, kelas, tahun_ajaran, aktif
CREATE TABLE IF NOT EXISTS siswa_kelas (
    id BIGSERIAL PRIMARY KEY,
    nisn TEXT NOT NULL,
    nama_siswa TEXT NOT NULL,
    kelas TEXT NOT NULL,
    tahun_ajaran TEXT NOT NULL,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(nisn, tahun_ajaran)
);

-- 2. WALI KELAS (Kelas - Guru)
-- Header: id, nama_kelas, guru_id, nama_guru, aktif
CREATE TABLE IF NOT EXISTS wali_kelas (
    id BIGSERIAL PRIMARY KEY,
    nama_kelas TEXT NOT NULL,
    guru_id TEXT NOT NULL,
    nama_guru TEXT NOT NULL,
    tahun_ajaran TEXT, 
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(nama_kelas, tahun_ajaran) 
);

-- 3. GURU ASUH (Guru - Siswa)
-- Header: id, guru_id, nama_guru, nisn_siswa, nama_siswa, aktif
DROP TABLE IF EXISTS guru_asuh_new; -- cleanup
DROP TABLE IF EXISTS guru_asuh;
CREATE TABLE guru_asuh (
    id BIGSERIAL PRIMARY KEY,
    guru_id TEXT NOT NULL,
    nama_guru TEXT NOT NULL,
    nisn_siswa TEXT NOT NULL,
    nama_siswa TEXT NOT NULL,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. GURU MAPEL (Guru - Mapel)
-- Header: id, guru_id, nama_guru, nama_mapel
DROP TABLE IF EXISTS guru_mapel_new; -- cleanup
DROP TABLE IF EXISTS guru_mapel;
CREATE TABLE guru_mapel (
    id BIGSERIAL PRIMARY KEY,
    guru_id TEXT NOT NULL,
    nama_guru TEXT NOT NULL,
    nama_mapel TEXT NOT NULL,
    tahun_ajaran TEXT,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. LIBUR
-- Header: id, tanggal, jam_ke, keterangan
CREATE TABLE IF NOT EXISTS libur (
    id BIGSERIAL PRIMARY KEY,
    tanggal DATE NOT NULL,
    jam_ke TEXT DEFAULT 'Semua', 
    keterangan TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS for these tables
ALTER TABLE siswa_kelas DISABLE ROW LEVEL SECURITY;
ALTER TABLE wali_kelas DISABLE ROW LEVEL SECURITY;
ALTER TABLE guru_asuh DISABLE ROW LEVEL SECURITY;
ALTER TABLE guru_mapel DISABLE ROW LEVEL SECURITY;
ALTER TABLE libur DISABLE ROW LEVEL SECURITY;
