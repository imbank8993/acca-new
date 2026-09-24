-- Migration: Add rekening columns to master_guru
-- Stores up to 2 bank accounts per teacher directly in master_guru
-- This replaces the need for a separate rekening_guru table for self-service profile editing

BEGIN;

-- Add rekening_1 columns
ALTER TABLE master_guru
    ADD COLUMN IF NOT EXISTS rekening_1_nama_bank TEXT,
    ADD COLUMN IF NOT EXISTS rekening_1_nomor TEXT,
    ADD COLUMN IF NOT EXISTS rekening_1_atas_nama TEXT,
    ADD COLUMN IF NOT EXISTS rekening_1_aktif BOOLEAN DEFAULT true;

-- Add rekening_2 columns
ALTER TABLE master_guru
    ADD COLUMN IF NOT EXISTS rekening_2_nama_bank TEXT,
    ADD COLUMN IF NOT EXISTS rekening_2_nomor TEXT,
    ADD COLUMN IF NOT EXISTS rekening_2_atas_nama TEXT,
    ADD COLUMN IF NOT EXISTS rekening_2_aktif BOOLEAN DEFAULT true;

-- Add updated_at if not exists
ALTER TABLE master_guru
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add comments
COMMENT ON COLUMN master_guru.rekening_1_nama_bank IS 'Nama bank rekening utama (Bank 1)';
COMMENT ON COLUMN master_guru.rekening_1_nomor IS 'Nomor rekening bank 1';
COMMENT ON COLUMN master_guru.rekening_1_atas_nama IS 'Nama pemilik rekening bank 1';
COMMENT ON COLUMN master_guru.rekening_1_aktif IS 'Apakah rekening bank 1 aktif';
COMMENT ON COLUMN master_guru.rekening_2_nama_bank IS 'Nama bank rekening cadangan (Bank 2)';
COMMENT ON COLUMN master_guru.rekening_2_nomor IS 'Nomor rekening bank 2';
COMMENT ON COLUMN master_guru.rekening_2_atas_nama IS 'Nama pemilik rekening bank 2';
COMMENT ON COLUMN master_guru.rekening_2_aktif IS 'Apakah rekening bank 2 aktif';

COMMIT;
