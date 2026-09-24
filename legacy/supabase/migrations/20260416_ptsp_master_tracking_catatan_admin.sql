-- Add catatan_admin column to ptsp_master_tracking so status sync from child tables
-- can also carry admin notes to the master tracking record
ALTER TABLE ptsp_master_tracking ADD COLUMN IF NOT EXISTS catatan_admin TEXT;
