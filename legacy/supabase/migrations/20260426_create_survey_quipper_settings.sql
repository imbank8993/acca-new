-- Migration: Create survey_quipper_settings table
-- Settings untuk survey Quipper (misal: show chart untuk guru/siswa)

CREATE TABLE IF NOT EXISTS survey_quipper_settings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key     VARCHAR(100) NOT NULL UNIQUE,
    setting_value   VARCHAR(255) NOT NULL DEFAULT 'false',
    description     TEXT,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Default settings
INSERT INTO survey_quipper_settings (setting_key, setting_value, description)
VALUES
    ('show_chart_guru', 'false', 'Tampilkan tab grafik untuk role GURU'),
    ('show_chart_siswa', 'false', 'Tampilkan tab grafik untuk role SISWA')
ON CONFLICT (setting_key) DO NOTHING;

-- Enable RLS
ALTER TABLE survey_quipper_settings ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can SELECT settings
CREATE POLICY "survey_quipper_settings_select"
    ON survey_quipper_settings
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: ADMIN can UPDATE settings
CREATE POLICY "survey_quipper_settings_admin_update"
    ON survey_quipper_settings
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE auth_id::text = auth.uid()::text
            AND role LIKE '%ADMIN%'
        )
    );

COMMENT ON TABLE survey_quipper_settings IS 'Pengaturan survey Quipper seperti tampilkan/sembunyikan tab grafik';
COMMENT ON COLUMN survey_quipper_settings.setting_key IS 'Key pengaturan: show_chart_guru, show_chart_siswa';
COMMENT ON COLUMN survey_quipper_settings.setting_value IS 'Nilai: true atau false';
