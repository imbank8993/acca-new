-- Add rata_um and rata_ijazah columns to kelulusan_data for direct import
ALTER TABLE kelulusan_data
    ADD COLUMN IF NOT EXISTS rata_um   NUMERIC(5,2) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS rata_ijazah NUMERIC(5,2) DEFAULT NULL;

-- Trigger already exists from previous migration
