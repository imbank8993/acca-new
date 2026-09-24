-- Migration: lebarkan ketidakhadiran.kelas dan petugas_nip
-- Tanggal: 2026-09-22
--
-- Masalah: kolom kelas dibuat VARCHAR(20) di 20260121_create_ketidakhadiran.sql.
-- Pada Kurikulum Merdeka, nama kelas peminatan/lanjutan memiliki nama panjang,
-- seperti "XI Bahasa Indonesia Lanjut 1" (28 karakter), "XI Sejarah Tingkat Lanjut 1" (27 karakter),
-- "XI Bahasa Inggris Lanjut 1" (26 karakter), "XI Matematika Lanjut 3" (22 karakter).
-- Akibatnya ketika menambahkan izin/sakit untuk siswa di kelas tersebut,
-- Prisma melempar error "The provided value for the column is too long for the column's type".
--
-- Mengubah kolom kelas menjadi TEXT (sama seperti di tabel siswa_kelas, absensi_sesi, guru_asuh)
-- dan petugas_nip menjadi VARCHAR(50).

ALTER TABLE public.ketidakhadiran
  ALTER COLUMN kelas TYPE TEXT;

ALTER TABLE public.ketidakhadiran
  ALTER COLUMN petugas_nip TYPE VARCHAR(50);
