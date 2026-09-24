-- Verify and fix informasi_akademik table columns
-- Run this to ensure all columns exist

-- Add show_on_landing if not exists
ALTER TABLE informasi_akademik
ADD COLUMN IF NOT EXISTS show_on_landing BOOLEAN DEFAULT true;

-- Add sort_order if not exists
ALTER TABLE informasi_akademik
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 999 NOT NULL;

-- Fix any NULL sort_order values
UPDATE informasi_akademik SET sort_order = 999 WHERE sort_order IS NULL;

-- Ensure NOT NULL constraint
ALTER TABLE informasi_akademik
ALTER COLUMN sort_order SET NOT NULL;

-- Create index if not exists
CREATE INDEX IF NOT EXISTS idx_informasi_akademik_sort_order ON informasi_akademik(sort_order);
CREATE INDEX IF NOT EXISTS idx_informasi_akademik_show_on_landing ON informasi_akademik(show_on_landing);
