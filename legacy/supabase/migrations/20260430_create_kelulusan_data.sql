-- Create kelulusan_data table for managing graduation status of XII grade students
CREATE TABLE IF NOT EXISTS kelulusan_data (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nisn            TEXT NOT NULL,
    tahun_ajaran    TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'MENUNGGU'
                    CHECK (status IN ('LULUS', 'TIDAK_LULUS', 'MENUNGGU')),
    nomor_ijazah    TEXT,
    catatan         TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT kelulusan_data_unique UNIQUE (nisn, tahun_ajaran)
);

-- New: Global publish schedule (single row per tahun_ajaran)
CREATE TABLE IF NOT EXISTS kelulusan_publish (
    tahun_ajaran    TEXT PRIMARY KEY,
    publish_at      TIMESTAMPTZ, -- null = published now
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_kelulusan_nisn       ON kelulusan_data(nisn);
CREATE INDEX IF NOT EXISTS idx_kelulusan_tahun_ajaran ON kelulusan_data(tahun_ajaran);
CREATE INDEX IF NOT EXISTS idx_kelulusan_status     ON kelulusan_data(status);

-- RLS Policies (same pattern as um_rata_raport)
ALTER TABLE kelulusan_data ENABLE ROW LEVEL SECURITY;

-- Select: All authenticated users can read
CREATE POLICY "kelulusan_data: select authenticated" ON kelulusan_data
    FOR SELECT USING (auth.role() = 'authenticated');

-- Write: Only ADMIN can write
CREATE POLICY "kelulusan_data: admin write" ON kelulusan_data
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_id = auth.uid()
            AND role ILIKE '%admin%'
        )
    );

-- Trigger for updated_at
CREATE TRIGGER tr_kelulusan_data_updated_at
    BEFORE UPDATE ON kelulusan_data
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();

-- RLS for kelulusan_publish
ALTER TABLE kelulusan_publish ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kelulusan_publish: select authenticated" ON kelulusan_publish
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "kelulusan_publish: admin write" ON kelulusan_publish
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_id = auth.uid()
            AND role ILIKE '%admin%'
        )
    );

CREATE TRIGGER tr_kelulusan_publish_updated_at
    BEFORE UPDATE ON kelulusan_publish
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();

-- Add menu permission for admin
INSERT INTO master_permissions_list (category, resource, action, label, description)
VALUES
  ('Kelulusan', 'kelulusan', 'read',   'Lihat Kelulusan',        'Melihat data kelulusan siswa'),
  ('Kelulusan', 'kelulusan', 'write',  'Kelola Kelulusan',       'Mengelola status kelulusan siswa XII')
ON CONFLICT (resource, action) DO NOTHING;