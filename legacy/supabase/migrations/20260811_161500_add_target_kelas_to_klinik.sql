-- Migration: Add target_kelas to klinik_slots
-- Date: 2026-08-11

ALTER TABLE klinik_slots ADD COLUMN IF NOT EXISTS target_kelas TEXT[];
