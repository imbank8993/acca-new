-- Add OP_JURNAL to roles table first (if not exists)
INSERT INTO roles (name, description) VALUES
('OP_JURNAL', 'Operator Jurnal — Admin Jurnal Guru')
ON CONFLICT (name) DO NOTHING;

-- Add OP_JURNAL role permissions for jurnal admin (add/edit/delete libur, edit jurnal others)
-- Date: 2026-04-08
-- Description: Seed role_permissions for OP_JURNAL role.

-- OP_JURNAL: Admin Jurnal
INSERT INTO role_permissions (role_name, resource, action, is_allowed) VALUES
-- Jurnal full access (view, create, edit any, delete any, export admin)
('OP_JURNAL', 'jurnal', 'view', true),
('OP_JURNAL', 'jurnal', 'create', true),
('OP_JURNAL', 'jurnal', 'edit:own', true),
('OP_JURNAL', 'jurnal', 'edit:any', true),
('OP_JURNAL', 'jurnal', 'delete:any', true),
('OP_JURNAL', 'jurnal', 'export:personal', true),
('OP_JURNAL', 'jurnal', 'export:class', true),
('OP_JURNAL', 'jurnal', 'export:admin', true),

-- Pengaturan Data: Libur (manage)
('OP_JURNAL', 'pengaturan_data:libur', 'view', true),
('OP_JURNAL', 'pengaturan_data:libur', 'manage', true),

-- Pengaturan Data: Generate Jurnal (view + manage)
('OP_JURNAL', 'pengaturan_data:generate_jurnal', 'view', true),
('OP_JURNAL', 'pengaturan_data:generate_jurnal', 'manage', true),

-- View only for other settings
('OP_JURNAL', 'pengaturan_data:siswa_kelas', 'view', true),
('OP_JURNAL', 'pengaturan_data:wali_kelas', 'view', true),
('OP_JURNAL', 'pengaturan_data:guru_asuh', 'view', true),
('OP_JURNAL', 'pengaturan_data:dropdown', 'view', true),
('OP_JURNAL', 'pengaturan_data:guru_mapel', 'read', true),
('OP_JURNAL', 'pengaturan_data:jadwal_guru', 'read', true)
ON CONFLICT (role_name, resource, action) DO NOTHING;
