-- Add piket_input as a distinct resource for role permissions dropdown
-- This allows admins to separately grant Piket Input access without full piket access

INSERT INTO master_permissions_list (category, resource, action, label, description)
VALUES
    ('Jurnal & Absensi', 'piket_input', 'view', 'Aksi: Lihat Piket Input', 'Melihat halaman input piket'),
    ('Jurnal & Absensi', 'piket_input', 'input', 'Aksi: Input Piket', 'Membuat dan menyimpan laporan piket')
ON CONFLICT (resource, action) DO UPDATE
SET
    category = EXCLUDED.category,
    label = EXCLUDED.label,
    description = EXCLUDED.description;
