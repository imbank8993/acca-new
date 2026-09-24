-- Migration: Add flags for multiple simultaneous absence conditions
-- These are additive boolean flags that can coexist with main presence category
-- A teacher can have: kategori_kehadiran (main) + mengambil_istirahat + durasi_keluar_awal

ALTER TABLE jurnal_guru ADD COLUMN IF NOT EXISTS mengambil_istirahat BOOLEAN DEFAULT false;
ALTER TABLE jurnal_guru ADD COLUMN IF NOT EXISTS durasi_keluar_awal INTEGER;
