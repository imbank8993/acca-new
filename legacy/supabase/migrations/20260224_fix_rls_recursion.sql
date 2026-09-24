-- Fix for Infinite Recursion in Row Level Security (RLS)
-- Date: 2026-02-24

-- 1. Create a SECURITY DEFINER function to check document ownership
-- This bypasses RLS on personal_documents when called from a context where RLS would recurse.
CREATE OR REPLACE FUNCTION public.check_is_document_owner(doc_id UUID, req_user_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.personal_documents 
        WHERE id = doc_id AND user_id = req_user_id
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Drop the problematic RLS policy on personal_document_shares
DROP POLICY IF EXISTS "Users can manage shares for own documents" ON public.personal_document_shares;

-- 3. Re-create the policy using the SECURITY DEFINER function
CREATE POLICY "Users can manage shares for own documents" ON public.personal_document_shares
    FOR ALL USING (
        public.check_is_document_owner(document_id, public.get_current_user_id())
    )
    WITH CHECK (
        public.check_is_document_owner(document_id, public.get_current_user_id())
    );

-- 4. Create a SECURITY DEFINER function to check folder ownership
CREATE OR REPLACE FUNCTION public.check_is_folder_owner(f_id UUID, req_user_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.personal_folders 
        WHERE id = f_id AND user_id = req_user_id
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 5. Drop the problematic RLS policy on personal_folder_shares
DROP POLICY IF EXISTS "Users can manage shares for own folders" ON public.personal_folder_shares;

-- 6. Re-create the policy using the SECURITY DEFINER function
CREATE POLICY "Users can manage shares for own folders" ON public.personal_folder_shares
    FOR ALL USING (
        public.check_is_folder_owner(folder_id, public.get_current_user_id())
    )
    WITH CHECK (
        public.check_is_folder_owner(folder_id, public.get_current_user_id())
    );
