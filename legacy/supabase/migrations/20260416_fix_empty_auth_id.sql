-- ============================================================
-- Fix: auth_id empty string → NULL
-- Problem: auth_id column is UUID type but contains ''
-- (invalid UUID) causing all user lookups to fail
-- Fix: Convert '' to NULL so lookups can fall back to
-- username-based lookup in /api/auth/me
-- ============================================================

-- Step 1: Convert empty string to NULL
UPDATE users SET auth_id = NULL WHERE auth_id = '';

-- Step 2: Add CHECK constraint to prevent future empty strings
-- (PostgreSQL will auto-cast '' to NULL in the comparison above,
-- but let's prevent new empty strings at DB level)
ALTER TABLE users
ADD CONSTRAINT users_auth_id_valid
CHECK (auth_id IS NULL OR auth_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

-- Step 3: Verify
-- SELECT id, username, auth_id FROM users LIMIT 10;
