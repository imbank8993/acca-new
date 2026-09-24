-- Create the table
CREATE TABLE IF NOT EXISTS public.fitur_akademik (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT NOT NULL,
    icon TEXT,
    order_num INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.fitur_akademik ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read active features
CREATE POLICY "Public profiles are viewable by everyone."
ON public.fitur_akademik FOR SELECT
USING ( is_active = true );

-- Policy: Authenticated users can read all features
CREATE POLICY "Authenticated users can read all features"
ON public.fitur_akademik FOR SELECT
TO authenticated
USING ( true );

CREATE POLICY "Authenticated users can insert features"
ON public.fitur_akademik FOR INSERT
TO authenticated
WITH CHECK ( true );

CREATE POLICY "Authenticated users can update features"
ON public.fitur_akademik FOR UPDATE
TO authenticated
USING ( true )
WITH CHECK ( true );

CREATE POLICY "Authenticated users can delete features"
ON public.fitur_akademik FOR DELETE
TO authenticated
USING ( true );
