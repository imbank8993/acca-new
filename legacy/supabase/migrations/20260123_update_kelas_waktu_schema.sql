-- Migration: Update ref_kelas and waktu tables to support 'program' field

-- 1. Update ref_kelas
-- Adding 'program' column.
ALTER TABLE ref_kelas ADD COLUMN IF NOT EXISTS program TEXT DEFAULT 'Reguler';

-- 2. Update waktu
-- Adding 'program' column.
ALTER TABLE waktu ADD COLUMN IF NOT EXISTS program TEXT DEFAULT 'Reguler';

-- Update Unique Constraint for waktu to include program
ALTER TABLE waktu DROP CONSTRAINT IF EXISTS waktu_jam_ke_hari_key;

-- We need to ensure we don't have duplicates before adding the constraint if there was existing data, 
-- but since we are dev, we assume it's fine or we truncate. 
-- For safety in dev, we can truncate if needed, but 'ADD CONSTRAINT' will fail if duplicates exist.
-- Assuming empty or non-conflicting data for now.
ALTER TABLE waktu ADD CONSTRAINT waktu_hari_program_jam_ke_key UNIQUE (hari, program, jam_ke);
