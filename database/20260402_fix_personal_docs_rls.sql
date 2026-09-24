-- SQL Migration: Add RLS policies for shared personal documents and folders
-- Date: 2026-04-02

-- 1. Enable RLS on tables (if not already enabled)
ALTER TABLE public.personal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_document_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_folder_shares ENABLE ROW LEVEL SECURITY;

-- 2. Policies for personal_documents
-- Owner can do everything
DROP POLICY IF EXISTS "Users can manage their own documents" ON public.personal_documents;
CREATE POLICY "Users can manage their own documents" ON public.personal_documents
FOR ALL USING (auth.uid() = (SELECT auth_id FROM users WHERE id = user_id));

-- Shared users can SELECT
DROP POLICY IF EXISTS "Shared users can view documents" ON public.personal_documents;
CREATE POLICY "Shared users can view documents" ON public.personal_documents
FOR SELECT USING (
    id IN (
        SELECT document_id FROM personal_document_shares 
        WHERE shared_with_user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
    OR
    folder_id IN (
        SELECT folder_id FROM personal_folder_shares
        WHERE shared_with_user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
);

-- 3. Policies for personal_folders
-- Owner
DROP POLICY IF EXISTS "Users can manage their own folders" ON public.personal_folders;
CREATE POLICY "Users can manage their own folders" ON public.personal_folders
FOR ALL USING (auth.uid() = (SELECT auth_id FROM users WHERE id = user_id));

-- Shared users
DROP POLICY IF EXISTS "Shared users can view folders" ON public.personal_folders;
CREATE POLICY "Shared users can view folders" ON public.personal_folders
FOR SELECT USING (
    id IN (
        SELECT folder_id FROM personal_folder_shares
        WHERE shared_with_user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
);

-- 4. Policies for personal_document_shares (so owners can see who they shared with)
DROP POLICY IF EXISTS "Owners can view their own document shares" ON public.personal_document_shares;
CREATE POLICY "Owners can view their own document shares" ON public.personal_document_shares
FOR ALL USING (
    document_id IN (
        SELECT id FROM personal_documents 
        WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
    OR
    shared_with_user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- 5. Policies for personal_folder_shares
DROP POLICY IF EXISTS "Owners can view their own folder shares" ON public.personal_folder_shares;
CREATE POLICY "Owners can view their own folder shares" ON public.personal_folder_shares
FOR ALL USING (
    folder_id IN (
        SELECT id FROM personal_folders 
        WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
    OR
    shared_with_user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
);
