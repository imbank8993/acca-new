-- Migration: Create acca_letters table
-- Stores ACCA letters generated from ketidakhadiran (IZIN type)
-- with barcode verification and file upload to file.icgowa.sch.id

CREATE TABLE IF NOT EXISTS acca_letters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nomor_surat TEXT UNIQUE NOT NULL,
    nomor_urut INTEGER NOT NULL,
    barcode TEXT UNIQUE NOT NULL,
    jenis_izin TEXT NOT NULL CHECK (jenis_izin IN ('P', 'M')),
    siswa_nama TEXT NOT NULL,
    siswa_nisn TEXT NOT NULL,
    siswa_kelas TEXT,
    tgl_mulai TEXT NOT NULL,
    tgl_selesai TEXT NOT NULL,
    keterangan TEXT,
    file_url TEXT,
    file_name TEXT,
    generated_by TEXT,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_acc_letters_barcode ON acca_letters(barcode);
CREATE INDEX IF NOT EXISTS idx_acc_letters_nomor ON acca_letters(nomor_surat);
CREATE INDEX IF NOT EXISTS idx_acc_letters_tgl ON acca_letters(generated_at DESC);

-- Sequence for nomor_urut per year
CREATE TABLE IF NOT EXISTS acca_letter_sequence (
    tahun INTEGER PRIMARY KEY,
    last_number INTEGER DEFAULT 0
);

COMMENT ON TABLE acca_letters IS 'Surat ACCA generated from ketidakhadiran IZIN data';
