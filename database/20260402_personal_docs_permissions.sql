-- SQL Migration: Add personal-documents permissions for GURU role
-- Date: 2026-04-02

-- 1. Add personal-documents to master_permissions_list
INSERT INTO public.master_permissions_list (resource, action, label, category, description)
VALUES
    ('personal-documents', 'view', 'Akses Dokumen Pribadi', 'PERSONAL_DOCS', 'Dapat melihat halaman Dokumen Pribadi'),
    ('personal-documents', 'manage', 'Kelola Dokumen Pribadi', 'PERSONAL_DOCS', 'Dapat mengunggah, mengedit, dan menghapus dokumen sendiri'),
    ('personal-documents', 'share', 'Bagikan Dokumen Pribadi', 'PERSONAL_DOCS', 'Dapat membagikan dokumen ke user lain')
ON CONFLICT (resource, action) DO UPDATE SET
    label = EXCLUDED.label,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

-- 2. Ensure GURU role exists in roles table
INSERT INTO public.roles (name, description)
VALUES ('GURU', 'Guru')
ON CONFLICT (name) DO NOTHING;

-- 3. Grant personal-documents permissions to GURU role
-- View permission: all authenticated users should be able to access their own docs
INSERT INTO public.role_permissions (role_name, resource, action, is_allowed)
VALUES ('GURU', 'personal-documents', 'view', true)
ON CONFLICT (role_name, resource, action) DO NOTHING;

-- Manage permission: GURU can create/edit/delete their own documents
INSERT INTO public.role_permissions (role_name, resource, action, is_allowed)
VALUES ('GURU', 'personal-documents', 'manage', true)
ON CONFLICT (role_name, resource, action) DO NOTHING;

-- Share permission: GURU can share their documents
INSERT INTO public.role_permissions (role_name, resource, action, is_allowed)
VALUES ('GURU', 'personal-documents', 'share', true)
ON CONFLICT (role_name, resource, action) DO NOTHING;

-- 4. Also grant to KAMAD role
INSERT INTO public.roles (name, description)
VALUES ('KAMAD', 'Kepala Madrasah')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.role_permissions (role_name, resource, action, is_allowed)
VALUES
    ('KAMAD', 'personal-documents', 'view', true),
    ('KAMAD', 'personal-documents', 'manage', true),
    ('KAMAD', 'personal-documents', 'share', true)
ON CONFLICT (role_name, resource, action) DO NOTHING;

-- 5. Also grant to WALI KELAS role
INSERT INTO public.roles (name, description)
VALUES ('WALI KELAS', 'Wali Kelas')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.role_permissions (role_name, resource, action, is_allowed)
VALUES
    ('WALI KELAS', 'personal-documents', 'view', true),
    ('WALI KELAS', 'personal-documents', 'manage', true),
    ('WALI KELAS', 'personal-documents', 'share', true)
ON CONFLICT (role_name, resource, action) DO NOTHING;
