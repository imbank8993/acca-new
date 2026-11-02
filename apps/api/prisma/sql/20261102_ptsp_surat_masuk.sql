-- Keep existing letters and links while replacing the disposition workflow with read receipts.
ALTER TABLE public.ptsp_disposisi ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE public.ptsp_disposisi ADD COLUMN IF NOT EXISTS client_request_id uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS idx_ptsp_letter_delivery ON public.ptsp_disposisi(sender_id, client_request_id);
UPDATE public.notifications SET title = 'Pemberitahuan surat masuk PTSP', type = 'PTSP_SURAT_MASUK', link = '/layanan-ptsp?surat=' || source_id
WHERE type = 'PTSP_DISPOSISI' AND source_table = 'ptsp_disposisi';
