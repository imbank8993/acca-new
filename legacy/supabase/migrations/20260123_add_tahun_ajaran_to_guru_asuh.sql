-- Add tahun_ajaran column to guru_asuh table
ALTER TABLE guru_asuh ADD COLUMN IF NOT EXISTS tahun_ajaran TEXT DEFAULT '2025/2026';

-- Optional: Update existing rows if needed
-- UPDATE guru_asuh SET tahun_ajaran = '2025/2026' WHERE tahun_ajaran IS NULL;
