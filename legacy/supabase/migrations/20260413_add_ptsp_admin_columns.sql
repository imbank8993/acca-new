-- Migration: Add missing admin-tracking columns to PTSP tables
-- is_edited, edit_count, updated_at columns for admin audit trail

-- ptsp_master_tracking (no is_edited/edit_count needed, just updated_at)
ALTER TABLE ptsp_master_tracking ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE ptsp_master_tracking ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;
ALTER TABLE ptsp_master_tracking ADD COLUMN IF NOT EXISTS edit_count INTEGER DEFAULT 0;

-- ptsp_buku_tamu
ALTER TABLE ptsp_buku_tamu ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE ptsp_buku_tamu ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;
ALTER TABLE ptsp_buku_tamu ADD COLUMN IF NOT EXISTS edit_count INTEGER DEFAULT 0;

-- ptsp_izin_siswa
ALTER TABLE ptsp_izin_siswa ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE ptsp_izin_siswa ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;
ALTER TABLE ptsp_izin_siswa ADD COLUMN IF NOT EXISTS edit_count INTEGER DEFAULT 0;

-- ptsp_izin_magang
ALTER TABLE ptsp_izin_magang ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE ptsp_izin_magang ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;
ALTER TABLE ptsp_izin_magang ADD COLUMN IF NOT EXISTS edit_count INTEGER DEFAULT 0;

-- ptsp_legalisir
ALTER TABLE ptsp_legalisir ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE ptsp_legalisir ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;
ALTER TABLE ptsp_legalisir ADD COLUMN IF NOT EXISTS edit_count INTEGER DEFAULT 0;

-- ptsp_mutasi_siswa
ALTER TABLE ptsp_mutasi_siswa ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE ptsp_mutasi_siswa ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;
ALTER TABLE ptsp_mutasi_siswa ADD COLUMN IF NOT EXISTS edit_count INTEGER DEFAULT 0;

-- ptsp_pengganti_ijazah
ALTER TABLE ptsp_pengganti_ijazah ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE ptsp_pengganti_ijazah ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;
ALTER TABLE ptsp_pengganti_ijazah ADD COLUMN IF NOT EXISTS edit_count INTEGER DEFAULT 0;

-- ptsp_sosialisasi
ALTER TABLE ptsp_sosialisasi ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE ptsp_sosialisasi ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;
ALTER TABLE ptsp_sosialisasi ADD COLUMN IF NOT EXISTS edit_count INTEGER DEFAULT 0;
