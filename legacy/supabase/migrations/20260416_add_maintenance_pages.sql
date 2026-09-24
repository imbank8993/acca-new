-- Migration: Add new maintenance page settings for recently added pages
-- Pages: kehadiran-siswa, izin-guru, nilai-siswa

INSERT INTO site_settings (key, label, description, value, message)
VALUES
    ('maintenance_kehadiran_siswa', 'Kehadiran Siswa', 'Kunci halaman /kehadiran-siswa', 'false', 'Halaman kehadiran siswa sedang dalam perbaikan.'),
    ('maintenance_izin_guru', 'Izin Guru', 'Kunci halaman /izin-guru', 'false', 'Halaman pengajuan izin guru sedang dalam perbaikan.'),
    ('maintenance_nilai_siswa', 'Nilai Siswa', 'Kunci halaman /nilai-siswa', 'false', 'Halaman nilai siswa sedang dalam perbaikan.')
ON CONFLICT (key) DO NOTHING;
