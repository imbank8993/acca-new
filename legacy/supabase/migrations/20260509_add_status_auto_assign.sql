-- Tambah kolom status_auto_assign untuk menandai siswa yang di-auto-assign
ALTER TABLE form_pendaftaran_kokurikuler
ADD COLUMN IF NOT EXISTS status_auto_assign BOOLEAN DEFAULT false;

-- Tambah comment untuk dokumentasi
COMMENT ON COLUMN form_pendaftaran_kokurikuler.status_auto_assign IS 'True jika siswa di-assign ke program yang tidak dipilhnya karena tidak lolos di semua pilihan';