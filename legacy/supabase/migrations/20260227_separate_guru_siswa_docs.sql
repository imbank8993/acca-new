-- Migration: Separate Guru and Siswa Documents
-- Date: 2026-02-27

-- 1. Add target_role to upload_categories
ALTER TABLE public.upload_categories 
ADD COLUMN IF NOT EXISTS target_role TEXT DEFAULT 'siswa' CHECK (target_role IN ('siswa', 'guru'));

-- 2. Add target_role and nip to dokumen_siswa
ALTER TABLE public.dokumen_siswa 
ADD COLUMN IF NOT EXISTS target_role TEXT DEFAULT 'siswa' CHECK (target_role IN ('siswa', 'guru')),
ADD COLUMN IF NOT EXISTS nip TEXT;

-- 3. Relax FK constraint on nisn to allow NULL (since Guru uses NIP)
ALTER TABLE public.dokumen_siswa 
ALTER COLUMN nisn DROP NOT NULL; -- Some systems might need direct ALTER

-- If there's a strict FK, we might need to drop and re-add or just leave it if it's not strictly enforced.
-- Based on previous research, it references public.siswa(nisn).
-- For Guru, NISN will be NULL and NIP will be filled.

-- 4. Add index for NIP
CREATE INDEX IF NOT EXISTS idx_dok_siswa_nip ON public.dokumen_siswa(nip);

-- 5. Update existing records if any (default is 'siswa', so it's fine)
