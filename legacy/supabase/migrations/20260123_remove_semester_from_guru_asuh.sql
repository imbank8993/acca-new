-- Remove semester column from guru_asuh table as per user request
ALTER TABLE guru_asuh DROP COLUMN IF EXISTS semester;

-- Drop the index related to semester on guru_asuh if it exists
DROP INDEX IF EXISTS idx_guru_asuh_semester;
