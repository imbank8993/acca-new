-- Migration: Add dokumentasi to ekskul_pertemuan
-- Created: 2026-07-18
-- Purpose: Allow storing up to 3 photos per meeting

ALTER TABLE ekskul_pertemuan 
ADD COLUMN IF NOT EXISTS dokumentasi TEXT[];
