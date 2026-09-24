CREATE TABLE IF NOT EXISTS public.orangtua_siswa (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    nisn TEXT NOT NULL,
    status_keluarga TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, nisn)
);

-- Enable RLS
ALTER TABLE public.orangtua_siswa ENABLE ROW LEVEL SECURITY;

-- Policy: Admin can do all
CREATE POLICY "Admin All" ON public.orangtua_siswa
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.auth_id = auth.uid() AND users.role = 'ADMIN'
    )
);

-- Policy: Parent can read own
CREATE POLICY "Parent Read Own" ON public.orangtua_siswa
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = orangtua_siswa.user_id AND users.auth_id = auth.uid()
    )
);
