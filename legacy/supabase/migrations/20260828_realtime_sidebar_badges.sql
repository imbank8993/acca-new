-- Migration: aktifkan realtime untuk tabel antrean badge sidebar
-- Date: 2026-08-28
--
-- Badge di sidebar (lihat lib/sidebar-badges.ts) menghitung antrean yang menunggu
-- tindakan user. Angkanya dihitung di server; klien hanya perlu tahu KAPAN harus
-- menghitung ulang. Sinyal itu datang dari Postgres changes, dan itu hanya terkirim
-- untuk tabel yang terdaftar di publikasi `supabase_realtime`.
--
-- CATATAN PENTING soal RLS:
-- Langganan `postgres_changes` tunduk pada RLS milik klien yang berlangganan
-- (peran `authenticated`). Untuk tabel yang RLS-nya menutup SELECT bagi user biasa,
-- event-nya TIDAK akan sampai ke browser — badge tetap benar, hanya saja baru
-- menyegarkan diri lewat polling 60 detik / saat tab kembali aktif. Kalau sebuah
-- antrean terasa lambat berubah, periksa policy SELECT tabelnya lebih dulu.
--
-- Aman dijalankan berulang.

DO $$
DECLARE
    t text;
    tabel text[] := ARRAY[
        'tukar_jadwal_request',
        'jurnal_banding',
        'izin_guru',
        'log_kokurikuler_siswa'
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
