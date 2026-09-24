-- Create rekam_medis_siswa table for UKS Medical Records
CREATE TABLE IF NOT EXISTS public.rekam_medis_siswa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    no_rekam_medik VARCHAR(50) NOT NULL,
    nisn VARCHAR(30) NOT NULL,
    nama_siswa VARCHAR(255) NOT NULL,
    kelas VARCHAR(50),
    guru_asuh VARCHAR(255),
    gender VARCHAR(20),
    tempat_lahir VARCHAR(100),
    tanggal_lahir DATE,
    alamat TEXT,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    waktu TIME NOT NULL DEFAULT CURRENT_TIME,
    riwayat_penyakit TEXT[] DEFAULT '{}',
    riwayat_alergi_obat TEXT[] DEFAULT '{}',
    keluhan TEXT NOT NULL,
    tata_laksana TEXT,
    tindakan TEXT[] DEFAULT '{}',
    tindak_lanjut VARCHAR(100) NOT NULL DEFAULT 'Kembali ke Kelas',
    petugas_nama VARCHAR(255) NOT NULL,
    petugas_nip VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by NISN and Date
CREATE INDEX IF NOT EXISTS idx_rekam_medis_nisn ON public.rekam_medis_siswa(nisn);
CREATE INDEX IF NOT EXISTS idx_rekam_medis_tanggal ON public.rekam_medis_siswa(tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_rekam_medis_no_rm ON public.rekam_medis_siswa(no_rekam_medik);

-- Enable RLS
ALTER TABLE public.rekam_medis_siswa ENABLE ROW LEVEL SECURITY;

-- Allow read and write for authenticated users
CREATE POLICY "Allow public read rekam_medis_siswa" ON public.rekam_medis_siswa FOR SELECT USING (true);
CREATE POLICY "Allow authenticated write rekam_medis_siswa" ON public.rekam_medis_siswa FOR ALL USING (true);
