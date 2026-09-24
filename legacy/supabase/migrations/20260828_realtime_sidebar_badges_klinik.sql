-- Migration: tambahkan tabel Klinik Pembelajaran ke realtime badge sidebar
-- Date: 2026-08-28
--
-- Lanjutan dari 20260828_realtime_sidebar_badges.sql. Antrean klinik (lihat
-- lib/sidebar-badges.ts: klinik-kesediaan-guru, klinik-review-sesi,
-- klinik-review-laporan) membaca `klinik_slots` dan `klinik_laporan`, jadi kedua
-- tabel itu perlu ikut publikasi `supabase_realtime` supaya badge menyegarkan
-- diri seketika, bukan menunggu polling 60 detik.
--
-- Berkas terpisah (bukan menyunting migrasi sebelumnya) karena migrasi di proyek
-- ini dijalankan manual lewat Dashboard SQL Editor: yang sudah pernah dijalankan
-- belum tentu dijalankan ulang.
--
-- CATATAN RLS: `postgres_changes` tunduk pada RLS milik klien yang berlangganan.
-- Kalau SELECT klinik_* tertutup untuk user biasa, event-nya tidak sampai ke
-- browser — badge tetap benar, hanya menyegarkan lewat polling / saat tab aktif.
--
-- Aman dijalankan berulang.

DO $$
DECLARE
    t text;
    tabel text[] := ARRAY[
        'klinik_slots',
        'klinik_laporan'
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
