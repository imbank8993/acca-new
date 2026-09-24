-- Migration Script: Add email column to master_siswa
-- Run this in Supabase SQL Editor

BEGIN;

ALTER TABLE master_siswa ADD COLUMN IF NOT EXISTS email text;

COMMIT;
