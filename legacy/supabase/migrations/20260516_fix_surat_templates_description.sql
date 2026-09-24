-- =====================================================
-- Fix: Add missing 'description' column to surat_templates
-- This ensures the column exists even if the original
-- migration 20250513_create_surat_templates.sql wasn't applied
-- Date: 2026-05-16
-- =====================================================

-- Add description column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'surat_templates'
        AND column_name = 'description'
    ) THEN
        ALTER TABLE surat_templates ADD COLUMN description TEXT;
    END IF;
END $$;

COMMENT ON COLUMN surat_templates.description IS 'Deskripsi singkat tentang template surat';
