-- Migration to add last_location to users table for accurate monitoring
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_location VARCHAR(255);
