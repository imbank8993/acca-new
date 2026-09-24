-- Migration: tambahkan Keuangan Madrasah ke realtime badge sidebar
-- Date: 2026-08-28
--
-- Antrean baru di lib/sidebar-badges.ts, satu per peran dalam alur keuangan:
--   keuangan-ktu            -> status/report_status = 'Menunggu KTU'
--   keuangan-kepala-divisi  -> 'Menunggu Divisi', dibatasi divisi yang dipimpin
--   keuangan-ppk            -> 'Menunggu PPK'
--   keuangan-bendahara      -> 'Antrean Pencairan' / 'Dicairkan Sebagian'
--   keuangan-pj             -> milik pemohon: 'Menunggu Konfirmasi PJ',
--                              'Menunggu Laporan PJ', 'Revisi PJ'
--
-- Cukup satu tabel: kelima antrean membaca `budget_requests`, dan setiap
-- perpindahan tahap (persetujuan, pencairan, konfirmasi, verifikasi laporan)
-- selalu berakhir sebagai UPDATE pada baris itu.
--
-- Berkas terpisah karena migrasi di proyek ini dijalankan manual lewat Dashboard
-- SQL Editor: yang sudah pernah dijalankan belum tentu dijalankan ulang.
--
-- CATATAN RLS: RLS modul keuangan dikunci rapat, jadi event postgres_changes
-- kemungkinan besar TIDAK sampai ke browser dan badge akan menyegar lewat polling
-- 60 detik / saat tab kembali aktif. Angkanya tetap benar — pendaftaran ini hanya
-- supaya realtime bekerja bila policy SELECT-nya dilonggarkan di kemudian hari.
--
-- Aman dijalankan berulang.

DO $$
DECLARE
    t text;
    tabel text[] := ARRAY[
        'budget_requests'
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
