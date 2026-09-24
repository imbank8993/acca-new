-- Add substitute teacher columns to absensi_sesi
ALTER TABLE absensi_sesi ADD COLUMN IF NOT EXISTS guru_pengganti_nip TEXT;
ALTER TABLE absensi_sesi ADD COLUMN IF NOT EXISTS guru_pengganti_nama TEXT;

-- Index for performance when exporting
CREATE INDEX IF NOT EXISTS idx_absensi_sesi_substitute ON absensi_sesi(guru_pengganti_nip);
