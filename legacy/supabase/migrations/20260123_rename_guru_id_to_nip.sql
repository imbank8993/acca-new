-- Rename guru_id to nip in all related tables

-- 1. Master Guru (Check table name, assumed 'guru' based on previous migrations, but API uses 'master_guru')
-- We will attempt to rename inside 'guru' table first if it exists.
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'guru') THEN
        ALTER TABLE guru RENAME COLUMN guru_id TO nip;
    END IF;
    
    -- In case the table is actually named 'master_guru' (based on API code)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'master_guru') THEN
        ALTER TABLE master_guru RENAME COLUMN guru_id TO nip;
    END IF;
END $$;

-- 2. Wali Kelas
ALTER TABLE wali_kelas RENAME COLUMN guru_id TO nip;

-- 3. Guru Asuh
ALTER TABLE guru_asuh RENAME COLUMN guru_id TO nip;

-- 4. Guru Mapel
ALTER TABLE guru_mapel RENAME COLUMN guru_id TO nip;

-- 5. Users table (if it exists and links to guru)
-- OPTIONAL: If users table has guru_id
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'guru_id') THEN
        ALTER TABLE users RENAME COLUMN guru_id TO nip;
    END IF;
END $$;
