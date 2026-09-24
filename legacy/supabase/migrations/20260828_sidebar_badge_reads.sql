-- Migration: penanda "sudah dilihat" untuk badge sidebar yang bersifat kabar baru
-- Date: 2026-08-28
--
-- LATAR BELAKANG
-- Hampir semua badge di lib/sidebar-badges.ts adalah ANTREAN TINDAKAN: angkanya
-- turun karena pemiliknya mengerjakan sesuatu, jadi tidak butuh status baca.
--
-- Dua badge milik siswa tidak begitu:
--   nilai-siswa     — nilai baru masuk
--   prestasi-hasil  — pengajuan prestasinya disetujui/ditolak
-- Siswa tidak bisa "mengerjakan" keduanya. Tanpa penanda dibaca, angkanya akan
-- menempel selamanya. Tabel ini menyimpan KAPAN siswa terakhir membuka halaman
-- terkait; yang dihitung hanyalah baris yang lebih baru dari waktu itu.
--
-- Satu baris per (user, antrean) — bukan penanda per baris data — supaya membuka
-- halaman cukup satu UPDATE, bukan menulis ke ratusan baris nilai.
--
-- CATATAN saat pertama kali dipakai: kalau seorang siswa belum punya baris di
-- sini, lib/sidebar-badges.ts menyemainya ke waktu SEKARANG dan menghitung nol.
-- Ini disengaja — tanpa itu, siswa lama akan disambut badge berisi seluruh
-- riwayat nilainya pada login pertama setelah fitur ini aktif.
--
-- Aman dijalankan berulang.

CREATE TABLE IF NOT EXISTS sidebar_badge_reads (
    user_id      BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Kunci antrean di lib/sidebar-badges.ts, mis. 'nilai-siswa'.
    queue_key    VARCHAR(64) NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, queue_key)
);

COMMENT ON TABLE sidebar_badge_reads IS
    'Kapan seorang user terakhir membuka halaman sebuah antrean badge sidebar. Hanya untuk badge bertipe kabar baru (nilai-siswa, prestasi-hasil), bukan antrean tindakan.';

-- Ditulis lewat service role dari /api/sidebar-badges/seen, tidak pernah
-- langsung dari browser — jadi RLS dikunci penuh (tanpa policy = tertutup).
ALTER TABLE sidebar_badge_reads ENABLE ROW LEVEL SECURITY;
