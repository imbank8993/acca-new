-- Migration: Create Personal Documents Feature Tables
-- Date: 2026-02-24

-- 1. Create personal_folders table
CREATE TABLE IF NOT EXISTS public.personal_folders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    nama TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, nama)
);

-- 2. Create personal_documents table
CREATE TABLE IF NOT EXISTS public.personal_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES public.personal_folders(id) ON DELETE SET NULL,
    judul TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_path TEXT NOT NULL,
    size BIGINT, -- Size in bytes
    extension TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create personal_document_shares table
CREATE TABLE IF NOT EXISTS public.personal_document_shares (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES public.personal_documents(id) ON DELETE CASCADE,
    shared_with_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    shared_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, shared_with_user_id)
);

-- Enable RLS
ALTER TABLE public.personal_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_document_shares ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user_id from auth.uid()
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS INTEGER AS $$
    SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Policies for personal_folders
CREATE POLICY "Users can manage own folders" ON public.personal_folders
    FOR ALL USING (user_id = public.get_current_user_id())
    WITH CHECK (user_id = public.get_current_user_id());

-- Policies for personal_documents
CREATE POLICY "Users can manage own documents" ON public.personal_documents
    FOR ALL USING (user_id = public.get_current_user_id())
    WITH CHECK (user_id = public.get_current_user_id());

CREATE POLICY "Users can view shared documents" ON public.personal_documents
    FOR SELECT USING (
        id IN (
            SELECT document_id FROM public.personal_document_shares 
            WHERE shared_with_user_id = public.get_current_user_id()
        )
    );

-- Policies for personal_document_shares
CREATE POLICY "Users can manage shares for own documents" ON public.personal_document_shares
    FOR ALL USING (
        document_id IN (
            SELECT id FROM public.personal_documents 
            WHERE user_id = public.get_current_user_id()
        )
    )
    WITH CHECK (
        document_id IN (
            SELECT id FROM public.personal_documents 
            WHERE user_id = public.get_current_user_id()
        )
    );

CREATE POLICY "Users can view shares they are part of" ON public.personal_document_shares
    FOR SELECT USING (
        shared_with_user_id = public.get_current_user_id()
    );

-- Indices
CREATE INDEX IF NOT EXISTS idx_personal_folders_user ON public.personal_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_documents_user ON public.personal_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_documents_folder ON public.personal_documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_personal_document_shares_user ON public.personal_document_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_personal_document_shares_doc ON public.personal_document_shares(document_id);
