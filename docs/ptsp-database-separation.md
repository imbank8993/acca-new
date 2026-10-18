# Pemisahan Database PTSP

## Cakupan

- Backend dashboard ACCA membaca, memperbarui, dan menghapus tabel PTSP melalui koneksi Prisma khusus `PTSP_DATABASE_URL`.
- Koneksi utama `DATABASE_URL` tetap digunakan modul ACCA lainnya.
- URL dokumen pada record tetap menunjuk ke storage yang sekarang; endpoint penghapusan file di web tidak dialihkan.
- Form permohonan PTSP dijalankan aplikasi eksternal. Aplikasi itu harus diarahkan ke proyek database PTSP yang sama sebelum atau bersamaan dengan dashboard ACCA.

## Variabel lingkungan

Atur pada `.env` server di VPS, jangan commit ke Git:

- `PTSP_DATABASE_URL`: transaction pooler Supabase port 6543 untuk aplikasi Prisma, dengan `pgbouncer=true`.
- `PTSP_DIRECT_URL`: session pooler Supabase port 5432 untuk operasi schema Prisma. Gunakan host dan username persis dari Supabase Connect.

Jangan gunakan URL Supabase atau API key untuk kedua variabel tersebut. URL harus berupa PostgreSQL connection string. Encode karakter khusus password sebagai percent encoding.

## Persiapan sebelum mengaktifkan

1. Pastikan URL berasal dari proyek Supabase khusus PTSP, bukan proyek Storage lama.
2. Pastikan 14 tabel pada `apps/api/prisma/ptsp-schema.prisma` beserta tipe kolomnya cocok dengan tabel di database tujuan.
3. Arahkan aplikasi input eksternal ke proyek database PTSP yang sama. Pastikan file upload tetap memakai storage yang dimaksud.
4. Jalankan build dan typecheck pada lingkungan yang dapat mengunduh Prisma engine.
5. Siapkan salinan cadangan dan rencana pemindahan data lama bila record lama perlu dipertahankan.
6. Setelah perubahan kode masuk ke branch `main`, workflow deploy membaca `.env` VPS dan berhenti bila URL PTSP belum tersedia.

Pipeline tidak menjalankan migrasi otomatis terhadap database PTSP. Tabel tujuan sudah dibuat; lakukan inspeksi schema read-only terlebih dahulu dan jangan menjalankan `db push` tanpa review.
