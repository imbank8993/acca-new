-- Migration: perbarui komentar kolom is_kontinu / seri_id
-- Created: 2026-09-02
--
-- OPSIONAL — hanya memperbarui dokumentasi kolom, tidak mengubah data,
-- struktur, index, maupun constraint. Aman dijalankan kapan saja.
--
-- Latar: sejak entri kontinu disimpan sebagai SATU baris rentang penuh
-- (lihat lib/ketidakhadiran-seri.ts), komentar lama yang berbunyi "baris ini
-- bagian dari entri kontinu ... hari pertama/terakhir memakai jam sebelah"
-- sudah tidak menggambarkan bentuk datanya.

COMMENT ON COLUMN ketidakhadiran.is_kontinu IS
  'TRUE bila baris ini satu rentang izin/sakit tanpa putus lintas hari: tgl_mulai s.d. tgl_selesai adalah rentang penuh, dan waktu_mulai_real/waktu_selesai_real adalah batas awal & akhir rentang (bukan jam yang berulang tiap hari). Penjabaran per hari dilakukan saat membaca lewat entryTimeWindowForDate() di lib/ketidakhadiran-jp.ts. Data lama bisa masih berbentuk satu baris per tanggal dengan jam sebelah — rapikan dengan merge-ketidakhadiran-kontinu.js.';

COMMENT ON COLUMN ketidakhadiran.seri_id IS
  'Pengikat baris-baris satu entri multi-hari untuk satu siswa. Mode "Berulang Setiap Hari" tetap satu baris per tanggal sehingga seri berisi banyak baris; mode kontinu kini hanya satu baris per seri.';
