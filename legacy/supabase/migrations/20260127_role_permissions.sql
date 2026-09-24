-- Migration: Role Permissions System
-- This migration creates the tables needed for dynamic role-based access control (RBAC).

-- 1. Create a table to define custom roles if they don't exist in the system yet
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL, -- e.g., 'ADMIN_3', 'GURU_PICKET'
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create index on role name
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);

-- 3. Create a table for role permissions
-- This table maps roles to specific resources and actions
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_name TEXT NOT NULL, -- references roles.name or existing roles like 'ADMIN'
    resource TEXT NOT NULL,  -- e.g., 'guru', 'siswa', 'jurnal'
    action TEXT NOT NULL,    -- e.g., 'create', 'read', 'update', 'delete', or field-specific like 'edit_nip'
    is_allowed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role_name, resource, action)
);

-- 4. Create indexes for role permissions
CREATE INDEX IF NOT EXISTS idx_role_perms_role_name ON role_permissions(role_name);
CREATE INDEX IF NOT EXISTS idx_role_perms_resource ON role_permissions(resource);

-- 5. Seed initial data
INSERT INTO roles (name, description) VALUES 
('ADMIN', 'Administrator Utama dengan akses penuh'),
('GURU', 'Tenaga Pendidik'),
('OP_ABSENSI', 'Operator Absensi'),
('KAMAD', 'Kepala Madrasah'),
('SISWA', 'Peserta Didik')
ON CONFLICT (name) DO NOTHING;

-- Initial permissions for ADMIN (all access)
INSERT INTO role_permissions (role_name, resource, action) VALUES 
('ADMIN', '*', '*')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE roles IS 'Table defining user roles';
COMMENT ON TABLE role_permissions IS 'Table mapping roles to specific permissions on resources and actions';
