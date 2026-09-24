-- =====================================================
-- DATA LIBUR: lingkup per kelas/tingkat + pembersihan data
-- Updated: 2026-08-27
--
-- Jalankan lewat Supabase Dashboard ▸ SQL Editor (RPC exec_sql tidak ada).
-- Script ini idempoten; aman dijalankan ulang.
--
-- Isi:
--   1. Kolom lingkup + target_kelas  → libur bisa dibatasi ke tingkat/kelas
--   2. Normalisasi jam_ke NULL/kosong → 'Semua'
--   3. Pecah jam_ke gabungan ('1,2') jadi satu baris per jam
--   4. Buang duplikat, lalu pasang UNIQUE index yang selama ini tidak ada
--   5. Nyalakan RLS: publik boleh baca, tulis hanya lewat service role
-- =====================================================

-- ── 1. Kolom lingkup ────────────────────────────────────────────────
-- lingkup: 'semua'   → seluruh madrasah (perilaku lama, jadi default)
--          'tingkat' → target_kelas berisi angka tingkat: {'10','12'}
--          'kelas'   → target_kelas berisi nama kelas: {'XI Fisika 1'}
ALTER TABLE libur ADD COLUMN IF NOT EXISTS lingkup TEXT NOT NULL DEFAULT 'semua';
ALTER TABLE libur ADD COLUMN IF NOT EXISTS target_kelas TEXT[] NOT NULL DEFAULT '{}'::text[];

DO $$
BEGIN
    ALTER TABLE libur ADD CONSTRAINT libur_lingkup_check
        CHECK (lingkup IN ('semua', 'tingkat', 'kelas'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Baris lama tanpa target dianggap berlaku untuk semua kelas.
UPDATE libur
SET lingkup = 'semua', target_kelas = '{}'::text[]
WHERE lingkup <> 'semua' AND (target_kelas IS NULL OR cardinality(target_kelas) = 0);

-- ── 2. Normalisasi jam_ke ───────────────────────────────────────────
UPDATE libur SET jam_ke = 'Semua'
WHERE jam_ke IS NULL OR btrim(jam_ke::text) = '' OR lower(btrim(jam_ke::text)) = 'semua';

-- ── 3. Pecah jam_ke gabungan berkoma ────────────────────────────────
-- Halaman input pernah menyimpan '1,2' dalam satu baris saat entri diedit.
-- Semua pembaca membandingkan jam satu per satu, sehingga '1,2' hanya terbaca
-- sebagai jam 1 dan jam 2 tetap dibuatkan jurnal.
WITH pecah AS (
    SELECT l.tanggal,
           btrim(j) AS jam,
           l.keterangan,
           l.lingkup,
           l.target_kelas
    FROM libur l,
         LATERAL unnest(string_to_array(l.jam_ke::text, ',')) AS j
    WHERE l.jam_ke::text LIKE '%,%'
      AND btrim(j) <> ''
)
INSERT INTO libur (tanggal, jam_ke, keterangan, lingkup, target_kelas)
SELECT DISTINCT p.tanggal, p.jam, p.keterangan, p.lingkup, p.target_kelas
FROM pecah p
WHERE NOT EXISTS (
    SELECT 1 FROM libur x
    WHERE x.tanggal = p.tanggal
      AND x.jam_ke::text = p.jam
      AND x.lingkup = p.lingkup
      AND x.target_kelas = p.target_kelas
);

DELETE FROM libur WHERE jam_ke::text LIKE '%,%';

-- ── 4. Duplikat + UNIQUE index ──────────────────────────────────────
-- supabase/jurnal_schema.sql menjanjikan UNIQUE(tanggal, jam_ke) tapi tabel
-- live tidak pernah memilikinya, jadi duplikat bisa menumpuk diam-diam.
DELETE FROM libur a
USING libur b
WHERE a.id > b.id
  AND a.tanggal = b.tanggal
  AND a.jam_ke::text = b.jam_ke::text
  AND a.lingkup = b.lingkup
  AND a.target_kelas = b.target_kelas;

ALTER TABLE libur ALTER COLUMN jam_ke SET DEFAULT 'Semua';

DO $$
BEGIN
    ALTER TABLE libur ALTER COLUMN jam_ke SET NOT NULL;
EXCEPTION
    WHEN others THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS libur_slot_unik
    ON libur (tanggal, jam_ke, lingkup, target_kelas);

CREATE INDEX IF NOT EXISTS idx_libur_tanggal ON libur (tanggal);

-- ── 5. RLS ──────────────────────────────────────────────────────────
-- Sebelumnya RLS dimatikan total, sehingga siapa pun yang memegang anon key
-- bisa menulis/menghapus seluruh kalender libur. Pembacaan tetap dibuka
-- (kalender dipakai banyak halaman, termasuk situs publik); penulisan hanya
-- boleh lewat service role, dan route API sudah memverifikasi role dulu.
ALTER TABLE libur ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS libur_select_all ON libur;
CREATE POLICY libur_select_all ON libur FOR SELECT USING (true);

-- Sengaja TIDAK ada policy INSERT/UPDATE/DELETE:
-- service_role melewati RLS, selain itu ditolak.

COMMENT ON COLUMN libur.lingkup IS 'semua | tingkat | kelas — cakupan libur';
COMMENT ON COLUMN libur.target_kelas IS 'Tingkat (10/11/12) atau nama kelas sesuai lingkup; kosong = semua kelas';
