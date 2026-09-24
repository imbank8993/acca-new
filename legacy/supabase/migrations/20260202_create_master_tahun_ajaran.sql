-- Migration: Create master_tahun_ajaran table
-- Description: Central settings for Academic Year

CREATE TABLE IF NOT EXISTS master_tahun_ajaran (
    id BIGSERIAL PRIMARY KEY,
    tahun_ajaran TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS
ALTER TABLE master_tahun_ajaran DISABLE ROW LEVEL SECURITY;

-- Insert default value
INSERT INTO master_tahun_ajaran (tahun_ajaran, is_active) 
VALUES ('2025/2026', true)
ON CONFLICT (tahun_ajaran) DO UPDATE SET is_active = true;
