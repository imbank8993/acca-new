-- Migration: Perbaiki constraint unik pada nilai_data agar menyertakan tahun_ajaran
-- Mencegah tabrakan nilai antar tahun ajaran untuk siswa atau tagihan yang sama

ALTER TABLE public.nilai_data DROP CONSTRAINT IF EXISTS unique_nilai_entry;
ALTER TABLE public.nilai_data ADD CONSTRAINT unique_nilai_entry
  UNIQUE (nip, kelas, mapel, semester, tahun_ajaran, nisn, jenis, tagihan, materi_tp);
