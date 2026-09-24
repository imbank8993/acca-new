-- Migration: Add kelas_list column to tugas_siswa table for multi-kelas support
-- Also add created_by_nip for precise guru ownership tracking

ALTER TABLE tugas_siswa
    ADD COLUMN IF NOT EXISTS kelas_list JSONB DEFAULT '[]'::JSONB,
    ADD COLUMN IF NOT EXISTS created_by_nip TEXT;

-- Migrate existing single kelas to kelas_list array
UPDATE tugas_siswa
SET kelas_list = to_jsonb(ARRAY[kelas])
WHERE kelas IS NOT NULL AND kelas_list = '[]'::JSONB;

-- Backfill created_by_nip from guru_id for existing records
UPDATE tugas_siswa
SET created_by_nip = guru_id
WHERE created_by_nip IS NULL AND guru_id IS NOT NULL;

-- Add comments
COMMENT ON COLUMN tugas_siswa.kelas_list IS 'Array of kelas names as JSONB, e.g. ["X IPA 1", "X IPA 2"]';
COMMENT ON COLUMN tugas_siswa.created_by_nip IS 'NIP/NISN of the user who created the tugas';

-- Index for faster kelas_list filtering
CREATE INDEX IF NOT EXISTS idx_tugas_siswa_kelas_list ON tugas_siswa USING GIN (kelas_list);
CREATE INDEX IF NOT EXISTS idx_tugas_siswa_created_by_nip ON tugas_siswa(created_by_nip);
