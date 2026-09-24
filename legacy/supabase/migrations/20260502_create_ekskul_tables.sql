-- Migration: Create Ekskul Tables
-- Created: 2026-05-02
-- Purpose: Master ekstrakurikuler, pembina, and siswa registration

-- ============================================
-- 1. MASTER EKSTRAKURIKULER (ekskul)
-- ============================================
CREATE TABLE IF NOT EXISTS ekskul (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_ekskul TEXT NOT NULL,
    tahun_ajaran TEXT NOT NULL,
    semester INTEGER NOT NULL,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ekskul_unique
    ON ekskul (nama_ekskul, tahun_ajaran, semester);

CREATE INDEX IF NOT EXISTS idx_ekskul_tahun_semester ON ekskul (tahun_ajaran, semester);

-- ============================================
-- 2. PEMBINA EKSTRAKURIKULER (ekskul_pembina)
-- ============================================
CREATE TABLE IF NOT EXISTS ekskul_pembina (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ekskul_id UUID REFERENCES ekskul(id) ON DELETE CASCADE,
    nip VARCHAR(255) NOT NULL,
    nama_guru VARCHAR(255),
    tahun_ajaran TEXT NOT NULL,
    semester INTEGER NOT NULL,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ekskul_pembina_unique
    ON ekskul_pembina (ekskul_id, nip, tahun_ajaran, semester);

CREATE INDEX IF NOT EXISTS idx_ekskul_pembina_nip ON ekskul_pembina (nip);
CREATE INDEX IF NOT EXISTS idx_ekskul_pembina_tahun_semester ON ekskul_pembina (tahun_ajaran, semester);

-- ============================================
-- 3. SISWA EKSTRAKURIKULER (ekskul_siswa)
-- ============================================
CREATE TABLE IF NOT EXISTS ekskul_siswa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ekskul_id UUID REFERENCES ekskul(id) ON DELETE CASCADE,
    siswa_id UUID NOT NULL,
    tahun_ajaran TEXT NOT NULL,
    semester INTEGER NOT NULL,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ekskul_siswa_unique
    ON ekskul_siswa (ekskul_id, siswa_id, tahun_ajaran, semester);

CREATE INDEX IF NOT EXISTS idx_ekskul_siswa_siswa_id ON ekskul_siswa (siswa_id);
CREATE INDEX IF NOT EXISTS idx_ekskul_siswa_tahun_semester ON ekskul_siswa (tahun_ajaran, semester);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE ekskul ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekskul_pembina ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekskul_siswa ENABLE ROW LEVEL SECURITY;

-- ekskul: public read, authenticated write
CREATE POLICY "Allow read access to anyone" ON ekskul FOR SELECT USING (true);
CREATE POLICY "Allow all access to authenticated users" ON ekskul FOR ALL USING (auth.role() = 'authenticated');

-- ekskul_pembina: public read, authenticated write
CREATE POLICY "Allow read access to anyone" ON ekskul_pembina FOR SELECT USING (true);
CREATE POLICY "Allow all access to authenticated users" ON ekskul_pembina FOR ALL USING (auth.role() = 'authenticated');

-- ekskul_siswa: public read, authenticated write
CREATE POLICY "Allow read access to anyone" ON ekskul_siswa FOR SELECT USING (true);
CREATE POLICY "Allow all access to authenticated users" ON ekskul_siswa FOR ALL USING (auth.role() = 'authenticated');