-- Migration: Create Grading System Tables
-- Created: 2026-01-28

CREATE TABLE IF NOT EXISTS nilai_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nip VARCHAR(255) NOT NULL,
    kelas VARCHAR(100) NOT NULL,
    mapel VARCHAR(100) NOT NULL,
    semester INTEGER NOT NULL,
    nisn VARCHAR(50) NOT NULL,
    jenis VARCHAR(50) NOT NULL, -- e.g. 'Kuis', 'Tugas', 'UH', 'PTS', 'PAS'
    tagihan VARCHAR(255), -- Assessment name
    materi_tp VARCHAR(100), -- Topic name (SUM 1, SUM 2, etc.)
    nilai NUMERIC(5, 2), -- Score
    catatan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nilai_bobot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nip VARCHAR(255) NOT NULL,
    kelas VARCHAR(100) NOT NULL,
    mapel VARCHAR(100) NOT NULL,
    semester INTEGER NOT NULL,
    bobot_config JSONB NOT NULL, -- { harian: { Kuis: 20, Tugas: 30, UH: 50 }, rapor: { Harian: 60, PAS: 40 }, perBab: {} }
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nilai_tagihan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nip VARCHAR(255) NOT NULL,
    kelas VARCHAR(100) NOT NULL,
    mapel VARCHAR(100) NOT NULL,
    semester INTEGER NOT NULL,
    materi_tp VARCHAR(100) NOT NULL,
    jenis VARCHAR(50) NOT NULL,
    nama_tagihan VARCHAR(255) NOT NULL,
    topik TEXT,
    tanggal DATE,
    deskripsi TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_nilai_data_lookup ON nilai_data(nip, kelas, mapel, semester);
CREATE INDEX IF NOT EXISTS idx_nilai_bobot_lookup ON nilai_bobot(nip, kelas, mapel, semester);
CREATE INDEX IF NOT EXISTS idx_nilai_tagihan_lookup ON nilai_tagihan(nip, kelas, mapel, semester);

-- RLS (Row Level Security) - Basic setup
-- Disable RLS for now to ensure working state, user can enable later if needed
-- ALTER TABLE nilai_data ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE nilai_bobot ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE nilai_tagihan ENABLE ROW LEVEL SECURITY;
