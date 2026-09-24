-- 1. Create table public.pengumuman
CREATE TABLE IF NOT EXISTS public.pengumuman (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'Umum',
    pinned BOOLEAN NOT NULL DEFAULT false,
    target_roles TEXT[] NULL, -- e.g. ARRAY['GURU', 'SISWA'] or null for all
    created_by TEXT NOT NULL,
    created_by_nip VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. RLS
ALTER TABLE public.pengumuman ENABLE ROW LEVEL SECURITY;

-- Policy: Semua authenticated user bisa read
CREATE POLICY "Pengumuman: authenticated can read" ON public.pengumuman
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Authenticated user bisa write
CREATE POLICY "Pengumuman: authenticated can write" ON public.pengumuman
    FOR ALL USING (auth.role() = 'authenticated');

-- 3. Permissions
INSERT INTO master_permissions_list (category, resource, action, label, description)
VALUES
  ('04. LAYANAN & INFO', 'pengumuman', 'view',   'Lihat Pengumuman',    'Melihat halaman & data Pengumuman'),
  ('04. LAYANAN & INFO', 'pengumuman', 'create',  'Input Pengumuman',    'Menginput Pengumuman baru'),
  ('04. LAYANAN & INFO', 'pengumuman', 'edit',    'Edit Pengumuman',     'Mengubah Pengumuman'),
  ('04. LAYANAN & INFO', 'pengumuman', 'delete',  'Hapus Pengumuman',    'Menghapus Pengumuman')
ON CONFLICT (resource, action) DO NOTHING;
