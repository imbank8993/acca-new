-- Add role column to form_pendaftaran_kokurikuler table
ALTER TABLE form_pendaftaran_kokurikuler ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'SISWA';
