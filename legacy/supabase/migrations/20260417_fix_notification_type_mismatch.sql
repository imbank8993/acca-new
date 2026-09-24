-- Migration: Fix send_notification type mismatch for bigint and UUID
-- Date: 2026-04-17

-- 1. Alter notifications table to store any type of source_id
ALTER TABLE notifications ALTER COLUMN source_id TYPE VARCHAR(100);

-- 2. Drop legacy function signature if it exists
DROP FUNCTION IF EXISTS send_notification(varchar, varchar, text, varchar, varchar, uuid, varchar, uuid);

-- 3. MAIN FUNCTION: Accepts TEXT for source_id (Universal storage)
CREATE OR REPLACE FUNCTION send_notification(
    p_type           VARCHAR,
    p_title          VARCHAR,
    p_message        TEXT,
    p_link           VARCHAR,
    p_recipient_role VARCHAR DEFAULT NULL,
    p_recipient_user_id UUID DEFAULT NULL,
    p_source_table   VARCHAR DEFAULT NULL,
    p_source_id      TEXT    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO notifications (
        type, title, message, link,
        recipient_role, recipient_user_id,
        source_table, source_id
    ) VALUES (
        p_type, p_title, p_message, p_link,
        p_recipient_role, p_recipient_user_id,
        p_source_table, p_source_id
    )
    RETURNING id INTO new_id;

    RETURN new_id;
END;
$$;

-- 4. OVERLOAD: For BIGINT source_id (e.g., users, jurnal_guru, nilai_data)
CREATE OR REPLACE FUNCTION send_notification(
    p_type           VARCHAR,
    p_title          VARCHAR,
    p_message        TEXT,
    p_link           VARCHAR,
    p_recipient_role VARCHAR,
    p_recipient_user_id UUID,
    p_source_table   VARCHAR,
    p_source_id      BIGINT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN send_notification(
        p_type, p_title, p_message, p_link,
        p_recipient_role, p_recipient_user_id,
        p_source_table,
        p_source_id::TEXT
    );
END;
$$;

-- 5. OVERLOAD: For UUID source_id (e.g., izin_guru, ketidakhadiran)
CREATE OR REPLACE FUNCTION send_notification(
    p_type           VARCHAR,
    p_title          VARCHAR,
    p_message        TEXT,
    p_link           VARCHAR,
    p_recipient_role VARCHAR,
    p_recipient_user_id UUID,
    p_source_table   VARCHAR,
    p_source_id      UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN send_notification(
        p_type, p_title, p_message, p_link,
        p_recipient_role, p_recipient_user_id,
        p_source_table,
        p_source_id::TEXT
    );
END;
$$;
