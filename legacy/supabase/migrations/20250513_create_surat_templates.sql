-- Templates for Surat/Izin/Keterangan
CREATE TABLE IF NOT EXISTS surat_templates (
    id UUID DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('IZIN_SINGLE', 'IZIN_GROUP', 'TUGAS_SINGLE', 'TUGAS_GROUP', 'SAKIT', 'REKAM_MEDIK')),
    description TEXT,
    storage_path TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE surat_templates ENABLE ROW LEVEL SECURITY;

-- Everyone can view templates
CREATE POLICY "Templates are viewable by all authenticated users"
ON surat_templates FOR SELECT
TO authenticated
USING (true);

-- Only admin can insert/update/delete templates
CREATE POLICY "Admin can manage templates"
ON surat_templates FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE auth.uid()::text = id::text
        AND (UPPER(role) = 'ADMIN' OR UPPER(role) = 'ADMINISTRATOR')
    )
);