-- ====================================================================================
-- Migrasi: Custom Forms (Form Builder)
-- Deskripsi: Tabel untuk menyimpan skema form dari form.io dan respons dari pengguna
-- ====================================================================================

-- 1. Tabel `custom_forms` (Menyimpan Metadata & Skema Form JSON)
CREATE TABLE IF NOT EXISTS public.custom_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE, -- Optional: jika ingin URL cantik seperti /f/pendaftaran-2026
    schema JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger untuk updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.custom_forms;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.custom_forms
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 2. Tabel `custom_form_responses` (Menyimpan Jawaban Pengguna)
CREATE TABLE IF NOT EXISTS public.custom_form_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES public.custom_forms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Null jika diisi oleh tamu (publik)
    data JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================================
-- ROW LEVEL SECURITY (RLS)
-- ====================================================================================

-- Aktifkan RLS
ALTER TABLE public.custom_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_form_responses ENABLE ROW LEVEL SECURITY;

-- Policy untuk `custom_forms`
-- Publik & User login bisa baca form jika form itu di set public = true
CREATE POLICY "Publik bisa membaca form yang public" 
ON public.custom_forms 
FOR SELECT 
USING (is_public = true);

-- User yang login bisa membaca form yang private (Admin/OP_Form dsb)
CREATE POLICY "Authenticated bisa membaca semua form" 
ON public.custom_forms 
FOR SELECT 
TO authenticated 
USING (true);

-- Hanya Admin atau pembuat form yang bisa Insert/Update/Delete form
-- Karena acca-app menggunakan Edge API Access control, kita izinkan auth.uid() != null untuk insert, 
-- nanti akses dibatasi di UI dan API Route (hanya Admin/OP_Form yang bisa panggil endpoint POST/PUT).
CREATE POLICY "Authenticated bisa menambah form" 
ON public.custom_forms 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Pembuat form bisa mengubah form" 
ON public.custom_forms 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Pembuat form bisa menghapus form" 
ON public.custom_forms 
FOR DELETE 
TO authenticated 
USING (auth.uid() = created_by);


-- Policy untuk `custom_form_responses`
-- Publik bisa INSERT respons jika form-nya public
CREATE POLICY "Publik bisa mengisi form public" 
ON public.custom_form_responses 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.custom_forms 
        WHERE id = form_id AND is_public = true
    )
);

-- User yang login bisa mengisi form apapun (jika punya akses)
CREATE POLICY "Authenticated bisa mengisi form" 
ON public.custom_form_responses 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- User yang login bisa melihat respons yang dia kirim (opsional)
CREATE POLICY "User bisa melihat respons sendiri" 
ON public.custom_form_responses 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Pembuat form bisa melihat semua respons untuk form buatannya
CREATE POLICY "Pembuat form bisa melihat semua respons formnya" 
ON public.custom_form_responses 
FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.custom_forms 
        WHERE id = custom_form_responses.form_id AND created_by = auth.uid()
    )
);
