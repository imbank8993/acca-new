-- Add cbt_auth_id to link with CBT App Auth ID
ALTER TABLE users ADD COLUMN IF NOT EXISTS cbt_auth_id UUID;

-- Optional: Create index for faster lookups if needed later
CREATE INDEX IF NOT EXISTS idx_users_cbt_auth_id ON users(cbt_auth_id);
