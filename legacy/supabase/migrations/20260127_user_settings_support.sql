-- Migration: User Settings Support
-- Adds indexes and helper functions for user management

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_aktif ON users(aktif);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Create audit log table for tracking user changes
CREATE TABLE IF NOT EXISTS user_audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    changed_by TEXT NOT NULL,
    action TEXT NOT NULL, -- 'UPDATE_DATA', 'UPDATE_PAGES', 'UPDATE_ROLES', 'TOGGLE_STATUS', 'BULK_REPLACE'
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on audit log
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON user_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON user_audit_log(created_at DESC);

-- Function to log user changes
CREATE OR REPLACE FUNCTION log_user_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_audit_log (user_id, changed_by, action, old_value, new_value)
    VALUES (
        NEW.id,
        COALESCE(current_setting('app.current_user', true), 'system'),
        TG_ARGV[0],
        row_to_json(OLD),
        row_to_json(NEW)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Triggers can be added later if needed
-- Example: CREATE TRIGGER user_update_trigger AFTER UPDATE ON users
--          FOR EACH ROW EXECUTE FUNCTION log_user_change('UPDATE_DATA');

COMMENT ON TABLE user_audit_log IS 'Audit log for tracking user management changes';
COMMENT ON FUNCTION log_user_change IS 'Function to log user changes to audit table';
