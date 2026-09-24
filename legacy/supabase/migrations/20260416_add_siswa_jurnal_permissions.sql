-- Add PENGURUS_KELAS role
INSERT INTO roles (name, description) VALUES
('PENGURUS_KELAS', 'Pengurus Kelas (Ketua/Wakil Ketua Kelas)')
ON CONFLICT (name) DO NOTHING;

-- Grant PENGURUS_KELAS permission to tugas_siswa
-- Date: 2026-04-16
-- Description: Allow class officers (Pengurus Kelas) to view and create tugas_siswa.

INSERT INTO role_permissions (role_name, resource, action, is_allowed) VALUES
-- PENGURUS_KELAS: Tugas Siswa
('PENGURUS_KELAS', 'tugas_siswa', 'view', true),
('PENGURUS_KELAS', 'tugas_siswa', 'create', true),
('PENGURUS_KELAS', 'tugas_siswa', 'edit:own', true),
('PENGURUS_KELAS', 'tugas_siswa', 'delete:own', true)
ON CONFLICT (role_name, resource, action) DO NOTHING;