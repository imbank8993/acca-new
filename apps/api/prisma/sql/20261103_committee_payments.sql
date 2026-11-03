DO $$
DECLARE first_install boolean := to_regclass('public.committee_activities') IS NULL;
BEGIN
CREATE TABLE IF NOT EXISTS public.committee_activities (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL, owner_name text NOT NULL,
 title text NOT NULL, description text NOT NULL DEFAULT '', start_date date NOT NULL, end_date date NOT NULL,
 revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CHECK(end_date >= start_date)
);
CREATE TABLE IF NOT EXISTS public.committee_terms (
 id uuid PRIMARY KEY, activity_id uuid NOT NULL REFERENCES public.committee_activities(id) ON DELETE CASCADE,
 title text NOT NULL, month integer NOT NULL CHECK(month BETWEEN 1 AND 12), year integer NOT NULL CHECK(year BETWEEN 2000 AND 2200),
 attachments jsonb NOT NULL DEFAULT '[]', revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(activity_id,month,year)
);
CREATE TABLE IF NOT EXISTS public.committee_items (
 id uuid PRIMARY KEY, term_id uuid NOT NULL REFERENCES public.committee_terms(id) ON DELETE CASCADE,
 description text NOT NULL, recipient text NOT NULL DEFAULT '', quantity numeric(12,2) NOT NULL CHECK(quantity>0),
 unit text NOT NULL DEFAULT 'paket', unit_price numeric(16,0) NOT NULL CHECK(unit_price>0),
 amount numeric(16,0) GENERATED ALWAYS AS (round(quantity*unit_price)) STORED,
 revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.committee_payments (
 id uuid PRIMARY KEY, item_id uuid NOT NULL REFERENCES public.committee_items(id),
 amount numeric(16,0) NOT NULL CHECK(amount>0), paid_on date NOT NULL,
 proof_url text NOT NULL, note text NOT NULL DEFAULT '', actor_id uuid NOT NULL, actor_name text NOT NULL,
 request_id uuid NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.committee_history (
 id uuid PRIMARY KEY, activity_id uuid NOT NULL REFERENCES public.committee_activities(id), actor_id uuid NOT NULL, actor_name text NOT NULL,
 action text NOT NULL, reason text NOT NULL DEFAULT '', snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.committee_payments ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE public.committee_payments ADD COLUMN IF NOT EXISTS voided_by uuid;
ALTER TABLE public.committee_payments ADD COLUMN IF NOT EXISTS void_reason text;
CREATE INDEX IF NOT EXISTS committee_activity_owner ON public.committee_activities(owner_id);
CREATE INDEX IF NOT EXISTS committee_term_activity ON public.committee_terms(activity_id);
CREATE INDEX IF NOT EXISTS committee_item_term ON public.committee_items(term_id);
CREATE INDEX IF NOT EXISTS committee_payment_item ON public.committee_payments(item_id);
CREATE INDEX IF NOT EXISTS committee_history_activity ON public.committee_history(activity_id,created_at DESC);
ALTER TABLE public.committee_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committee_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committee_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committee_history ENABLE ROW LEVEL SECURITY;
-- PJ gets a separate entry to the same feature, without a grant to routine honor data.
IF first_install AND to_regclass('public.role_pages') IS NOT NULL THEN
 INSERT INTO public.role_pages(role,page_id,sort_order)
 SELECT r,'pengajuan-komite',90 FROM unnest(ARRAY['GURU','ADMIN','ADMINISTRATOR','BENDAHARA_KOMITE','KAMAD','KTU','OP_MADRASAH']) r
 ON CONFLICT(role,page_id) DO NOTHING;
END IF;
END $$;
