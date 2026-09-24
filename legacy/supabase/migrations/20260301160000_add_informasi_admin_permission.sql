-- Add 'informasi' as separate admin resource (distinct from 'informasi_akademik')
-- informasi = admin page (upload/manage files)
-- informasi_akademik = public view page (read-only, show_on_landing only)

INSERT INTO master_permissions_list (category, resource, action, label, description)
VALUES
    ('Akademik', 'informasi', 'view', 'View (Utama)', 'Akses ke halaman informasi'),
    ('Akademik', 'informasi', 'manage', 'Full Access (manage)', 'Mengelola seluruh dokumen informasi akademik')
ON CONFLICT (resource, action) DO UPDATE
SET
    category = EXCLUDED.category,
    label = EXCLUDED.label,
    description = EXCLUDED.description;
