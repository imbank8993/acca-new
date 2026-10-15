-- Migration: Menambahkan kolom nomor_hp pada tabel master_siswa
-- Memungkinkan siswa mengisi nomor HP mandiri via tab Data Diri di halaman profil
-- dan ditampilkan di halaman Master Siswa.

BEGIN;

ALTER TABLE public.master_siswa
  ADD COLUMN IF NOT EXISTS nomor_hp text;

COMMENT ON COLUMN public.master_siswa.nomor_hp IS 'Nomor HP pribadi siswa yang dapat diperbarui mandiri via profil';

COMMIT;
