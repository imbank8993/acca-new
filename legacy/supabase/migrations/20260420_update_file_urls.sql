-- Migration: Update Upload URLs to new domain file.icgowa.sch.id
-- Created: 2026-04-20

-- 1. Update users (foto_profil)
UPDATE public.users 
SET foto_profil = REPLACE(REPLACE(foto_profil, 'acca.icgowa.sch.id', 'file.icgowa.sch.id'), 'akademik.icgowa.sch.id', 'file.icgowa.sch.id')
WHERE foto_profil LIKE '%icgowa.sch.id%';

-- 2. Update ketidakhadiran (file_url)
UPDATE public.ketidakhadiran
SET file_url = REPLACE(REPLACE(file_url, 'acca.icgowa.sch.id', 'file.icgowa.sch.id'), 'akademik.icgowa.sch.id', 'file.icgowa.sch.id')
WHERE file_url LIKE '%icgowa.sch.id%';

-- 3. Update informasi_akademik (file_url)
UPDATE public.informasi_akademik
SET file_url = REPLACE(REPLACE(file_url, 'acca.icgowa.sch.id', 'file.icgowa.sch.id'), 'akademik.icgowa.sch.id', 'file.icgowa.sch.id')
WHERE file_url LIKE '%icgowa.sch.id%';

-- 4. Update laporan_piket_detail (dokumentasi_url)
UPDATE public.laporan_piket_detail
SET dokumentasi_url = REPLACE(REPLACE(dokumentasi_url, 'acca.icgowa.sch.id', 'file.icgowa.sch.id'), 'akademik.icgowa.sch.id', 'file.icgowa.sch.id')
WHERE dokumentasi_url LIKE '%icgowa.sch.id%';

-- 5. Update laporan_guru_asuh (foto_url)
UPDATE public.laporan_guru_asuh
SET foto_url = REPLACE(REPLACE(foto_url, 'acca.icgowa.sch.id', 'file.icgowa.sch.id'), 'akademik.icgowa.sch.id', 'file.icgowa.sch.id')
WHERE foto_url LIKE '%icgowa.sch.id%';

-- 6. Update personal_documents (file_url & file_path)
UPDATE public.personal_documents
SET 
  file_url = REPLACE(REPLACE(file_url, 'acca.icgowa.sch.id', 'file.icgowa.sch.id'), 'akademik.icgowa.sch.id', 'file.icgowa.sch.id'),
  file_path = REPLACE(REPLACE(file_path, 'acca.icgowa.sch.id', 'file.icgowa.sch.id'), 'akademik.icgowa.sch.id', 'file.icgowa.sch.id')
WHERE file_url LIKE '%icgowa.sch.id%' OR file_path LIKE '%icgowa.sch.id%';

-- 7. Update tugas_siswa (file_url)
UPDATE public.tugas_siswa
SET file_url = REPLACE(REPLACE(file_url, 'acca.icgowa.sch.id', 'file.icgowa.sch.id'), 'akademik.icgowa.sch.id', 'file.icgowa.sch.id')
WHERE file_url LIKE '%icgowa.sch.id%';

-- 8. Update izin_guru (surat_tugas_url)
UPDATE public.izin_guru
SET surat_tugas_url = REPLACE(REPLACE(surat_tugas_url, 'acca.icgowa.sch.id', 'file.icgowa.sch.id'), 'akademik.icgowa.sch.id', 'file.icgowa.sch.id')
WHERE surat_tugas_url LIKE '%icgowa.sch.id%';

-- 9. Update jurnal_tugas_tambahan (foto_url)
UPDATE public.jurnal_tugas_tambahan
SET foto_url = REPLACE(REPLACE(foto_url, 'acca.icgowa.sch.id', 'file.icgowa.sch.id'), 'akademik.icgowa.sch.id', 'file.icgowa.sch.id')
WHERE foto_url LIKE '%icgowa.sch.id%';

-- 10. Update dokumen_siswa (file_url & file_path)
UPDATE public.dokumen_siswa
SET 
  file_url = REPLACE(REPLACE(file_url, 'acca.icgowa.sch.id', 'file.icgowa.sch.id'), 'akademik.icgowa.sch.id', 'file.icgowa.sch.id'),
  file_path = REPLACE(REPLACE(file_path, 'acca.icgowa.sch.id', 'file.icgowa.sch.id'), 'akademik.icgowa.sch.id', 'file.icgowa.sch.id')
WHERE file_url LIKE '%icgowa.sch.id%' OR file_path LIKE '%icgowa.sch.id%';

-- 11. Update uploaded_documents (file_url)
UPDATE public.uploaded_documents
SET file_url = REPLACE(REPLACE(file_url, 'acca.icgowa.sch.id', 'file.icgowa.sch.id'), 'akademik.icgowa.sch.id', 'file.icgowa.sch.id')
WHERE file_url LIKE '%icgowa.sch.id%';

-- 12. Update PTSP Tables
-- ptsp_izin_magang (file_surat_pengantar)
UPDATE public.ptsp_izin_magang SET file_surat_pengantar = REPLACE(REPLACE(file_surat_pengantar, 'acca.icgowa.sch.id', 'file.icgowa.sch.id'), 'akademik.icgowa.sch.id', 'file.icgowa.sch.id') WHERE file_surat_pengantar LIKE '%icgowa.sch.id%';

-- ptsp_sosialisasi (file_url)
UPDATE public.ptsp_sosialisasi SET file_url = REPLACE(REPLACE(file_url, 'acca.icgowa.sch.id', 'file.icgowa.sch.id'), 'akademik.icgowa.sch.id', 'file.icgowa.sch.id') WHERE file_url LIKE '%icgowa.sch.id%';

-- ptsp_legalisir (file_dokumen)
UPDATE public.ptsp_legalisir SET file_dokumen = REPLACE(REPLACE(file_dokumen, 'acca.icgowa.sch.id', 'file.icgowa.sch.id'), 'akademik.icgowa.sch.id', 'file.icgowa.sch.id') WHERE file_dokumen LIKE '%icgowa.sch.id%';

-- ptsp_mutasi_siswa (file_permohonan_ortu, file_rekomendasi_tujuan)
UPDATE public.ptsp_mutasi_siswa SET file_permohonan_ortu = REPLACE(REPLACE(file_permohonan_ortu, 'acca.icgowa.sch.id', 'file.icgowa.sch.id'), 'akademik.icgowa.sch.id', 'file.icgowa.sch.id') WHERE file_permohonan_ortu LIKE '%icgowa.sch.id%';
UPDATE public.ptsp_mutasi_siswa SET file_rekomendasi_tujuan = REPLACE(REPLACE(file_rekomendasi_tujuan, 'acca.icgowa.sch.id', 'file.icgowa.sch.id'), 'akademik.icgowa.sch.id', 'file.icgowa.sch.id') WHERE file_rekomendasi_tujuan LIKE '%icgowa.sch.id%';

-- ptsp_pengganti_ijazah (file_copy_ijazah, file_copy_ktp, file_pas_foto, file_surat_kehilangan)
UPDATE public.ptsp_pengganti_ijazah SET file_copy_ijazah = REPLACE(REPLACE(file_copy_ijazah, 'acca.icgowa.sch.id', 'file.icgowa.sch.id'), 'akademik.icgowa.sch.id', 'file.icgowa.sch.id') WHERE file_copy_ijazah LIKE '%icgowa.sch.id%';
UPDATE public.ptsp_pengganti_ijazah SET file_copy_ktp = REPLACE(REPLACE(file_copy_ktp, 'acca.icgowa.sch.id', 'file.icgowa.sch.id'), 'akademik.icgowa.sch.id', 'file.icgowa.sch.id') WHERE file_copy_ktp LIKE '%icgowa.sch.id%';
UPDATE public.ptsp_pengganti_ijazah SET file_pas_foto = REPLACE(REPLACE(file_pas_foto, 'acca.icgowa.sch.id', 'file.icgowa.sch.id'), 'akademik.icgowa.sch.id', 'file.icgowa.sch.id') WHERE file_pas_foto LIKE '%icgowa.sch.id%';
UPDATE public.ptsp_pengganti_ijazah SET file_surat_kehilangan = REPLACE(REPLACE(file_surat_kehilangan, 'acca.icgowa.sch.id', 'file.icgowa.sch.id'), 'akademik.icgowa.sch.id', 'file.icgowa.sch.id') WHERE file_surat_kehilangan LIKE '%icgowa.sch.id%';

-- ptsp_peminjaman_sarana (file_proposal)
UPDATE public.ptsp_peminjaman_sarana SET file_proposal = REPLACE(REPLACE(file_proposal, 'acca.icgowa.sch.id', 'file.icgowa.sch.id'), 'akademik.icgowa.sch.id', 'file.icgowa.sch.id') WHERE file_proposal LIKE '%icgowa.sch.id%';

-- ptsp_izin_penelitian (file_proposal)
UPDATE public.ptsp_izin_penelitian SET file_proposal = REPLACE(REPLACE(file_proposal, 'acca.icgowa.sch.id', 'file.icgowa.sch.id'), 'akademik.icgowa.sch.id', 'file.icgowa.sch.id') WHERE file_proposal LIKE '%icgowa.sch.id%';

-- ptsp_pengaduan (file_bukti)
UPDATE public.ptsp_pengaduan SET file_bukti = REPLACE(REPLACE(file_bukti, 'acca.icgowa.sch.id', 'file.icgowa.sch.id'), 'akademik.icgowa.sch.id', 'file.icgowa.sch.id') WHERE file_bukti LIKE '%icgowa.sch.id%';
