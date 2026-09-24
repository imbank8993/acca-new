-- Disable RLS for all LCKH tables to make them unrestricted
ALTER TABLE public.lckh_periods DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lckh_modules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lckh_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lckh_approvals DISABLE ROW LEVEL SECURITY;

-- Grant Full Access to everyone (authenticated, anon, etc)
GRANT ALL ON public.lckh_periods TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.lckh_modules TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.lckh_submissions TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.lckh_approvals TO postgres, anon, authenticated, service_role;
