-- Add 'informasi_akademik' as public read-only resource
-- informasi_akademik = public view page (read-only, show_on_landing only)

INSERT INTO master_permissions_list (category, resource, action, label, description)
VALUES
    ('Akademik', 'informasi_akademik', 'view', 'View (Utama)', 'Melihat daftar dokumen informasi akademik')
ON CONFLICT (resource, action) DO UPDATE
SET
    category = EXCLUDED.category,
    label = EXCLUDED.label,
    description = EXCLUDED.description;
