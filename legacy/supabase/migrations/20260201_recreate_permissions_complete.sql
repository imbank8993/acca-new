-- COMPLETE PERMISSIONS RESET & SEED SCRIPT
-- Date: 2026-02-01
-- Description: Re-creates the role_permissions table and populates it with a comprehensive set of default permissions for ADMIN and GURU.

-- 1. Reset Table
DROP TABLE IF EXISTS role_permissions;

CREATE TABLE role_permissions (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL, -- 'ADMIN', 'GURU', 'WALI_KELAS', etc.
    resource VARCHAR(100) NOT NULL, -- e.g. 'jurnal', 'absensi', 'nilai'
    action VARCHAR(100) NOT NULL,   -- e.g. 'view', 'create', 'manage'
    is_allowed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role_name, resource, action)
);

-- ==========================================
-- 2. POPULATE PERMISSIONS FOR 'ADMIN'
-- ==========================================
-- Admin gets access to practically everything.

INSERT INTO role_permissions (role_name, resource, action, is_allowed) VALUES
-- JURNAL
('ADMIN', 'jurnal', 'view', true),
('ADMIN', 'jurnal', 'create', true),
('ADMIN', 'jurnal', 'edit_any', true),
('ADMIN', 'jurnal', 'delete_any', true),
('ADMIN', 'jurnal', 'export_admin', true),

-- ABSENSI
('ADMIN', 'absensi', 'view', true),
('ADMIN', 'absensi', 'take', true),
('ADMIN', 'absensi', 'update', true),
('ADMIN', 'absensi', 'delete', true),
('ADMIN', 'absensi', 'export_admin', true),

-- NILAI
('ADMIN', 'nilai', 'view', true),
('ADMIN', 'nilai', 'manage', true),
('ADMIN', 'nilai', 'config', true),
('ADMIN', 'nilai', 'export', true),

-- LCKH (Laporan Kinerja)
('ADMIN', 'lckh', 'view', true),
('ADMIN', 'lckh', 'approve', true), -- Admin can approve
('ADMIN', 'lckh', 'manage', true),

-- TUGAS TAMBAHAN
('ADMIN', 'tugas_tambahan', 'view', true),
('ADMIN', 'tugas_tambahan', 'manage', true), -- Plotting/Assignment

-- KETIDAKHADIRAN
('ADMIN', 'ketidakhadiran', 'view', true),
('ADMIN', 'ketidakhadiran', 'create', true),
('ADMIN', 'ketidakhadiran', 'approve', true),
('ADMIN', 'ketidakhadiran', 'delete', true),

-- MASTER DATA (Full Control)
('ADMIN', 'master_data', 'view', true),
('ADMIN', 'master_data', 'manage', true),

-- SYSTEM SETTINGS
('ADMIN', 'settings', 'view', true),
('ADMIN', 'settings', 'manage', true),
('ADMIN', 'settings', 'users_manage', true);


-- ==========================================
-- 3. POPULATE PERMISSIONS FOR 'GURU'
-- ==========================================
-- Teachers have restricted access focused on their duties.

INSERT INTO role_permissions (role_name, resource, action, is_allowed) VALUES
-- JURNAL
('GURU', 'jurnal', 'view', true),         -- Can see journals
('GURU', 'jurnal', 'create', true),       -- Can create journals
('GURU', 'jurnal', 'edit_own', true),     -- Can edit OWN journals
('GURU', 'jurnal', 'export_personal', true), -- Export own data

-- ABSENSI
('GURU', 'absensi', 'view', true),        -- Can see basic attendance info
('GURU', 'absensi', 'take', true),        -- Can take attendance for their class/session
('GURU', 'absensi', 'export_personal', true),

-- NILAI
('GURU', 'nilai', 'view', true),
('GURU', 'nilai', 'manage', true),       -- Input grades for their subjects
('GURU', 'nilai', 'export', true),       -- Download ledger for their subjects

-- LCKH
('GURU', 'lckh', 'view', true),          -- View own LCKH page
('GURU', 'lckh', 'create', true),        -- Create daily report
('GURU', 'lckh', 'edit', true),          -- Edit own report
('GURU', 'lckh', 'delete', true),        -- Delete own draft

-- TUGAS TAMBAHAN
('GURU', 'tugas_tambahan', 'view', true); -- View their assigned duties


-- ==========================================
-- 4. OPTIONAL: POPULATE 'WALI_KELAS'
-- ==========================================
-- Homeroom teachers need slightly more access than standard teachers regarding their class.

INSERT INTO role_permissions (role_name, resource, action, is_allowed) VALUES
('WALI_KELAS', 'jurnal', 'export_class', true),   -- Export journal for their class
('WALI_KELAS', 'absensi', 'export_class', true),  -- Export attendance for their class
('WALI_KELAS', 'nilai', 'view_class', true),      -- View grades for their class
('WALI_KELAS', 'ketidakhadiran', 'view', true);   -- View sick/leave notes for their class

