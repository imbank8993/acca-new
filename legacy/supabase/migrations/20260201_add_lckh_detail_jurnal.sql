ALTER TABLE public.lckh_submissions 
ADD COLUMN IF NOT EXISTS detail_jurnal JSONB;

COMMENT ON COLUMN public.lckh_submissions.detail_jurnal IS 'Detail jurnal harian (JSON [{tanggal, hari, jam_ke, kelas, mapel, materi, siswa_hadir, siswa_sakit, siswa_izin, siswa_alpa}])';
