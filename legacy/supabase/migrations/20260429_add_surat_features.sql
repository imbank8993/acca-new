-- Migration: Add surat features columns
-- Features: lampiran_count, lampiran_type, lampiran_title, lampiran_file, lampiran_guru_ids, lampiran_siswa_ids, poin, paragraf

ALTER TABLE public.surat
ADD COLUMN IF NOT EXISTS lampiran_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS lampiran_type TEXT DEFAULT 'guru',
ADD COLUMN IF NOT EXISTS lampiran_title TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS lampiran_file TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS lampiran_guru_ids TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS lampiran_siswa_ids TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS poin TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS paragraf TEXT DEFAULT '';

-- Add comments for documentation
COMMENT ON COLUMN surat.lampiran_count IS 'Jumlah lampiran: 0, 1, atau 2';
COMMENT ON COLUMN surat.lampiran_type IS 'Jenis lampiran: guru atau siswa';
COMMENT ON COLUMN surat.lampiran_title IS 'Judul manual untuk lampiran';
COMMENT ON COLUMN surat.lampiran_file IS 'Base64 atau URL file yang diupload';
COMMENT ON COLUMN surat.lampiran_guru_ids IS 'Array ID guru yang dipilih';
COMMENT ON COLUMN surat.lampiran_siswa_ids IS 'Array ID siswa yang dipilih';
COMMENT ON COLUMN surat.poin IS 'Isi poin pemberitahuan (trigger: @poin)';
COMMENT ON COLUMN surat.paragraf IS 'Isi paragraf surat (bisa mehrere paragraf dipisahkan ---)';
