-- Add skip_hari_libur column to agenda_akademik
ALTER TABLE agenda_akademik ADD COLUMN IF NOT EXISTS skip_hari_libur BOOLEAN DEFAULT FALSE;

-- Update existing "Ujian" category to have this enabled by default to maintain previous behavior
UPDATE agenda_akademik SET skip_hari_libur = TRUE WHERE kategori = 'Ujian';
