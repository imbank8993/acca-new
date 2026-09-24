-- Migration: tambahkan tabel Guru Asuh & Catatan Siswa ke realtime badge sidebar
-- Date: 2026-08-28
--
-- Lanjutan dari 20260828_realtime_sidebar_badges.sql dan
-- 20260828_realtime_sidebar_badges_klinik.sql. Antrean baru di lib/sidebar-badges.ts:
--   guru-asuh-approval  -> laporan_guru_asuh_submissions (status 'Submitted')
--   wali-kelas-catatan  -> catatan_siswa (status 'BARU')
--
-- Berkas terpisah karena migrasi di proyek ini dijalankan manual lewat Dashboard
-- SQL Editor: yang sudah pernah dijalankan belum tentu dijalankan ulang.
--
-- CATATAN RLS: `postgres_changes` tunduk pada RLS milik klien yang berlangganan.
-- Kalau SELECT tabel ini tertutup untuk user biasa, event-nya tidak sampai ke
-- browser — badge tetap benar, hanya menyegar lewat polling / saat tab aktif.
--
-- Aman dijalankan berulang.

DO $$
DECLARE
    t text;
    tabel text[] := ARRAY[
        'laporan_guru_asuh_submissions',
        'catatan_siswa'
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
