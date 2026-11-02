CREATE TABLE IF NOT EXISTS public.ptsp_disposisi (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 table_name text NOT NULL, request_id text NOT NULL,
 sender_id uuid NOT NULL, recipient_id uuid NOT NULL,
 sender_name text NOT NULL, recipient_name text NOT NULL,
 instructions text NOT NULL, snapshot jsonb NOT NULL,
 status text NOT NULL DEFAULT 'Menunggu' CHECK (status IN ('Menunggu','Diproses','Selesai')),
 follow_up text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ptsp_disposisi_recipient ON public.ptsp_disposisi(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ptsp_disposisi_request ON public.ptsp_disposisi(table_name, request_id);
