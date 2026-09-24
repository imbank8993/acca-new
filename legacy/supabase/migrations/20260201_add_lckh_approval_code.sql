ALTER TABLE public.lckh_submissions 
ADD COLUMN IF NOT EXISTS approval_code TEXT,
ADD COLUMN IF NOT EXISTS approved_by_waka TEXT,
ADD COLUMN IF NOT EXISTS approved_by_kamad TEXT;

-- Enum update if needed, but we are using text status for flexibility or existing enum
-- If 'status' is an enum type, ensure 'Approved_Kamad' is in it. 
-- In my previous migration I likely used text or specific enum. 
-- Assuming text based on the component code using 'Approved_Waka'. 
