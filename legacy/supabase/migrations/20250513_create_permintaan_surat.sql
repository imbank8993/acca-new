-- =====================================================
-- Table: permintaan_surat
-- Table untuk menyimpan permintaan/pengajuan surat
-- =====================================================

-- Create table
CREATE TABLE IF NOT EXISTS permintaan_surat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nomor_surat VARCHAR(50),
    jenis_surat VARCHAR(100) NOT NULL,  -- referensi ke master_dropdown (misal: nota_dinas, surat_keterangan, dll)
    judul VARCHAR(255),
    keperluan TEXT,

    -- Pemohon
    pemohon_nip VARCHAR(50),
    pemohon_nama VARCHAR(255),
    pemohon_role VARCHAR(50),

    -- Data surat yang diminta
    data_json JSONB DEFAULT '{}',

    -- Lampiran (guru/siswa/users yang dilampirkan)
    lampiran_json JSONB DEFAULT '[]',

    -- Status dan approval
    status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'menunggu', 'diproses', 'disetujui', 'ditolak', 'selesai')),
    status_catatan TEXT,

    -- Approval workflow
    approved_by VARCHAR(50),
    approved_at TIMESTAMPTZ,
    approved_catatan TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(50),
    updated_by VARCHAR(50)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_permintaan_surat_jenis ON permintaan_surat(jenis_surat);
CREATE INDEX IF NOT EXISTS idx_permintaan_surat_status ON permintaan_surat(status);
CREATE INDEX IF NOT EXISTS idx_permintaan_surat_pemohon ON permintaan_surat(pemohon_nip);
CREATE INDEX IF NOT EXISTS idx_permintaan_surat_created ON permintaan_surat(created_at DESC);

-- Enable RLS
ALTER TABLE permintaan_surat ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Semua role bisa melihat pengajuan miliknya sendiri
CREATE POLICY "Users can view own requests" ON permintaan_surat
    FOR SELECT USING (
        pemohon_nip = current_setting('app.current_user_nip', true)
    );

-- ADMIN dan OP_Layanan bisa melihat semua
CREATE POLICY "Admins can view all" ON permintaan_surat
    FOR SELECT USING (
        current_setting('app.current_user_roles', true) LIKE '%ADMIN%' OR
        current_setting('app.current_user_roles', true) LIKE '%OP_LAYANAN%'
    );

-- Insert policy untuk user
CREATE POLICY "Users can insert own requests" ON permintaan_surat
    FOR INSERT WITH CHECK (true);

-- Update policy
CREATE POLICY "Users can update own draft requests" ON permintaan_surat
    FOR UPDATE USING (
        pemohon_nip = current_setting('app.current_user_nip', true) AND
        status = 'draft'
    );

-- Admin can update all
CREATE POLICY "Admins can update all requests" ON permintaan_surat
    FOR UPDATE USING (
        current_setting('app.current_user_roles', true) LIKE '%ADMIN%' OR
        current_setting('app.current_user_roles', true) LIKE '%OP_LAYANAN%'
    );

-- Delete policy
CREATE POLICY "Users can delete own draft requests" ON permintaan_surat
    FOR DELETE USING (
        pemohon_nip = current_setting('app.current_user_nip', true) AND
        status = 'draft'
    );

-- =====================================================
-- Function to auto-update updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_permintaan_surat_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS trigger_permintaan_surat_updated ON permintaan_surat;
CREATE TRIGGER trigger_permintaan_surat_updated
    BEFORE UPDATE ON permintaan_surat
    FOR EACH ROW EXECUTE FUNCTION update_permintaan_surat_timestamp();