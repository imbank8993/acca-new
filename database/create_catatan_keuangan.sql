-- =============================================
-- SQL: Catatan Keuangan Tables
-- Run di Supabase SQL Editor
-- =============================================

-- 1. Tabel Catatan Keuangan
CREATE TABLE IF NOT EXISTS catatan_keuangan (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_guru       TEXT NOT NULL,
    nip             TEXT,
    nama_kegitan    TEXT NOT NULL,
    item            TEXT NOT NULL,
    nominal         NUMERIC(15,2) NOT NULL DEFAULT 0,
    keterangan      TEXT,
    status          TEXT NOT NULL DEFAULT 'BELUM_TERGANTI' CHECK (status IN ('BELUM_TERGANTI', 'TERGANTI')),
    tahun_ajaran    TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    created_by      TEXT,
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 2. Index
CREATE INDEX IF NOT EXISTS idx_ck_nip ON catatan_keuangan(nip);
CREATE INDEX IF NOT EXISTS idx_ck_status ON catatan_keuangan(status);
CREATE INDEX IF NOT EXISTS idx_ck_tahun_ajaran ON catatan_keuangan(tahun_ajaran);

-- 3. RLS
ALTER TABLE catatan_keuangan ENABLE ROW LEVEL SECURITY;

-- Policy: Semua authenticated user bisa read
CREATE POLICY "CK: authenticated can read" ON catatan_keuangan
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Authenticated user bisa insert/update
CREATE POLICY "CK: authenticated can write" ON catatan_keuangan
    FOR ALL USING (auth.role() = 'authenticated');

-- 4. Permissions
INSERT INTO master_permissions_list (category, resource, action, label, description)
VALUES
  ('Keuangan', 'catatan-keuangan', 'view',   'Lihat Catatan Keuangan',    'Melihat halaman & data Catatan Keuangan'),
  ('Keuangan', 'catatan-keuangan', 'create',  'Input Catatan Keuangan',    'Menginput Catatan Keuangan'),
  ('Keuangan', 'catatan-keuangan', 'edit',    'Edit Catatan Keuangan',    'Mengubah Catatan Keuangan'),
  ('Keuangan', 'catatan-keuangan', 'delete',  'Hapus Catatan Keuangan',  'Menghapus Catatan Keuangan')
ON CONFLICT (resource, action) DO NOTHING;
