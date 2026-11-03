-- Immutable receipt images and extraction snapshots. Unapplied drafts expire after 7 days.
CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id uuid PRIMARY KEY,
  batch_id uuid NOT NULL,
  owner_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('GURU_ASUH','KLINIK','EKSKUL')),
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL CHECK (year BETWEEN 2000 AND 2200),
  filename text NOT NULL,
  mime text NOT NULL,
  image bytea NOT NULL,
  file_hash text NOT NULL,
  reference_key text,
  extracted jsonb NOT NULL,
  candidates jsonb NOT NULL,
  selected jsonb,
  applied_at timestamptz,
  applied_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id,batch_id,file_hash)
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_receipts_paid_hash ON public.payment_receipts(file_hash) WHERE applied_at IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payment_receipts_paid_reference ON public.payment_receipts(reference_key) WHERE applied_at IS NOT NULL AND reference_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_receipts_batch ON public.payment_receipts(owner_id,batch_id);
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
