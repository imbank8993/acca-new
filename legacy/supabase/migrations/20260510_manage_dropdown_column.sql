-- Migration: Create function to manage dropdown columns dynamically
-- This function allows admins to add/drop columns in master_dropdown table

CREATE OR REPLACE FUNCTION manage_dropdown_column(
    action TEXT,  -- 'add' or 'drop'
    column_name TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Sanitize column name - only allow alphanumeric and underscore
    column_name := regexp_replace(column_name, '[^a-zA-Z0-9_]', '_', 'g');

    IF action = 'add' THEN
        EXECUTE format('ALTER TABLE master_dropdown ADD COLUMN IF NOT EXISTS %I TEXT', column_name);
    ELSIF action = 'drop' THEN
        EXECUTE format('ALTER TABLE master_dropdown DROP COLUMN IF EXISTS %I', column_name);
    END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION manage_dropdown_column(TEXT, TEXT) TO authenticated;
