-- Migration: Add photo_url to users table
-- Fixes missing column error during user management

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS photo_url TEXT;

COMMENT ON COLUMN users.photo_url IS 'URL for user profile photo';
