-- Migration: Implement Folder Sharing
-- Date: 2026-02-24

-- 1. Create personal_folder_shares table
CREATE TABLE IF NOT EXISTS public.personal_folder_shares (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    folder_id UUID NOT NULL REFERENCES public.personal_folders(id) ON DELETE CASCADE,
    shared_with_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    shared_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(folder_id, shared_with_user_id)
);

-- Enable RLS
ALTER TABLE public.personal_folder_shares ENABLE ROW LEVEL SECURITY;

-- 2. Policies for personal_folder_shares
CREATE POLICY "Users can manage shares for own folders" ON public.personal_folder_shares
    FOR ALL USING (
        folder_id IN (
            SELECT id FROM public.personal_folders 
            WHERE user_id = public.get_current_user_id()
        )
    )
    WITH CHECK (
        folder_id IN (
            SELECT id FROM public.personal_folders 
            WHERE user_id = public.get_current_user_id()
        )
    );

CREATE POLICY "Users can view folder shares they are part of" ON public.personal_folder_shares
    FOR SELECT USING (
        shared_with_user_id = public.get_current_user_id()
    );

-- 3. Update personal_folders policies to allow viewing shared folders
CREATE POLICY "Users can view folders shared with them" ON public.personal_folders
    FOR SELECT USING (
        id IN (
            SELECT folder_id FROM public.personal_folder_shares 
            WHERE shared_with_user_id = public.get_current_user_id()
        )
    );

-- 4. Update personal_documents policies to allow viewing docs in shared folders
CREATE POLICY "Users can view documents in shared folders" ON public.personal_documents
    FOR SELECT USING (
        folder_id IN (
            SELECT folder_id FROM public.personal_folder_shares 
            WHERE shared_with_user_id = public.get_current_user_id()
        )
    );

-- 5. Indices
CREATE INDEX IF NOT EXISTS idx_personal_folder_shares_user ON public.personal_folder_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_personal_folder_shares_folder ON public.personal_folder_shares(folder_id);
