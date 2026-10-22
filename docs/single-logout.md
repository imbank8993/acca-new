# Logout bersama ACCA

Keluar melalui menu akun ACCA menutup sesi pada browser/profil browser yang sama di ACCA, ACCA CBT, ACCA Tools, dan WordPress. Perangkat atau profil browser lain tidak diubah.

## Perubahan aplikasi

- ACCA: tombol logout mengambil daftar tujuan melalui `POST /api/auth/logout?phase=prepare` tanpa menghapus sesi. Setelah seluruh permintaan aplikasi pendamping selesai atau gagal, `POST /api/auth/logout` menghapus sesi ACCA dan menerbitkan penanda untuk tab lain. Jika ada kegagalan, nama aplikasi ditampilkan dan pengguna dapat mencoba lagi. Semua permintaan menggunakan `keepalive` agar permintaan yang sudah dikirim dapat tetap berjalan ketika halaman berpindah.
- CBT: endpoint `POST /api/auth/single-logout` menghapus cookie sesi normal maupun `__Host-cbt_session`.
- Tools: endpoint `POST /auth/single-logout` menghapus sesi Flask.
- WordPress: plugin pendamping menjalankan [`wp_logout()`](https://developer.wordpress.org/reference/functions/wp_logout/), yang mengakhiri sesi WordPress saat ini dan menghapus cookie autentikasinya.
- Tab yang sudah terbuka memantau penanda publik `acca_logout_at` pada domain `icgowa.sch.id`. Penanda ini tidak berisi identitas, token, atau hak akses. Tab yang sedang menjalankan logout bersama tetap menampilkan hasilnya; tab lain diarahkan ke login.

Cookie autentikasi tetap terbatas pada masing-masing aplikasi. Permintaan logout antar aplikasi menggunakan cookie tujuan melalui browser, sehingga sesi browser tersebut yang ditutup. Endpoint pendamping hanya menerima `POST` dari origin ACCA yang dikonfigurasi; permintaan tanpa Origin atau dari situs lain ditolak. CORS memakai origin spesifik dan credentials, sesuai [aturan browser](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS).

## Aktivasi

1. Terapkan perubahan ACCA New.
2. Terapkan perubahan autentikasi/logout pada ACCA CBT dan ACCA Tools. Source pada folder yang diberikan sudah diperbarui; salinan patch tersedia di `integrations/single-logout/` untuk perangkat lain. Jangan menerapkan patch dua kali pada checkout yang sama.
3. Pada perangkat yang mengelola WordPress, buka **Plugin → Tambah Plugin → Unggah Plugin**, pilih `integrations/wordpress/acca-single-logout.zip`, lalu **Pasang** dan **Aktifkan**. Plugin ini mendampingi plugin SSO yang sudah ada.
4. Periksa URL production:

   - ACCA: `https://acca.icgowa.sch.id`
   - CBT: `CBT_URL` atau `NEXT_PUBLIC_CBT_URL`, default `https://acca-cbt.icgowa.sch.id`
   - Tools: `NEXT_PUBLIC_TOOLS_URL`, default `https://acca-tools.icgowa.sch.id`
   - WordPress: `WP_SINGLE_LOGOUT_URL`, default `https://icgowa.sch.id/?acca_single_logout=1`

5. Di CBT, `NEXT_PUBLIC_ACCA_URL` harus menunjuk ke origin ACCA. Di Tools gunakan `ACCA_APP_URL`. Keduanya sudah memiliki default `https://acca.icgowa.sch.id`.

Tidak dibutuhkan secret atau migrasi database baru. Logout bersama aktif otomatis pada production. Gunakan `SINGLE_LOGOUT_ENABLED=true` untuk pengujian lokal dengan URL pendamping yang sesuai. Integrasi yang dinonaktifkan dilaporkan sebagai logout yang belum lengkap.

Pada localhost, gunakan aplikasi pendamping lokal dengan skema yang sama (misalnya ACCA `http://localhost:3006` dan CBT `http://localhost:3008`). Cookie `SameSite=Lax` milik situs production tidak dikirim oleh browser melalui fetch dari localhost. ACCA mendeteksi perbedaan situs ini dan melaporkannya sebagai sesi yang belum ditutup, meskipun endpoint anonim mungkin menjawab `ok`. Untuk menutup seluruh sesi production, jalankan logout dari `https://acca.icgowa.sch.id` dan pastikan semua endpoint pendamping sudah terpasang.

Jika origin ACCA diganti, tambahkan pada `wp-config.php` sebelum baris penutup konfigurasi:

```php
define('ACCA_SINGLE_LOGOUT_ORIGIN', 'https://acca.icgowa.sch.id');
```

Untuk WordPress dalam subdirektori, sesuaikan `WP_SINGLE_LOGOUT_URL` ke URL instalasi WordPress tersebut dengan parameter `acca_single_logout=1`.

## Batasan

- Seluruh aplikasi tetap perlu diperbarui di server, dan plugin WordPress perlu diaktifkan. Hingga itu selesai, ACCA menampilkan kegagalan logout pada aplikasi yang belum mendukung endpoint baru.
- Pemantauan tab bekerja dalam beberapa detik ketika tab aktif; browser dapat menunda interval pada tab latar belakang. Fokus/aktivasi tab juga memicu pemeriksaan.
- Ini menghapus sesi browser yang sedang digunakan; token yang disalin secara terpisah dan sesi pada perangkat lain tidak dicabut oleh fitur ini.
- Permintaan lintas situs ditandai gagal karena cookie `SameSite=Lax` tujuan tidak ikut dikirim. Notifikasi tab lewat cookie domain bersama hanya tersedia pada `icgowa.sch.id` dan subdomainnya.

## Verifikasi production 23 Oktober 2026

Pemeriksaan tanpa cookie pengguna terhadap endpoint production menunjukkan ACCA mengembalikan ketiga URL yang benar, seluruh endpoint pendamping menerima `Origin: https://acca.icgowa.sch.id`, dan setiap endpoint mengirim header penghapusan cookie sesi. Plugin WordPress sudah aktif. Ini membuktikan endpoint terpasang, bukan membuktikan sesi browser pengguna sudah dicabut. Uji akhir perlu dilakukan setelah perubahan ACCA diterapkan: login ke keempat aplikasi, logout ACCA, lalu muat ulang halaman terlindungi masing-masing aplikasi pada profil browser yang sama.
