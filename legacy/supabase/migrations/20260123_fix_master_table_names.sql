-- Migration: Fix Table Names to match API Routes AND Disable RLS (Unrestricted)
-- Date: 2026-01-23

-- 1. Rename Siswa -> master_siswa
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'siswa') THEN
        ALTER TABLE siswa RENAME TO master_siswa;
    END IF;
END $$;

-- 2. Rename Guru -> master_guru
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'guru') THEN
        ALTER TABLE guru RENAME TO master_guru;
    END IF;
END $$;

-- 3. Rename Mapel -> master_mapel
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mapel') THEN
        ALTER TABLE mapel RENAME TO master_mapel;
    END IF;
END $$;

-- 4. Rename Ref_Kelas -> master_kelas
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ref_kelas') THEN
        ALTER TABLE ref_kelas RENAME TO master_kelas;
    END IF;
END $$;

-- 5. Rename Waktu -> master_waktu
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'waktu') THEN
        ALTER TABLE waktu RENAME TO master_waktu;
    END IF;
END $$;

-- =========================================================
-- DISABLE ROW LEVEL SECURITY (UNRESTRICTED ACCESS)
-- =========================================================

ALTER TABLE master_siswa DISABLE ROW LEVEL SECURITY;
ALTER TABLE master_guru DISABLE ROW LEVEL SECURITY;
ALTER TABLE master_mapel DISABLE ROW LEVEL SECURITY;
ALTER TABLE master_kelas DISABLE ROW LEVEL SECURITY;
ALTER TABLE master_waktu DISABLE ROW LEVEL SECURITY;
