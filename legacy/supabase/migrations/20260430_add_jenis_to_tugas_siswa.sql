-- Add jenis column to tugas_siswa: 'tugas' or 'pengingat'
-- Also add optional metadata fields for pengingat type

ALTER TABLE tugas_siswa
    ADD COLUMN IF NOT EXISTS jenis TEXT NOT NULL DEFAULT 'tugas',
    ADD COLUMN IF NOT EXISTS ruangan TEXT,
    ADD COLUMN IF NOT EXISTS durasi TEXT,
    ADD COLUMN IF NOT EXISTS sifat_ujian TEXT;

-- Index for faster filtering by jenis
CREATE INDEX IF NOT EXISTS idx_tugas_siswa_jenis ON tugas_siswa(jenis);
