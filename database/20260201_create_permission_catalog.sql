-- Create a catalog table for available system permissions
CREATE TABLE IF NOT EXISTS master_permissions_list (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL, -- e.g. 'Jurnal', 'Absensi'
    resource VARCHAR(100) NOT NULL, -- The technical resource string, e.g. 'jurnal'
    action VARCHAR(100) NOT NULL,   -- The technical action string, e.g. 'bg_export'
    label VARCHAR(255) NOT NULL,    -- Human readable label
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(resource, action)
);

-- Populate with refined list
INSERT INTO master_permissions_list (category, resource, action, label, description) VALUES
-- JURNAL
('Jurnal', 'jurnal', 'view', 'Lihat Data Jurnal', 'Akses halaman jurnal dan melihat daftar'),
('Jurnal', 'jurnal', 'create', 'Tambah Jurnal', 'Membuat entri jurnal baru'),
('Jurnal', 'jurnal', 'edit_materi_refleksi', 'Edit Materi & Refleksi', 'Hanya edit kolom materi dan refleksi (untuk Guru/Pengganti)'),
('Jurnal', 'jurnal', 'update_any', 'Edit Semua Jurnal', 'Edit penuh seluruh data jurnal (Admin/OP)'),
('Jurnal', 'jurnal', 'delete_any', 'Hapus Data Jurnal', 'Menghapus data jurnal (Admin/OP)'),
('Jurnal', 'jurnal', 'export_personal', 'Export Mode Guru', 'Download laporan jurnal milik sendiri/pengganti'),
('Jurnal', 'jurnal', 'export_class', 'Export Mode Wali Kelas', 'Download laporan jurnal spesifik kelas bimbingan'),
('Jurnal', 'jurnal', 'export_admin', 'Export Mode Admin', 'Download semua data jurnal sistem'),

-- ABSENSI
('Absensi', 'absensi', 'view', 'Lihat Absensi', 'Akses halaman absensi'),
('Absensi', 'absensi', 'take', 'Input Presensi', 'Melakukan input kehadiran siswa'),
('Absensi', 'absensi', 'update', 'Edit Presensi', 'Mengubah data presensi yang sudah disimpan'),
('Absensi', 'absensi', 'delete', 'Hapus Presensi', 'Menghapus sesi absensi'),
('Absensi', 'absensi', 'export_personal', 'Export Laporan Guru', 'Download rekap absen kelas yang diajar'),
('Absensi', 'absensi', 'export_class', 'Export Laporan Wali Kelas', 'Download rekap absen kelas bimbingan'),
('Absensi', 'absensi', 'export_admin', 'Export Laporan Admin', 'Download semua rekap absensi'),

-- KETIDAKHADIRAN
('Ketidakhadiran', 'ketidakhadiran', 'view', 'Lihat Ketidakhadiran', 'Melihat daftar izin/sakit siswa'),
('Ketidakhadiran', 'ketidakhadiran', 'create', 'Input Izin/Sakit', 'Menambahkan data ketidakhadiran siswa'),
('Ketidakhadiran', 'ketidakhadiran', 'approve', 'Approval Ketidakhadiran', 'Menyetujui atau menolak permohonan'),
('Ketidakhadiran', 'ketidakhadiran', 'delete', 'Hapus Ketidakhadiran', 'Menghapus data ketidakhadiran'),

-- NILAI (ASSESSMENT)
('Penilaian', 'nilai', 'view', 'Lihat Nilai', 'Akses halaman penilaian'),
('Penilaian', 'nilai', 'manage', 'Kelola Nilai', 'Input dan edit nilai siswa'),
('Penilaian', 'nilai', 'config', 'Konfigurasi Bobot', 'Mengatur bobot penilaian (PH, PTS, PAS)'),
('Penilaian', 'nilai', 'export', 'Export Leger/Rapor', 'Download data nilai atau rapor'),

-- MASTER DATA (PENGATURAN DATA)
('Master Data', 'master_data', 'siswa_manage', 'Kelola Data Siswa', 'Tambah/Edit/Hapus Siswa'),
('Master Data', 'master_data', 'guru_manage', 'Kelola Data Guru', 'Tambah/Edit/Hapus Guru'),
('Master Data', 'master_data', 'kelas_manage', 'Kelola Data Kelas', 'Tambah/Edit/Hapus Kelas'),
('Master Data', 'master_data', 'mapel_manage', 'Kelola Mapel', 'Tambah/Edit/Hapus Mata Pelajaran'),
('Master Data', 'master_data', 'tahun_ajaran_manage', 'Kelola Tahun Ajaran', 'Mengatur tahun ajaran aktif'),

-- SYSTEM SETTINGS
('System', 'settings', 'users_manage', 'Kelola User', 'Akses menu pengaturan user'),
('System', 'settings', 'roles_manage', 'Kelola Role & Izin', 'Mengatur role dan permission akses'),
('System', 'settings', 'menu_access', 'Kelola Akses Menu', 'Mengatur visibilitas menu sidebar');

-- Optional: clean up duplicates if ran multiples times (handled by ON CONFLICT if constraints exist, otherwise manual check)
-- For this script, we assume fresh run or we rely on UNIQUE(resource, action) to fail/skip if exists. 
-- In PG, we can use ON CONFLICT DO UPDATE...
