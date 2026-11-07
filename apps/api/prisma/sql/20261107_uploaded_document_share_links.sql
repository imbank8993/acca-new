-- Link publik (tanpa login) untuk satu berkas di tab Dokumen Sekolah.
-- Token acak adalah satu-satunya pelindung berkas, jadi baris ini ikut
-- terhapus bersama dokumennya.
CREATE TABLE IF NOT EXISTS public.uploaded_document_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  document_id uuid NOT NULL REFERENCES public.uploaded_documents(id) ON DELETE CASCADE,
  created_by uuid,
  created_by_name text,
  revoked boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_uploaded_document_share_links_document ON public.uploaded_document_share_links(document_id);
ALTER TABLE public.uploaded_document_share_links ENABLE ROW LEVEL SECURITY;
