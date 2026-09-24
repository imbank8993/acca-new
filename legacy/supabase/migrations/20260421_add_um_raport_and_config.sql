-- Migration: Add UM Raport Average and Config
-- Created: 2026-04-21

-- 1. Tabel Nilai Rata-Rata Raport S1-5
CREATE TABLE IF NOT EXISTS um_rata_raport (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nisn            TEXT NOT NULL,
    mapel           TEXT NOT NULL,
    nilai           NUMERIC(5,2),
    tahun_ajaran    TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT um_rata_raport_unique UNIQUE (nisn, mapel, tahun_ajaran)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_um_raport_nisn ON um_rata_raport(nisn);
CREATE INDEX IF NOT EXISTS idx_um_raport_ta   ON um_rata_raport(tahun_ajaran);

-- 2. Tabel Konfigurasi Bobot UM
CREATE TABLE IF NOT EXISTS um_konfigurasi (
    tahun_ajaran    TEXT PRIMARY KEY,
    bobot_raport    NUMERIC(3,2) NOT NULL DEFAULT 0.60, -- 60%
    bobot_ujian     NUMERIC(3,2) NOT NULL DEFAULT 0.40, -- 40%
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS Policies
ALTER TABLE um_rata_raport ENABLE ROW LEVEL SECURITY;
ALTER TABLE um_konfigurasi ENABLE ROW LEVEL SECURITY;

-- Select policies: All authenticated users can read
CREATE POLICY "um_rata_raport: select authenticated" ON um_rata_raport
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "um_konfigurasi: select authenticated" ON um_konfigurasi
    FOR SELECT USING (auth.role() = 'authenticated');

-- Write policies: Only ADMIN can write
CREATE POLICY "um_rata_raport: admin write" ON um_rata_raport
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_id = auth.uid()
            AND role ILIKE '%admin%'
        )
    );

CREATE POLICY "um_konfigurasi: admin write" ON um_konfigurasi
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_id = auth.uid()
            AND role ILIKE '%admin%'
        )
    );

-- 4. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_um_rata_raport_updated_at
    BEFORE UPDATE ON um_rata_raport
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();

CREATE TRIGGER tr_um_konfigurasi_updated_at
    BEFORE UPDATE ON um_konfigurasi
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();

-- 5. Add meta permissions
INSERT INTO master_permissions_list (category, resource, action, label, description)
VALUES
  ('Ujian Madrasah', 'ujian-madrasah', 'config', 'Konfigurasi Bobot UM', 'Mengatur bobot nilai raport vs ujian'),
  ('Ujian Madrasah', 'ujian-madrasah', 'import-raport', 'Import Rata-Rata Raport', 'Import nilai rata-rata raport S1-5')
ON CONFLICT (resource, action) DO NOTHING;
