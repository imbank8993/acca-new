-- Add storage_type column to track which storage each file uses
-- This allows accurate per-storage usage calculation

-- informasi_akademik
ALTER TABLE informasi_akademik ADD COLUMN IF NOT EXISTS storage_type VARCHAR(20) DEFAULT 'supabase';
ALTER TABLE informasi_akademik ADD CONSTRAINT informasi_akademik_storage_type_check
    CHECK (storage_type IN ('supabase', 'cloudflare')) DEFERRABLE;

-- personal_documents
ALTER TABLE personal_documents ADD COLUMN IF NOT EXISTS storage_type VARCHAR(20) DEFAULT 'supabase';
ALTER TABLE personal_documents ADD CONSTRAINT personal_documents_storage_type_check
    CHECK (storage_type IN ('supabase', 'cloudflare')) DEFERRABLE;

-- ketidakhadiran
ALTER TABLE ketidakhadiran ADD COLUMN IF NOT EXISTS storage_type VARCHAR(20) DEFAULT 'supabase';
ALTER TABLE ketidakhadiran ADD CONSTRAINT ketidakhadiran_storage_type_check
    CHECK (storage_type IN ('supabase', 'cloudflare')) DEFERRABLE;

-- dokumen_siswa
ALTER TABLE dokumen_siswa ADD COLUMN IF NOT EXISTS storage_type VARCHAR(20) DEFAULT 'supabase';
ALTER TABLE dokumen_siswa ADD CONSTRAINT dokumen_siswa_storage_type_check
    CHECK (storage_type IN ('supabase', 'cloudflare')) DEFERRABLE;

-- uploaded_documents
ALTER TABLE uploaded_documents ADD COLUMN IF NOT EXISTS storage_type VARCHAR(20) DEFAULT 'supabase';
ALTER TABLE uploaded_documents ADD CONSTRAINT uploaded_documents_storage_type_check
    CHECK (storage_type IN ('supabase', 'cloudflare')) DEFERRABLE;

-- tugas_siswa
ALTER TABLE tugas_siswa ADD COLUMN IF NOT EXISTS storage_type VARCHAR(20) DEFAULT 'supabase';
ALTER TABLE tugas_siswa ADD CONSTRAINT tugas_siswa_storage_type_check
    CHECK (storage_type IN ('supabase', 'cloudflare')) DEFERRABLE;

-- acca_letters
ALTER TABLE acca_letters ADD COLUMN IF NOT EXISTS storage_type VARCHAR(20) DEFAULT 'supabase';
ALTER TABLE acca_letters ADD CONSTRAINT acca_letters_storage_type_check
    CHECK (storage_type IN ('supabase', 'cloudflare')) DEFERRABLE;

-- surat
ALTER TABLE surat ADD COLUMN IF NOT EXISTS storage_type VARCHAR(20) DEFAULT 'supabase';
ALTER TABLE surat ADD CONSTRAINT surat_storage_type_check
    CHECK (storage_type IN ('supabase', 'cloudflare')) DEFERRABLE;

-- ptsp_sosialisasi
ALTER TABLE ptsp_sosialisasi ADD COLUMN IF NOT EXISTS storage_type VARCHAR(20) DEFAULT 'supabase';

-- ptsp tables
ALTER TABLE ptsp_peminjaman_sarana ADD COLUMN IF NOT EXISTS storage_type VARCHAR(20) DEFAULT 'supabase';
ALTER TABLE ptsp_izin_penelitian ADD COLUMN IF NOT EXISTS storage_type VARCHAR(20) DEFAULT 'supabase';
ALTER TABLE ptsp_pengaduan ADD COLUMN IF NOT EXISTS storage_type VARCHAR(20) DEFAULT 'supabase';

-- Update existing rows to use 'supabase' as default
UPDATE informasi_akademik SET storage_type = 'supabase' WHERE storage_type IS NULL;
UPDATE personal_documents SET storage_type = 'supabase' WHERE storage_type IS NULL;
UPDATE ketidakhadiran SET storage_type = 'supabase' WHERE storage_type IS NULL;
UPDATE dokumen_siswa SET storage_type = 'supabase' WHERE storage_type IS NULL;
UPDATE uploaded_documents SET storage_type = 'supabase' WHERE storage_type IS NULL;
UPDATE tugas_siswa SET storage_type = 'supabase' WHERE storage_type IS NULL;
UPDATE acca_letters SET storage_type = 'supabase' WHERE storage_type IS NULL;
UPDATE surat SET storage_type = 'supabase' WHERE storage_type IS NULL;
UPDATE ptsp_sosialisasi SET storage_type = 'supabase' WHERE ptsp_sosialisasi.storage_type IS NULL;
UPDATE ptsp_peminjaman_sarana SET storage_type = 'supabase' WHERE ptsp_peminjaman_sarana.storage_type IS NULL;
UPDATE ptsp_izin_penelitian SET storage_type = 'supabase' WHERE ptsp_izin_penelitian.storage_type IS NULL;
UPDATE ptsp_pengaduan SET storage_type = 'supabase' WHERE ptsp_pengaduan.storage_type IS NULL;