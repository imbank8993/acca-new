-- Add tahun_ajaran to nilai tables
ALTER TABLE IF EXISTS nilai_data ADD COLUMN IF NOT EXISTS tahun_ajaran text DEFAULT '2024/2025';
ALTER TABLE IF EXISTS nilai_bobot ADD COLUMN IF NOT EXISTS tahun_ajaran text DEFAULT '2024/2025';
ALTER TABLE IF EXISTS nilai_tagihan ADD COLUMN IF NOT EXISTS tahun_ajaran text DEFAULT '2024/2025';

-- We should ideally update unique constraints to include tahun_ajaran, 
-- but that depends on existing constraints. 
-- For now, adding the column allows storing the data.
