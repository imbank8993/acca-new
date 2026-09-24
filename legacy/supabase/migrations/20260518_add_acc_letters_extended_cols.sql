-- Migration: Add columns needed by generate-letter API
-- Run this in Supabase SQL Editor

-- 1. Extend jenis_izin check constraint
ALTER TABLE acca_letters DROP CONSTRAINT IF EXISTS acca_letters_jenis_izin_check;
ALTER TABLE acca_letters ADD CONSTRAINT acca_letters_jenis_izin_check
    CHECK (jenis_izin IN ('P', 'M', 'AKHIR_PEKAN', 'REKAM_MEDIK', 'REKOMENDASI_KONTROL'));

-- 2. Penandatangan fields
ALTER TABLE acca_letters ADD COLUMN IF NOT EXISTS penjabat_nama TEXT;
ALTER TABLE acca_letters ADD COLUMN IF NOT EXISTS penjabat_jabatan TEXT;

-- 3. is_printed flag (if not exists from earlier migration)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'acca_letters' AND column_name = 'is_printed'
    ) THEN
        ALTER TABLE acca_letters ADD COLUMN is_printed BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- 4. Link to ketidakhadiran source (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'acca_letters' AND column_name = 'ketidakhadiran_id'
    ) THEN
        ALTER TABLE acca_letters ADD COLUMN ketidakhadiran_id UUID REFERENCES ketidakhadiran(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_acc_letters_ketidakhadiran_id
    ON acca_letters(ketidakhadiran_id) WHERE ketidakhadiran_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_acc_letters_is_printed
    ON acca_letters(is_printed) WHERE is_printed = true;