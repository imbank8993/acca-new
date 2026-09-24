-- Migration: Create rekam_medik_log table for archive tracking
-- Description: Stores metadata of exported Rekam Medik PDF documents

CREATE TABLE IF NOT EXISTS rekam_medik_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bulan INTEGER NOT NULL CHECK (bulan BETWEEN 1 AND 12),
    tahun INTEGER NOT NULL,
    file_url TEXT,
    file_name TEXT,
    total_records INTEGER DEFAULT 0,
    petugas_nama VARCHAR(255),
    petugas_nip VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rekam_medik_log_bulan_tahun ON rekam_medik_log(bulan, tahun);
CREATE INDEX IF NOT EXISTS idx_rekam_medik_log_created_at ON rekam_medik_log(created_at DESC);

COMMENT ON TABLE rekam_medik_log IS 'Archive log for exported Rekam Medik PDF documents';