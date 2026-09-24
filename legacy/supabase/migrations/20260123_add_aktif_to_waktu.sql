-- Migration: Add 'aktif' column to 'master_waktu' table (and ensure for others)
-- Using 'master_waktu' because 'waktu' does not exist.
ALTER TABLE master_waktu ADD COLUMN IF NOT EXISTS aktif BOOLEAN DEFAULT true;

-- Ensure other tables also have it (just in case)
ALTER TABLE master_siswa ADD COLUMN IF NOT EXISTS aktif BOOLEAN DEFAULT true;
ALTER TABLE master_guru ADD COLUMN IF NOT EXISTS aktif BOOLEAN DEFAULT true;
ALTER TABLE master_mapel ADD COLUMN IF NOT EXISTS aktif BOOLEAN DEFAULT true;
ALTER TABLE master_kelas ADD COLUMN IF NOT EXISTS aktif BOOLEAN DEFAULT true;
