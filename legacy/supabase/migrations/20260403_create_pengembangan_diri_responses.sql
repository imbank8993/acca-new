-- Survey Pengembangan Diri Responses Table
-- Created: 2026-04-03

-- =====================================================
-- TABLE: pengembangan_diri_responses
-- =====================================================
CREATE TABLE IF NOT EXISTS pengembangan_diri_responses (
    id BIGSERIAL PRIMARY KEY,

    -- Identitas
    kelas_id INTEGER REFERENCES master_kelas(id),
    kelas_nama TEXT,
    tingkat INTEGER,

    -- Minat & Ketertarikan
    ketertarikan TEXT,

    -- Bidang Minat
    bidang_minati TEXT,
    bidang_minati_lainnya TEXT,

    -- Keterampilan yang Ingin Dikembangkan (stored as JSON array)
    keterampilan JSONB DEFAULT '[]'::jsonb,

    -- Preferensi
    waktu_pelaksanaan TEXT,
    durasi_ideal INTEGER,
    kendala JSONB DEFAULT '[]'::jsonb,
    kesediaan_rutin TEXT,

    -- Metadata
    ip_address TEXT,
    user_agent TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),

    -- Soft delete
    deleted_at TIMESTAMPTZ
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_pengembangan_diri_kelas ON pengembangan_diri_responses(kelas_nama, deleted_at);
CREATE INDEX IF NOT EXISTS idx_pengembangan_diri_submitted ON pengembangan_diri_responses(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_pengembangan_diri_aktif ON pengembangan_diri_responses(deleted_at) WHERE deleted_at IS NULL;

-- =====================================================
-- ENABLE RLS
-- =====================================================
ALTER TABLE pengembangan_diri_responses ENABLE ROW LEVEL SECURITY;

-- Public read for submitting (no auth needed for anonymous survey)
CREATE POLICY "Allow anonymous insert" ON pengembangan_diri_responses
    FOR INSERT TO anon WITH CHECK (true);

-- Authenticated users can view all responses
CREATE POLICY "Allow authenticated view" ON pengembangan_diri_responses
    FOR SELECT TO authenticated USING (deleted_at IS NULL);

-- Authenticated users can delete
CREATE POLICY "Allow authenticated delete" ON pengembangan_diri_responses
    FOR DELETE TO authenticated USING (deleted_at IS NULL);

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE pengembangan_diri_responses IS 'Response data untuk Survey Pengembangan Diri';
COMMENT ON COLUMN pengembangan_diri_responses.keterampilan IS 'Array of selected skills, e.g. ["leadership", "creativity"]';
COMMENT ON COLUMN pengembangan_diri_responses.kendala IS 'Array of selected obstacles, e.g. ["jadwal", "info"]';
