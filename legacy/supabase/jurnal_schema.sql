-- ============================================
-- JURNAL GURU FEATURE - DATABASE SCHEMA
-- ============================================

-- Table: jurnal_settings
-- Purpose: Stores configuration for automatic journal generation
CREATE TABLE IF NOT EXISTS jurnal_settings (
    id SERIAL PRIMARY KEY,
    is_auto_generate_enabled BOOLEAN DEFAULT false,
    generate_start_date DATE,
    generate_end_date DATE,
    skip_holidays BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255)
);

-- Table: jurnal_guru
-- Purpose: Stores teacher journal entries (generated or manually filled)
CREATE TABLE IF NOT EXISTS jurnal_guru (
    id SERIAL PRIMARY KEY,
    nip VARCHAR(50) NOT NULL,
    nama_guru VARCHAR(255) NOT NULL,
    tanggal DATE NOT NULL,
    hari VARCHAR(20) NOT NULL,
    jam_ke VARCHAR(10) NOT NULL,
    kelas VARCHAR(50) NOT NULL,
    mata_pelajaran VARCHAR(255) NOT NULL,
    materi TEXT,
    refleksi TEXT,
    kategori_kehadiran VARCHAR(50) DEFAULT 'Sesuai',
    guru_pengganti VARCHAR(255),
    keterangan_terlambat TEXT,
    keterangan_tambahan TEXT,
    guru_piket VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(nip, tanggal, jam_ke, kelas)
);

-- Table: jadwal_guru
-- Purpose: Stores teacher schedules for automatic journal generation
CREATE TABLE IF NOT EXISTS jadwal_guru (
    id SERIAL PRIMARY KEY,
    nip VARCHAR(50) NOT NULL,
    nama_guru VARCHAR(255) NOT NULL,
    hari VARCHAR(20) NOT NULL,
    jam_ke INT NOT NULL,
    kelas VARCHAR(50) NOT NULL,
    mata_pelajaran VARCHAR(255) NOT NULL,
    aktif BOOLEAN DEFAULT true,
    tanggal_mulai_berlaku DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(nip, hari, jam_ke, kelas)
);

-- Table: libur
-- Purpose: Stores holiday information for skipping journal generation
CREATE TABLE IF NOT EXISTS libur (
    id SERIAL PRIMARY KEY,
    tanggal DATE NOT NULL,
    jam_ke INT,
    keterangan VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tanggal, jam_ke)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_jurnal_guru_tanggal ON jurnal_guru(tanggal);
CREATE INDEX IF NOT EXISTS idx_jurnal_guru_nip ON jurnal_guru(nip);
CREATE INDEX IF NOT EXISTS idx_jurnal_guru_kelas ON jurnal_guru(kelas);
CREATE INDEX IF NOT EXISTS idx_jadwal_guru_hari ON jadwal_guru(hari);
CREATE INDEX IF NOT EXISTS idx_jadwal_guru_aktif ON jadwal_guru(aktif);
CREATE INDEX IF NOT EXISTS idx_libur_tanggal ON libur(tanggal);

-- Comments for documentation
COMMENT ON TABLE jurnal_settings IS 'Configuration for automatic journal generation';
COMMENT ON TABLE jurnal_guru IS 'Teacher journal entries (auto-generated or manually filled by students)';
COMMENT ON TABLE jadwal_guru IS 'Teacher schedule for automatic journal generation';
COMMENT ON TABLE libur IS 'Holiday calendar for skipping journal generation';
