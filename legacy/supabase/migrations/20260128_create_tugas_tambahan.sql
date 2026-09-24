-- Migration: Create Tugas Tambahan Tables
-- Created: 2026-01-28

CREATE TABLE IF NOT EXISTS tugas_tambahan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nip VARCHAR(255) NOT NULL,
    nama_guru VARCHAR(255) NOT NULL,
    jabatan VARCHAR(100) NOT NULL, -- Wali Kelas, Pembina Ekstrakurikuler, Kepala Laboratorium, Kepala Perpustakaan, Wakil Kepala Madrasah
    keterangan TEXT, -- Deskripsi tugas atau detil (misal kelas yang dibawahi, atau divisi wakil)
    tahun_ajaran VARCHAR(20) NOT NULL,
    semester INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (nip, jabatan, tahun_ajaran, semester)
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_tugas_tambahan_nip ON tugas_tambahan(nip);
CREATE INDEX IF NOT EXISTS idx_tugas_tambahan_tahun_semester ON tugas_tambahan(tahun_ajaran, semester);

-- Create a table for periodic reports (jurnal) of these additional duties
CREATE TABLE IF NOT EXISTS jurnal_tugas_tambahan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tugas_id UUID REFERENCES tugas_tambahan(id) ON DELETE CASCADE,
    nip VARCHAR(255) NOT NULL,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    kegiatan TEXT NOT NULL,
    hasil TEXT,
    foto_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jurnal_tt_tanggal ON jurnal_tugas_tambahan(tanggal);
CREATE INDEX IF NOT EXISTS idx_jurnal_tt_nip ON jurnal_tugas_tambahan(nip);
