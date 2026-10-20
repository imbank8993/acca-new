/** PostgreSQL 16+: filter only the creator's metadata and the caller's visible points.
 * Aggregate counts in SQL, and return full rows only for the requested page.
 * Parameters: user ID, pinned legacy bindings, literal search, status, date prefix,
 * page size, offset. All user input is passed separately from the SQL text.
 */
export const NOTULENSI_LIST_SQL = String.raw`
WITH ownership AS (
  SELECT n.id, n.agenda, n.tanggal, n.lokasi, n.pimpinan_rapat, n.notulis, n.catatan,
    CASE WHEN regexp_replace(n.created_by, '^\s+|\s+$', '', 'g') LIKE 'user:%'
      THEN regexp_replace(n.created_by, '^\s+|\s+$', '', 'g') = 'user:' || $1::text
      ELSE ($2::jsonb ->> lower(regexp_replace(regexp_replace(n.created_by, '^\s+|\s+$', '', 'g'), '\s+', ' ', 'g'))) = $1::text
    END IS TRUE AS is_owner,
    CASE jsonb_typeof(n.poin_poin)
      WHEN 'array' THEN n.poin_poin
      WHEN 'string' THEN CASE WHEN pg_input_is_valid(n.poin_poin #>> '{}', 'jsonb')
        THEN CASE WHEN jsonb_typeof((n.poin_poin #>> '{}')::jsonb) = 'array'
          THEN (n.poin_poin #>> '{}')::jsonb ELSE '[]'::jsonb END
        ELSE '[]'::jsonb END
      ELSE '[]'::jsonb
    END AS points
  FROM public.notulensi_rapat n
), visible AS (
  SELECT n.id, n.tanggal, n.is_owner,
    CASE WHEN p.total = 0 THEN CASE WHEN n.is_owner THEN 'Belum' END
      WHEN p.all_done THEN 'Selesai' WHEN p.all_pending THEN 'Belum' ELSE 'Proses'
    END AS visible_status,
    strpos(lower(n.agenda), $3::text) > 0 OR p.matches_search OR (
      n.is_owner AND (
        strpos(lower(coalesce(n.lokasi, '')), $3::text) > 0 OR
        strpos(lower(coalesce(n.pimpinan_rapat, '')), $3::text) > 0 OR
        strpos(lower(coalesce(n.notulis, '')), $3::text) > 0 OR
        strpos(lower(coalesce(n.catatan, '')), $3::text) > 0
      )
    ) AS matches_search
  FROM ownership n
  CROSS JOIN LATERAL (
    SELECT count(*) AS total,
      bool_and(lower(regexp_replace(coalesce(point->>'status', ''), '^\s+|\s+$', '', 'g')) = 'selesai') AS all_done,
      bool_and(lower(regexp_replace(coalesce(point->>'status', ''), '^\s+|\s+$', '', 'g')) NOT IN ('proses', 'selesai')) AS all_pending,
      coalesce(bool_or(
        strpos(lower(regexp_replace(coalesce(nullif(point->>'teks', ''), nullif(point->>'poin', ''), point->>'isi', ''), '^\s+|\s+$', '', 'g')), $3::text) > 0 OR
        strpos(lower(coalesce(point->>'pic', '')), $3::text) > 0 OR
        strpos(lower(coalesce(point->>'keterangan', '')), $3::text) > 0
      ), false) AS matches_search
    FROM jsonb_array_elements(n.points) AS entry(point)
    WHERE jsonb_typeof(point) = 'object'
      AND regexp_replace(coalesce(nullif(point->>'teks', ''), nullif(point->>'poin', ''), point->>'isi', ''), '^\s+|\s+$', '', 'g') <> ''
      AND (n.is_owner OR CASE WHEN nullif(regexp_replace(point->>'pic_user_id', '^\s+|\s+$', '', 'g'), '') IS NOT NULL
        THEN regexp_replace(point->>'pic_user_id', '^\s+|\s+$', '', 'g') = $1::text
        ELSE ($2::jsonb ->> lower(btrim(regexp_replace(point->>'pic', '\s+', ' ', 'g')))) = $1::text
      END)
  ) p
), filtered AS (
  SELECT * FROM visible
  WHERE ($3::text = '' OR matches_search)
    AND ($4::text = '' OR visible_status = $4::text)
    AND ($5::text = '' OR (is_owner AND starts_with(to_char(tanggal, 'YYYY-MM-DD'), $5::text)))
), page AS (
  SELECT id FROM filtered ORDER BY tanggal DESC, id DESC LIMIT $6::int OFFSET $7::bigint
)
SELECT
  coalesce((SELECT jsonb_agg(
    to_jsonb(n) || jsonb_build_object('id', n.id::text, 'agenda_id', n.agenda_id::text, 'revision', n.updated_at::text)
    ORDER BY n.tanggal DESC, n.id DESC
  ) FROM page JOIN public.notulensi_rapat n USING (id)), '[]'::jsonb) AS data,
  (SELECT jsonb_build_object('total', count(*),
    'belum', count(*) FILTER (WHERE visible_status = 'Belum'),
    'proses', count(*) FILTER (WHERE visible_status = 'Proses'),
    'selesai', count(*) FILTER (WHERE visible_status = 'Selesai')) FROM visible) AS stats,
  (SELECT count(*)::int FROM filtered) AS total
`;
