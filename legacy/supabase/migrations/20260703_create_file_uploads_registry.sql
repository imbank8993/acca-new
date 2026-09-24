-- Registry terpusat untuk semua file yang diunggah ke storage.
-- Setiap upload tercatat satu baris dengan ukurannya; baris dihapus saat file dihapus.
-- Dipakai halaman Pengaturan Umum → Penyimpanan File untuk kalkulasi kapasitas terpakai.

CREATE TABLE IF NOT EXISTS file_uploads (
    id BIGSERIAL PRIMARY KEY,
    file_url TEXT NOT NULL UNIQUE,
    file_name TEXT,
    folder TEXT DEFAULT 'general',
    size_bytes BIGINT NOT NULL DEFAULT 0,
    storage_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_file_uploads_storage_type ON file_uploads(storage_type);
CREATE INDEX IF NOT EXISTS idx_file_uploads_folder ON file_uploads(folder);

-- Hanya diakses lewat service role (API server); tidak perlu akses anon/authenticated
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;
