-- Add missing columns to laporan_piket to match API expectations
ALTER TABLE public.laporan_piket 
ADD COLUMN IF NOT EXISTS nama_guru_piket TEXT,
ADD COLUMN IF NOT EXISTS jam_ke TEXT,
ADD COLUMN IF NOT EXISTS keterangan TEXT;

-- Create detail table for per-class reports
CREATE TABLE IF NOT EXISTS public.laporan_piket_detail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    piket_id UUID REFERENCES public.laporan_piket(id) ON DELETE CASCADE,
    nama_kelas TEXT NOT NULL,
    nama_guru TEXT,
    status_kehadiran TEXT,
    dokumentasi_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for detail table
CREATE INDEX IF NOT EXISTS idx_laporan_piket_detail_piket_id ON public.laporan_piket_detail(piket_id);

-- Check RLS
ALTER TABLE public.laporan_piket ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laporan_piket_detail ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to select
CREATE POLICY "Allow authenticated select" ON public.laporan_piket
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated select detail" ON public.laporan_piket_detail
    FOR SELECT USING (auth.role() = 'authenticated');
