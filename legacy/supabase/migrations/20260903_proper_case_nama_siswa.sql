-- =============================================================================
-- Ubah nama siswa dari HURUF BESAR SEMUA menjadi Kapital Di Awal Kata
--
-- Sumbernya: master_siswa.nama_lengkap. Nama siswa juga TERSALIN (denormalisasi)
-- ke kolom `nama_siswa` di beberapa tabel lain — siswa_kelas dan kawan-kawan —
-- jadi mengubah master saja akan menyisakan HURUF BESAR di layar yang membaca
-- salinan itu. Langkah 5 menyapu semuanya.
--
-- CARA PAKAI: jalankan per bagian di Supabase Dashboard > SQL Editor, JANGAN
-- sekaligus. Bagian 2 (pratinjau) dan 3 (cadangan) dijalankan dan DIPERIKSA
-- lebih dulu sebelum bagian 4 menyentuh data.
--
-- Tanggal: 2026-09-03
-- =============================================================================


-- =============================================================================
-- 1. FUNGSI PENGUBAH
-- =============================================================================
-- Sengaja BUKAN initcap() bawaan Postgres: initcap() mengapitalkan huruf setelah
-- SETIAP karakter non-alfanumerik, termasuk apostrof — "MA'RUF" jadi "Ma'Ruf".
-- Di sini hanya spasi dan tanda hubung yang memulai kata baru:
--
--   MUHAMMAD RIZKI      -> Muhammad Rizki
--   ABDUL MA'RUF        -> Abdul Ma'ruf      (initcap: Ma'Ruf  <- salah)
--   SITI AL-FARIZI      -> Siti Al-Farizi
--   A. RAHMAN           -> A. Rahman
--   Sudah Rapi          -> Sudah Rapi        (idempoten, aman diulang)
--
-- Spasi ganda dan spasi di tepi ikut dirapikan — itu kotoran khas data impor
-- dari Excel, dan membiarkannya berarti pencarian nama meleset tanpa sebab
-- yang terlihat.

CREATE OR REPLACE FUNCTION proper_case_nama(p_nama text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    s          text;
    hasil      text := '';
    ch         text;
    i          int;
    awal_kata  boolean := true;
BEGIN
    IF p_nama IS NULL THEN
        RETURN NULL;
    END IF;

    s := lower(btrim(regexp_replace(p_nama, '\s+', ' ', 'g')));

    FOR i IN 1..length(s) LOOP
        ch := substr(s, i, 1);

        IF awal_kata AND ch ~ '[[:alpha:]]' THEN
            hasil := hasil || upper(ch);
            awal_kata := false;
        ELSE
            hasil := hasil || ch;
        END IF;

        IF ch = ' ' OR ch = '-' THEN
            awal_kata := true;
        END IF;
    END LOOP;

    RETURN hasil;
END;
$$;


-- =============================================================================
-- 2. PRATINJAU — TIDAK mengubah apa pun. Jalankan dan PERIKSA dulu.
-- =============================================================================
-- Perhatikan khususnya baris yang mengandung apostrof, tanda hubung, gelar, atau
-- singkatan; itu tempat aturan kapitalisasi paling mungkin meleset.

SELECT
    nisn,
    nama_lengkap                        AS sebelum,
    proper_case_nama(nama_lengkap)      AS sesudah
FROM master_siswa
WHERE nama_lengkap IS DISTINCT FROM proper_case_nama(nama_lengkap)
ORDER BY nama_lengkap
LIMIT 200;

-- Berapa banyak yang akan berubah?
SELECT
    count(*)                                                                   AS total_siswa,
    count(*) FILTER (WHERE nama_lengkap = upper(nama_lengkap))                 AS huruf_besar_semua,
    count(*) FILTER (WHERE nama_lengkap IS DISTINCT FROM proper_case_nama(nama_lengkap)) AS akan_berubah
FROM master_siswa;


-- =============================================================================
-- 3. CADANGAN — WAJIB, jalankan sebelum bagian 4.
-- =============================================================================
-- Perubahan ini tidak bisa dibatalkan dengan menjalankan ulang fungsi apa pun:
-- kapitalisasi asli sudah hilang begitu ditimpa. Tabel ini satu-satunya jalan
-- pulang. Simpan; hapus hanya setelah Anda yakin hasilnya benar.

CREATE TABLE IF NOT EXISTS _backup_nama_siswa_20260903 AS
SELECT id, nisn, nama_lengkap, now() AS dicadangkan_pada
FROM master_siswa;

-- Pastikan isinya masuk sebelum lanjut.
SELECT count(*) AS baris_cadangan FROM _backup_nama_siswa_20260903;


-- =============================================================================
-- 4. UBAH SUMBERNYA
-- =============================================================================

UPDATE master_siswa
SET nama_lengkap = proper_case_nama(nama_lengkap)
WHERE nama_lengkap IS DISTINCT FROM proper_case_nama(nama_lengkap);


-- =============================================================================
-- 5. SELARASKAN SALINAN NAMA DI TABEL LAIN
-- =============================================================================
-- Ditulis dinamis, bukan daftar tabel yang dituliskan satu per satu, karena
-- skema live di proyek ini TIDAK selalu sama dengan berkas migrasi
-- (mis. siswa_kelas.nama_siswa tidak pernah muncul di migrasi mana pun).
-- Yang disapu: setiap tabel di schema public yang punya kolom `nama_siswa`
-- DAN kolom kunci ke siswa — `nisn` ATAU `nisn_siswa`.
--
-- Dua nama kolom kunci, bukan satu: `guru_asuh` memakai `nisn_siswa`, dan versi
-- pertama blok ini yang hanya mencari `nisn` melewatkannya diam-diam — 289
-- barisnya tetap HURUF BESAR sampai ketahuan dari laporan bagian 6(c).
--
-- Nilainya diambil ulang dari master_siswa lewat kunci itu, bukan sekadar
-- di-proper_case di tempat: kalau ada salinan yang sudah melenceng dari master
-- (nama berubah setelah disalin), cara ini sekalian meluruskannya.

DO $$
DECLARE
    t          record;
    jml        bigint;
    total      bigint := 0;
BEGIN
    FOR t IN
        SELECT c.table_name,
               (SELECT c2.column_name
                  FROM information_schema.columns c2
                 WHERE c2.table_schema = 'public'
                   AND c2.table_name   = c.table_name
                   AND c2.column_name IN ('nisn', 'nisn_siswa')
                 ORDER BY c2.column_name = 'nisn' DESC
                 LIMIT 1) AS kol_kunci
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.column_name  = 'nama_siswa'
        ORDER BY c.table_name
    LOOP
        IF t.kol_kunci IS NULL THEN
            RAISE NOTICE '%: DILEWATI, tidak punya nisn/nisn_siswa', t.table_name;
            CONTINUE;
        END IF;

        EXECUTE format(
            'UPDATE public.%I t
                SET nama_siswa = m.nama_lengkap
               FROM public.master_siswa m
              WHERE t.%I = m.nisn
                AND t.nama_siswa IS DISTINCT FROM m.nama_lengkap',
            t.table_name, t.kol_kunci
        );
        GET DIAGNOSTICS jml = ROW_COUNT;
        total := total + jml;
        RAISE NOTICE '%: % baris diselaraskan (kunci: %)', t.table_name, jml, t.kol_kunci;
    END LOOP;

    RAISE NOTICE 'Total salinan diselaraskan: %', total;
END;
$$;


-- Sisa baris yang kunci siswanya tidak cocok dengan master (siswa sudah dihapus,
-- atau nisn salah ketik): tidak ada rujukan untuk diambil, jadi kapitalisasinya
-- dirapikan di tempat. Baris yang sudah selaras dengan master tidak tersentuh —
-- nama di master sudah melewati fungsi yang sama, jadi hasilnya identik.
DO $$
DECLARE
    t     record;
    jml   bigint;
BEGIN
    FOR t IN
        SELECT c.table_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.column_name  = 'nama_siswa'
        ORDER BY c.table_name
    LOOP
        EXECUTE format(
            'UPDATE public.%I
                SET nama_siswa = proper_case_nama(nama_siswa)
              WHERE nama_siswa IS DISTINCT FROM proper_case_nama(nama_siswa)',
            t.table_name
        );
        GET DIAGNOSTICS jml = ROW_COUNT;
        IF jml > 0 THEN
            RAISE NOTICE '%: % baris dirapikan tanpa rujukan master', t.table_name, jml;
        END IF;
    END LOOP;
END;
$$;


-- =============================================================================
-- 6. VERIFIKASI
-- =============================================================================

-- (a) Tidak boleh ada sisa nama HURUF BESAR SEMUA di master.
--     Nama satu huruf ("A") dikecualikan karena huruf besar memang benar.
SELECT nisn, nama_lengkap
FROM master_siswa
WHERE nama_lengkap = upper(nama_lengkap)
  AND nama_lengkap ~ '[[:alpha:]]{2,}'
ORDER BY nama_lengkap;

-- (b) Salinan yang masih beda dari master (harusnya kosong).
SELECT 'siswa_kelas' AS tabel, sk.nisn, sk.nama_siswa AS salinan, m.nama_lengkap AS master
FROM siswa_kelas sk
JOIN master_siswa m ON m.nisn = sk.nisn
WHERE sk.nama_siswa IS DISTINCT FROM m.nama_lengkap
LIMIT 50;

-- (c) Sisa HURUF BESAR di SEMUA tabel yang punya kolom nama_siswa.
--     Ini pengganti laporan "tabel tanpa nisn" versi sebelumnya: yang penting
--     bukan tabel mana yang tidak punya kunci, melainkan apakah masih ada nama
--     yang belum berubah. Hasil kosong = beres.
DO $$
DECLARE
    t    record;
    jml  bigint;
BEGIN
    FOR t IN
        SELECT c.table_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.column_name  = 'nama_siswa'
        ORDER BY c.table_name
    LOOP
        EXECUTE format(
            'SELECT count(*) FROM public.%I
              WHERE nama_siswa = upper(nama_siswa)
                AND nama_siswa ~ ''[[:alpha:]]{2,}''',
            t.table_name
        ) INTO jml;
        RAISE NOTICE '%: % nama masih HURUF BESAR', t.table_name, jml;
    END LOOP;
END;
$$;


-- =============================================================================
-- 7. OPSIONAL — nama orang tua
-- =============================================================================
-- TIDAK dijalankan otomatis: Anda meminta nama siswa, dan nama ayah/ibu adalah
-- data orang lain. Hilangkan komentar hanya kalau memang diinginkan.
--
-- UPDATE master_siswa
-- SET nama_ayah = proper_case_nama(nama_ayah),
--     nama_ibu  = proper_case_nama(nama_ibu)
-- WHERE nama_ayah IS DISTINCT FROM proper_case_nama(nama_ayah)
--    OR nama_ibu  IS DISTINCT FROM proper_case_nama(nama_ibu);


-- =============================================================================
-- 8. PEMBATALAN (kalau hasilnya tidak sesuai)
-- =============================================================================
-- Kembalikan dari cadangan, lalu jalankan ULANG bagian 5 supaya salinannya
-- ikut kembali.
--
-- UPDATE master_siswa m
-- SET nama_lengkap = b.nama_lengkap
-- FROM _backup_nama_siswa_20260903 b
-- WHERE b.nisn = m.nisn
--   AND m.nama_lengkap IS DISTINCT FROM b.nama_lengkap;
