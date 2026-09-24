-- Tambahkan kolom status_pelatih ke ekskul_pembina
ALTER TABLE ekskul_pembina ADD COLUMN IF NOT EXISTS status_pelatih VARCHAR(20) DEFAULT 'Internal';

-- Buat tabel laporan_ekskul_submissions untuk pelaporan WKM Kesiswaan
CREATE TABLE IF NOT EXISTS laporan_ekskul_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ekskul_id UUID REFERENCES ekskul(id) ON DELETE CASCADE,
    pembina_nip VARCHAR(50),
    pembina_nama VARCHAR(255),
    bulan INT NOT NULL,
    tahun INT NOT NULL,
    status VARCHAR(20) DEFAULT 'Menunggu',
    total_pertemuan INT DEFAULT 0,
    catatan_pembina TEXT,
    catatan_reviewer TEXT,
    approved_by UUID,
    approved_by_name VARCHAR(255),
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    pdf_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    dibayarkan BOOLEAN DEFAULT FALSE,
    dibayarkan_at TIMESTAMPTZ,
    dibayarkan_by UUID,
    dibayarkan_by_name VARCHAR(255),
    catatan_pembayaran TEXT
);

-- Atur Row Level Security (opsional, jika RLS aktif di tabel lain)
ALTER TABLE laporan_ekskul_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for all users" ON laporan_ekskul_submissions FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE ekskul_pertemuan ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES laporan_ekskul_submissions(id) ON DELETE SET NULL;
ALTER TABLE laporan_ekskul_submissions ADD CONSTRAINT uq_ekskul_laporan UNIQUE (ekskul_id, pembina_nip, bulan, tahun);
