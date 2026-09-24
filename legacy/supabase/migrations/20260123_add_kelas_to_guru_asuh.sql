-- Add kelas column to guru_asuh table
ALTER TABLE guru_asuh ADD COLUMN IF NOT EXISTS kelas TEXT;

-- Update existing rows if any (optional, purely for data consistency if needed)
-- UPDATE guru_asuh SET kelas = ... 
