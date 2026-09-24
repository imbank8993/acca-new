-- Migration: Create Kokurikuler tables

-- 1. Master Kokurikuler (Rutinitas)
CREATE TABLE IF NOT EXISTS master_kokurikuler (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_kegiatan VARCHAR(255) NOT NULL,
    kategori VARCHAR(100),
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE master_kokurikuler ENABLE ROW LEVEL SECURITY;
-- Baca: semua user yang login. Tulis (insert/update/delete) TIDAK diberi policy utk
-- role authenticated -> hanya bisa lewat service role (API server yang sudah
-- mengecek peran Koordinator/Admin). Ini mencegah siswa mengubah master via akses langsung.
-- Buang policy permisif lama (jika migrasi versi sebelumnya sudah dijalankan).
DROP POLICY IF EXISTS "Allow read access to anyone" ON master_kokurikuler;
DROP POLICY IF EXISTS "Allow all access to authenticated users" ON master_kokurikuler;
DROP POLICY IF EXISTS "kokur_master_read" ON master_kokurikuler;
CREATE POLICY "kokur_master_read" ON master_kokurikuler FOR SELECT TO authenticated USING (true);

-- 2. Log Kokurikuler Siswa (Pencatatan Harian)
CREATE TABLE IF NOT EXISTS log_kokurikuler_siswa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nisn VARCHAR(50) NOT NULL REFERENCES master_siswa(nisn) ON DELETE CASCADE,
    tanggal DATE NOT NULL,
    kegiatan_id UUID REFERENCES master_kokurikuler(id) ON DELETE SET NULL,
    nama_kegiatan VARCHAR(255) NOT NULL, -- Diisi nama master atau nama kustom
    is_custom BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'Pending', -- Pending, Disetujui, Ditolak
    verifier_nip VARCHAR(50), -- NIP Pembina Asrama yang memverifikasi
    catatan TEXT, -- Catatan dari verifikator (jika ditolak)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_log_kokurikuler_nisn ON log_kokurikuler_siswa(nisn);
CREATE INDEX IF NOT EXISTS idx_log_kokurikuler_tanggal ON log_kokurikuler_siswa(tanggal);
CREATE INDEX IF NOT EXISTS idx_log_kokurikuler_status ON log_kokurikuler_siswa(status);

ALTER TABLE log_kokurikuler_siswa ENABLE ROW LEVEL SECURITY;
-- Baca: semua user login (data ditapis per NISN/kelas di API). Tulis hanya lewat
-- service role (API server memvalidasi kepemilikan NISN utk siswa & peran verifikator).
DROP POLICY IF EXISTS "Allow read access to anyone" ON log_kokurikuler_siswa;
DROP POLICY IF EXISTS "Allow all access to authenticated users" ON log_kokurikuler_siswa;
DROP POLICY IF EXISTS "kokur_log_read" ON log_kokurikuler_siswa;
CREATE POLICY "kokur_log_read" ON log_kokurikuler_siswa FOR SELECT TO authenticated USING (true);
