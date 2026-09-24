-- Refine Permission Catalog for Strict Granular Control
-- We will use a dot notation or colon notation for resources to support the "Mandiri" aspect of tabs

TRUNCATE TABLE master_permissions_list RESTART IDENTITY;

INSERT INTO master_permissions_list (category, resource, action, label, description) VALUES

-- 1. MASTER DATA (Granular per Tab)
('Master Data', 'master.siswa', 'view', 'Siswa: Lihat Data', 'Hanya melihat daftar siswa'),
('Master Data', 'master.siswa', 'manage', 'Siswa: Kelola (Tambah/Edit/Hapus)', 'Full akses manajemen siswa'),
('Master Data', 'master.siswa', 'export', 'Siswa: Export Data', 'Download data siswa'),

('Master Data', 'master.guru', 'view', 'Guru: Lihat Data', 'Hanya melihat daftar guru'),
('Master Data', 'master.guru', 'manage', 'Guru: Kelola (Tambah/Edit/Hapus)', 'Full akses manajemen guru'),
('Master Data', 'master.guru', 'export', 'Guru: Export Data', 'Download data guru'),

('Master Data', 'master.kelas', 'view', 'Kelas: Lihat Data', 'Hanya melihat daftar kelas'),
('Master Data', 'master.kelas', 'manage', 'Kelas: Kelola (Tambah/Edit/Hapus)', 'Full akses manajemen kelas'),
('Master Data', 'master.kelas', 'export', 'Kelas: Export Data', 'Download data kelas'),

('Master Data', 'master.mapel', 'view', 'Mapel: Lihat Data', 'Hanya melihat daftar mapel'),
('Master Data', 'master.mapel', 'manage', 'Mapel: Kelola (Tambah/Edit/Hapus)', 'Full akses manajemen mapel'),
('Master Data', 'master.mapel', 'export', 'Mapel: Export Data', 'Download data mapel'),

-- 2. PENGATURAN DATA (Granular per Tab)
('Pengaturan Data', 'settings.wali_kelas', 'view', 'Wali Kelas: Lihat', 'Melihat plotting wali kelas'),
('Pengaturan Data', 'settings.wali_kelas', 'manage', 'Wali Kelas: Kelola', 'Plotting wali kelas'),
('Pengaturan Data', 'settings.wali_kelas', 'export', 'Wali Kelas: Export', 'Export data wali kelas'),

('Pengaturan Data', 'settings.jadwal_guru', 'view', 'Jadwal: Lihat', 'Melihat jadwal pelajaran'),
('Pengaturan Data', 'settings.jadwal_guru', 'manage', 'Jadwal: Kelola', 'Upload/Edit jadwal pelajaran'),
('Pengaturan Data', 'settings.jadwal_guru', 'export', 'Jadwal: Export', 'Export jadwal pelajaran'),

('Pengaturan Data', 'settings.tahun_ajaran', 'view', 'Tahun Ajaran: Lihat', 'Melihat tahun ajaran'),
('Pengaturan Data', 'settings.tahun_ajaran', 'manage', 'Tahun Ajaran: Kelola', 'Mengatur tahun ajaran aktif'),

('Pengaturan Data', 'settings.hari_libur', 'view', 'Hari Libur: Lihat', 'Melihat kalender libur'),
('Pengaturan Data', 'settings.hari_libur', 'manage', 'Hari Libur: Kelola', 'Menambah/Edit hari libur'),

-- 3. PENGATURAN TUGAS (Refactored Module)
('Pengaturan Tugas', 'tugas.guru_mapel', 'view', 'Guru Mapel: Lihat', 'Melihat plotting guru mapel'),
('Pengaturan Tugas', 'tugas.guru_mapel', 'manage', 'Guru Mapel: Kelola', 'Plotting guru mapel'),
('Pengaturan Tugas', 'tugas.guru_mapel', 'export', 'Guru Mapel: Export', 'Export data guru mapel'),

('Pengaturan Tugas', 'tugas.tugas_tambahan', 'view', 'Tugas Tambahan: Lihat', 'Melihat daftar tugas tambahan'),
('Pengaturan Tugas', 'tugas.tugas_tambahan', 'manage', 'Tugas Tambahan: Kelola', 'Menambah tugas tambahan'),

('Pengaturan Tugas', 'tugas.jadwal_sholat', 'view', 'Jadwal Sholat: Lihat', 'Melihat jadwal piket sholat'),
('Pengaturan Tugas', 'tugas.jadwal_sholat', 'manage', 'Jadwal Sholat: Kelola', 'Mengatur jadwal piket sholat'),

-- 4. PENGATURAN USERS (Admin Only)
('System', 'admin.users', 'manage', 'Kelola User & Role', 'Akses penuh menu pengaturan users'),

-- 5. RESET DATA
('System', 'admin.reset', 'manage', 'Reset Data Sistem', 'Akses fitur bahaya reset data'),

-- 6. EXISTING MODULES (Jurnal, Absensi, Nilai, LCKH) - Preserved as requested
('Jurnal', 'jurnal', 'view', 'Lihat Data Jurnal', 'Akses umum jurnal'),
('Jurnal', 'jurnal', 'create', 'Tambah Jurnal', 'Membuat entri jurnal'),
('Jurnal', 'jurnal', 'edit_own', 'Edit Punya Sendiri', 'Edit jurnal milik sendiri'),
('Jurnal', 'jurnal', 'manage_all', 'Kelola Semua (Admin)', 'Edit/Hapus semua jurnal'),
('Jurnal', 'jurnal', 'export_personal', 'Export Mode Guru', 'Laporan pribadi'),
('Jurnal', 'jurnal', 'export_class', 'Export Mode Wali', 'Laporan kelas'),
('Jurnal', 'jurnal', 'export_admin', 'Export Mode Admin', 'Laporan global'),

('Absensi', 'absensi.guru', 'view', 'Absensi Guru: Lihat', 'Melihat absensi guru'),
('Absensi', 'absensi.guru', 'manage', 'Absensi Guru: Kelola', 'Melakukan absensi guru'),
('Absensi', 'absensi.guru', 'export', 'Absensi Guru: Export', 'Export data absensi'),

-- 5. KETIDAKHADIRAN (Granular)
('Ketidakhadiran', 'ketidakhadiran.izin', 'view', 'Izin: Lihat Data', 'Lihat data izin siswa'),
('Ketidakhadiran', 'ketidakhadiran.izin', 'manage', 'Izin: Kelola (Tambah/Edit/Hapus)', 'Kelola data izin'),
('Ketidakhadiran', 'ketidakhadiran.izin', 'export', 'Izin: Export Data', 'Export data izin'),

('Ketidakhadiran', 'ketidakhadiran.sakit', 'view', 'Sakit: Lihat Data', 'Lihat data sakit siswa'),
('Ketidakhadiran', 'ketidakhadiran.sakit', 'manage', 'Sakit: Kelola (Tambah/Edit/Hapus)', 'Kelola data sakit'),
('Ketidakhadiran', 'ketidakhadiran.sakit', 'export', 'Sakit: Export Data', 'Export data sakit'),

-- 6. OTHERS / SYSTEM
('Absensi', 'absensi', 'view', 'Lihat Absensi', 'Akses data absensi'),
('Absensi', 'absensi', 'take', 'Ambil Absensi', 'Melakukan presensi harian'),
('Absensi', 'absensi', 'manage', 'Koreksi Absensi', 'Mengubah data absen yg sudah masuk'),
('Absensi', 'absensi', 'export_personal', 'Export Mode Guru', 'Laporan pribadi'),
('Absensi', 'absensi', 'export_class', 'Export Mode Wali', 'Laporan kelas'),
('Absensi', 'absensi', 'export_admin', 'Export Mode Admin', 'Laporan global'),

('Nilai', 'nilai', 'view', 'Lihat Nilai', 'Melihat buku nilai'),
('Nilai', 'nilai', 'manage', 'Input Nilai', 'Mengisi nilai siswa'),
('Nilai', 'nilai', 'config', 'Konfigurasi Bobot', 'Mengatur bobot penilaian'),
('Nilai', 'nilai', 'export', 'Export Leger/Rapor', 'Download nilai'),

('LCKH', 'lckh', 'view', 'Lihat LCKH', 'Melihat LCKH'),
('LCKH', 'lckh', 'create', 'Input LCKH', 'Mengisi LCKH bulanan'),
('LCKH', 'lckh', 'approve', 'Approval LCKH', 'Menyetujui LCKH (Waka/Kamad)');
