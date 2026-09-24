-- ============================================================
--  LINK BERBAGI INFORMASI
--  Menyimpan token link publik (tanpa login) untuk satu folder
--  atau satu file di halaman Informasi & Layanan.
--
--  Link internal (deep-link /informasi-akademik?div=..&folder=..)
--  TIDAK butuh tabel ini — ia hanya query-param biasa dan tetap
--  tunduk pada filter audience saat penerima login.
--  Tabel ini khusus untuk link yang boleh dibuka siapa saja.
-- ============================================================

CREATE TABLE IF NOT EXISTS informasi_share_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Token acak (base64url) yang jadi bagian URL /info-link/<token>.
    token           TEXT NOT NULL UNIQUE,
    -- 'folder' = satu folder utuh, 'file' = satu dokumen saja.
    scope           TEXT NOT NULL CHECK (scope IN ('folder', 'file')),
    -- Divisi + nama folder hasil parse kolom category (mis. "[Akademik] Kurikulum").
    division        TEXT,
    folder          TEXT,
    -- id dokumen: UUID informasi_akademik, atau 'upload_<uuid>' untuk uploaded_documents.
    doc_id          TEXT,
    -- Judul yang ditampilkan di halaman publik (snapshot saat link dibuat).
    label           TEXT,
    created_by      UUID,
    created_by_name TEXT,
    -- NULL = tidak kedaluwarsa.
    expires_at      TIMESTAMPTZ,
    revoked         BOOLEAN NOT NULL DEFAULT FALSE,
    view_count      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_informasi_share_links_token
    ON informasi_share_links (token);
-- Dipakai saat modal berbagi menampilkan daftar link aktif untuk satu target.
CREATE INDEX IF NOT EXISTS idx_informasi_share_links_target
    ON informasi_share_links (scope, division, folder, doc_id);

-- RLS menyala tanpa policy apa pun: hanya service role (supabaseAdmin) yang
-- boleh membaca/menulis. Halaman publik mengambil datanya lewat server
-- component / route handler, bukan lewat client anon.
ALTER TABLE informasi_share_links ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE informasi_share_links IS
    'Token link publik (tanpa login) untuk folder/file halaman Informasi & Layanan.';
