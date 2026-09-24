-- Update pages string untuk admin users
-- Menambahkan Pengaturan Users ke menu admin

UPDATE users
SET pages = 'Dashboard,Jurnal>Jurnal=jurnal|Pengaturan Jurnal=jurnal/pengaturan|Form Siswa=jurnal/siswa,Konfigurasi Data>Master Data|Pengaturan Data|Pengaturan Users=pengaturan-users|Reset Data,Absensi,Nilai,LCKHApproval,LCKH,Status User=LogLogin,JadwalGuru,Rekap Data>Absensi=RekapAbsensi|Jurnal=RekapJurnal,Master Data>Wali Kelas=WaliKelas|Guru Asuh=GuruAsuh|Kelas,Pengaturan Akun=User,Export Data>Absensi=ExportAbsensi|Jurnal=ExportJurnal,Rekap Absen&Jurnal=RekapKehadiranJurnal,Layanan Guru>Absensi Guru=AbsensiSiswa|Jurnal Guru=JurnalGuru,Sosialisasi,Ketidakhadiran,StatusSiswa'
WHERE role ILIKE '%admin%';

-- Verify the update
SELECT id, username, nama, role, pages
FROM users
WHERE role ILIKE '%admin%';
