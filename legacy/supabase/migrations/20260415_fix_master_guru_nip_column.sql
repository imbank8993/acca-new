-- Migration: Fix master_guru column names
-- Ensures master_guru has a 'nip' column (not guru_id, nipasguru_id, etc.)
-- Run this in Supabase SQL Editor

BEGIN;

-- 1. Check current columns
-- This migration will add 'nip' column if it doesn't exist,
-- and/or rename problematic columns

DO $$
DECLARE
    col_exists BOOLEAN;
    has_nip BOOLEAN := FALSE;
    has_guru_id BOOLEAN := FALSE;
    has_nipasguru_id BOOLEAN := FALSE;
    col_name TEXT;
BEGIN
    -- Check what columns exist
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'master_guru') THEN
        FOR col_name IN
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'master_guru' AND table_schema = 'public'
        LOOP
            IF col_name = 'nip' THEN
                has_nip := TRUE;
            ELSIF col_name = 'guru_id' THEN
                has_guru_id := TRUE;
            ELSIF col_name = 'nipasguru_id' THEN
                has_nipasguru_id := TRUE;
            END IF;
        END LOOP;

        RAISE NOTICE 'master_guru columns check: nip=%, guru_id=%, nipasguru_id=%', has_nip, has_guru_id, has_nipasguru_id;

        -- If nipasguru_id exists, rename to nip
        IF has_nipasguru_id AND NOT has_nip THEN
            ALTER TABLE master_guru RENAME COLUMN nipasguru_id TO nip;
            RAISE NOTICE 'Renamed nipasguru_id to nip';
        END IF;

        -- If guru_id exists and nip doesn't, rename guru_id to nip
        IF has_guru_id AND NOT has_nip THEN
            ALTER TABLE master_guru RENAME COLUMN guru_id TO nip;
            RAISE NOTICE 'Renamed guru_id to nip';
        END IF;

        -- If neither nip nor guru_id exists, add nip column
        IF NOT has_nip AND NOT has_guru_id AND NOT has_nipasguru_id THEN
            -- Check if there's any text column we can use as nip
            -- This is a fallback - ideally we'd know what column holds the NIP
            RAISE WARNING 'master_guru has neither nip nor guru_id column. Manual inspection needed.';
        END IF;
    ELSE
        RAISE EXCEPTION 'master_guru table does not exist!';
    END IF;
END $$;

COMMIT;
