-- Additive, idempotent. Run after 20261016_e_sertifikat.sql, before new web code.
BEGIN;
ALTER TABLE ecert_recipients ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS ecert_public_limits (
  bucket text PRIMARY KEY CHECK (length(bucket) <= 80),
  hits integer NOT NULL CHECK (hits > 0 AND hits <= 1200),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS ecert_public_limits_expiry ON ecert_public_limits(expires_at);
ALTER TABLE ecert_public_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ecert_public_limits FROM PUBLIC;
COMMIT;
