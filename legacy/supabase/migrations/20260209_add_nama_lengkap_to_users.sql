-- Add nama_lengkap column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS nama_lengkap TEXT;

-- Update existing records to have nama_lengkap same as nama initially
UPDATE users SET nama_lengkap = nama WHERE nama_lengkap IS NULL;
