-- Migration: Fix unique constraint on master_tahun_ajaran
-- Description: Allow multiple semesters for the same academic year

-- 1. Drop the old unique constraint on just tahun_ajaran
ALTER TABLE IF EXISTS master_tahun_ajaran 
DROP CONSTRAINT IF EXISTS master_tahun_ajaran_tahun_ajaran_key;

-- 2. Add new unique constraint on (tahun_ajaran, semester)
-- This allows "2024/2025" Ganjil and "2024/2025" Genap to coexist.
ALTER TABLE IF EXISTS master_tahun_ajaran
ADD CONSTRAINT master_tahun_ajaran_tahun_semester_key UNIQUE (tahun_ajaran, semester);
