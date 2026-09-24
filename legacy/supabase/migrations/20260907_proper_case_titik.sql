-- =============================================================================
-- Perbaikan proper_case_nama: titik juga memulai kata baru
--
-- Versi di 20260903_proper_case_nama_siswa.sql hanya menganggap SPASI dan TANDA
-- HUBUNG sebagai awal kata. Titik tidak termasuk, sehingga singkatan yang
-- ditulis rapat kehilangan kapitalnya:
--
--   M.ALIF        -> M.alif      SALAH   (seharusnya M.Alif)
--   MUH.ZAKY      -> Muh.zaky    SALAH   (seharusnya Muh.Zaky)
--   M. AGUS       -> M. Agus     benar   (titik diikuti spasi, sudah tertangani)
--
-- Titik yang diikuti spasi tidak berubah perilakunya: spasi sudah memulai kata
-- baru, jadi menambah titik sebagai pemicu hanya menyetel penanda yang sama dua
-- kali berturut-turut.
--
-- Apostrof TETAP bukan pemicu — "ABDUL MA'RUF" harus jadi "Abdul Ma'ruf",
-- bukan "Ma'Ruf". Itu alasan fungsi ini ada, menggantikan initcap() bawaan.
--
-- AMAN DIJALANKAN ULANG di atas data yang sudah terlanjur diubah: fungsi ini
-- me-lowercase seluruh nama lebih dulu, jadi "M.alif" pun akan diperbaiki
-- menjadi "M.Alif". Cadangan dari migrasi 20260903 (_backup_nama_siswa_20260903)
-- tetap menjadi satu-satunya jalan pulang ke kapitalisasi ASLI.
--
-- CARA PAKAI: jalankan per bagian, JANGAN sekaligus. Periksa bagian 2 dulu.
--
-- Tanggal: 2026-09-07
-- =============================================================================


-- =============================================================================
-- 1. FUNGSI YANG DIPERBAIKI
-- =============================================================================

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

        -- Titik ditambahkan di sini; spasi & tanda hubung seperti semula.
        -- Apostrof sengaja TIDAK ikut (lihat catatan di kepala berkas).
        IF ch = ' ' OR ch = '-' OR ch = '.' THEN
            awal_kata := true;
        END IF;
    END LOOP;

    RETURN hasil;
END;
$$;


-- =============================================================================
-- 2. PRATINJAU — TIDAK mengubah apa pun. Jalankan dan PERIKSA dulu.
-- =============================================================================
-- Daftarnya seharusnya pendek dan seluruhnya berisi nama bertitik rapat.
-- Kalau ada nama TANPA titik yang muncul di sini, berhenti dan periksa —
-- artinya ada yang tak terduga.

SELECT
    nisn,
    nama_lengkap                   AS sebelum,
    proper_case_nama(nama_lengkap) AS sesudah
FROM master_siswa
WHERE nama_lengkap IS DISTINCT FROM proper_case_nama(nama_lengkap)
ORDER BY nama_lengkap;


-- =============================================================================
-- 3. UBAH SUMBERNYA
-- =============================================================================

UPDATE master_siswa
SET nama_lengkap = proper_case_nama(nama_lengkap)
WHERE nama_lengkap IS DISTINCT FROM proper_case_nama(nama_lengkap);


-- =============================================================================
-- 4. SELARASKAN SALINAN NAMA DI TABEL LAIN
-- =============================================================================
-- Sama persis dengan bagian 5 migrasi 20260903 — nama siswa tersalin ke kolom
-- `nama_siswa` di banyak tabel, dan memperbaiki master saja akan menyisakan
-- ejaan lama di layar yang membaca salinan itu.
--
-- Ditulis dinamis karena skema live TIDAK selalu sama dengan berkas migrasi.
-- Dua nama kolom kunci: `nisn` dan `nisn_siswa` (dipakai guru_asuh).

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
        IF jml > 0 THEN
            RAISE NOTICE '%: % baris diselaraskan (kunci: %)', t.table_name, jml, t.kol_kunci;
        END IF;
    END LOOP;

    RAISE NOTICE 'Total salinan diselaraskan: %', total;
END;
$$;


-- Baris yang kunci siswanya tidak cocok dengan master (siswa sudah dihapus atau
-- nisn salah ketik): tidak ada rujukan untuk diambil, jadi dirapikan di tempat.
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
-- 5. VERIFIKASI — ketiganya harus kosong / nol
-- =============================================================================

-- (a) Tidak boleh ada titik yang langsung diikuti huruf kecil.
SELECT nisn, nama_lengkap
FROM master_siswa
WHERE nama_lengkap ~ '\.[[:lower:]]'
ORDER BY nama_lengkap;

-- (b) Tidak ada lagi yang tersisa untuk diubah (fungsi sudah idempoten).
SELECT count(*) AS masih_perlu_diubah
FROM master_siswa
WHERE nama_lengkap IS DISTINCT FROM proper_case_nama(nama_lengkap);

-- (c) Salinan yang masih beda dari master.
SELECT 'siswa_kelas' AS tabel, sk.nisn, sk.nama_siswa AS salinan, m.nama_lengkap AS master
FROM siswa_kelas sk
JOIN master_siswa m ON m.nisn = sk.nisn
WHERE sk.nama_siswa IS DISTINCT FROM m.nama_lengkap
LIMIT 50;
