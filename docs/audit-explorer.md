# Audit dan penjelajah data

Halaman `/audit-log` menyediakan tiga tab khusus **ADMIN / ADMINISTRATOR**:

1. **Log Audit**: pencarian pelaku, tindakan, tabel/modul dan ID data; detail kolom yang berubah serta nilai sebelum/sesudah.
2. **Tabel Data**: daftar tabel, nama/tipe kolom, primary key, status nullable, isi tabel dan detail baris. Tidak menyediakan perintah SQL atau operasi tulis.
3. **Dokumen**: folder dan file dari bucket Cloudflare R2 yang digunakan aplikasi, breadcrumb, tampilan daftar/ikon, pratinjau dan unduhan. Tidak menyediakan unggah, hapus atau pindah file. Pencarian nama berlaku pada halaman daftar yang sedang dimuat.

Otorisasi administrator diperiksa kembali di server. Hak membuka halaman saja tidak memberi akses ke seluruh tabel atau dokumen. Respons berisi data menggunakan `private, no-store`.

## Aktivasi pencatatan menyeluruh

Migrasi yang diperlukan: `apps/api/prisma/sql/20261022_system_audit.sql`.

Workflow deployment GitHub dan `scripts/deploy.sh` sudah menjalankan migrasi ini sebelum container aplikasi baru diaktifkan. Untuk instalasi manual, dari root proyek dengan `DATABASE_URL` server yang benar:

```sh
docker compose run --rm --no-deps acca-api node node_modules/prisma/build/index.js db execute --schema apps/api/prisma/schema.prisma --file apps/api/prisma/sql/20261022_system_audit.sql
```

Tanpa Docker, jalankan perintah Prisma yang sama dengan Node pada lingkungan server yang sudah memasang dependensi proyek. Perintah di atas adalah panduan deployment; menambahkan source tidak berarti migrasi sudah dijalankan di database.

Migrasi memasang trigger untuk `INSERT`, `UPDATE`, `DELETE` dan `TRUNCATE` pada tabel aplikasi dalam schema `public` dan `auth` di **database utama yang ditunjuk `DATABASE_URL`**. Setiap perubahan baris dan audit-nya tersimpan dalam transaksi yang sama. Jika pencatatan trigger gagal, perubahan data ikut dibatalkan. Pembaruan yang tidak mengubah nilai tidak menghasilkan catatan baru. Pengosongan seluruh tabel dicatat sebagai tindakan hapus dengan operasi `TRUNCATE`, tanpa menyalin seluruh isinya.

Identitas pengguna berasal dari sesi terverifikasi backend/web dan dikirim sebagai konteks lokal transaksi; konteks tidak terbawa ke pengguna berikutnya pada koneksi pool. Operasi batch dan transaksi aplikasi mempertahankan sifat atomiknya. Operasi langsung di database, pekerjaan latar belakang atau operasi internal tanpa sesi pengguna ditandai sebagai sistem/database. Audit lama dari modul tetap ditampilkan, sehingga satu tindakan dapat mempunyai catatan bisnis dan catatan perubahan baris.

Tabel `audit_logs`, `activity_logs`, `user_heartbeats`, dan `_prisma_migrations` dikecualikan untuk menghindari audit berulang dan pencatatan aktivitas teknis yang terus-menerus. Saat backend dimulai, pemasangan trigger diperiksa kembali untuk tabel baru. Tabel yang dibuat setelah aplikasi berjalan memerlukan pemanggilan ulang `SELECT public.acca_install_audit_triggers();` oleh pengelola database atau restart backend. Indikator cakupan di tab audit menampilkan apakah seluruh tabel yang termasuk cakupan sudah memiliki trigger aktif.

Pencatatan dimulai setelah migrasi aktif. Perubahan lama yang belum pernah dicatat tidak dapat dibuat ulang. Database lain, aplikasi eksternal yang memakai database lain, perubahan struktur tabel (DDL), dan perubahan objek R2 langsung melalui dashboard Cloudflare tidak otomatis menjadi audit perubahan baris database ini. Administrator database tetap dapat mengubah trigger/log; fitur ini bukan penyimpanan audit yang kebal terhadap administrator database.

## Pembatasan isi data

- Tabel schema `auth` hanya menampilkan struktur; nilai baris dan nilai sebelum/sesudah autentikasi disembunyikan.
- Kolom bernama password, token, secret, credential, API key dan pola serupa disamarkan, termasuk konfigurasi JSON yang disimpan sebagai teks.
- Penyaringan mengikuti nama kolom/kunci. Jangan menyimpan kredensial di kolom teks umum dengan nama yang tidak menjelaskan isinya.
- Nilai teks, kedalaman JSON dan panjang array dibatasi untuk menjaga ukuran tampilan/audit. Penjelajah ini bukan alat backup lengkap.
- Data dibaca per halaman dengan nama tabel yang divalidasi terhadap katalog database, identifier yang dikutip, transaksi hanya-baca, dan batas waktu query.

## Cloudflare R2

Tab dokumen memakai konfigurasi Cloudflare yang sama dengan utilitas penyimpanan aplikasi: variabel `CLOUDFLARE_R2_*` / `R2_*`, atau konfigurasi penyimpanan aktif dari database jika tidak memakai environment. Tidak ada kredensial yang dikirim ke browser. Bucket aktif ditelusuri langsung melalui `ListObjectsV2`, sehingga file yang belum terdaftar di `file_uploads` tetap terlihat. Fitur ini menelusuri satu bucket aktif, bukan seluruh bucket akun Cloudflare.

Kredensial server harus mengizinkan daftar dan pembacaan objek pada bucket tersebut. Pratinjau/unduhan melewati endpoint yang memeriksa ulang administrator; HTML dan berkas aktif lainnya diunduh sebagai lampiran. Folder virtual mengikuti awalan nama objek di R2.

## Referensi implementasi

- [PostgreSQL CREATE TRIGGER](https://www.postgresql.org/docs/current/sql-createtrigger.html)
- [PostgreSQL SET TRANSACTION](https://www.postgresql.org/docs/current/sql-set-transaction.html)
- [Prisma 6 transactions](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions)
- [Cloudflare R2 S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/)
