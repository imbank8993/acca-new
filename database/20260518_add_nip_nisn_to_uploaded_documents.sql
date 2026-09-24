-- Add NIP/NISN columns to uploaded_documents for bulk upload feature
-- These columns identify the target person for each uploaded document

ALTER TABLE uploaded_documents ADD COLUMN IF NOT EXISTS uploader_nip TEXT DEFAULT NULL;
ALTER TABLE uploaded_documents ADD COLUMN IF NOT EXISTS uploader_nisn TEXT DEFAULT NULL;
ALTER TABLE uploaded_documents ADD COLUMN IF NOT EXISTS target_nip TEXT DEFAULT NULL;
ALTER TABLE uploaded_documents ADD COLUMN IF NOT EXISTS target_nisn TEXT DEFAULT NULL;
ALTER TABLE uploaded_documents ADD COLUMN IF NOT EXISTS uploader_id TEXT DEFAULT NULL;

-- Add indexes for faster lookup by NIP/NISN
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_uploader_nip ON uploaded_documents(uploader_nip);
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_uploader_nisn ON uploaded_documents(uploader_nisn);
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_target_nip ON uploaded_documents(target_nip);
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_target_nisn ON uploaded_documents(target_nisn);
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_uploader_id ON uploaded_documents(uploader_id);