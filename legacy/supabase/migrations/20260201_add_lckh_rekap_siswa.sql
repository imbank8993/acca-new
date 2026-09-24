ALTER TABLE public.lckh_submissions 
ADD COLUMN IF NOT EXISTS rekap_absensi_siswa JSONB;

COMMENT ON COLUMN public.lckh_submissions.rekap_absensi_siswa IS 'Rekapan statistik absensi siswa per kelas dan mapel (JSON [{kelas, mapel, sesi, H, S, I, A}])';
