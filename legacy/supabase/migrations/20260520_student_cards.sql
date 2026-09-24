-- Migration: Student Cards Table
-- Purpose: Manage unique student card IDs for QR codes used across multiple systems
-- Systems: Student verification, Attendance (Absensi), Library (Perpustakaan)

CREATE TABLE IF NOT EXISTS student_cards (
    id BIGSERIAL PRIMARY KEY,
    card_id TEXT NOT NULL UNIQUE, -- Unique card identifier for QR code (e.g., ACCAS-XXXXXXXX)
    nisn TEXT NOT NULL REFERENCES master_siswa(nisn) ON DELETE CASCADE,
    card_name TEXT DEFAULT 'Kartu Siswa', -- Optional: name for this card
    is_active BOOLEAN DEFAULT true, -- Card can be deactivated if lost
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    issued_by TEXT, -- username of issuer
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups by card_id
CREATE INDEX IF NOT EXISTS idx_student_cards_card_id ON student_cards(card_id);
CREATE INDEX IF NOT EXISTS idx_student_cards_nisn ON student_cards(nisn);
CREATE INDEX IF NOT EXISTS idx_student_cards_active ON student_cards(is_active);

-- Function to generate unique card ID format: ACCA-XXXXXXXX (8 random alphanumeric)
CREATE OR REPLACE FUNCTION generate_card_id()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    END LOOP;
    RETURN 'ACCA-' || result;
END;
$$ LANGUAGE plpgsql;

-- Helper function to get or create active card for a student
CREATE OR REPLACE FUNCTION get_or_create_student_card(p_nisn TEXT, p_issued_by TEXT DEFAULT NULL)
RETURNS TABLE(card_id TEXT, card_name TEXT, is_active BOOLEAN) AS $$
DECLARE
    v_card_id TEXT;
    v_card_name TEXT;
    v_is_active BOOLEAN;
BEGIN
    -- First try to get existing active card
    SELECT student_cards.card_id, student_cards.card_name, student_cards.is_active
    INTO v_card_id, v_card_name, v_is_active
    FROM student_cards
    WHERE student_cards.nisn = p_nisn AND student_cards.is_active = true
    ORDER BY student_cards.issued_at DESC
    LIMIT 1;

    -- If no active card exists, create one
    IF v_card_id IS NULL THEN
        -- Generate unique card_id (retry if collision)
        FOR i IN 1..10 LOOP
            v_card_id := generate_card_id();

            INSERT INTO student_cards (card_id, nisn, issued_by)
            VALUES (v_card_id, p_nisn, p_issued_by)
            ON CONFLICT (card_id) DO NOTHING;

            IF FOUND THEN
                EXIT;
            END IF;
        END LOOP;

        v_card_name := 'Kartu Siswa';
        v_is_active := true;
    END IF;

    RETURN QUERY SELECT v_card_id, v_card_name, v_is_active;
END;
$$ LANGUAGE plpgsql;

-- Update updated_at trigger
CREATE OR REPLACE FUNCTION update_student_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS student_cards_updated_at ON student_cards;
CREATE TRIGGER student_cards_updated_at
    BEFORE UPDATE ON student_cards
    FOR EACH ROW
    EXECUTE FUNCTION update_student_cards_updated_at();

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON student_cards TO service_role;
-- GRANT USAGE, SELECT ON SEQUENCE student_cards_id_seq TO service_role;

COMMENT ON TABLE student_cards IS 'Student card identifiers for QR codes used across verification, attendance, and library systems';
COMMENT ON COLUMN student_cards.card_id IS 'Unique card ID encoded in QR code (format: ACCA-XXXXXXXX)';
COMMENT ON COLUMN student_cards.is_active IS 'Card can be deactivated if lost/stolen and reissued';
