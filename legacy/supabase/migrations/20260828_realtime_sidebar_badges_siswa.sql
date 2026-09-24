-- Migration: tabel badge sisi siswa ke realtime sidebar
-- Date: 2026-08-28
--
-- Antrean baru di lib/sidebar-badges.ts:
--   tugas-siswa        -> tugas_siswa + tugas_siswa_checklist (antrean tindakan:
--                         turun saat siswa mencentang tugasnya selesai)
--   prestasi-validasi  -> prestasi_lomba, status_validasi = 'Menunggu'
--   prestasi-hasil     -> prestasi_lomba, hasil validasi yang belum dilihat siswa
--   nilai-siswa        -> nilai_data yang lebih baru dari penanda dilihat
--
-- `tugas_siswa_checklist` ikut didaftarkan karena angka tugas justru TURUN dari
-- sana — tanpa itu badge baru padam setelah polling 60 detik walau siswa sudah
-- mencentang.
--
-- Jalankan 20260828_sidebar_badge_reads.sql lebih dulu: dua antrean terakhir
-- membutuhkannya. Tanpa tabel itu keduanya diam (nol), tidak error.
--
-- Aman dijalankan berulang.

DO $$
DECLARE
    t text;
    tabel text[] := ARRAY[
        'tugas_siswa',
        'tugas_siswa_checklist',
        'prestasi_lomba',
        'nilai_data'
    ];
BEGIN
    FOREACH t IN ARRAY tabel LOOP
        -- Lewati tabel yang belum ada di instalasi ini.
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = t
        ) THEN
            RAISE NOTICE 'Lewati %: tabel tidak ditemukan', t;
            CONTINUE;
        END IF;

        -- Lewati kalau sudah terdaftar (ALTER PUBLICATION ... ADD akan error).
        IF EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = t
        ) THEN
            RAISE NOTICE 'Lewati %: sudah ada di publikasi', t;
            CONTINUE;
        END IF;

        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        RAISE NOTICE 'Ditambahkan ke realtime: %', t;
    END LOOP;
END $$;

-- Verifikasi:
-- SELECT tablename FROM pg_publication_tables
-- WHERE pubname = 'supabase_realtime' AND schemaname = 'public' ORDER BY tablename;
