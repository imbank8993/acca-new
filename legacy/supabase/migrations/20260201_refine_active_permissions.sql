-- Refine Master Permissions List
-- Date: 2026-02-01
-- Description: Catalog of all active system functions for clean Role Permission assignment.

-- Ensure table exists first
CREATE TABLE IF NOT EXISTS master_permissions_list (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    label VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(resource, action)
);

-- Ensure role_permissions table exists as well
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    is_allowed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role_name, resource, action)
);

-- Clear existing catalog to prevent stale entries
DELETE FROM master_permissions_list;

INSERT INTO master_permissions_list (category, resource, action, label, description) VALUES
-- Jurnal Guru
('Jurnal', 'jurnal', 'view', 'View Jurnal', 'Melihat halaman jurnal'),
('Jurnal', 'jurnal', 'create', 'Input Jurnal', 'Menambah jurnal mengajar baru'),
('Jurnal', 'jurnal', 'edit:own', 'Edit Jurnal (Sendiri)', 'Mengedit jurnal milik sendiri'),
('Jurnal', 'jurnal', 'edit:any', 'Edit Jurnal (Semua)', 'Mengedit jurnal orang lain (Admin/Piket)'),
('Jurnal', 'jurnal', 'delete:any', 'Hapus Jurnal', 'Menghapus data jurnal'),
('Jurnal', 'jurnal', 'export:personal', 'Export (Personal)', 'Export data jurnal milik sendiri'),
('Jurnal', 'jurnal', 'export:class', 'Export (Wali Kelas)', 'Export jurnal berdasarkan kelas binaan'),
('Jurnal', 'jurnal', 'export:admin', 'Export (Global)', 'Export semua data jurnal'),

-- Absensi
('Absensi', 'absensi', 'view', 'View Absensi', 'Melihat halaman absensi'),
('Absensi', 'absensi', 'take', 'Input Presensi', 'Melakukan/Menyimpan absensi siswa'),
('Absensi', 'absensi', 'delete', 'Hapus Presensi', 'Menghapus sesi absensi'),
('Absensi', 'absensi', 'export:class', 'Export Rekap (Kelas)', 'Export rekap absensi kelas'),
('Absensi', 'absensi', 'export:admin', 'Export Rekap (Admin)', 'Export rekap absensi global'),

-- Nilai
('Nilai', 'nilai', 'view', 'View Nilai', 'Melihat halaman penilaian'),
('Nilai', 'nilai', 'manage', 'Input/Edit Nilai', 'Mengelola nilai siswa'),
('Nilai', 'nilai', 'config', 'Konfigurasi Bobot', 'Mengatur bobot nilai (Kuis/Tugas/UH)'),
('Nilai', 'nilai', 'export', 'Export & Leger', 'Download Leger dan rekap nilai'),

-- LCKH (Laporan Capaian Kinerja Harian)
('LCKH', 'lckh', 'view', 'View LCKH', 'Melihat LCKH'),
('LCKH', 'lckh', 'create', 'Isi LCKH', 'Mengisi/Submit LCKH harian'),
('LCKH', 'lckh', 'edit', 'Edit LCKH', 'Mengedit LCKH (Draft)'),
('LCKH', 'lckh', 'approve', 'Approval LCKH', 'Menyetujui/Menolak LCKH (Waka/Kamad)'),
('LCKH', 'lckh', 'export', 'Export LCKH', 'Export rekap LCKH'),

-- Tugas Tambahan
('Tugas Tambahan', 'tugas_tambahan', 'view', 'View Tugas', 'Melihat tugas tambahan'),
('Tugas Tambahan', 'tugas_tambahan', 'manage', 'Kelola Penugasan', 'Admin: Mengatur plotting tugas tambahan'),

-- Ketidakhadiran (Cuti/Izin Guru)
('Ketidakhadiran', 'ketidakhadiran', 'view', 'View Data', 'Melihat data ketidakhadiran'),
('Ketidakhadiran', 'ketidakhadiran', 'create', 'Ajukan Izin', 'Mengajukan izin/cuti'),
('Ketidakhadiran', 'ketidakhadiran', 'approve', 'Approval Izin', 'Menyetujui izin (Piket/Admin)'),
('Ketidakhadiran', 'ketidakhadiran', 'delete', 'Hapus Data', 'Menghapus data izin'),

-- Pengaturan Data (Settings)
('Pengaturan Data', 'pengaturan_data:siswa_kelas', 'view', 'Data Siswa: View', 'Melihat data siswa & kelas'),
('Pengaturan Data', 'pengaturan_data:siswa_kelas', 'manage', 'Data Siswa: Manage', 'Tambah/Edit/Hapus Siswa & Kelas'),
('Pengaturan Data', 'pengaturan_data:wali_kelas', 'view', 'Wali Kelas: View', 'Melihat plotting wali kelas'),
('Pengaturan Data', 'pengaturan_data:wali_kelas', 'manage', 'Wali Kelas: Manage', 'Mengatur wali kelas'),
('Pengaturan Data', 'pengaturan_data:guru_asuh', 'view', 'Guru Asuh: View', 'Melihat plotting guru asuh'),
('Pengaturan Data', 'pengaturan_data:guru_asuh', 'manage', 'Guru Asuh: Manage', 'Mengatur guru asuh'),
('Pengaturan Data', 'pengaturan_data:libur', 'view', 'Data Libur: View', 'Melihat kalender libur'),
('Pengaturan Data', 'pengaturan_data:libur', 'manage', 'Data Libur: Manage', 'Mengatur hari libur'),
('Pengaturan Data', 'pengaturan_data:dropdown', 'view', 'Master: View', 'Melihat master data dropdown'),
('Pengaturan Data', 'pengaturan_data:dropdown', 'manage', 'Master: Manage', 'Mengatur master data dropdown'),
('Pengaturan Data', 'pengaturan_data:generate_jurnal', 'view', 'Generate Jurnal: View', 'Melihat fitur generate jurnal'),
('Pengaturan Data', 'pengaturan_data:generate_jurnal', 'manage', 'Generate Jurnal: Manage', 'Menggunakan fitur generate jurnal massal'),
('Pengaturan Data', 'pengaturan_data:guru_mapel', 'read', 'Guru Mapel: Read', 'Melihat data guru mapel'),
('Pengaturan Data', 'pengaturan_data:guru_mapel', 'manage', 'Guru Mapel: Manage', 'Mengelola data guru mapel'),
('Pengaturan Data', 'pengaturan_data:jadwal_guru', 'read', 'Jadwal Guru: Read', 'Melihat jadwal guru'),
('Pengaturan Data', 'pengaturan_data:jadwal_guru', 'manage', 'Jadwal Guru: Manage', 'Mengelola jadwal guru'),
('Pengaturan Data', 'pengaturan_data:tugas_tambahan', 'read', 'Tugas Tambahan: Read', 'Melihat konfigurasi tugas tambahan'),
('Pengaturan Data', 'pengaturan_data:tugas_tambahan', 'manage', 'Tugas Tambahan: Manage', 'Mengelola konfigurasi tugas tambahan'),

-- Pengaturan Sistem
('Pengaturan Users', 'pengaturan_users', 'manage', 'Manage Users & Roles', 'Mengelola user, role, dan izin akses');

-- Ensure admins have ALL these permissions by default
INSERT INTO role_permissions (role_name, resource, action, is_allowed)
SELECT 'ADMIN', resource, action, true FROM master_permissions_list
ON CONFLICT (role_name, resource, action) DO UPDATE SET is_allowed = true;

-- Grant standard VIEW to GURU for common pages (Default Policy: Visible but guarded)
INSERT INTO role_permissions (role_name, resource, action, is_allowed) VALUES
('GURU', 'jurnal', 'view', true),
('GURU', 'absensi', 'view', true),
('GURU', 'nilai', 'view', true),
('GURU', 'lckh', 'view', true),
('GURU', 'ketidakhadiran', 'view', true),
('GURU', 'tugas_tambahan', 'view', true),
('GURU', 'pengaturan_data:libur', 'view', true),
('GURU', 'pengaturan_data:siswa_kelas', 'view', true)
ON CONFLICT (role_name, resource, action) DO NOTHING;

-- Grant functional permissions to GURU (Base Teacher Role)
INSERT INTO role_permissions (role_name, resource, action, is_allowed) VALUES
('GURU', 'jurnal', 'create', true),
('GURU', 'jurnal', 'edit:own', true),
('GURU', 'jurnal', 'export:personal', true),
('GURU', 'absensi', 'take', true),
('GURU', 'absensi', 'export:class', true), -- Usually for Wali Kelas, but harmless to allow view
('GURU', 'nilai', 'manage', true),
('GURU', 'nilai', 'export', true),
('GURU', 'lckh', 'create', true),
('GURU', 'lckh', 'edit', true),
('GURU', 'ketidakhadiran', 'create', true)
ON CONFLICT (role_name, resource, action) DO NOTHING;
