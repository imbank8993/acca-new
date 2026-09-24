-- Fix user_id type mismatch in lckh_submissions table
-- Date: 2026-02-04
-- Issue: lckh_submissions.user_id is UUID (referencing auth.users)
--        but application uses public.users with integer ID


-- Step 1: Drop the existing foreign key constraint if exists
ALTER TABLE public.lckh_submissions 
DROP CONSTRAINT IF EXISTS lckh_submissions_user_id_fkey;

-- Step 2: Add a new column with integer type
ALTER TABLE public.lckh_submissions 
ADD COLUMN IF NOT EXISTS user_id_new integer;

-- Step 3: Migrate data from UUID to integer by looking up in public.users
-- Map auth_id (UUID) to id (integer)
UPDATE public.lckh_submissions AS l
SET user_id_new = u.id
FROM public.users AS u
WHERE l.user_id = u.auth_id;

-- Step 4: Drop the old UUID column
ALTER TABLE public.lckh_submissions 
DROP COLUMN IF EXISTS user_id;

-- Step 5: Rename the new column to user_id
ALTER TABLE public.lckh_submissions 
RENAME COLUMN user_id_new TO user_id;

-- Step 6: Make user_id NOT NULL
ALTER TABLE public.lckh_submissions 
ALTER COLUMN user_id SET NOT NULL;

-- Step 7: Add foreign key constraint to public.users
ALTER TABLE public.lckh_submissions
ADD CONSTRAINT lckh_submissions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Step 8: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_lckh_submissions_user_id 
ON public.lckh_submissions(user_id);

-- Step 9: Update RLS policies to use public.users id
DROP POLICY IF EXISTS "Users can view own LCKH" ON public.lckh_submissions;
DROP POLICY IF EXISTS "Users can insert own LCKH" ON public.lckh_submissions;
DROP POLICY IF EXISTS "Users can update own LCKH" ON public.lckh_submissions;

CREATE POLICY "Users can view own LCKH" ON public.lckh_submissions
    FOR SELECT USING (
        user_id IN (
            SELECT id FROM public.users WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own LCKH" ON public.lckh_submissions
    FOR INSERT WITH CHECK (
        user_id IN (
            SELECT id FROM public.users WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own LCKH" ON public.lckh_submissions
    FOR UPDATE USING (
        user_id IN (
            SELECT id FROM public.users WHERE auth_id = auth.uid()
        )
    );
