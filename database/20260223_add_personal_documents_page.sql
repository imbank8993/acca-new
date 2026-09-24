-- SQL Migration to add 'Dokumen Pribadi' feature
-- This should be run in Supabase SQL Editor

-- 1. Add to master_permissions_list (optional, if using the permission system for tabs)
-- INSERT INTO public.master_permissions_list (module, action, description)
-- VALUES ('personal-documents', 'view', 'Dapat melihat menu Dokumen Pribadi')
-- ON CONFLICT DO NOTHING;

-- 2. Update existing users to have the new page
-- Typically you'd update the role's default pages or specific users.
-- To add it to ALL users (as a safe default for testing):
UPDATE public.users 
SET pages = pages || ',Dokumen Pribadi=personal-documents'
WHERE pages NOT LIKE '%personal-documents%';

-- If you want to be more specific (e.g. only for ADMIN and GURU):
-- UPDATE public.users 
-- SET pages = pages || ',Dokumen Pribadi=personal-documents'
-- WHERE (role = 'ADMIN' OR role = 'GURU') 
-- AND pages NOT LIKE '%personal-documents%';
