-- Update file_storage_config table to support Google Drive
ALTER TABLE file_storage_config DROP CONSTRAINT IF EXISTS file_storage_config_storage_type_check;

ALTER TABLE file_storage_config ADD CONSTRAINT file_storage_config_storage_type_check
    CHECK (storage_type IN ('supabase', 'hosting', 'google_drive'));

-- Add Google Drive specific fields
ALTER TABLE file_storage_config ADD COLUMN IF NOT EXISTS google_client_id TEXT;
ALTER TABLE file_storage_config ADD COLUMN IF NOT EXISTS google_client_secret TEXT;
ALTER TABLE file_storage_config ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
ALTER TABLE file_storage_config ADD COLUMN IF NOT EXISTS google_folder_id TEXT;
ALTER TABLE file_storage_config ADD COLUMN IF NOT EXISTS google_access_token TEXT;
ALTER TABLE file_storage_config ADD COLUMN IF NOT EXISTS google_token_expiry TIMESTAMPTZ;

-- Add supabase specific fields
ALTER TABLE file_storage_config ADD COLUMN IF NOT EXISTS supabase_access_key TEXT;
ALTER TABLE file_storage_config ADD COLUMN IF NOT EXISTS supabase_secret_key TEXT;
ALTER TABLE file_storage_config ADD COLUMN IF NOT EXISTS supabase_region TEXT DEFAULT 'us-east-1';

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_file_storage_config_active ON file_storage_config(is_active) WHERE is_active = true;