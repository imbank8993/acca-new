-- Migration: System Config Table
-- Purpose: Store application configuration including verification base URL
-- This table allows the app to be hosting-agnostic for QR code verification

CREATE TABLE IF NOT EXISTS system_config (
    id BIGSERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by TEXT
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);

-- Insert default config values
INSERT INTO system_config (key, value, description) VALUES
    ('app_name', 'ACCA', 'Application name')
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_config (key, value, description) VALUES
    ('verify_base_url', '', 'Base URL for student card verification. If empty, uses current host.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_config (key, value, description) VALUES
    ('qr_domain', '', 'Stable subdomain/domain for QR code scanning (e.g., qr.sekolah.sch.id)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_config (key, value, description) VALUES
    ('app_version', '1.0.0', 'Current application version')
ON CONFLICT (key) DO NOTHING;

-- Function to get config value by key
CREATE OR REPLACE FUNCTION get_config(p_key TEXT)
RETURNS TEXT AS $$
DECLARE
    v_value TEXT;
BEGIN
    SELECT system_config.value INTO v_value
    FROM system_config
    WHERE system_config.key = p_key;
    RETURN COALESCE(v_value, '');
END;
$$ LANGUAGE plpgsql;

-- Function to set config value
CREATE OR REPLACE FUNCTION set_config(p_key TEXT, p_value TEXT, p_updated_by TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    INSERT INTO system_config (key, value, updated_by)
    VALUES (p_key, p_value, p_updated_by)
    ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW(),
        updated_by = COALESCE(EXCLUDED.updated_by, system_config.updated_by);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_system_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS system_config_updated_at ON system_config;
CREATE TRIGGER system_config_updated_at
    BEFORE UPDATE ON system_config
    FOR EACH ROW
    EXECUTE FUNCTION update_system_config_updated_at();

COMMENT ON TABLE system_config IS 'Application configuration for hosting-agnostic QR verification';
COMMENT ON COLUMN system_config.key IS 'Config key (e.g., verify_base_url, qr_domain)';
COMMENT ON COLUMN system_config.value IS 'Config value';