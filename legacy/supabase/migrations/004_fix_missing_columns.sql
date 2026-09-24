-- Fix missing columns in jadwal_guru table
-- Run this in Supabase Dashboard -> SQL Editor

-- 1. Add semester (Integer, default 2 for Genap)
ALTER TABLE jadwal_guru 
ADD COLUMN IF NOT EXISTS semester INTEGER DEFAULT 2;

-- 2. Add tahun_ajaran (Text, default 2025/2026)
ALTER TABLE jadwal_guru 
ADD COLUMN IF NOT EXISTS tahun_ajaran TEXT DEFAULT '2025/2026';

-- 3. Add berlaku_mulai (Date, for effective date filtering)
ALTER TABLE jadwal_guru 
ADD COLUMN IF NOT EXISTS berlaku_mulai DATE;

-- 4. Add nip (Text, for teacher ID)
ALTER TABLE jadwal_guru 
ADD COLUMN IF NOT EXISTS nip TEXT;

-- 5. Reload the schema cache (standard Supabase function)
NOTIFY pgrst, 'reload config';
