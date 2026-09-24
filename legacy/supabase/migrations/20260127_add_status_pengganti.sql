-- Migration to add status_pengganti column to jurnal_guru table
-- Created at: 2026-01-27

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'jurnal_guru'
        AND column_name = 'status_pengganti'
    ) THEN
        ALTER TABLE jurnal_guru
        ADD COLUMN status_pengganti VARCHAR(50);
    END IF;
END $$;
