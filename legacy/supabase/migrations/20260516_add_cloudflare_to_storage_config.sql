-- Update file_storage_config table to support Cloudflare R2
ALTER TABLE file_storage_config DROP CONSTRAINT IF EXISTS file_storage_config_storage_type_check;

ALTER TABLE file_storage_config ADD CONSTRAINT file_storage_config_storage_type_check
    CHECK (storage_type IN ('supabase', 'hosting', 'google_drive', 'cloudflare'));

-- Add Cloudflare R2 specific fields
ALTER TABLE file_storage_config ADD COLUMN IF NOT EXISTS cloudflare_account_id TEXT;
ALTER TABLE file_storage_config ADD COLUMN IF NOT EXISTS cloudflare_access_key_id TEXT;
ALTER TABLE file_storage_config ADD COLUMN IF NOT EXISTS cloudflare_secret_access_key TEXT;
ALTER TABLE file_storage_config ADD COLUMN IF NOT EXISTS cloudflare_bucket_name TEXT;
ALTER TABLE file_storage_config ADD COLUMN IF NOT EXISTS cloudflare_public_url TEXT;
ALTER TABLE file_storage_config ADD COLUMN IF NOT EXISTS cloudflare_cdn_domain TEXT;