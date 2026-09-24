-- Migration: Perketat RLS prestasi_lomba (peran + kepemilikan)
-- Created: 2026-07-19
--
-- Migrasi awal (20260718_create_prestasi_lomba.sql) membuka SELECT/INSERT/UPDATE/DELETE
-- untuk SEMUA user login (auth.role()='authenticated'). Akibatnya siswa bisa
-- menyetujui prestasinya sendiri, menghapus/mengubah milik siswa lain, atau insert
-- atas nama NISN orang lain — alur validasi hanya dijaga di UI. Migrasi ini
-- menggantinya dengan aturan berbasis peran (validator) dan kepemilikan (nisn siswa).

-- Helper: apakah user adalah validator prestasi (ADMIN / OP_LOMBA / WKM_KESISWAAN).
CREATE OR REPLACE FUNCTION is_prestasi_validator(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
    WHERE u.auth_id = uid
      AND (u.role ILIKE '%ADMIN%'
        OR u.role ILIKE '%OP_LOMBA%'
        OR u.role ILIKE '%WKM_KESISWAAN%')
  );
$$;

-- Helper: apakah NISN baris ini milik user (nisn siswa = users.nip / username).
CREATE OR REPLACE FUNCTION owns_prestasi_nisn(uid uuid, target_nisn text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
    WHERE u.auth_id = uid
      AND (u.nip = target_nisn OR u.username = target_nisn)
  );
$$;

GRANT EXECUTE ON FUNCTION is_prestasi_validator(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION owns_prestasi_nisn(uuid, text) TO authenticated;

-- Buang policy lama yang terlalu longgar.
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON prestasi_lomba;
DROP POLICY IF EXISTS "Allow insert access for authenticated users" ON prestasi_lomba;
DROP POLICY IF EXISTS "Allow update access for authenticated users" ON prestasi_lomba;
DROP POLICY IF EXISTS "Allow delete access for authenticated users" ON prestasi_lomba;

-- Idempoten: buang juga versi baru bila migrasi diulang.
DROP POLICY IF EXISTS "prestasi select validator atau pemilik" ON prestasi_lomba;
DROP POLICY IF EXISTS "prestasi insert pemilik menunggu" ON prestasi_lomba;
DROP POLICY IF EXISTS "prestasi update hanya validator" ON prestasi_lomba;
DROP POLICY IF EXISTS "prestasi delete validator atau pemilik" ON prestasi_lomba;

-- SELECT: validator lihat semua; siswa hanya miliknya.
CREATE POLICY "prestasi select validator atau pemilik"
  ON prestasi_lomba FOR SELECT
  TO authenticated
  USING (is_prestasi_validator(auth.uid()) OR owns_prestasi_nisn(auth.uid(), nisn));

-- INSERT: siswa hanya boleh menambah prestasi miliknya dan berstatus 'Menunggu'
-- (mencegah self-approve saat insert). Validator boleh menambah bebas.
CREATE POLICY "prestasi insert pemilik menunggu"
  ON prestasi_lomba FOR INSERT
  TO authenticated
  WITH CHECK (
    is_prestasi_validator(auth.uid())
    OR (owns_prestasi_nisn(auth.uid(), nisn) AND status_validasi = 'Menunggu')
  );

-- UPDATE: hanya validator (status_validasi, catatan, dll). Siswa tidak punya alur edit.
CREATE POLICY "prestasi update hanya validator"
  ON prestasi_lomba FOR UPDATE
  TO authenticated
  USING (is_prestasi_validator(auth.uid()))
  WITH CHECK (is_prestasi_validator(auth.uid()));

-- DELETE: validator bebas; siswa hanya miliknya dan hanya saat Menunggu/Ditolak.
CREATE POLICY "prestasi delete validator atau pemilik"
  ON prestasi_lomba FOR DELETE
  TO authenticated
  USING (
    is_prestasi_validator(auth.uid())
    OR (owns_prestasi_nisn(auth.uid(), nisn) AND status_validasi IN ('Menunggu', 'Ditolak'))
  );
