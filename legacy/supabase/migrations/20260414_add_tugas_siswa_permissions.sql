-- Migration: Add tugas_siswa permissions
-- Add permissions for tugas_siswa resource

-- Insert into master_permissions_list if not exists
INSERT INTO master_permissions_list (category, resource, action, label, description)
VALUES
    ('Tugas Siswa', 'tugas_siswa', 'view', 'View Tugas Siswa', 'Melihat daftar tugas siswa'),
    ('Tugas Siswa', 'tugas_siswa', 'create', 'Input Tugas Siswa', 'Menambah tugas siswa baru'),
    ('Tugas Siswa', 'tugas_siswa', 'edit', 'Edit Tugas Siswa', 'Mengedit tugas siswa'),
    ('Tugas Siswa', 'tugas_siswa', 'delete', 'Hapus Tugas Siswa', 'Menghapus tugas siswa')
ON CONFLICT (resource, action) DO NOTHING;

-- Add role_permissions for ADMIN
INSERT INTO role_permissions (role_name, resource, action, is_allowed)
VALUES
    ('ADMIN', 'tugas_siswa', 'view', true),
    ('ADMIN', 'tugas_siswa', 'create', true),
    ('ADMIN', 'tugas_siswa', 'edit', true),
    ('ADMIN', 'tugas_siswa', 'delete', true)
ON CONFLICT (role_name, resource, action) DO NOTHING;

-- Add role_permissions for SISWA
INSERT INTO role_permissions (role_name, resource, action, is_allowed)
VALUES
    ('SISWA', 'tugas_siswa', 'view', true),
    ('SISWA', 'tugas_siswa', 'create', true),
    ('SISWA', 'tugas_siswa', 'edit', true),
    ('SISWA', 'tugas_siswa', 'delete', true)
ON CONFLICT (role_name, resource, action) DO NOTHING;

-- Add role_permissions for GURU
INSERT INTO role_permissions (role_name, resource, action, is_allowed)
VALUES
    ('GURU', 'tugas_siswa', 'view', true),
    ('GURU', 'tugas_siswa', 'edit', true),
    ('GURU', 'tugas_siswa', 'delete', true)
ON CONFLICT (role_name, resource, action) DO NOTHING;