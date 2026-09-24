-- =====================================================
-- ACCA App: Absensi (Attendance) Module
-- Migration: Create Jadwal, Absensi Sesi, and Absensi Detail tables
-- =====================================================

-- =====================================================
-- Table: jadwal_guru (Teacher Schedules)
-- =====================================================
CREATE TABLE IF NOT EXISTS jadwal_guru (
    id BIGSERIAL PRIMARY KEY,
    nip TEXT NOT NULL,
    nama_guru TEXT NOT NULL,
    hari TEXT NOT NULL CHECK (hari IN ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu')),
    jam_ke INTEGER NOT NULL CHECK (jam_ke >= 1 AND jam_ke <= 10),
    kelas TEXT NOT NULL,
    mata_pelajaran TEXT NOT NULL,
    tahun_ajaran TEXT NOT NULL,
    semester INTEGER NOT NULL CHECK (semester IN (1, 2)),
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for jadwal_guru
CREATE INDEX idx_jadwal_guru_nip ON jadwal_guru(nip, hari, aktif);
CREATE INDEX idx_jadwal_guru_kelas ON jadwal_guru(kelas, hari, aktif);

-- =====================================================
-- Table: absensi_sesi (Attendance Sessions)
-- =====================================================
CREATE TABLE IF NOT EXISTS absensi_sesi (
    id BIGSERIAL PRIMARY KEY,
    jadwal_id BIGINT REFERENCES jadwal_guru(id) ON DELETE SET NULL,
    nip TEXT NOT NULL,
    kelas TEXT NOT NULL,
    mata_pelajaran TEXT NOT NULL,
    tanggal DATE NOT NULL,
    hari TEXT NOT NULL CHECK (hari IN ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu')),
    jam_ke INTEGER NOT NULL CHECK (jam_ke >= 1 AND jam_ke <= 10),
    materi TEXT,
    catatan TEXT,
    tahun_ajaran TEXT NOT NULL,
    semester INTEGER NOT NULL CHECK (semester IN (1, 2)),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT NOT NULL
);

-- Indexes for absensi_sesi
CREATE INDEX idx_absensi_sesi_guru ON absensi_sesi(nip, tanggal);
CREATE INDEX idx_absensi_sesi_kelas ON absensi_sesi(kelas, tanggal);

-- =====================================================
-- Table: absensi_detail (Individual Student Attendance)
-- =====================================================
CREATE TABLE IF NOT EXISTS absensi_detail (
    id BIGSERIAL PRIMARY KEY,
    sesi_id BIGINT NOT NULL REFERENCES absensi_sesi(id) ON DELETE CASCADE,
    siswa_id TEXT NOT NULL,
    nama_siswa TEXT NOT NULL,
    nis TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('H', 'S', 'I', 'A')),
    keterangan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Ensure one record per student per session
    UNIQUE(sesi_id, siswa_id)
);

-- Indexes for absensi_detail
CREATE INDEX idx_absensi_detail_sesi ON absensi_detail(sesi_id);
CREATE INDEX idx_absensi_detail_siswa ON absensi_detail(siswa_id);

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE jadwal_guru ENABLE ROW LEVEL SECURITY;
ALTER TABLE absensi_sesi ENABLE ROW LEVEL SECURITY;
ALTER TABLE absensi_detail ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- jadwal_guru Policies
-- =====================================================

-- Teachers can view their own schedules
CREATE POLICY "Teachers can view their own schedules"
    ON jadwal_guru
    FOR SELECT
    USING (
        nip = current_setting('app.current_user_nip', true)
    );

-- Admins can view all schedules
CREATE POLICY "Admins can view all schedules"
    ON jadwal_guru
    FOR SELECT
    USING (
        current_setting('app.current_user_role', true) LIKE '%KAMAD%' 
        OR current_setting('app.current_user_role', true) LIKE '%TU%'
    );

-- Admins can insert/update/delete schedules
CREATE POLICY "Admins can manage schedules"
    ON jadwal_guru
    FOR ALL
    USING (
        current_setting('app.current_user_role', true) LIKE '%KAMAD%' 
        OR current_setting('app.current_user_role', true) LIKE '%TU%'
    );

-- =====================================================
-- absensi_sesi Policies
-- =====================================================

-- Teachers can view their own attendance sessions
CREATE POLICY "Teachers can view their own attendance sessions"
    ON absensi_sesi
    FOR SELECT
    USING (
        nip = current_setting('app.current_user_nip', true)
    );

-- Teachers can create attendance sessions for their schedules
CREATE POLICY "Teachers can create attendance sessions"
    ON absensi_sesi
    FOR INSERT
    WITH CHECK (
        nip = current_setting('app.current_user_nip', true)
    );

-- Teachers can update their own attendance sessions
CREATE POLICY "Teachers can update their own sessions"
    ON absensi_sesi
    FOR UPDATE
    USING (
        nip = current_setting('app.current_user_nip', true)
    );

-- Admins can view all sessions
CREATE POLICY "Admins can view all sessions"
    ON absensi_sesi
    FOR SELECT
    USING (
        current_setting('app.current_user_role', true) LIKE '%KAMAD%' 
        OR current_setting('app.current_user_role', true) LIKE '%TU%'
    );

-- =====================================================
-- absensi_detail Policies
-- =====================================================

-- Teachers can view attendance details for their sessions
CREATE POLICY "Teachers can view their session details"
    ON absensi_detail
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM absensi_sesi
            WHERE absensi_sesi.id = absensi_detail.sesi_id
            AND absensi_sesi.nip = current_setting('app.current_user_nip', true)
        )
    );

-- Teachers can insert/update attendance details for their sessions
CREATE POLICY "Teachers can manage their session details"
    ON absensi_detail
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM absensi_sesi
            WHERE absensi_sesi.id = absensi_detail.sesi_id
            AND absensi_sesi.nip = current_setting('app.current_user_nip', true)
        )
    );

-- Admins can view all attendance details
CREATE POLICY "Admins can view all attendance details"
    ON absensi_detail
    FOR SELECT
    USING (
        current_setting('app.current_user_role', true) LIKE '%KAMAD%' 
        OR current_setting('app.current_user_role', true) LIKE '%TU%'
    );

-- =====================================================
-- Helper Functions
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on jadwal_guru
CREATE TRIGGER update_jadwal_guru_updated_at
    BEFORE UPDATE ON jadwal_guru
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE jadwal_guru IS 'Teacher schedules - stores weekly schedule for each teacher';
COMMENT ON TABLE absensi_sesi IS 'Attendance sessions - one record per class meeting';
COMMENT ON TABLE absensi_detail IS 'Student attendance records - individual attendance per session';

COMMENT ON COLUMN jadwal_guru.hari IS 'Day of week: Senin, Selasa, Rabu, Kamis, Jumat, Sabtu';
COMMENT ON COLUMN jadwal_guru.jam_ke IS 'Period number (1-10)';
COMMENT ON COLUMN absensi_detail.status IS 'H=Hadir, S=Sakit, I=Izin, A=Alpa';
