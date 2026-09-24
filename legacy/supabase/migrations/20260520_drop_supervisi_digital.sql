-- ============================================================
-- MIGRATION: Drop Supervisi Digital Tables
-- Run via: Supabase Dashboard > SQL Editor
-- Or: npx supabase migration up
-- ============================================================

-- Drop dalam urutan: anak dulu (foreign key dependencies)
DROP TABLE IF EXISTS penilaian CASCADE;
DROP TABLE IF EXISTS dokumen_upload CASCADE;
DROP TABLE IF EXISTS rubrik_persetujuan CASCADE;
DROP TABLE IF EXISTS dokumen_persyaratan CASCADE;
DROP TABLE IF EXISTS rekap_penilaian CASCADE;
DROP TABLE IF EXISTS supervisor_assignment CASCADE;
DROP TABLE IF EXISTS indikator_penilaian CASCADE;
DROP TABLE IF EXISTS dokumen_kategori CASCADE;

-- Hapus menu entry (jika ada tabel pages/kategori_menu yang menyimpan menu)
-- NOTE: Skip karena tabel "pages" tidak ada di schema ini.
-- Jika menu disimpan di tempat lain, cek manual di Supabase Dashboard.