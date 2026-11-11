CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  description text,
  location text,
  condition text NOT NULL DEFAULT 'Baik',
  photo_url text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.inventory_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id),
  borrower_id text NOT NULL,
  borrower_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  purpose text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'Menunggu' CHECK (status IN ('Menunggu','Disetujui','Ditolak','Dipinjam','Dikembalikan','Dibatalkan')),
  consent_at timestamptz NOT NULL,
  consent_text text NOT NULL,
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text,
  handed_over_at timestamptz,
  returned_at timestamptz,
  return_condition text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_loan_period CHECK (end_at > start_at)
);
CREATE INDEX IF NOT EXISTS inventory_loans_item_period ON public.inventory_loans(item_id,start_at,end_at);
CREATE INDEX IF NOT EXISTS inventory_loans_borrower ON public.inventory_loans(borrower_id,created_at DESC);

INSERT INTO public.role_pages(role, page_id, sort_order)
SELECT r.name, 'inventaris', 0 FROM public.roles r
WHERE UPPER(r.name) IN ('ADMIN','ADMINISTRATOR','GURU','SISWA','STAF','TENDIK','KTU','WKM_SARPRAS','OP_INVENTARIS')
ON CONFLICT (role, page_id) DO NOTHING;

-- Susunan menu yang pernah disimpan tidak otomatis mengikuti MENU_GROUPS bawaan.
-- Sisipkan halaman baru ke grup Layanan tanpa mengubah urutan atau label lain.
WITH current_layout AS (
  SELECT id, layout,
    CASE WHEN jsonb_typeof(layout) = 'array' THEN layout ELSE layout->'groups' END AS groups
  FROM public.menu_layout WHERE id = 1
), updated_groups AS (
  SELECT c.id, c.layout,
    jsonb_agg(
      CASE WHEN g.value->>'key' = 'layanan'
        THEN jsonb_set(g.value, '{pages}', COALESCE(g.value->'pages', '[]'::jsonb) || '"inventaris"'::jsonb)
        ELSE g.value END ORDER BY g.ordinality
    ) AS groups
  FROM current_layout c
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(c.groups) = 'array' THEN c.groups ELSE '[]'::jsonb END) WITH ORDINALITY AS g(value, ordinality)
  WHERE jsonb_typeof(c.groups) = 'array'
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(c.groups) AS entry WHERE entry->>'key' = 'layanan')
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(c.groups) AS entry WHERE entry->'pages' ? 'inventaris')
  GROUP BY c.id, c.layout
)
UPDATE public.menu_layout m
SET layout = CASE WHEN jsonb_typeof(u.layout) = 'array' THEN u.groups ELSE jsonb_set(u.layout, '{groups}', u.groups) END,
    updated_at = now()
FROM updated_groups u WHERE m.id = u.id;

-- Susunan kustom dapat mengganti seluruh grup bawaan. Jika tidak ada grup
-- Layanan, buat grup Inventaris tersendiri agar halaman tetap muncul di sidebar.
WITH current_layout AS (
  SELECT id, layout,
    CASE WHEN jsonb_typeof(layout) = 'array' THEN layout ELSE layout->'groups' END AS groups
  FROM public.menu_layout WHERE id = 1
), updated_groups AS (
  SELECT id, layout,
    groups || jsonb_build_array(jsonb_build_object(
      'key', 'inventaris', 'label', 'Inventaris',
      'icon', 'fa-boxes-stacked', 'pages', jsonb_build_array('inventaris')
    )) AS groups
  FROM current_layout c
  WHERE jsonb_typeof(groups) = 'array'
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(c.groups) AS entry WHERE entry->'pages' ? 'inventaris')
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(c.groups) AS entry WHERE entry->>'key' = 'layanan')
)
UPDATE public.menu_layout m
SET layout = CASE WHEN jsonb_typeof(u.layout) = 'array' THEN u.groups ELSE jsonb_set(u.layout, '{groups}', u.groups) END,
    updated_at = now()
FROM updated_groups u WHERE m.id = u.id;
