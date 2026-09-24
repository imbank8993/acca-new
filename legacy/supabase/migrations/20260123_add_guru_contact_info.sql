-- Migration: Add contact info columns to guru table
ALTER TABLE guru
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS no_hp TEXT;
