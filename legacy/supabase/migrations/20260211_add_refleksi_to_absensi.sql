-- Add refleksi column to absensi_sesi
ALTER TABLE absensi_sesi ADD COLUMN IF NOT EXISTS refleksi TEXT;

-- Add journal_id to link with jurnal_guru table
ALTER TABLE absensi_sesi ADD COLUMN IF NOT EXISTS jurnal_id BIGINT;
