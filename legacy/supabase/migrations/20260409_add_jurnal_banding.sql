-- Ajukan Banding Jurnal — tables
-- Date: 2026-04-09
-- Description: Add jurnal_banding and jurnal_banding_history tables.

-- =============================================================================
-- TABLE: jurnal_banding
-- =============================================================================
CREATE TABLE IF NOT EXISTS jurnal_banding (
    id SERIAL PRIMARY KEY,
    jurnal_id INT NOT NULL REFERENCES jurnal_guru(id) ON DELETE CASCADE,
    nip TEXT NOT NULL,
    nama_guru TEXT NOT NULL,
    alasan TEXT NOT NULL,
    -- Status: PENDING | APPROVED | REJECTED
    status TEXT NOT NULL DEFAULT 'PENDING',
    -- Daftar koreksi: [{field: "kelas", nilai_lama: "X", nilai_baru: "Y"}, ...]
    koreksi JSONB DEFAULT '[]'::jsonb,
    -- Review
    reviewed_by TEXT,
    reviewed_by_name TEXT,
    reviewed_at TIMESTAMPTZ,
    catatan_reviewer TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate banding: satu banding per jurnal per nip
    CONSTRAINT unik_banding_jurnal_nip UNIQUE (jurnal_id, nip)
);

COMMENT ON TABLE jurnal_banding IS 'Pengajuan banding oleh guru terhadap isian jurnal';
COMMENT ON COLUMN jurnal_banding.koreksi IS 'Array objek {field, nilai_lama, nilai_baru} yang perlu dikoreksi di jurnal_guru';

-- =============================================================================
-- TABLE: jurnal_banding_history
-- =============================================================================
CREATE TABLE IF NOT EXISTS jurnal_banding_history (
    id SERIAL PRIMARY KEY,
    banding_id INT NOT NULL REFERENCES jurnal_banding(id) ON DELETE CASCADE,
    action TEXT NOT NULL,  -- CREATED | APPROVED | REJECTED | EDITED
    actor TEXT NOT NULL,
    actor_name TEXT,
    detail JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE jurnal_banding_history IS 'Audit trail untuk setiap aksi pada banding jurnal';

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_banding_jurnal_id ON jurnal_banding(jurnal_id);
CREATE INDEX IF NOT EXISTS idx_banding_nip ON jurnal_banding(nip);
CREATE INDEX IF NOT EXISTS idx_banding_status ON jurnal_banding(status);
CREATE INDEX IF NOT EXISTS idx_banding_created_at ON jurnal_banding(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_banding_history_banding_id ON jurnal_banding_history(banding_id);

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_jurnal_banding_updated_at
    BEFORE UPDATE ON jurnal_banding
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY (anonimisasi — auth.uid UUID vs users.id BIGINT tidak bisa dibanding langsung)
-- Notes: API routes menggunakan supabaseAdmin (service_role) sehingga RLS ini
--        BUKAN mekanisme keamanan utama — hanya proteksi if client-side query.
--        Autentikasi & autorisasi penuh dilakukan di API route layer.
-- =============================================================================
ALTER TABLE jurnal_banding ENABLE ROW LEVEL SECURITY;
ALTER TABLE jurnal_banding_history ENABLE ROW LEVEL SECURITY;

-- Service role (supabaseAdmin) bypass RLS, jadi policy ini hanya untuk keamanan tambahan.
-- Biar aman, buat policy sederhana: authenticated user bisa read/write.
-- Untuk filtering detail (milik sendiri vs semua), ditangani di API route.

-- GURU / OP_JURNAL / ADMIN — authenticated user bisa read
CREATE POLICY "authenticated_read_banding" ON jurnal_banding
    FOR SELECT TO authenticated USING (true);

-- GURU — insert untuk nip sendiri (diperiksa via body payload di API route)
CREATE POLICY "authenticated_insert_banding" ON jurnal_banding
    FOR INSERT TO authenticated WITH CHECK (true);

-- OP_JURNAL / ADMIN — bisa update (approve/reject)
CREATE POLICY "authenticated_update_banding" ON jurnal_banding
    FOR UPDATE TO authenticated USING (true);

-- GURU / OP_JURNAL / ADMIN — bisa read history
CREATE POLICY "authenticated_read_banding_history" ON jurnal_banding_history
    FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- PERMISSIONS: role_permissions seed
-- =============================================================================
INSERT INTO role_permissions (role_name, resource, action, is_allowed) VALUES
-- GURU
('GURU', 'jurnal_banding', 'create', true),
('GURU', 'jurnal_banding', 'view', true),
-- OP_JURNAL
('OP_JURNAL', 'jurnal_banding', 'create', true),
('OP_JURNAL', 'jurnal_banding', 'view', true),
('OP_JURNAL', 'jurnal_banding', 'view:any', true),
('OP_JURNAL', 'jurnal_banding', 'approve', true),
-- ADMIN
('ADMIN', 'jurnal_banding', 'create', true),
('ADMIN', 'jurnal_banding', 'view', true),
('ADMIN', 'jurnal_banding', 'view:any', true),
('ADMIN', 'jurnal_banding', 'approve', true)
ON CONFLICT (role_name, resource, action) DO NOTHING;
