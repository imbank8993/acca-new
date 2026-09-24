-- ============================================================
-- Menu: Tambahkan IzinGuru ke kolom pages untuk role terkait
-- ============================================================

-- GURU bisa ajukan dan lihat miliknya
UPDATE users
SET pages = pages || ',IzinGuru'
WHERE role LIKE '%GURU%'
  AND pages NOT LIKE '%IzinGuru%';

-- KAMAD bisa approve izin/sakit
UPDATE users
SET pages = pages || ',IzinGuru'
WHERE role LIKE '%KAMAD%'
  AND pages NOT LIKE '%IzinGuru%';

-- OP_JURNAL bisa verifikasi dinas luar
UPDATE users
SET pages = pages || ',IzinGuru'
WHERE role LIKE '%OP_JURNAL%'
  AND pages NOT LIKE '%IzinGuru%';

-- ADMIN bisa lihat semua
UPDATE users
SET pages = pages || ',IzinGuru'
WHERE role LIKE '%ADMIN%'
  AND pages NOT LIKE '%IzinGuru%';

-- ============================================================
-- Permissions untuk role_permissions table
-- ============================================================

INSERT INTO role_permissions (role_name, resource, action, is_allowed)
VALUES
  ('GURU',     'izin_guru', 'view',    true),
  ('GURU',     'izin_guru', 'create',  true),
  ('GURU',     'izin_guru', 'delete',  true),
  ('KAMAD',    'izin_guru', 'view',    true),
  ('KAMAD',    'izin_guru', 'approve', true),
  ('OP_JURNAL','izin_guru', 'view',    true),
  ('OP_JURNAL','izin_guru', 'approve', true),
  ('ADMIN',    'izin_guru', 'view',    true),
  ('ADMIN',    'izin_guru', 'create',  true),
  ('ADMIN',    'izin_guru', 'approve', true),
  ('ADMIN',    'izin_guru', 'delete',  true)
ON CONFLICT DO NOTHING;
