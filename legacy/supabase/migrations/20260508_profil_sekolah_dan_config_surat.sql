-- =====================================================
-- ACCA App: Profil Sekolah & Konfigurasi Surat
-- Migration: Create profil_sekolah and config_surat tables
-- Author: ACCA Team
-- Date: 2026-05-08
-- =====================================================

-- =====================================================
-- Table: profil_sekolah
-- Master table for school profile/identity
-- =====================================================
CREATE TABLE IF NOT EXISTS profil_sekolah (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- ── School Identifier ────────────────────────────────
    npsn TEXT UNIQUE,                    -- NPSN (Nomor Pokok Sekolah Nasional) - 8 digit
    nsm TEXT,                            -- NSM (Nomor Statistik Madrasah) - untuk sekolah madrasah
    nds TEXT,                             -- NPS (Nomor Dataverse Sekolah)

    -- ── Basic Info ───────────────────────────────────────
    nama TEXT NOT NULL,
    jenjang TEXT CHECK (jenjang IN (
        'SD', 'SMP', 'SMA', 'SMK',
        'MI', 'MTs', 'MA', 'MAK'
    )),
    jenis TEXT CHECK (jenis IN ('NEGERI', 'SWASTA')),
    status TEXT CHECK (status IN ('Aktif', 'Non Aktif')),

    -- ── Location ─────────────────────────────────────────
    alamat TEXT,
    desa_kelurahan TEXT,
    kecamatan TEXT,
    kabupaten_kota TEXT,
    provinsi TEXT,
    kode_pos TEXT,

    -- ── Contact ──────────────────────────────────────────
    telepon TEXT,
    fax TEXT,
    email TEXT,
    website TEXT,

    -- ── Principal / Headmaster Info ───────────────────────
    kepala_sekolah_nama TEXT,
    kepala_sekolah_nip TEXT,
    kepala_sekolah_nuptk TEXT,

    -- ── Branding (for surat and other documents) ──────────
    logo_url TEXT,                       -- Stored logo/header image URL
    logo_kecil_url TEXT,                 -- Small logo for QR overlay
    background_surat_url TEXT,           -- Default background for surat
    header_surat_text TEXT,              -- Optional header text override
    footer_surat_text TEXT,              -- Optional footer text

    -- ── Surat Configuration (default format) ─────────────
    format_nomor_surat TEXT DEFAULT '{nomor}/{kode}/{bagian}/{bulan_romawi}/{tahun}',
    kode_bagian_default TEXT DEFAULT 'A',

    -- ── Integration codes ────────────────────────────────
    dapodik_code TEXT,                   -- Dapodik integration code
    emis_code TEXT,                      -- EMIS code
    bukan_code TEXT,                     -- BUKAN code

    -- ── Other ─────────────────────────────────────────────
    tahun_berdiri INTEGER,
    status_terakhir_update TIMESTAMPTZ DEFAULT NOW(),

    -- ── Metadata ─────────────────────────────────────────
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table comments
COMMENT ON TABLE profil_sekolah IS 'Master table for school profile/identity - used across all modules including surat, absensi, etc.';

COMMENT ON COLUMN profil_sekolah.npsn IS 'NPSN (Nomor Pokok Sekolah Nasional) - unique identifier for Indonesian schools';
COMMENT ON COLUMN profil_sekolah.nsm IS 'NSM (Nomor Statistik Madrasah) - statistical number for madrasah schools';
COMMENT ON COLUMN profil_sekolah.nds IS 'NPS (Nomor Dataverse Sekolah) - dataverse school identifier';
COMMENT ON COLUMN profil_sekolah.jenjang IS 'School level: SD/SMP/SMA/SMK for umum, MI/MTs/MA/MAK for madrasah';
COMMENT ON COLUMN profil_sekolah.jenis IS 'School type: NEGERI (public) or SWASTA (private)';
COMMENT ON COLUMN profil_sekolah.status IS 'Active status of the school';
COMMENT ON COLUMN profil_sekolah.logo_url IS 'Main logo URL for surat and documents';
COMMENT ON COLUMN profil_sekolah.logo_kecil_url IS 'Small logo for QR code overlay';
COMMENT ON COLUMN profil_sekolah.background_surat_url IS 'Default background image for surat';
COMMENT ON COLUMN profil_sekolah.format_nomor_surat IS 'Template for surat number: {nomor}/{kode}/{bagian}/{bulan_romawi}/{tahun}';
COMMENT ON COLUMN profil_sekolah.kode_bagian_default IS 'Default kode for bagian (e.g., A, B, C)';

-- =====================================================
-- Table: config_surat
-- Per-school surat configuration overrides
-- =====================================================
CREATE TABLE IF NOT EXISTS config_surat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profil_sekolah_id UUID NOT NULL REFERENCES profil_sekolah(id) ON DELETE CASCADE,

    -- ── Branding / Logo ────────────────────────────────────
    background_url TEXT,                 -- Background template surat (override profil)
    logo_url TEXT,                        -- Logo sekolah utama (override profil)
    logo_kecil_url TEXT,                  -- Logo kecil untuk kop / header surat
    logo_qr_url TEXT,                     -- Logo ACCA untuk overlay di tengah barcode verifikasi digital

    -- ── Header/Footer Text ────────────────────────────────
    header_text TEXT,
    footer_text TEXT,

    -- ── Format Nomor Surat ────────────────────────────────
    format_nomor_template TEXT DEFAULT '{nomor}/{kode1}/{kode2}/{kode3}/{bulan_romawi}/{tahun}',

    -- ── Kode Surat (3 kelompok dengan pilihan ganda) ────────
    -- Setiap kelompok bisa punya banyak pilihan yang dipilih saat buat surat
    kode1_options TEXT,                  -- JSON: [{"kode":"A","nama":"Umum"},{"kode":"D","nama":"Kesiswaan"}]
    kode2_options TEXT,                   -- JSON: [{"kode":"001","nama":"Reguler"},{"kode":"002","nama":"Khusus"}]
    kode3_options TEXT,                   -- JSON: [{"kode":"G","nama":"Guru"},{"kode":"S","nama":"Siswa"}]

    -- ── Pejabat Default untuk Surat ───────────────────────
    pejabat_default_id UUID REFERENCES auth.users(id),  -- Nullable FK to users
    pejabat_default_nama TEXT,
    pejabat_default_jabatan TEXT,
    pejabat_default_nip TEXT,

    -- ── Active status ─────────────────────────────────────
    is_default BOOLEAN DEFAULT true,

    -- ── Metadata ───────────────────────────────────────────
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Enforce one config per school
    UNIQUE(profil_sekolah_id)
);

-- Table and column comments
COMMENT ON TABLE config_surat IS 'Per-school surat configuration overrides - links to profil_sekolah';
COMMENT ON COLUMN config_surat.kode1_options IS 'Pilihan Kode-1 untuk nomor surat. Format JSON array: [{kode, nama}]';
COMMENT ON COLUMN config_surat.kode2_options IS 'Pilihan Kode-2 untuk nomor surat. Format JSON array: [{kode, nama}]';
COMMENT ON COLUMN config_surat.kode3_options IS 'Pilihan Kode-3 untuk nomor surat. Format JSON array: [{kode, nama}]';
COMMENT ON COLUMN config_surat.logo_kecil_url IS 'Logo kecil untuk kop/header surat (bukan untuk QR)';
COMMENT ON COLUMN config_surat.logo_qr_url IS 'Logo ACCA khusus untuk overlay di tengah barcode verifikasi digital (ttd digital)';
COMMENT ON COLUMN config_surat.pejabat_default_id IS 'FK to users table - preferred default signatory';

-- =====================================================
-- Add references to existing tables
-- =====================================================

-- Add profil_sekolah_id to users (multi-tenant support)
ALTER TABLE IF EXISTS users
    ADD COLUMN IF NOT EXISTS profil_sekolah_id UUID REFERENCES profil_sekolah(id);

CREATE INDEX IF NOT EXISTS idx_users_profil ON users(profil_sekolah_id);

-- Add profil_sekolah_id to surat (multi-tenant support)
ALTER TABLE IF EXISTS surat
    ADD COLUMN IF NOT EXISTS profil_sekolah_id UUID REFERENCES profil_sekolah(id);

CREATE INDEX IF NOT EXISTS idx_surat_profil ON surat(profil_sekolah_id);

-- =====================================================
-- Triggers
-- =====================================================

-- Auto-update timestamp function
CREATE OR REPLACE FUNCTION update_profil_sekolah_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profil_sekolah
DROP TRIGGER IF EXISTS trg_profil_sekolah_updated ON profil_sekolah;
CREATE TRIGGER trg_profil_sekolah_updated
    BEFORE UPDATE ON profil_sekolah
    FOR EACH ROW EXECUTE FUNCTION update_profil_sekolah_timestamp();

-- Trigger for config_surat
DROP TRIGGER IF EXISTS trg_config_surat_updated ON config_surat;
CREATE TRIGGER trg_config_surat_updated
    BEFORE UPDATE ON config_surat
    FOR EACH ROW EXECUTE FUNCTION update_profil_sekolah_timestamp();

-- =====================================================
-- Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_profil_sekolah_npsn ON profil_sekolah(npsn);
CREATE INDEX IF NOT EXISTS idx_profil_sekolah_nama ON profil_sekolah(nama);

-- =====================================================
-- RLS Policies
-- =====================================================
ALTER TABLE profil_sekolah ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_surat ENABLE ROW LEVEL SECURITY;

-- profil_sekolah policies
DROP POLICY IF EXISTS "Allow authenticated read profil_sekolah" ON profil_sekolah;
CREATE POLICY "Allow authenticated read profil_sekolah"
    ON profil_sekolah FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin write profil_sekolah" ON profil_sekolah;
CREATE POLICY "Allow admin write profil_sekolah"
    ON profil_sekolah FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM users
        WHERE users.auth_id = auth.uid()
        AND users.role IN ('superadmin', 'admin')
    ));

-- config_surat policies
DROP POLICY IF EXISTS "Allow authenticated read config_surat" ON config_surat;
CREATE POLICY "Allow authenticated read config_surat"
    ON config_surat FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin write config_surat" ON config_surat;
CREATE POLICY "Allow admin write config_surat"
    ON config_surat FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM users
        WHERE users.auth_id = auth.uid()
        AND users.role IN ('superadmin', 'admin')
    ));

-- =====================================================
-- Seed Data: Default Profile
-- =====================================================
INSERT INTO profil_sekolah (
    nama,
    jenjang,
    jenis,
    status,
    alamat,
    telepon,
    email,
    format_nomor_surat,
    kepala_sekolah_nama,
    kepala_sekolah_nip
) VALUES (
    'MTs Negeri 2 Malang',
    'MTs',
    'NEGERI',
    'Aktif',
    'Jl. Ir. Sukarno No.123, Malang',
    '(0341) 123456',
    'mtsn2malang@kemendikbud.go.id',
    '{nomor}/{kode}/{bagian}/{bulan_romawi}/{tahun}',
    'Dr. H. Ahmad Fauzi, M.Pd.',
    '197001011993031001'
);

-- Seed default config_surat for the first profil
INSERT INTO config_surat (
    profil_sekolah_id,
    is_default,
    format_nomor_template,
    kode1_options,
    kode2_options,
    kode3_options
)
SELECT
    id,
    true,
    '{nomor}/{kode1}/{kode2}/{kode3}/{bulan_romawi}/{tahun}',
    '[{"kode":"A","nama":"Umum"},{"kode":"B","nama":"Guru"},{"kode":"C","nama":"Siswa"}]',
    '[{"kode":"001","nama":"Reguler"}]',
    '[{"kode":"G","nama":"Guru"},{"kode":"S","nama":"Siswa"}]'
FROM profil_sekolah
WHERE id = (SELECT id FROM profil_sekolah LIMIT 1)
ON CONFLICT (profil_sekolah_id) DO NOTHING;
