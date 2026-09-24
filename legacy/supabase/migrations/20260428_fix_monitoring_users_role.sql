-- Migration: Fix Monitoring - Add role column to users table
-- Date: 2026-04-28
-- Fixes: "role is not defined" error in /api/monitoring/users

-- Add role column to users table if not exists
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'GURU';

-- Add index for role column for better query performance
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Also ensure last_seen and last_location columns exist (needed by monitoring)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_location TEXT;

CREATE INDEX IF NOT EXISTS idx_users_last_seen ON public.users(last_seen);
CREATE INDEX IF NOT EXISTS idx_users_last_location ON public.users(last_location);

-- Grant necessary permissions
GRANT SELECT ON public.users TO authenticated;
GRANT SELECT ON public.users TO service_role;