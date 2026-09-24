-- =============================================================================
-- Migrasi 1/2: Versi jadwal eksplisit
-- Tanggal   : 2026-08-20
-- Jalankan  : Supabase Dashboard > SQL Editor (manual)
-- Sifat     : AMAN — tidak menghapus/menonaktifkan baris mana pun.
--             Pembersihan data ada di file terpisah (..._cleanup.sql).
-- =============================================================================
--
-- MASALAH
-- `jadwal_guru` tidak punya konsep versi. Kebenaran "jadwal yang berlaku hari
-- ini" disimpulkan dari kombinasi `aktif=true` + `berlaku_mulai` termax, padahal
-- baris versi lama tidak pernah dinonaktifkan saat jadwal baru di-Generate.
-- Akibatnya 13 versi jadwal (Jan-Agu) semuanya `aktif=true` sekaligus, dan guru
-- yang DIHAPUS dari suatu hari tetap terlihat mengajar di hari itu selamanya —
-- karena tidak adanya baris baru tak bisa mengalahkan baris lama.
--
-- SOLUSI
-- Setiap upload "Generate" sebenarnya adalah snapshot lengkap satu minggu.
-- Migrasi ini menjadikannya entitas nyata, sehingga aturan bacanya cukup:
--   jadwal pada tanggal T = isi versi 'penuh' terbaru dengan berlaku_mulai <= T,
--   ditimpa oleh versi 'parsial' yang lebih baru.
-- Tidak ada lagi heuristik tebak-tebakan di sisi aplikasi.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Tabel versi
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jadwal_versi (
    id            BIGSERIAL PRIMARY KEY,
    berlaku_mulai DATE        NOT NULL UNIQUE,
    -- 'penuh'   : snapshot seluruh jadwal (hasil Generate) — menggantikan versi sebelumnya
    -- 'parsial' : tambalan sebagian (koreksi beberapa guru/hari) — menimpa di atas versi penuh
    jenis         TEXT        NOT NULL DEFAULT 'penuh' CHECK (jenis IN ('penuh', 'parsial')),
    catatan       TEXT,
    dibuat_oleh   TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  jadwal_versi IS 'Satu baris = satu kali penetapan jadwal (Generate/koreksi). Sumber kebenaran jadwal yang berlaku pada suatu tanggal.';
COMMENT ON COLUMN jadwal_versi.jenis IS 'penuh = snapshot lengkap yang menggantikan versi sebelumnya; parsial = tambalan yang hanya menimpa slot yang disebutnya.';

-- -----------------------------------------------------------------------------
-- 2. Kaitkan jadwal_guru ke versi
-- -----------------------------------------------------------------------------
ALTER TABLE jadwal_guru
    ADD COLUMN IF NOT EXISTS versi_id BIGINT REFERENCES jadwal_versi(id);

COMMENT ON COLUMN jadwal_guru.aktif IS 'Baris ini dibatalkan DI DALAM versinya. BUKAN penanda "berlaku sekarang" — itu ditentukan oleh versi_id.';

-- CATATAN PENTING — JANGAN menonaktifkan baris versi lama.
-- Sempat direncanakan "pembersihan" yang men-set aktif=false pada seluruh baris
-- versi lama. Itu SALAH dan sudah dibatalkan: baris versi lama adalah satu-satunya
-- sumber jadwal historis, dan absensi susulan (mis. mengabsen tanggal 10 Juli)
-- meresolusi versi yang berlaku pada tanggal itu. Menonaktifkannya membuat
-- jadwal 10 Juli mengembalikan 0 slot — absen susulan jadi mustahil.
-- Baris versi lama HARUS tetap aktif=true. Yang menentukan jadwal berlaku adalah
-- versi_id + tanggal, bukan flag aktif.

-- -----------------------------------------------------------------------------
-- 3. Backfill: satu versi per berlaku_mulai yang sudah ada
--    jenis = 'penuh' bila mencakup >= 4 hari berbeda (ciri snapshot seminggu),
--    selain itu 'parsial' (mis. 2026-05-17: hanya 2 hari, 3 guru).
-- -----------------------------------------------------------------------------
INSERT INTO jadwal_versi (berlaku_mulai, jenis, catatan, dibuat_oleh)
SELECT
    j.berlaku_mulai,
    CASE WHEN COUNT(DISTINCT j.hari) >= 4 THEN 'penuh' ELSE 'parsial' END,
    'Backfill otomatis dari data lama (' || COUNT(*) || ' baris, '
        || COUNT(DISTINCT j.hari) || ' hari, ' || COUNT(DISTINCT j.nip) || ' guru)',
    'migrasi'
FROM jadwal_guru j
WHERE j.berlaku_mulai IS NOT NULL
GROUP BY j.berlaku_mulai
ON CONFLICT (berlaku_mulai) DO NOTHING;

UPDATE jadwal_guru j
SET    versi_id = v.id
FROM   jadwal_versi v
WHERE  j.berlaku_mulai = v.berlaku_mulai
  AND  j.versi_id IS DISTINCT FROM v.id;

-- -----------------------------------------------------------------------------
-- 4. Jaga konsistensi untuk SEMUA penulis, termasuk jalur kode yang belum
--    diperbarui (form tambah/edit manual, import, skrip ad-hoc): versi_id
--    diisi otomatis dari berlaku_mulai, dan versinya dibuat bila belum ada.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION jadwal_guru_set_versi()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_id BIGINT;
BEGIN
    IF NEW.berlaku_mulai IS NULL THEN
        NEW.berlaku_mulai := CURRENT_DATE;
    END IF;

    -- versi_id yang dikirim eksplisit dan cocok dengan berlaku_mulai-nya dihormati
    IF NEW.versi_id IS NOT NULL THEN
        SELECT id INTO v_id FROM jadwal_versi
        WHERE id = NEW.versi_id AND berlaku_mulai = NEW.berlaku_mulai;
        IF FOUND THEN
            RETURN NEW;
        END IF;
    END IF;

    SELECT id INTO v_id FROM jadwal_versi WHERE berlaku_mulai = NEW.berlaku_mulai;
    IF NOT FOUND THEN
        INSERT INTO jadwal_versi (berlaku_mulai, jenis, catatan, dibuat_oleh)
        VALUES (NEW.berlaku_mulai, 'parsial', 'Dibuat otomatis oleh trigger', 'trigger')
        ON CONFLICT (berlaku_mulai) DO UPDATE SET berlaku_mulai = EXCLUDED.berlaku_mulai
        RETURNING id INTO v_id;
    END IF;

    NEW.versi_id := v_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jadwal_guru_set_versi ON jadwal_guru;
CREATE TRIGGER trg_jadwal_guru_set_versi
    BEFORE INSERT OR UPDATE OF berlaku_mulai, versi_id ON jadwal_guru
    FOR EACH ROW EXECUTE FUNCTION jadwal_guru_set_versi();

-- -----------------------------------------------------------------------------
-- 5. Satu slot fisik (kelas + hari + jam) hanya boleh dipegang SATU baris aktif
--    per versi. Diverifikasi terhadap data live: 0 pelanggaran di seluruh 13
--    versi, jadi index ini bisa dipasang tanpa pembersihan lebih dulu.
--    Inilah yang membuat duplikat seperti "X D Kamis jam 1 punya 4 baris aktif"
--    mustahil terbentuk lagi.
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_jadwal_guru_slot_per_versi
    ON jadwal_guru (versi_id, kelas, hari, jam_ke)
    WHERE aktif;

CREATE INDEX IF NOT EXISTS idx_jadwal_guru_versi        ON jadwal_guru (versi_id) WHERE aktif;
CREATE INDEX IF NOT EXISTS idx_jadwal_guru_versi_nip    ON jadwal_guru (versi_id, nip) WHERE aktif;
CREATE INDEX IF NOT EXISTS idx_jadwal_versi_berlaku     ON jadwal_versi (berlaku_mulai DESC);

-- -----------------------------------------------------------------------------
-- 6. Tambatkan sesi absensi ke versi jadwal yang dipakai saat sesi dibuka,
--    supaya rekap historis tetap benar walau jadwal berubah kemudian.
--    (jadwal_id sudah ada di absensi_sesi, tapi selama ini jarang terisi.)
-- -----------------------------------------------------------------------------
ALTER TABLE absensi_sesi
    ADD COLUMN IF NOT EXISTS jadwal_versi_id BIGINT REFERENCES jadwal_versi(id);

COMMENT ON COLUMN absensi_sesi.jadwal_versi_id IS 'Versi jadwal yang berlaku saat sesi dibuka. Diisi otomatis oleh /api/absensi/sesi.';

-- -----------------------------------------------------------------------------
-- 7. RLS: sama posturnya dengan jadwal_guru — semua pengguna login boleh baca,
--    dan boleh tulis (proses "Generate Jadwal" berjalan dari browser admin).
--    Pembatasan siapa yang boleh Generate ditegakkan di UI/route (cek isAdmin).
-- -----------------------------------------------------------------------------
ALTER TABLE jadwal_versi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS jadwal_versi_read  ON jadwal_versi;
DROP POLICY IF EXISTS jadwal_versi_write ON jadwal_versi;

CREATE POLICY jadwal_versi_read ON jadwal_versi
    FOR SELECT TO authenticated USING (true);

CREATE POLICY jadwal_versi_write ON jadwal_versi
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;

-- =============================================================================
-- VERIFIKASI (jalankan setelah COMMIT)
-- =============================================================================
-- SELECT v.berlaku_mulai, v.jenis,
--        COUNT(*) FILTER (WHERE j.aktif) AS baris_aktif,
--        COUNT(DISTINCT j.hari) AS hari,
--        COUNT(DISTINCT j.nip)  AS guru
-- FROM   jadwal_versi v LEFT JOIN jadwal_guru j ON j.versi_id = v.id
-- GROUP  BY v.id, v.berlaku_mulai, v.jenis
-- ORDER  BY v.berlaku_mulai;
--
-- Harapan: 14 versi, 13 'penuh' + 1 'parsial' (2026-05-17),
--          dan tidak ada baris jadwal_guru dengan versi_id NULL:
-- SELECT COUNT(*) FROM jadwal_guru WHERE versi_id IS NULL;  -- harus 0
