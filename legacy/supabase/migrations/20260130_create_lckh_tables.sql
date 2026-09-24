-- Migration: Create LCKH Tables and Enums
-- Created: 2026-01-30

-- 1. Create Enum for Status
DO $$ BEGIN
    CREATE TYPE lckh_status AS ENUM ('Draft', 'Submitted', 'Approved_Waka', 'Approved_Kamad', 'Revisi', 'Rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create LCKH Submissions Table
CREATE TABLE IF NOT EXISTS public.lckh_submissions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    nama_guru text NOT NULL,
    nip text,
    
    bulan int NOT NULL,
    tahun int NOT NULL,
    
    -- Summary Data (Cached at generation time)
    total_jam_mengajar numeric DEFAULT 0,
    total_jurnal_isi int DEFAULT 0,
    total_alpa int DEFAULT 0,
    total_sakit int DEFAULT 0,
    total_izin int DEFAULT 0,
    total_ketidakhadiran int DEFAULT 0,
    
    -- Nilai (Grades) Integration
    total_nilai_input int DEFAULT 0,
    
    -- Status Workflow
    status lckh_status DEFAULT 'Draft',
    
    -- Notes
    catatan_guru text,
    catatan_reviewer text,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    submitted_at timestamptz,
    approved_at timestamptz
);

-- 3. Enable RLS
ALTER TABLE public.lckh_submissions ENABLE ROW LEVEL SECURITY;

-- 4. Policies
-- Grants
GRANT ALL ON TABLE public.lckh_submissions TO postgres, authenticated, anon, service_role;

-- Users can see their own submissions
CREATE POLICY "Users can view own LCKH" ON public.lckh_submissions
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert/update their own submissions
CREATE POLICY "Users can insert own LCKH" ON public.lckh_submissions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own LCKH" ON public.lckh_submissions
    FOR UPDATE USING (auth.uid() = user_id);

-- Admins/Waka/Kamad can view all (Simulated via role check or open for now if simplistic)
-- For a robust system, we should check user_roles table or metadata. 
-- For now, allowing all authenticated to READ is safer for debugging, but restricting WRITE.
CREATE POLICY "Admins/Waka/Kamad can view all LCKH" ON public.lckh_submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE auth_id = auth.uid() 
            AND (role ILIKE '%ADMIN%' OR role ILIKE '%KAMAD%' OR role ILIKE '%WAKA%')
        )
    );

CREATE POLICY "Admins/Waka/Kamad can update LCKH" ON public.lckh_submissions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE auth_id = auth.uid() 
            AND (role ILIKE '%ADMIN%' OR role ILIKE '%KAMAD%' OR role ILIKE '%WAKA%')
        )
    );
