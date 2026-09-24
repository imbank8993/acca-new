-- Migration: Add is_locked column to master_tahun_ajaran
-- Description: Allow admin to lock UM input per tahun ajaran

-- 1. Add column (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'master_tahun_ajaran' AND column_name = 'is_locked'
    ) THEN
        ALTER TABLE master_tahun_ajaran ADD COLUMN is_locked BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 2. Enable RLS
ALTER TABLE master_tahun_ajaran ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies first (to avoid duplicate errors), then recreate
DROP POLICY IF EXISTS "Allow read master_tahun_ajaran" ON master_tahun_ajaran;
DROP POLICY IF EXISTS "Allow admin update master_tahun_ajaran" ON master_tahun_ajaran;

-- 4. Create policies
CREATE POLICY "Allow read master_tahun_ajaran"
ON master_tahun_ajaran FOR SELECT USING (true);

CREATE POLICY "Allow admin update master_tahun_ajaran"
ON master_tahun_ajaran FOR UPDATE USING (true);
