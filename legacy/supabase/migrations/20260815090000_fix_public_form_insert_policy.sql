-- ====================================================================================
-- Fix: tamu tidak bisa mengirim tanggapan pada form "Akses via Link"
-- ====================================================================================
-- Policy lama hanya mengenal kolom custom_forms.is_public, sedangkan aplikasi
-- menganggap sebuah form terbuka untuk umum bila SALAH SATU dari ini benar:
--   - kolom is_public = true             (toggle "Akademik App")
--   - schema->>'is_public'      = 'true'
--   - schema->>'is_link_public' = 'true' (toggle "Akses via Link")
-- Akibatnya insert dari role `anon` ditolak RLS (42501) dan submit gagal,
-- padahal halaman /f/[id] tetap menampilkan formulirnya.
--
-- Catatan penting: policy TIDAK boleh memakai `EXISTS (SELECT ... FROM custom_forms)`
-- langsung, karena RLS custom_forms ikut berlaku di dalam subquery tersebut dan
-- role `anon` hanya boleh membaca baris dengan is_public = true — persis baris yang
-- perlu diperiksa di sini justru tidak terlihat. Karena itu pemeriksaannya
-- dipindah ke fungsi SECURITY DEFINER, sehingga visibilitas SELECT custom_forms
-- untuk publik tidak perlu diperlebar.

CREATE OR REPLACE FUNCTION public.form_accepts_public_responses(p_form_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.custom_forms f
        WHERE f.id = p_form_id
          AND (
                f.is_public = true
             OR f.schema->>'is_public' = 'true'
             OR f.schema->>'is_link_public' = 'true'
          )
          -- Formulir yang sudah ditutup ditolak di level DB juga, bukan hanya di API
          AND COALESCE(f.schema->>'is_active', 'true') <> 'false'
    );
$$;

REVOKE ALL ON FUNCTION public.form_accepts_public_responses(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.form_accepts_public_responses(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Publik bisa mengisi form public" ON public.custom_form_responses;

CREATE POLICY "Publik bisa mengisi form public"
ON public.custom_form_responses
FOR INSERT
WITH CHECK (public.form_accepts_public_responses(form_id));
