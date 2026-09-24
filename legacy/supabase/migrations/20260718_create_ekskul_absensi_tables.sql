-- Migration: Absensi Ekstrakurikuler (pertemuan + kehadiran)
-- Created: 2026-07-18
-- Purpose: Pembina ekskul mencatat pertemuan & absensi peserta per pertemuan.
--   Diakses lewat halaman baru "ekskul-pembina". Jalankan via Dashboard SQL Editor.

-- ============================================
-- 1. PERTEMUAN EKSKUL (ekskul_pertemuan)
-- ============================================
CREATE TABLE IF NOT EXISTS ekskul_pertemuan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ekskul_id UUID NOT NULL REFERENCES ekskul(id) ON DELETE CASCADE,
    tanggal DATE NOT NULL,
    pertemuan_ke INTEGER,
    materi TEXT,
    catatan TEXT,
    nip VARCHAR(255) NOT NULL,          -- pembina yang mencatat
    nama_guru VARCHAR(255),
    tahun_ajaran TEXT NOT NULL,
    semester INTEGER NOT NULL CHECK (semester IN (1, 2)),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Satu pertemuan per ekskul per tanggal
CREATE UNIQUE INDEX IF NOT EXISTS idx_ekskul_pertemuan_unique
    ON ekskul_pertemuan (ekskul_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_ekskul_pertemuan_ekskul ON ekskul_pertemuan (ekskul_id);
CREATE INDEX IF NOT EXISTS idx_ekskul_pertemuan_ta_sem ON ekskul_pertemuan (tahun_ajaran, semester);

-- ============================================
-- 2. ABSENSI EKSKUL (ekskul_absensi)
-- ============================================
CREATE TABLE IF NOT EXISTS ekskul_absensi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pertemuan_id UUID NOT NULL REFERENCES ekskul_pertemuan(id) ON DELETE CASCADE,
    siswa_id BIGINT NOT NULL,           -- master_siswa.id (bigint)
    status TEXT NOT NULL DEFAULT 'H' CHECK (status IN ('H', 'S', 'I', 'A')),
    catatan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (pertemuan_id, siswa_id)
);

CREATE INDEX IF NOT EXISTS idx_ekskul_absensi_pertemuan ON ekskul_absensi (pertemuan_id);
CREATE INDEX IF NOT EXISTS idx_ekskul_absensi_siswa ON ekskul_absensi (siswa_id);

-- ============================================
-- RLS (API memakai service role; policy authenticated agar konsisten dgn ekskul)
-- ============================================
ALTER TABLE ekskul_pertemuan ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekskul_absensi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to anyone" ON ekskul_pertemuan;
DROP POLICY IF EXISTS "Allow all access to authenticated users" ON ekskul_pertemuan;
CREATE POLICY "Allow read access to anyone" ON ekskul_pertemuan FOR SELECT USING (true);
CREATE POLICY "Allow all access to authenticated users" ON ekskul_pertemuan FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow read access to anyone" ON ekskul_absensi;
DROP POLICY IF EXISTS "Allow all access to authenticated users" ON ekskul_absensi;
CREATE POLICY "Allow read access to anyone" ON ekskul_absensi FOR SELECT USING (true);
CREATE POLICY "Allow all access to authenticated users" ON ekskul_absensi FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- AKSES HALAMAN: ekskul-pembina
-- Pembina = role GURU (self-filter via ekskul_pembina di API);
-- plus ADMIN & WKM_KESISWAAN utk pengawasan/rekap semua ekskul.
-- ============================================
INSERT INTO role_pages (role, page_id, sort_order)
VALUES
    ('ADMIN', 'ekskul-pembina', 100),
    ('GURU', 'ekskul-pembina', 100),
    ('WKM_KESISWAAN', 'ekskul-pembina', 100)
ON CONFLICT (role, page_id) DO NOTHING;
