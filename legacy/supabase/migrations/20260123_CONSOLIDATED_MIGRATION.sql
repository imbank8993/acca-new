-- =====================================================
-- CONSOLIDATED MIGRATION SCRIPT (2026-01-23)
-- Run this ENTIRE script in Supabase SQL Editor to fix missing tables and columns.
-- =====================================================

-- -----------------------------------------------------
-- 1. BASE MASTER DATA TABLES (Mapel, Kelas, Waktu, Siswa)
-- -----------------------------------------------------

-- Mapel
CREATE TABLE IF NOT EXISTS mapel (
    id BIGSERIAL PRIMARY KEY,
    kode TEXT UNIQUE NOT NULL,
    nama TEXT NOT NULL,
    kelompok TEXT,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ref Kelas
CREATE TABLE IF NOT EXISTS ref_kelas (
    id BIGSERIAL PRIMARY KEY,
    nama TEXT UNIQUE NOT NULL,
    tingkat INTEGER, 
    urutan INTEGER DEFAULT 0,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Waktu (Initial Creation)
CREATE TABLE IF NOT EXISTS waktu (
    id BIGSERIAL PRIMARY KEY,
    jam_ke INTEGER NOT NULL,
    mulai TIME NOT NULL,
    selesai TIME NOT NULL,
    hari TEXT,
    is_istirahat BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Constraint might be dropped/recreated below, so we start simple
    UNIQUE(jam_ke, hari) 
);

-- Siswa
CREATE TABLE IF NOT EXISTS siswa (
    nisn TEXT PRIMARY KEY,
    nama_lengkap TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('L', 'P')),
    tempat_lahir TEXT,
    tanggal_lahir DATE,
    nama_ayah TEXT,
    nama_ibu TEXT,
    nomor_hp_ayah TEXT,
    nomor_hp_ibu TEXT,
    alamat TEXT,
    asal_sekolah TEXT,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------
-- 2. GURU & RELATIONS
-- -----------------------------------------------------

-- Guru
CREATE TABLE IF NOT EXISTS guru (
    guru_id TEXT PRIMARY KEY, -- NIP or Custom ID
    nama_lengkap TEXT NOT NULL,
    tempat_lahir TEXT,
    tanggal_lahir DATE,
    golongan TEXT,
    pangkat TEXT,
    tmt_tugas DATE,
    pendidikan_terakhir TEXT,
    riwayat_pendidikan JSONB DEFAULT '[]'::JSONB,
    alamat TEXT,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_guru_nama ON guru(nama_lengkap);

-- Guru Mapel (Pengampuan)
CREATE TABLE IF NOT EXISTS guru_mapel (
    id BIGSERIAL PRIMARY KEY,
    guru_id TEXT NOT NULL,
    mapel_id BIGINT REFERENCES mapel(id) ON DELETE CASCADE,
    tahun_ajaran TEXT NOT NULL,
    semester INTEGER,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(guru_id, mapel_id, tahun_ajaran)
);

-- Guru Asuh (Perwalian)
CREATE TABLE IF NOT EXISTS guru_asuh (
    id BIGSERIAL PRIMARY KEY,
    guru_id TEXT NOT NULL, 
    siswa_id TEXT REFERENCES siswa(nisn) ON DELETE CASCADE,
    tahun_ajaran TEXT NOT NULL,
    kategori TEXT, -- 'Wali Kelas', 'Guru BK', 'Pembina'
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(guru_id, siswa_id, tahun_ajaran, kategori)
);

-- -----------------------------------------------------
-- 3. SCHEMA UPDATES (Program & Time Constraints)
-- -----------------------------------------------------

-- Add 'program' to ref_kelas
ALTER TABLE ref_kelas ADD COLUMN IF NOT EXISTS program TEXT DEFAULT 'Reguler';

-- Add 'program' to waktu
ALTER TABLE waktu ADD COLUMN IF NOT EXISTS program TEXT DEFAULT 'Reguler';

-- Update Unique Constraint for waktu
ALTER TABLE waktu DROP CONSTRAINT IF EXISTS waktu_jam_ke_hari_key;
-- If this fails due to duplicates, you may need to TRUNCATE `waktu` first: TRUNCATE TABLE waktu;
ALTER TABLE waktu ADD CONSTRAINT waktu_hari_program_jam_ke_key UNIQUE (hari, program, jam_ke);


-- -----------------------------------------------------
-- 4. RLS POLICIES (Fixes & Defaults)
-- -----------------------------------------------------

ALTER TABLE mapel ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_kelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE waktu ENABLE ROW LEVEL SECURITY;
ALTER TABLE siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE guru ENABLE ROW LEVEL SECURITY;
ALTER TABLE guru_mapel ENABLE ROW LEVEL SECURITY;
ALTER TABLE guru_asuh ENABLE ROW LEVEL SECURITY;

-- Helper block to create policies safely
DO $$ 
BEGIN
    -- MAPEL
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read mapel') THEN
        CREATE POLICY "Public read mapel" ON mapel FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated insert mapel') THEN
        CREATE POLICY "Authenticated insert mapel" ON mapel FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated update mapel') THEN
        CREATE POLICY "Authenticated update mapel" ON mapel FOR UPDATE TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated delete mapel') THEN
        CREATE POLICY "Authenticated delete mapel" ON mapel FOR DELETE TO authenticated USING (true);
    END IF;

    -- KELAS
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read ref_kelas') THEN
        CREATE POLICY "Public read ref_kelas" ON ref_kelas FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated insert ref_kelas') THEN
         CREATE POLICY "Authenticated insert ref_kelas" ON ref_kelas FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated update ref_kelas') THEN
         CREATE POLICY "Authenticated update ref_kelas" ON ref_kelas FOR UPDATE TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated delete ref_kelas') THEN
         CREATE POLICY "Authenticated delete ref_kelas" ON ref_kelas FOR DELETE TO authenticated USING (true);
    END IF;

    -- WAKTU
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read waktu') THEN
        CREATE POLICY "Public read waktu" ON waktu FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated insert waktu') THEN
        CREATE POLICY "Authenticated insert waktu" ON waktu FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated update waktu') THEN
        CREATE POLICY "Authenticated update waktu" ON waktu FOR UPDATE TO authenticated USING (true);
    END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated delete waktu') THEN
        CREATE POLICY "Authenticated delete waktu" ON waktu FOR DELETE TO authenticated USING (true);
    END IF;

    -- SISWA (Corrected Policies)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read siswa') THEN
        CREATE POLICY "Public read siswa" ON siswa FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable insert for authenticated users') THEN
        CREATE POLICY "Enable insert for authenticated users" ON siswa FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable update for authenticated users') THEN
        CREATE POLICY "Enable update for authenticated users" ON siswa FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable delete for authenticated users') THEN
        CREATE POLICY "Enable delete for authenticated users" ON siswa FOR DELETE TO authenticated USING (true);
    END IF;

    -- GURU
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read guru') THEN
        CREATE POLICY "Public read guru" ON guru FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated insert guru') THEN
        CREATE POLICY "Authenticated insert guru" ON guru FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated update guru') THEN
        CREATE POLICY "Authenticated update guru" ON guru FOR UPDATE TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated delete guru') THEN
        CREATE POLICY "Authenticated delete guru" ON guru FOR DELETE TO authenticated USING (true);
    END IF;
    
END $$;
