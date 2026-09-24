-- Migration Script: Drop email column from master tables
-- Run this in Supabase SQL Editor

BEGIN;

ALTER TABLE master_guru DROP COLUMN IF EXISTS email;
ALTER TABLE master_siswa DROP COLUMN IF EXISTS email;

COMMIT;
