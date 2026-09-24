-- Add sort_order column to informasi_akademik for folder ordering
ALTER TABLE informasi_akademik
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 999;

-- Update existing NULL values to 999 so they sort last by default
UPDATE informasi_akademik SET sort_order = 999 WHERE sort_order IS NULL;

-- Add NOT NULL constraint after data is fixed
ALTER TABLE informasi_akademik
ALTER COLUMN sort_order SET NOT NULL;

-- Add index for faster sorting
CREATE INDEX IF NOT EXISTS idx_informasi_akademik_sort_order ON informasi_akademik(sort_order);
