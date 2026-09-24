ALTER TABLE dokumen_siswa 
ADD COLUMN IF NOT EXISTS kategori TEXT DEFAULT 'Umum';

COMMENT ON COLUMN dokumen_siswa.kategori IS 'Nama folder atau kategori dokumen (misal: Rapor Semester 1, Ijazah)';
