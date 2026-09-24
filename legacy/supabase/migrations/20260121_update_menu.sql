-- Migration: Add Ketidakhadiran to user menu
-- Created: 2026-01-21
-- Description: Updates the pages column for Admin and relevant operators to include Ketidakhadiran menu

-- 1. Update ADMIN users
-- Append ",Ketidakhadiran" if not already present
UPDATE users 
SET pages = pages || ',Ketidakhadiran'
WHERE role = 'Admin' 
  AND pages NOT LIKE '%Ketidakhadiran%';

-- 2. Update OP_IZIN users
UPDATE users 
SET pages = pages || ',Ketidakhadiran'
WHERE role = 'OP_Izin' 
  AND pages NOT LIKE '%Ketidakhadiran%';

-- 3. Update OP_UKS users
UPDATE users 
SET pages = pages || ',Ketidakhadiran'
WHERE role = 'OP_UKS' 
  AND pages NOT LIKE '%Ketidakhadiran%';

-- Comment: If you use the checkbox format (legacy), this might need adjustment.
-- Assuming standard comma-separated format based on current codebase.
