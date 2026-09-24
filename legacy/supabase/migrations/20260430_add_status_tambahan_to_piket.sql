-- Add status_tambahan_1, status_tambahan_2, status_tambahan_3 to laporan_piket_detail
-- This allows piket input to add up to 3 additional presence statuses per class, similar to jurnal input

ALTER TABLE laporan_piket_detail
ADD COLUMN IF NOT EXISTS status_tambahan_1 TEXT,
ADD COLUMN IF NOT EXISTS status_tambahan_2 TEXT,
ADD COLUMN IF NOT EXISTS status_tambahan_3 TEXT;