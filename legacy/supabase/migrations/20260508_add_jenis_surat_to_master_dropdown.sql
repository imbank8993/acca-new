-- Migration: Add jenis_surat column to master_dropdown
-- Created: 2026-05-08
-- Description: Add jenis_surat column for storing surat type options

ALTER TABLE public.master_dropdown
ADD COLUMN IF NOT EXISTS jenis_surat text;

-- Seed jenis_surat options
INSERT INTO public.master_dropdown (jenis_surat, urutan)
VALUES
('Surat Masuk', 1),
('Surat Keluar', 2),
('Nota Dinas', 3),
('Undangan', 4),
('Surat Pengantar', 5),
('Pemberitahuan', 6),
('Surat Rekomendasi', 7),
('Surat Izin', 8),
('Berita Acara', 9),
('Surat Tugas', 10),
('Surat Keterangan', 11),
('Surat Edaran', 12)
ON CONFLICT DO NOTHING;
