-- Migration: Update surat table for 3-kode format
-- Created: 2026-05-08
-- Description: Add 3 kode columns to replace single kategori/bagian

-- Add 3 kode columns to surat
ALTER TABLE IF EXISTS surat
    ADD COLUMN IF NOT EXISTS nomor_kode1 VARCHAR(20) DEFAULT 'A',
    ADD COLUMN IF NOT EXISTS nomor_kode1_nama VARCHAR(100),
    ADD COLUMN IF NOT EXISTS nomor_kode2 VARCHAR(20) DEFAULT '001',
    ADD COLUMN IF NOT EXISTS nomor_kode2_nama VARCHAR(100),
    ADD COLUMN IF NOT EXISTS nomor_kode3 VARCHAR(20) DEFAULT 'G',
    ADD COLUMN IF NOT EXISTS nomor_kode3_nama VARCHAR(100);

-- Migrate existing data: nomor_kategori -> nomor_kode1
UPDATE surat SET nomor_kode1 = COALESCE(nomor_kategori, 'A') WHERE nomor_kode1 IS NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_surat_kode1 ON surat(nomor_kode1);
CREATE INDEX IF NOT EXISTS idx_surat_kode2 ON surat(nomor_kode2);
CREATE INDEX IF NOT EXISTS idx_surat_kode3 ON surat(nomor_kode3);

-- Update existing surat_templates to use the new kode format
UPDATE surat_templates SET template_html = REPLACE(template_html, '{kode}', '{kode1}')
WHERE template_html LIKE '%{kode}%';
