-- Migration: Fix RLS for guru and siswa tables to allow authenticated users to read

-- Enable RLS if not already enabled
ALTER TABLE public.guru ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.siswa ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.guru;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.siswa;
DROP POLICY IF EXISTS "Allow authenticated users to read guru" ON public.guru;
DROP POLICY IF EXISTS "Allow authenticated users to read siswa" ON public.siswa;

-- Create policy to allow authenticated users to read guru
CREATE POLICY "Allow authenticated users to read guru"
ON public.guru
FOR SELECT
TO authenticated
USING (true);

-- Create policy to allow authenticated users to read siswa
CREATE POLICY "Allow authenticated users to read siswa"
ON public.siswa
FOR SELECT
TO authenticated
USING (true);

-- Also allow public read access for non-sensitive data (optional - for public pages)
-- Uncomment these if you want non-authenticated users to also read guru/siswa
-- CREATE POLICY "Allow public read access to guru" ON public.guru FOR SELECT TO public USING (true);
-- CREATE POLICY "Allow public read access to siswa" ON public.siswa FOR SELECT TO public USING (true);

-- Grant permissions
GRANT SELECT ON public.guru TO authenticated;
GRANT SELECT ON public.siswa TO authenticated;
