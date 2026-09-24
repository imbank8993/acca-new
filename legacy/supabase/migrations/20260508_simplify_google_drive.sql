-- Update file_storage_config to simplify Google Drive to just Folder ID
ALTER TABLE file_storage_config DROP COLUMN IF EXISTS google_client_id;
ALTER TABLE file_storage_config DROP COLUMN IF EXISTS google_client_secret;
ALTER TABLE file_storage_config DROP COLUMN IF EXISTS google_refresh_token;
ALTER TABLE file_storage_config DROP COLUMN IF EXISTS google_access_token;
ALTER TABLE file_storage_config DROP COLUMN IF EXISTS google_token_expiry;

-- Rename folder_id to be more descriptive
ALTER TABLE file_storage_config RENAME COLUMN google_folder_id TO google_drive_folder_id;