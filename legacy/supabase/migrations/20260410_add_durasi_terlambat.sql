-- Migration: Add durasi_terlambat column to jurnal table
-- Purpose: Store late duration in minutes for "Terlambat" category

ALTER TABLE jurnal_guru ADD COLUMN IF NOT EXISTS durasi_terlambat INTEGER;
