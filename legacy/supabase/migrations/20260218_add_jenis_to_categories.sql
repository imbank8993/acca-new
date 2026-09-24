
-- Migration: Add 'jenis' column to upload_categories
-- Default to 'official' for existing records

ALTER TABLE upload_categories 
ADD COLUMN IF NOT EXISTS jenis TEXT DEFAULT 'official';

-- Add check constraint to ensure only valid values
ALTER TABLE upload_categories 
ADD CONSTRAINT check_jenis_category 
CHECK (jenis IN ('official', 'student'));

-- Update any nulls just in case
UPDATE upload_categories SET jenis = 'official' WHERE jenis IS NULL;
