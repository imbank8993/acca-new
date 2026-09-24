-- Migration: Create tugas_siswa table
-- Deskripsi: Tabel untuk menyimpan data tugas siswa yang diinput oleh siswa

CREATE TABLE IF NOT EXISTS tugas_siswa (
    id BIGSERIAL PRIMARY KEY,
    guru_id TEXT,                         -- NIP guru yang membuat tugas (nullable untuk kompatibilitas)
    nama_guru TEXT NOT NULL,
    mapel_id INTEGER,
    nama_mapel TEXT NOT NULL,
    kelas TEXT NOT NULL,
    judul_tugas TEXT NOT NULL,
    deskripsi TEXT,
    tanggal_mulai DATE,
    tanggal_selesai DATE,                 -- nullable untuk tugas tunggal
    is_range BOOLEAN DEFAULT false,       -- true = rentang, false = tunggal
    file_url TEXT,                        -- URL file lampiran
    file_name TEXT,                       -- Nama file original
    nisn_pembuat TEXT,                    -- NISN siswa yang membuat tugas (untuk tracking)
    nama_pembuat TEXT,                    -- Nama siswa yang membuat tugas
    tahun_ajaran TEXT,
    semester INTEGER,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk query yang cepat
CREATE INDEX IF NOT EXISTS idx_tugas_siswa_guru_id ON tugas_siswa(guru_id);
CREATE INDEX IF NOT EXISTS idx_tugas_siswa_kelas ON tugas_siswa(kelas);
CREATE INDEX IF NOT EXISTS idx_tugas_siswa_mapel ON tugas_siswa(nama_mapel);
CREATE INDEX IF NOT EXISTS idx_tugas_siswa_tanggal ON tugas_siswa(tanggal_mulai);
CREATE INDEX IF NOT EXISTS idx_tugas_siswa_created_at ON tugas_siswa(created_at DESC);

-- Enable RLS
ALTER TABLE tugas_siswa ENABLE ROW LEVEL SECURITY;

-- Policy untuk Admin (bisa lihat dan edit semua)
CREATE POLICY "Admin can do all on tugas_siswa"
    ON tugas_siswa FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_id = auth.uid()
            AND role LIKE '%ADMIN%'
        )
    );

-- Policy untuk Guru (bisa lihat tugas yang dibuat oleh guru tersebut atau dimana guru tersebut mengajar)
CREATE POLICY "Guru can view tugas_siswa"
    ON tugas_siswa FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_id = auth.uid()
            AND role LIKE '%GURU%'
        )
    );

-- Policy untuk Siswa (hanya bisa lihat tugas untuk kelasnya)
CREATE POLICY "Siswa can view tugas_siswa"
    ON tugas_siswa FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_id = auth.uid()
            AND role LIKE '%SISWA%'
        )
    );

-- Comment
COMMENT ON TABLE tugas_siswa IS 'Tabel untuk menyimpan data tugas siswa';
COMMENT ON COLUMN tugas_siswa.guru_id IS 'NIP guru yang memberikan tugas';
COMMENT ON COLUMN tugas_siswa.nama_mapel IS 'Nama mata pelajaran';
COMMENT ON COLUMN tugas_siswa.is_range IS 'true = rentang tanggal, false = tanggal tunggal';
COMMENT ON COLUMN tugas_siswa.nisn_pembuat IS 'NISN siswa yang input tugas (tracking)';