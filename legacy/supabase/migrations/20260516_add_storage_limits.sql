-- Add file size limits and allowed extensions per storage config
ALTER TABLE file_storage_config ADD COLUMN IF NOT EXISTS max_file_size_mb INTEGER DEFAULT NULL;
ALTER TABLE file_storage_config ADD COLUMN IF NOT EXISTS allowed_extensions TEXT DEFAULT NULL;

COMMENT ON COLUMN file_storage_config.max_file_size_mb IS 'Maximum file size in MB (NULL = unlimited)';
COMMENT ON COLUMN file_storage_config.allowed_extensions IS 'Comma-separated allowed file extensions (NULL = all allowed, e.g. jpg,png,pdf)';