-- =============================================================================
-- Keuangan — urutan verifikasi diubah: KTU lebih dulu, baru Kepala Divisi.
--
-- Alur LAMA : Ajukan -> Kepala Divisi -> KTU -> PPK -> Bendahara
-- Alur BARU : Ajukan -> KTU -> Kepala Divisi -> PPK -> Bendahara
--   (divisi TU melewati tahap Kepala Divisi: Ajukan -> KTU -> PPK -> Bendahara)
--
-- Nama status TIDAK berubah ('Menunggu KTU' / 'Menunggu Divisi'), hanya urutannya.
-- Karena itu tidak ada perubahan skema — yang perlu ditangani hanya DATA BERJALAN.
--
-- MASALAHNYA: baris yang saat ini berstatus 'Menunggu Divisi' dibuat oleh alur
-- lama, artinya KTU BELUM memverifikasi. Kalau dibiarkan, aplikasi versi baru
-- akan meneruskannya dari Kepala Divisi langsung ke PPK sehingga tahap KTU
-- terlewat sama sekali.
--
-- Skrip ini mengembalikan baris tersebut ke 'Menunggu KTU' supaya mengikuti
-- urutan baru dari awal. Pengajuan yang Kepala Divisi-nya sudah menyetujui
-- (sudah ada di 'Menunggu PPK' atau lebih jauh) TIDAK disentuh.
--
-- Jalankan manual lewat Supabase Dashboard > SQL Editor.
-- =============================================================================

BEGIN;

-- 1) Tinjau dulu — jalankan SELECT ini sebelum UPDATE untuk melihat dampaknya.
--    (Baris yang akan diubah; pastikan jumlahnya masuk akal.)
-- SELECT id, request_number, status, division_id, created_at
-- FROM budget_requests
-- WHERE status = 'Menunggu Divisi'
-- ORDER BY created_at;

-- 2) Pengajuan yang masih menunggu Kepala Divisi dikembalikan ke antrean KTU.
UPDATE budget_requests
SET status = 'Menunggu KTU'
WHERE status = 'Menunggu Divisi';

-- 3) Hal yang sama untuk alur verifikasi LAPORAN.
UPDATE budget_requests
SET report_status = 'Menunggu KTU'
WHERE report_status = 'Menunggu Divisi';

COMMIT;

-- Catatan: approval_logs sengaja tidak diubah. Log adalah jejak historis apa
-- yang benar-benar terjadi; kalau ada pengajuan yang sempat di-ACC Kepala Divisi
-- di bawah alur lama, log itu tetap tercatat dan tampil di timeline.
