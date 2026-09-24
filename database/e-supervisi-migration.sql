-- Enum for 3 stages
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sv_tahap') THEN
        CREATE TYPE sv_tahap AS ENUM ('administrasi', 'persiapan', 'pelaksanaan');
    END IF;
END $$;

-- Table 1: sv_master_dokumen
CREATE TABLE IF NOT EXISTS sv_master_dokumen (
    id SERIAL PRIMARY KEY,
    tahap sv_tahap NOT NULL,
    nama_dokumen TEXT NOT NULL,
    deskripsi TEXT,
    urutan INT DEFAULT 0,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 2: sv_indikator  
CREATE TABLE IF NOT EXISTS sv_indikator (
    id SERIAL PRIMARY KEY,
    dokumen_id INT NOT NULL REFERENCES sv_master_dokumen(id) ON DELETE CASCADE,
    nama_indikator TEXT NOT NULL,
    deskripsi TEXT,
    skala_config JSONB NOT NULL DEFAULT '{"tipe": "angka", "min": 1, "max": 4}',
    urutan INT DEFAULT 0,
    aktif BOOLEAN DEFAULT true
);

-- Table 3: sv_penugasan
CREATE TABLE IF NOT EXISTS sv_penugasan (
    id SERIAL PRIMARY KEY,
    guru_nip VARCHAR NOT NULL,
    supervisor_nip VARCHAR NOT NULL,
    tahun_ajaran_id INT NOT NULL REFERENCES master_tahun_ajaran(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'aktif' CHECK (status IN ('draft', 'aktif', 'selesai')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(guru_nip, supervisor_nip, tahun_ajaran_id)
);

-- Table 4: sv_unggahan_guru
CREATE TABLE IF NOT EXISTS sv_unggahan_guru (
    id SERIAL PRIMARY KEY,
    penugasan_id INT NOT NULL REFERENCES sv_penugasan(id) ON DELETE CASCADE,
    dokumen_id INT NOT NULL REFERENCES sv_master_dokumen(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(penugasan_id, dokumen_id)
);

-- Table 5: sv_rekam_nilai
CREATE TABLE IF NOT EXISTS sv_rekam_nilai (
    id SERIAL PRIMARY KEY,
    penugasan_id INT NOT NULL REFERENCES sv_penugasan(id) ON DELETE CASCADE,
    indikator_id INT NOT NULL REFERENCES sv_indikator(id) ON DELETE CASCADE,
    nilai_mentah VARCHAR,
    nilai_konversi NUMERIC(6,2),
    catatan TEXT,
    scored_at TIMESTAMPTZ DEFAULT NOW(),
    scored_by VARCHAR,
    UNIQUE(penugasan_id, indikator_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sv_dokumen_tahap ON sv_master_dokumen(tahap, aktif);
CREATE INDEX IF NOT EXISTS idx_sv_indikator_dokumen ON sv_indikator(dokumen_id, aktif);
CREATE INDEX IF NOT EXISTS idx_sv_penugasan_guru ON sv_penugasan(guru_nip, tahun_ajaran_id);
CREATE INDEX IF NOT EXISTS idx_sv_penugasan_supervisor ON sv_penugasan(supervisor_nip, tahun_ajaran_id);
CREATE INDEX IF NOT EXISTS idx_sv_unggahan ON sv_unggahan_guru(penugasan_id, dokumen_id);
CREATE INDEX IF NOT EXISTS idx_sv_nilai ON sv_rekam_nilai(penugasan_id, indikator_id);
