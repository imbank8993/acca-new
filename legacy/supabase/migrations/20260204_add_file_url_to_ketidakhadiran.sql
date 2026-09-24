-- Migration: Add file_url to ketidakhadiran table
-- Created: 2026-02-04
-- Description: Adds a column to store the URL of uploaded supporting documents

ALTER TABLE ketidakhadiran ADD COLUMN file_url TEXT;

COMMENT ON COLUMN ketidakhadiran.file_url IS 'URL dokumen pendukung yang diunggah ke hosting';
