-- Migration: Add target_siswa column to tugas_siswa table
-- Description: This column stores specific student selections (JSON array of NISNs) if the assignment is not for the whole class.

ALTER TABLE tugas_siswa ADD COLUMN IF NOT EXISTS target_siswa JSONB;
COMMENT ON COLUMN tugas_siswa.target_siswa IS 'List of specific NISNs if not assigned to the whole class, e.g. ["001", "002"]';
