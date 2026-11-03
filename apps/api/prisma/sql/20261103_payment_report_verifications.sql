CREATE TABLE IF NOT EXISTS public.payment_report_verifications (
 id uuid PRIMARY KEY,
 token_hash text NOT NULL UNIQUE,
 issuer_id uuid NOT NULL,
 pdf_hash text NOT NULL CHECK (pdf_hash ~ '^[0-9a-f]{64}$'),
 snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_report_verifications ENABLE ROW LEVEL SECURITY;
