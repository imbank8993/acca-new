CREATE TABLE IF NOT EXISTS public.registrasi_sanggar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama TEXT NOT NULL,
    nip TEXT,
    asal_sekolah TEXT NOT NULL,
    alamat TEXT NOT NULL,
    nomor_wa TEXT NOT NULL,
    email TEXT,
    pilihan_sanggar TEXT NOT NULL,
    kelas_pelatihan TEXT NOT NULL,
    sumber_aplikasi TEXT DEFAULT 'acca-app',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.registrasi_sanggar ENABLE ROW LEVEL SECURITY;

-- Allow insert from everyone (since akademik-app might send data without login)
CREATE POLICY "Allow insert for everyone" ON public.registrasi_sanggar FOR INSERT WITH CHECK (true);

-- Allow read for authenticated users only
CREATE POLICY "Allow read for authenticated" ON public.registrasi_sanggar FOR SELECT TO authenticated USING (true);
