-- Migration: Add granular permissions for Data Settings tabs
-- Date: 2026-02-01

-- Support for DataSettingsPage tabs: siswa_kelas, wali_kelas, guru_asuh, dropdown, libur

-- ADMIN: Grant full view/manage access to all settings
INSERT INTO role_permissions (role_name, resource, action, is_allowed) VALUES
-- Siswa Kelas
('ADMIN', 'pengaturan_data:siswa_kelas', 'view', true),
('ADMIN', 'pengaturan_data:siswa_kelas', 'manage', true),

-- Wali Kelas
('ADMIN', 'pengaturan_data:wali_kelas', 'view', true),
('ADMIN', 'pengaturan_data:wali_kelas', 'manage', true),

-- Guru Asuh
('ADMIN', 'pengaturan_data:guru_asuh', 'view', true),
('ADMIN', 'pengaturan_data:guru_asuh', 'manage', true),

-- Dropdown (Master Data)
('ADMIN', 'pengaturan_data:dropdown', 'view', true),
('ADMIN', 'pengaturan_data:dropdown', 'manage', true),

-- Data Libur
('ADMIN', 'pengaturan_data:libur', 'view', true),
('ADMIN', 'pengaturan_data:libur', 'manage', true)
ON CONFLICT (role_name, resource, action) DO UPDATE SET is_allowed = true;

-- Optional: Grant basic VIEW access to GURU/WALI_KELAS if needed
-- e.g. Teachers can view Holiday Data
INSERT INTO role_permissions (role_name, resource, action, is_allowed) VALUES
('GURU', 'pengaturan_data:libur', 'view', true)
ON CONFLICT (role_name, resource, action) DO UPDATE SET is_allowed = true;
