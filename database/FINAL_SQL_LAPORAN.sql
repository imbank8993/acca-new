-- RUN THIS IN SUPABASE SQL EDITOR

-- 1. Create the Laporan Piket table (if not already created)
CREATE TABLE IF NOT EXISTS public.laporan_piket (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nip TEXT NOT NULL,
    nama_guru TEXT NOT NULL,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    shift TEXT CHECK (shift IN ('Pagi', 'Siang')),
    catatan_kejadian TEXT,
    jumlah_guru_terlambat INTEGER DEFAULT 0,
    jumlah_siswa_terlambat INTEGER DEFAULT 0,
    sarana_prasarana_notes TEXT,
    is_final BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add permissions for Laporan Piket
-- Assuming roles GURU and ADMIN exist
INSERT INTO public.role_permissions (role_name, resource, action, is_allowed)
VALUES 
('GURU', 'laporan_piket', 'create', true),
('GURU', 'laporan_piket', 'view', true),
('ADMIN', 'laporan_piket', 'create', true),
('ADMIN', 'laporan_piket', 'view', true),
('ADMIN', 'laporan_piket', 'delete', true)
ON CONFLICT DO NOTHING;

-- 3. Update navigation for a specific user (Example: Update for your username)
-- Ganti 'username_anda' dengan username Anda yang digunakan saat login.
UPDATE public.users 
SET pages = pages || ',Laporan>Jurnal Pembelajaran=laporan/jurnal-pembelajaran|Laporan Guru Piket=laporan/piket'
WHERE username = 'username_anda' 
  AND pages NOT LIKE '%Laporan%';
