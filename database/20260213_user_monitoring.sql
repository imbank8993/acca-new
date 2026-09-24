-- Create activity_logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Linking to auth.users if possible, or public.users
    action VARCHAR(255) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add last_seen to users table if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_seen') THEN 
        ALTER TABLE public.users ADD COLUMN last_seen TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add RLS policies if RLS is enabled (optional but recommended)
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to activity_logs" ON public.activity_logs FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert to activity_logs" ON public.activity_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
