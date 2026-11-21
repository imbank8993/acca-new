-- Index public.users(auth_id).
--
-- auth_id dibaca di SETIAP permintaan terautentikasi CBT (status aktif & nama,
-- `WHERE auth_id = $1`) dan oleh JwtStrategy acca-new untuk token bersubjek UUID,
-- serta oleh UPDATE last_seen heartbeat. Tanpa index, tiap query itu memindai
-- seluruh tabel users.
--
-- Aman dijalankan ulang. Bila sudah ada index valid apa pun yang kolom PERTAMA-nya
-- auth_id (mis. dari dump Supabase dengan nama lain), tidak dibuat index ganda.
-- Tabel users berukuran ribuan baris, jadi pembuatannya hanya sesaat.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_index i
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = i.indkey[0]
     WHERE n.nspname = 'public' AND t.relname = 'users' AND a.attname = 'auth_id' AND i.indisvalid
  ) THEN
    CREATE INDEX idx_users_auth_id ON public.users (auth_id);
  END IF;
END $$;
