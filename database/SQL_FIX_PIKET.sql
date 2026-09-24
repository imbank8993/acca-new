
-- 1. Perbaiki Tabel Header (laporan_piket)
-- Jika tabel sudah ada tapi kolomnya salah, kita tambahkan kolom yang kurang
ALTER TABLE laporan_piket ADD COLUMN IF NOT EXISTS jam_ke TEXT;
ALTER TABLE laporan_piket ADD COLUMN IF NOT EXISTS nama_guru_piket TEXT;
ALTER TABLE laporan_piket ADD COLUMN IF NOT EXISTS nip_guru_piket TEXT;
ALTER TABLE laporan_piket ADD COLUMN IF NOT EXISTS keterangan TEXT;

-- Atau, jika Anda ingin mereset total (HATI-HATI MEMHAPUS DATA LAMA):
-- DROP TABLE laporan_piket CASCADE;
-- Kemudian jalankan CREATE TABLE ulang di bawah ini.

-- Pastikan Tabel Header lengkap
CREATE TABLE IF NOT EXISTS laporan_piket (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tanggal DATE NOT NULL,
    nama_guru_piket TEXT NOT NULL,
    nip_guru_piket TEXT,
    jam_ke TEXT NOT NULL,
    keterangan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Buat Tabel Detail (laporan_piket_detail)
CREATE TABLE IF NOT EXISTS laporan_piket_detail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    piket_id UUID NOT NULL REFERENCES laporan_piket(id) ON DELETE CASCADE,
    nama_kelas TEXT NOT NULL,
    nama_guru TEXT,
    status_kehadiran TEXT,
    dokumentasi_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Aktifkan Security (opsional, public allow all untuk saat ini)
ALTER TABLE laporan_piket ENABLE ROW LEVEL SECURITY;
ALTER TABLE laporan_piket_detail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Insert Header" ON laporan_piket FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Select Header" ON laporan_piket FOR SELECT USING (true);
CREATE POLICY "Public Update Header" ON laporan_piket FOR UPDATE USING (true);

CREATE POLICY "Public Insert Detail" ON laporan_piket_detail FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Select Detail" ON laporan_piket_detail FOR SELECT USING (true);
