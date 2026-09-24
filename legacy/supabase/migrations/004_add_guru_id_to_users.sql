-- =====================================================
-- Migration: Add guru_id column to users table
-- Fixes issue where guruId falls back to username
-- =====================================================

-- Add guru_id column if not exists
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS guru_id TEXT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_guru_id ON users(guru_id);

-- Comment
COMMENT ON COLUMN users.guru_id IS 'Guru ID (contoh: G-IC-001) - digunakan untuk relasi dengan jadwal_guru dan absensi';

-- =====================================================
-- Manual Steps Required
-- =====================================================
-- 
-- Setelah menjalankan migration ini, Anda perlu UPDATE data:
-- 
-- UPDATE users 
-- SET guru_id = 'G-IC-001' 
-- WHERE username = 'imr-mn';
-- 
-- UPDATE users 
-- SET guru_id = 'G-IC-002' 
-- WHERE username = 'another_teacher';
-- 
-- Atau bisa bulk update jika punya mapping:
-- UPDATE users SET guru_id = [sesuai data Anda]
--
-- Verify:
-- SELECT id, username, nama, guru_id FROM users WHERE guru_id IS NOT NULL;
