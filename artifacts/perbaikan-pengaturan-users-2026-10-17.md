# Perbaikan Pengaturan Users — 17 Oktober 2026

- Penautan akun hanya menerima permintaan idempotent untuk akun sendiri. Penautan identitas lain ditolak.
- Login akun lama tanpa kredensial tidak lagi membuat kredensial dari password sembarang. Admin dapat menyiapkan akun melalui reset password.
- Penggantian password sendiri mewajibkan password saat ini. Profil dan kredensial diperbarui dalam satu transaksi.
- Perubahan/reset password mengganti versi sesi, membatalkan token lama, dan menghapus token pemulihan yang tertunda. Reset pemulihan memakai pemeriksaan token bersyarat agar tautan tidak dapat dipakai ulang.
- Identitas JWT ditentukan oleh subject, bukan pencocokan gabungan dengan email yang bisa berubah.
- Pemeriksaan sesi online diterapkan pada handler web yang mengakses data atau menerbitkan SSO; pemeriksaan tanda tangan offline hanya dipakai untuk navigasi middleware.
- Perubahan status/role/penghapusan akun memakai penguncian transaksi yang sama. Admin tanpa kredensial tidak dihitung sebagai cadangan admin yang bisa login.
- Endpoint perubahan role memvalidasi katalog role, jenis aksi, dan mencegah daftar role kosong.
- Pembuatan, perubahan, penghapusan, provisioning kredensial, serta reset oleh admin menggunakan transaksi sehingga kegagalan membatalkan seluruh perubahan terkait.

## Validasi

- 30 pengujian keamanan dan regresi sesi lulus: `node --test apps/api/test/user-settings-security.test.cjs apps/api/test/auth-session.test.cjs`.
- Pemeriksaan tipe kode backend terkait dan dependensinya lulus.
- Formulir ganti password diuji pada browser: password saat ini wajib dan dikirim dengan benar.
- Penguncian transaksi diuji menggunakan dua koneksi PostgreSQL; koneksi kedua menunggu sampai transaksi pertama melepas kunci.
- Pemeriksaan agregat database menemukan 0 kelompok kredensial yang ditautkan ke beberapa akun.
- Tidak ada akun atau password asli yang diubah selama pengujian. Tidak memerlukan migrasi tabel; versi sesi menggunakan metadata autentikasi yang sudah tersedia.
