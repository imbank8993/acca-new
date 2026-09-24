-- Add file_size column to all tables that store file URLs
-- Use IF NOT EXISTS for columns - safe to run multiple times

-- informasi_akademik (sudah ada kolumnya)
ALTER TABLE informasi_akademik ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT NULL;

-- personal_documents (sudah ada kolumnya)
ALTER TABLE personal_documents ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT NULL;

-- ketidakhadiran
ALTER TABLE ketidakhadiran ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT NULL;

-- dokumen_siswa
ALTER TABLE dokumen_siswa ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT NULL;

-- uploaded_documents
ALTER TABLE uploaded_documents ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT NULL;

-- tugas_siswa
ALTER TABLE tugas_siswa ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT NULL;

-- acca_letters
ALTER TABLE acca_letters ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT NULL;

-- surat
ALTER TABLE surat ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT NULL;

-- ptsp tables (kolom terpisah untuk tiap file)
ALTER TABLE ptsp_peminjaman_sarana ADD COLUMN IF NOT EXISTS file_proposal_size BIGINT DEFAULT NULL;
ALTER TABLE ptsp_izin_penelitian ADD COLUMN IF NOT EXISTS file_proposal_size BIGINT DEFAULT NULL;
ALTER TABLE ptsp_pengaduan ADD COLUMN IF NOT EXISTS file_bukti_size BIGINT DEFAULT NULL;
ALTER TABLE ptsp_sosialisasi ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT NULL;