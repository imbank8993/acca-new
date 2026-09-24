-- =====================================================
-- ACCA App: Master Data & Academic Relations
-- Migration: Create tables for Raw Entities and Relations
-- =====================================================

-- 1. RAW DATA: Mata Pelajaran
CREATE TABLE IF NOT EXISTS mapel (
    id BIGSERIAL PRIMARY KEY,
    kode TEXT UNIQUE NOT NULL,
    nama TEXT NOT NULL,
    kelompok TEXT, -- A (Wajib), B (Peminatan), C (Lintas Minat), dsb.
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RAW DATA: Referensi Kelas (hanya nama kelas, bukan rombel specific tahun)
CREATE TABLE IF NOT EXISTS ref_kelas (
    id BIGSERIAL PRIMARY KEY,
    nama TEXT UNIQUE NOT NULL, -- X A, XI IPA 1, dil
    tingkat INTEGER, -- 10, 11, 12
    urutan INTEGER DEFAULT 0,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RAW DATA: Waktu / Jam Pelajaran
CREATE TABLE IF NOT EXISTS waktu (
    id BIGSERIAL PRIMARY KEY,
    jam_ke INTEGER NOT NULL,
    mulai TIME NOT NULL,
    selesai TIME NOT NULL,
    hari TEXT, -- NULL means applies to all days, or specific 'Jumat'
    is_istirahat BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(jam_ke, hari)
);

-- 4. RAW DATA: Siswa (Data Induk)
-- Memisahkan data profil siswa dari data kelas (siswa_kelas)
-- Updated schema based on user request (2026-01-23)
CREATE TABLE IF NOT EXISTS siswa (
    nisn TEXT PRIMARY KEY, -- Primary Identifier
    nama_lengkap TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('L', 'P')),
    tempat_lahir TEXT,
    tanggal_lahir DATE,
    nama_ayah TEXT,
    nama_ibu TEXT,
    nomor_hp_ayah TEXT,
    nomor_hp_ibu TEXT,
    alamat TEXT,
    asal_sekolah TEXT, -- SMP/MTs
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. RELASI: Guru Mapel (Pengampuan)
CREATE TABLE IF NOT EXISTS guru_mapel (
    id BIGSERIAL PRIMARY KEY,
    guru_id TEXT NOT NULL, -- References users.guru_id implicitly
    mapel_id BIGINT REFERENCES mapel(id) ON DELETE CASCADE,
    tahun_ajaran TEXT NOT NULL,
    semester INTEGER, -- 1, 2, or NULL for both
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(guru_id, mapel_id, tahun_ajaran)
);

-- 6. RELASI: Guru Asuh (Perwalian / Counseling)
CREATE TABLE IF NOT EXISTS guru_asuh (
    id BIGSERIAL PRIMARY KEY,
    guru_id TEXT NOT NULL, 
    siswa_id TEXT REFERENCES siswa(nisn) ON DELETE CASCADE, -- References Raw Siswa
    tahun_ajaran TEXT NOT NULL,
    kategori TEXT, -- 'Wali Kelas', 'Guru BK', 'Pembina'
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(guru_id, siswa_id, tahun_ajaran, kategori)
);

-- Indexes
CREATE INDEX idx_mapel_kode ON mapel(kode);
CREATE INDEX idx_siswa_nama ON siswa(nama_lengkap);
CREATE INDEX idx_guru_mapel_guru ON guru_mapel(guru_id);
CREATE INDEX idx_guru_asuh_guru ON guru_asuh(guru_id);
CREATE INDEX idx_guru_asuh_siswa ON guru_asuh(siswa_id);

-- RLS Policies (Simplified for brevity, assuming standard RBAC)
-- Ensure 'siswa' table has RLS enabled if it was created before, 
-- but since this is presumably a fresh run or we handle IF NOT EXISTS:
ALTER TABLE mapel ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_kelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE waktu ENABLE ROW LEVEL SECURITY;
ALTER TABLE siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE guru_mapel ENABLE ROW LEVEL SECURITY;
ALTER TABLE guru_asuh ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users (adjust as needed for roles)
-- Policy creation commands are idempotent enough with 'IF NOT EXISTS' logic usually needed,
-- but for simplicity here we assume clean state or ignored errors if policy exists.
-- Better to use DO block for idempotency if running on existing DB.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read mapel') THEN
        CREATE POLICY "Public read mapel" ON mapel FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read ref_kelas') THEN
        CREATE POLICY "Public read ref_kelas" ON ref_kelas FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read waktu') THEN
        CREATE POLICY "Public read waktu" ON waktu FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read siswa') THEN
        CREATE POLICY "Public read siswa" ON siswa FOR SELECT TO authenticated USING (true);
    END IF;
END $$;
