-- Add Rekam Medik columns and Real Time columns to ketidakhadiran table
ALTER TABLE ketidakhadiran ADD COLUMN IF NOT EXISTS tindakan TEXT;
ALTER TABLE ketidakhadiran ADD COLUMN IF NOT EXISTS tindak_lanjut TEXT;
ALTER TABLE ketidakhadiran ADD COLUMN IF NOT EXISTS waktu_mulai_real TIME;
ALTER TABLE ketidakhadiran ADD COLUMN IF NOT EXISTS waktu_selesai_real TIME;

-- Remove redundant column if you have created it before
-- ALTER TABLE ketidakhadiran DROP COLUMN IF EXISTS waktu_kunjungan;

-- Add comments for documentation
COMMENT ON COLUMN ketidakhadiran.tindakan IS 'Tindakan medis yang dilakukan (khusus jenis Sakit)';
COMMENT ON COLUMN ketidakhadiran.tindak_lanjut IS 'Tindak lanjut medis (khusus jenis Sakit)';
COMMENT ON COLUMN ketidakhadiran.waktu_mulai_real IS 'Jam mulai dalam format waktu riil (HH:mm)';
COMMENT ON COLUMN ketidakhadiran.waktu_selesai_real IS 'Jam selesai dalam format waktu riil (HH:mm)';
