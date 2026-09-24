-- Fix: Ensure lckh_periods allows INSERT operations
-- Re-disable RLS if it was re-enabled
ALTER TABLE public.lckh_periods DISABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Read Periods" ON public.lckh_periods;
DROP POLICY IF EXISTS "Insert Periods" ON public.lckh_periods;

-- Create permissive policies
CREATE POLICY "Read Periods" ON public.lckh_periods FOR SELECT USING (true);
CREATE POLICY "Insert Periods" ON public.lckh_periods FOR INSERT WITH CHECK (true);
CREATE POLICY "Update Periods" ON public.lckh_periods FOR UPDATE USING (true);
CREATE POLICY "Delete Periods" ON public.lckh_periods FOR DELETE USING (true);

-- Ensure grants are in place
GRANT ALL ON public.lckh_periods TO postgres, anon, authenticated, service_role;
