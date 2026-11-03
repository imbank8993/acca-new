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
-- Existing payments remain direct treasury payments. Items may share a month.
ALTER TABLE public.committee_terms DROP CONSTRAINT IF EXISTS committee_terms_activity_id_month_year_key;
ALTER TABLE public.committee_payments ADD COLUMN IF NOT EXISTS flow text NOT NULL DEFAULT 'DIRECT' CHECK (flow IN ('DIRECT','PJ_ADVANCE','REIMBURSEMENT'));
ALTER TABLE public.committee_payments ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.committee_payments ADD COLUMN IF NOT EXISTS destination_account text NOT NULL DEFAULT '';
ALTER TABLE public.committee_items ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.committee_items ADD COLUMN IF NOT EXISTS attachments_migrated boolean NOT NULL DEFAULT false;
UPDATE public.committee_items i SET attachments=t.attachments, attachments_migrated=true
FROM public.committee_terms t WHERE i.term_id=t.id AND NOT i.attachments_migrated;
-- An old item without a price remains visible as a draft that can be priced.
ALTER TABLE public.committee_items DROP CONSTRAINT IF EXISTS committee_items_unit_price_check;
ALTER TABLE public.committee_items ADD CONSTRAINT committee_items_unit_price_check CHECK(unit_price>=0);
ALTER TABLE public.committee_terms ADD COLUMN IF NOT EXISTS item_migrated boolean NOT NULL DEFAULT false;
INSERT INTO public.committee_items(id,term_id,description,recipient,quantity,unit,unit_price,attachments,attachments_migrated)
SELECT gen_random_uuid(),t.id,t.title,'',1,'paket',0,t.attachments,true FROM public.committee_terms t
WHERE NOT t.item_migrated AND NOT EXISTS (SELECT 1 FROM public.committee_items i WHERE i.term_id=t.id);
UPDATE public.committee_terms SET item_migrated=true WHERE NOT item_migrated;
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
