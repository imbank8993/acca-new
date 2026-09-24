-- Explicitly use 'public' schema to avoid search_path issues
ALTER TABLE public.dokumen_siswa
DROP CONSTRAINT IF EXISTS fk_dokumen_siswa_nisn;

ALTER TABLE public.dokumen_siswa
ADD CONSTRAINT fk_dokumen_siswa_nisn
FOREIGN KEY (nisn)
REFERENCES public.siswa(nisn)
ON DELETE CASCADE;
