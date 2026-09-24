-- Migration: Add additional status columns for flexible presence tracking
-- Users can add up to 3 additional statuses via the "+" button
-- Total: 5 statuses per event (1 utama + 1 pengganti + 3 tambahan)
-- Columns:
-- 1. kategori_kehadiran - main dropdown (already exists)
-- 2. status_pengganti - replacement teacher status (already exists)
-- 3. durasi_terlambat - duration for Terlambat (already exists)
-- 4. durasi_keluar_awal - duration for "Keluar Sebelum Waktunya" (already exists)
-- 5. status_tambahan_1 - first additional status (VARCHAR, nullable)
-- 6. status_tambahan_2 - second additional status (VARCHAR, nullable)
-- 7. status_tambahan_3 - third additional status (VARCHAR, nullable)

ALTER TABLE jurnal_guru ADD COLUMN IF NOT EXISTS status_tambahan_1 VARCHAR(100);
ALTER TABLE jurnal_guru ADD COLUMN IF NOT EXISTS status_tambahan_2 VARCHAR(100);
ALTER TABLE jurnal_guru ADD COLUMN IF NOT EXISTS status_tambahan_3 VARCHAR(100);
