-- Migration: Add approver_role column to master_tugas_tambahan
-- This allows admins to configure which WKM (Akademik/Kesiswaan) approves each task type

ALTER TABLE master_tugas_tambahan 
  ADD COLUMN IF NOT EXISTS approver_role VARCHAR(50) DEFAULT 'WKM_AKADEMIK';

COMMENT ON COLUMN master_tugas_tambahan.approver_role IS 
  'Role WKM yang bertanggung jawab approve tugas ini: WKM_AKADEMIK, WKM_KESISWAAN, atau SEMUA_WKM';

-- Set default mapping for common task types
UPDATE master_tugas_tambahan SET approver_role = 'WKM_KESISWAAN' 
WHERE LOWER(nama_tugas) LIKE '%ekstrakurikuler%' 
   OR LOWER(nama_tugas) LIKE '%eskul%'
   OR LOWER(nama_tugas) LIKE '%osim%'
   OR LOWER(nama_tugas) LIKE '%pramuka%'
   OR LOWER(nama_tugas) LIKE '%pembina%';

UPDATE master_tugas_tambahan SET approver_role = 'WKM_AKADEMIK' 
WHERE approver_role IS NULL OR approver_role = 'WKM_AKADEMIK';
