-- ============================================================
-- Migration: Create surat tables for letter generation
-- Updated: Smart auto-increment letter numbers
-- ============================================================

-- Table: surat_templates (master templates)
CREATE TABLE IF NOT EXISTS surat_templates (
    id UUID DEFAULT gen_random_uuid(),
    nama_template VARCHAR(255) NOT NULL,
    jenis_surat VARCHAR(100) NOT NULL,
    template_html TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    CONSTRAINT surat_templates_pkey PRIMARY KEY (id)
);

-- Table: surat (main letter data)
CREATE TABLE IF NOT EXISTS surat (
    id UUID DEFAULT gen_random_uuid(),
    nomor_surat VARCHAR(100) NOT NULL,
    jenis_surat VARCHAR(100) NOT NULL,
    klasifikasi VARCHAR(50) DEFAULT 'BIASA',

    -- Smart number components
    nomor_urut INTEGER NOT NULL DEFAULT 1,
    nomor_kategori VARCHAR(10) DEFAULT 'A',
    nomor_bagian VARCHAR(100) DEFAULT 'Akademik',

    tanggal_surat DATE NOT NULL DEFAULT CURRENT_DATE,
    tanggal_ttd DATE,
    tempat_ttd VARCHAR(255),

    -- Pengirim & Penerima
    dari VARCHAR(500),
    kepada VARCHAR(500),
    alamat_tujuan TEXT,

    -- Perihal
    perkara VARCHAR(500),

    -- Lampiran
    lampiran VARCHAR(100),

    -- Isi Surat
    pembuka TEXT,
    isi_surat TEXT,
    penutup TEXT,

    -- TTD
    penandatangan_id UUID REFERENCES auth.users(id),
    penandatangan_nama VARCHAR(255),
    penandatangan_jabatan VARCHAR(255),
    penandatangan_nip VARCHAR(50),

    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Status
    status VARCHAR(50) DEFAULT 'DRAFT',
    catatan TEXT,

    -- Draft data (JSON for form state)
    draft_data JSONB,

    CONSTRAINT surat_pkey PRIMARY KEY (id)
);

-- Table: surat_logs (audit trail)
CREATE TABLE IF NOT EXISTS surat_logs (
    id UUID DEFAULT gen_random_uuid(),
    surat_id UUID REFERENCES surat(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    performed_by UUID REFERENCES auth.users(id),
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    details JSONB,
    CONSTRAINT surat_logs_pkey PRIMARY KEY (id)
);

-- Table: master_jenis_surat
CREATE TABLE IF NOT EXISTS master_jenis_surat (
    id SERIAL PRIMARY KEY,
    kode VARCHAR(50) UNIQUE NOT NULL,
    nama VARCHAR(255) NOT NULL,
    template_html TEXT,
    icon VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: master_pejabat (signatories)
CREATE TABLE IF NOT EXISTS master_pejabat (
    id SERIAL PRIMARY KEY,
    nama VARCHAR(255) NOT NULL,
    nip VARCHAR(50),
    jabatan VARCHAR(255),
    unit_kerja VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: nomor_surat_sequence (track sequence per year & category)
CREATE TABLE IF NOT EXISTS nomor_surat_sequence (
    id SERIAL PRIMARY KEY,
    tahun INTEGER NOT NULL,
    kategori VARCHAR(10) NOT NULL,
    bagian VARCHAR(100) DEFAULT 'Akademik',
    last_number INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tahun, kategori, bagian)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_surat_jenis ON surat(jenis_surat);
CREATE INDEX IF NOT EXISTS idx_surat_status ON surat(status);
CREATE INDEX IF NOT EXISTS idx_surat_created_by ON surat(created_by);
CREATE INDEX IF NOT EXISTS idx_surat_tanggal ON surat(tanggal_surat DESC);
CREATE INDEX IF NOT EXISTS idx_surat_logs_surat_id ON surat_logs(surat_id);
CREATE INDEX IF NOT EXISTS idx_surat_tahun ON surat(EXTRACT(YEAR FROM tanggal_surat));
CREATE INDEX IF NOT EXISTS idx_nomor_surat ON surat(nomor_surat);
CREATE INDEX IF NOT EXISTS idx_sequence_tahun_kategori ON nomor_surat_sequence(tahun, kategori);

-- Seed master jenis surat
INSERT INTO master_jenis_surat (kode, nama, icon) VALUES
    ('SURAT_MASUK', 'Surat Masuk', 'bi-arrow-down-circle'),
    ('SURAT_KELUAR', 'Surat Keluar', 'bi-arrow-up-circle'),
    ('NOTA_DINAS', 'Nota Dinas', 'bi-file-text'),
    ('UNDANGAN', 'Undangan', 'bi-calendar-event'),
    ('PENGANTAR', 'Surat Pengantar', 'bi-send'),
    ('PEMBERITAHUAN', 'Pemberitahuan', 'bi-bell'),
    ('REKOMENDASI', 'Surat Rekomendasi', 'bi-hand-thumbs-up'),
    ('IZIN', 'Surat Izin', 'bi-shield-check'),
    ('BERITA_ACARA', 'Berita Acara', 'bi-journal-text')
ON CONFLICT (kode) DO NOTHING;

-- Seed default pejabat
INSERT INTO master_pejabat (nama, nip, jabatan, unit_kerja) VALUES
    ('Dr. H. Ahmad Fauzi, M.Pd.I', '197001011993031001', 'Kepala Madrasah', 'MTs Negeri 2 Malang'),
    ('Hj. Siti Aminah, M.Pd.', '197202021994032002', 'Waka Kurikulum', 'MTs Negeri 2 Malang'),
    ('H. Mahmud, S.Pd., M.M.', '197303031995043003', 'Waka Kesiswaan', 'MTs Negeri 2 Malang'),
    ('Dra. Hj. Nur Halimah', '196808081992021004', 'Waka Sarana Prasarana', 'MTs Negeri 2 Malang')
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT SELECT ON master_jenis_surat TO authenticated;
GRANT SELECT ON master_pejabat TO authenticated;
GRANT ALL ON surat TO authenticated;
GRANT SELECT ON surat_logs TO authenticated;
GRANT ALL ON nomor_surat_sequence TO authenticated;
GRANT SELECT ON nomor_surat_sequence TO authenticated;