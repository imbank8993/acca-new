-- Jenis baris pada kalender libur:
--   'libur'         = hari/jam libur (warna merah di kalender agenda)
--   'tidak_efektif' = PBM tidak efektif (madrasah tetap buka, pembelajaran reguler ditiadakan)
-- Keduanya sama-sama meniadakan PBM reguler bagi jurnal/jadwal/absensi; bedanya
-- hanya pada label dan tampilan. Aman dijalankan ulang.
ALTER TABLE public.libur ADD COLUMN IF NOT EXISTS jenis text NOT NULL DEFAULT 'libur';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'libur_jenis_check') THEN
    ALTER TABLE public.libur
      ADD CONSTRAINT libur_jenis_check CHECK (jenis IN ('libur', 'tidak_efektif'));
  END IF;
END $$;

-- Sebelum kolom ini ada, "PBM tidak efektif" hanya dikenali dari keterangannya.
UPDATE public.libur
   SET jenis = 'tidak_efektif'
 WHERE jenis = 'libur'
   AND keterangan ~* '(tidak\s*efektif|non\s*[-_ ]?efektif)';
