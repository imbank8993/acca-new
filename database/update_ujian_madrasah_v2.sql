-- =============================================
-- SQL Update: Ujian Madrasah (UM) dengan Guru Pengampu
-- =============================================

-- Tambahkan kolom guru_nip jika belum ada
ALTER TABLE ujian_madrasah ADD COLUMN IF NOT EXISTS guru_nip TEXT;

-- Hapus unique constraint lama
ALTER TABLE ujian_madrasah DROP CONSTRAINT IF EXISTS ujian_madrasah_unique;

-- Buat unique constraint baru yang mencakup guru_nip
ALTER TABLE ujian_madrasah ADD CONSTRAINT ujian_madrasah_unique UNIQUE (kelas, nisn, mapel, tahun_ajaran, guru_nip);
