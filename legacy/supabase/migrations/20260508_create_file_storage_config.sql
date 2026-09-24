-- Create file_storage_config table for multi-school file storage configuration
CREATE TABLE IF NOT EXISTS file_storage_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    storage_type VARCHAR(20) NOT NULL DEFAULT 'hosting' CHECK (storage_type IN ('supabase', 'hosting', 'google_drive')),
    hosting_url VARCHAR(500),
    php_upload_path VARCHAR(255),
    php_delete_path VARCHAR(255),
    supabase_bucket VARCHAR(255),
    google_drive_folder_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policy
ALTER TABLE file_storage_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read file_storage_config"
    ON file_storage_config FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to manage file_storage_config"
    ON file_storage_config FOR ALL
    TO authenticated
    USING (auth.role() = 'authenticated');

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_file_storage_config_updated_at
    BEFORE UPDATE ON file_storage_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default config with hosting
INSERT INTO file_storage_config (storage_type, hosting_url, php_upload_path, php_delete_path, supabase_bucket, is_active)
VALUES ('hosting', 'https://file.icgowa.sch.id', 'acca_upload.php', 'acca_delete.php', NULL, true);