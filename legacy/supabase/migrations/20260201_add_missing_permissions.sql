-- Migration: Add missing granular permissions
-- Date: 2026-02-01

-- 1. Create role_permissions table if it doesn't exist (Denormalized structure based on usage in auth.ts)
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    is_allowed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role_name, resource, action)
);

-- 2. Grant Permissions for LCKH
-- GURU
INSERT INTO role_permissions (role_name, resource, action, is_allowed) VALUES
('GURU', 'lckh', 'view', true),
('GURU', 'lckh', 'create', true),
('GURU', 'lckh', 'edit', true),
('GURU', 'lckh', 'delete', true)
ON CONFLICT (role_name, resource, action) DO UPDATE SET is_allowed = true;

-- ADMIN (Approval)
INSERT INTO role_permissions (role_name, resource, action, is_allowed) VALUES
('ADMIN', 'lckh', 'view', true),
('ADMIN', 'lckh', 'approve', true)
ON CONFLICT (role_name, resource, action) DO UPDATE SET is_allowed = true;


-- 3. Grant Permissions for NILAI
-- GURU
INSERT INTO role_permissions (role_name, resource, action, is_allowed) VALUES
('GURU', 'nilai', 'view', true),
('GURU', 'nilai', 'manage', true),
('GURU', 'nilai', 'export', true)
ON CONFLICT (role_name, resource, action) DO UPDATE SET is_allowed = true;


-- 4. Grant Permissions for TUGAS TAMBAHAN
-- GURU (View Only)
INSERT INTO role_permissions (role_name, resource, action, is_allowed) VALUES
('GURU', 'tugas_tambahan', 'view', true)
ON CONFLICT (role_name, resource, action) DO UPDATE SET is_allowed = true;

-- ADMIN (Manage)
INSERT INTO role_permissions (role_name, resource, action, is_allowed) VALUES
('ADMIN', 'tugas_tambahan', 'view', true),
('ADMIN', 'tugas_tambahan', 'manage', true)
ON CONFLICT (role_name, resource, action) DO UPDATE SET is_allowed = true;


-- 5. Optional: Create Catalog Table for reference (but not valid for auth.ts logic yet)
CREATE TABLE IF NOT EXISTS master_permissions_list (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    label VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(resource, action)
);
