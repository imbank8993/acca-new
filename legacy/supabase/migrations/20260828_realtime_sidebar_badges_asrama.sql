-- Migration: tambahkan tabel antrean Keluar Asrama ke realtime badge sidebar
-- Date: 2026-08-28
--
-- Antrean baru di lib/sidebar-badges.ts:
--   ketidakhadiran-keluar-asrama -> baris SAKIT (Sedang/Berat/Kontrol) yang sudah
--   punya Rekomendasi Kontrol dari OP_UKS tapi Surat Izin Meninggalkan Asrama-nya
--   belum terbit.
--
-- Dua tabel didaftarkan karena angka itu berubah dari DUA arah: `ketidakhadiran`
-- saat barisnya masuk/dinonaktifkan, dan `acca_letters` saat suratnya terbit —
-- justru event acca_letters inilah yang menurunkan angkanya.
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
        'ketidakhadiran',
        'acca_letters'
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
