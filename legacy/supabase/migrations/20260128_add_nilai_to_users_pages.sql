-- Migration: Add Nilai to pages for all users
-- This ensures the "Nilai" menu appears for Gurus and Admins by default.
-- Created: 2026-01-28

-- 1. Update Gurus: Add Nilai if not present
UPDATE users
SET pages = CASE 
    WHEN pages IS NULL OR pages = '' THEN 'Dashboard,Absensi,Nilai,LCKH,JadwalGuru,Pengaturan Akun=User'
    WHEN pages NOT LIKE '%Nilai%' THEN pages || ',Nilai'
    ELSE pages 
END
WHERE role ILIKE '%GURU%';

-- 2. Update Admins: Add Nilai if not present
UPDATE users
SET pages = CASE 
    WHEN pages IS NULL OR pages = '' THEN 'Dashboard,Jurnal>Jurnal=jurnal|Pengaturan Jurnal=jurnal/pengaturan|Form Siswa=jurnal/siswa,Konfigurasi Data>Master Data|Pengaturan Data|Pengaturan Users=pengaturan-users|Reset Data,Absensi,Nilai,LCKHApproval,LCKH,Status User=LogLogin ,JadwalGuru,Rekap Data>Absensi=RekapAbsensi|Jurnal=RekapJurnal,Master Data>Wali Kelas=WaliKelas|Guru Asuh=GuruAsuh|Kelas,Pengaturan Akun=User,Export Data>Absensi=ExportAbsensi|Jurnal=ExportJurnal,Rekap Absen&Jurnal=RekapKehadiranJurnal,Layanan Guru>Absensi Guru=AbsensiSiswa|Jurnal Guru=JurnalGuru,Sosialisasi,Ketidakhadiran,StatusSiswa'
    WHEN pages NOT LIKE '%Nilai%' THEN pages || ',Nilai'
    ELSE pages 
END
WHERE role ILIKE '%ADMIN%';

-- 3. Update KAMAD (Headmaster)
UPDATE users
SET pages = CASE 
    WHEN pages IS NULL OR pages = '' THEN 'Dashboard,Absensi,Nilai,LCKHApproval,LCKH,Rekap Data>Absensi=RekapAbsensi|Jurnal=RekapJurnal,Sosialisasi'
    WHEN pages NOT LIKE '%Nilai%' THEN pages || ',Nilai'
    ELSE pages 
END
WHERE role ILIKE '%KAMAD%';
