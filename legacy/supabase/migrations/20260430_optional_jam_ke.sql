-- 20260430_drop_jam_ke.sql
-- Drop kolom jam_mulai/jam_selesai; waktu_mulai_real/waktu_selesai_real adalah sumber utama

ALTER TABLE ketidakhadiran
  DROP COLUMN IF EXISTS jam_mulai,
  DROP COLUMN IF EXISTS jam_selesai;
