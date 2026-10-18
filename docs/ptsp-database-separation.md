# Database Layanan PTSP

Halaman Layanan PTSP ACCA menggunakan klien Prisma utama dan membaca/menulis tabel PTSP pada database `acca_db` dari `DATABASE_URL`. Aplikasi pengajuan PTSP juga terhubung ke database utama tersebut.

Pengaturan menu layanan dan pesan WhatsApp disimpan pada `site_settings` dengan key `ptsp_service_config`. Deployment memverifikasi keberadaan tabel PTSP dan `site_settings` pada database utama sebelum mengaktifkan aplikasi.

Dokumen dan lampiran tetap memakai storage yang dikonfigurasi aplikasi PTSP.
