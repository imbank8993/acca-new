-- Migration: Create Prestasi Lomba Table
-- Created: 2026-07-18

-- Create ENUM types or check constraints
-- We use TEXT with CHECK constraint for better flexibility with Supabase

CREATE TABLE IF NOT EXISTS prestasi_lomba (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nisn TEXT NOT NULL,
    nama_lomba TEXT NOT NULL,
    kategori TEXT NOT NULL,
    tingkat TEXT NOT NULL CHECK (tingkat IN ('Sekolah', 'Kabupaten/Kota', 'Provinsi', 'Nasional', 'Internasional')),
    penyelenggara TEXT NOT NULL,
    tanggal_pelaksanaan DATE NOT NULL,
    prestasi_diraih TEXT NOT NULL,
    bukti_sertifikat TEXT NOT NULL,
    foto_kegiatan TEXT,
    status_validasi TEXT NOT NULL DEFAULT 'Menunggu' CHECK (status_validasi IN ('Menunggu', 'Disetujui', 'Ditolak')),
    catatan_validator TEXT,
    validated_by TEXT,
    validated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_prestasi_lomba_nisn ON prestasi_lomba(nisn);
CREATE INDEX IF NOT EXISTS idx_prestasi_lomba_status ON prestasi_lomba(status_validasi);

-- Enable Row Level Security (RLS)
ALTER TABLE prestasi_lomba ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for authenticated users" 
    ON prestasi_lomba 
    FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert access for authenticated users" 
    ON prestasi_lomba 
    FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update access for authenticated users" 
    ON prestasi_lomba 
    FOR UPDATE 
    USING (auth.role() = 'authenticated');
    
CREATE POLICY "Allow delete access for authenticated users" 
    ON prestasi_lomba 
    FOR DELETE 
    USING (auth.role() = 'authenticated');
