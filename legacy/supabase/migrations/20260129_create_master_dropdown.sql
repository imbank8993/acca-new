-- Migration: Create master_dropdown table with unrestricted access and packed data
-- Created: 2026-01-29
-- Description: Stores options for various dropdowns. RLS is DISABLED. Data is packed (starts at row 1 for all cols).

DROP TABLE IF EXISTS public.master_dropdown;

CREATE TABLE public.master_dropdown (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kategori_kehadiran text,
    keterangan_terlambat text,
    jenis_ketidakhadiran text,
    status_ketidakhadiran text,
    golongan text,
    pangkat text,
    
    urutan int DEFAULT 0,
    aktif boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- DISABLE RLS
ALTER TABLE public.master_dropdown DISABLE ROW LEVEL SECURITY;

-- Grant access
GRANT ALL ON TABLE public.master_dropdown TO postgres, authenticated, anon, service_role;

-- Seed Data (Packed)
-- Inserting rows where multiple columns are filled simultaneously
INSERT INTO public.master_dropdown 
(kategori_kehadiran, keterangan_terlambat, jenis_ketidakhadiran, status_ketidakhadiran, golongan, pangkat)
VALUES
('Hadir', 'Hujan',           'Sakit',      'Disetujui', 'I/a',   'Juru Muda'),
('Izin',  'Macet',           'Izin',       'Menunggu',  'I/b',   'Juru'),
('Sakit', 'Kendaraan Rusak', 'Cuti',       'Ditolak',   'I/c',   'Pengatur Muda'),
('Alpa',  'Lainnya',         'Dinas Luar', NULL,        'I/d',   'Pengatur'),
('Terlambat',                     NULL, NULL, 'Hadir Penuh', 'II/a',  'Penata Muda'),
('Diganti',                       NULL, NULL, 'Hanya Tugas', 'II/b',  'Penata'),
('Tukaran',                       NULL, NULL, 'Zoom/Online', 'II/c',  'Pembina'),
('Tim Teaching',                  NULL, NULL, 'Terlambat',   'II/d',  NULL),
('Penugasan dengan Pendampingan', NULL, NULL, NULL,          'III/a', NULL),
('Guru Pengganti',                NULL, NULL, NULL,          'III/b', NULL),
(NULL,    NULL,              NULL,         NULL,        'III/c', NULL),
(NULL,    NULL,              NULL,         NULL,        'III/d', NULL),
(NULL,    NULL,              NULL,         NULL,        'IV/a',  NULL),
(NULL,    NULL,              NULL,         NULL,        'IV/b',  NULL);
