-- Migration: Auto Assign Default Permissions
-- Description: Automatically grants 'view' access to standard modules when a new Role is created.

-- 1. Create the function that will run on new role creation
CREATE OR REPLACE FUNCTION public.handle_new_role_permissions()
RETURNS TRIGGER AS $$
DECLARE
    resource_item TEXT;
    resources TEXT[] := ARRAY[
        'dashboard',
        'jurnal',
        'absensi',
        'nilai',
        'ketidakhadiran',
        'laporan_guru_asuh',
        'lckh',
        'lckh_approval',
        'piket',
        'informasi',
        'dokumen_siswa',
        'informasi_akademik',
        'tugas_tambahan',
        'master',
        'pengaturan_data',
        'pengaturan_tugas',
        'pengaturan_users',
        'reset_data',
        'campione'
    ];
BEGIN
    -- Loop through defined resources and insert 'view' permission
    FOREACH resource_item IN ARRAY resources
    LOOP
        INSERT INTO public.role_permissions (role_name, resource, action, is_allowed, created_at, updated_at)
        VALUES (
            NEW.name, 
            resource_item, 
            'view', 
            true, 
            NOW(), 
            NOW()
        )
        ON CONFLICT (role_name, resource, action) DO NOTHING;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS on_role_created ON public.roles;

CREATE TRIGGER on_role_created
AFTER INSERT ON public.roles
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_role_permissions();

-- 3. Comments
COMMENT ON FUNCTION public.handle_new_role_permissions IS 'Automatically assigns default view permissions when a new role is inserted';
