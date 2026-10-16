-- Additive migration. Run before enabling /e-sertifikat. Does not modify existing data.
BEGIN;
CREATE TABLE IF NOT EXISTS ecert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  title text NOT NULL,
  organizer text NOT NULL,
  description text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  start_date date NOT NULL,
  end_date date NOT NULL,
  number_prefix text NOT NULL UNIQUE,
  next_number integer NOT NULL DEFAULT 1,
  template jsonb NOT NULL DEFAULT '{}',
  revision integer NOT NULL DEFAULT 1,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS ecert_events_owner ON ecert_events(owner_id, created_at DESC);
CREATE TABLE IF NOT EXISTS ecert_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES ecert_events(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('template','documentation','correspondence')),
  filename text NOT NULL,
  mime text NOT NULL CHECK (mime IN ('application/pdf','image/png','image/jpeg')),
  bytes bytea NOT NULL CHECK (octet_length(bytes) BETWEEN 1 AND 5242880),
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'template' OR is_public = false)
);
CREATE INDEX IF NOT EXISTS ecert_assets_event ON ecert_assets(event_id);
CREATE TABLE IF NOT EXISTS ecert_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES ecert_events(id) ON DELETE RESTRICT,
  name text NOT NULL,
  institution text NOT NULL DEFAULT '',
  identities jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','revoked')),
  certificate_number text UNIQUE,
  verify_token text UNIQUE,
  snapshot jsonb,
  issued_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text,
  CHECK ((status = 'draft' AND verify_token IS NULL AND snapshot IS NULL) OR
    (status IN ('issued','revoked') AND verify_token IS NOT NULL AND snapshot IS NOT NULL AND certificate_number IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS ecert_recipients_event ON ecert_recipients(event_id, status);
CREATE TABLE IF NOT EXISTS ecert_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES ecert_events(id),
  actor_id text NOT NULL,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ecert_audit_event ON ecert_audit(event_id, created_at DESC);
CREATE OR REPLACE FUNCTION ecert_protect_issued() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'draft' THEN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Issued certificates cannot be deleted'; END IF;
    IF ROW(NEW.event_id,NEW.name,NEW.institution,NEW.identities,NEW.certificate_number,NEW.verify_token,NEW.snapshot,NEW.issued_at)
      IS DISTINCT FROM ROW(OLD.event_id,OLD.name,OLD.institution,OLD.identities,OLD.certificate_number,OLD.verify_token,OLD.snapshot,OLD.issued_at)
      OR NEW.status='draft' OR (OLD.status='revoked' AND NEW.status<>'revoked') THEN
      RAISE EXCEPTION 'Issued certificate identity and snapshot are immutable';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ecert_issued_immutable ON ecert_recipients;
CREATE TRIGGER ecert_issued_immutable BEFORE UPDATE OR DELETE ON ecert_recipients FOR EACH ROW EXECUTE FUNCTION ecert_protect_issued();
ALTER TABLE ecert_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecert_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecert_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecert_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ecert_events, ecert_assets, ecert_recipients, ecert_audit FROM PUBLIC;
COMMIT;
