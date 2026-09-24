-- =============================================
-- SQL: Ujian Madrasah (UM) Tables
-- Run di Supabase SQL Editor
-- =============================================

-- 1. Tabel Konfigurasi Mata Pelajaran UM
CREATE TABLE IF NOT EXISTS ujian_madrasah_mapel (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode        TEXT NOT NULL UNIQUE,
    nama_mapel  TEXT NOT NULL,
    urutan      INT  NOT NULL DEFAULT 0,
    aktif       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Insert default mata pelajaran UM
INSERT INTO ujian_madrasah_mapel (kode, nama_mapel, urutan) VALUES
  ('AQH', 'Al-Qur''an Hadits',    1),
  ('AKA', 'Akidah Akhlak',        2),
  ('FIQ', 'Fiqih',                3),
  ('SKI', 'SKI',                  4),
  ('BAR', 'Bahasa Arab',          5),
  ('PPK', 'PPKn',                 6),
  ('BIN', 'Bhs Indonesia',        7),
  ('BIG', 'Bhs Inggris',          8),
  ('MTK', 'Matematika',           9),
  ('SEJ', 'Sejarah Indonesia',    10),
  ('FIS', 'Fisika',               11),
  ('KIM', 'Kimia',                12),
  ('BIO', 'Biologi',              13),
  ('EKO', 'Ekonomi',              14),
  ('GEO', 'Geografi',             15),
  ('SOS', 'Sosiologi',            16),
  ('SNB', 'Seni Budaya',          17),
  ('PJK', 'PJOK',                 18),
  ('PRK', 'Prakarya',             19)
ON CONFLICT (kode) DO NOTHING;

-- 2. Tabel Nilai Ujian Madrasah
CREATE TABLE IF NOT EXISTS ujian_madrasah (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kelas           TEXT NOT NULL,
    nisn            TEXT NOT NULL,
    mapel           TEXT NOT NULL,
    nilai           NUMERIC(5,2),
    catatan         TEXT,
    tahun_ajaran    TEXT NOT NULL DEFAULT '2025/2026',
    input_by_nip    TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT ujian_madrasah_unique UNIQUE (kelas, nisn, mapel, tahun_ajaran)
);

-- 3. Index untuk performa query
CREATE INDEX IF NOT EXISTS idx_um_kelas_ta ON ujian_madrasah(kelas, tahun_ajaran);
CREATE INDEX IF NOT EXISTS idx_um_nisn     ON ujian_madrasah(nisn);

-- 4. Row Level Security (RLS) — aktifkan sesuai kebijakan
ALTER TABLE ujian_madrasah ENABLE ROW LEVEL SECURITY;
ALTER TABLE ujian_madrasah_mapel ENABLE ROW LEVEL SECURITY;

-- Policy: Semua authenticated user bisa baca
CREATE POLICY "UM: authenticated can read" ON ujian_madrasah
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "UM Mapel: authenticated can read" ON ujian_madrasah_mapel
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Authenticated user bisa insert/update
CREATE POLICY "UM: authenticated can write" ON ujian_madrasah
    FOR ALL USING (auth.role() = 'authenticated');

-- =============================================
-- Add permissions entry ke master_permissions_list
-- =============================================
INSERT INTO master_permissions_list (category, resource, action, label, description)
VALUES
  ('Ujian Madrasah', 'ujian-madrasah', 'view',   'Lihat Ujian Madrasah',    'Melihat halaman & data Ujian Madrasah'),
  ('Ujian Madrasah', 'ujian-madrasah', 'create',  'Input Nilai UM',          'Menginput nilai Ujian Madrasah'),
  ('Ujian Madrasah', 'ujian-madrasah', 'edit',    'Edit Nilai UM',           'Mengubah nilai Ujian Madrasah'),
  ('Ujian Madrasah', 'ujian-madrasah', 'delete',  'Hapus Nilai UM',          'Menghapus nilai Ujian Madrasah'),
  ('Ujian Madrasah', 'ujian-madrasah', 'import',  'Import Excel UM',         'Import nilai UM dari file Excel'),
  ('Ujian Madrasah', 'ujian-madrasah', 'export',  'Export/Download Nilai UM','Export nilai UM ke file Excel')
ON CONFLICT (resource, action) DO NOTHING;
