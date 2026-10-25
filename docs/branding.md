# Logo aplikasi ACCA

Logo aplikasi memakai tiga sumber pada `apps/web/branding.config.json`:

- `symbol`: lambang biru transparan, saat ini `public/logo-sidebar-kecil.png`.
- `wordmark`: logo lengkap untuk latar terang, saat ini `public/logo-sidebar.png`.
- `wordmarkDark`: logo lengkap untuk latar gelap, saat ini `public/logo-sidebar-dark.png`.

Untuk memperbarui logo, ganti gambar sumber yang sesuai, lalu jalankan dari root repository:

```sh
npm run branding:sync --workspace=apps/web
```

Proses tersebut menyamakan ikon lama, favicon Next.js, ikon pemasangan aplikasi, gambar pratinjau tautan, dan logo yang ditanam dalam gambar laporan WhatsApp. Build frontend juga menjalankannya otomatis. `lib/branding.ts` dan `lib/branding-logo.ts` adalah hasil proses ini; jangan diedit langsung. Komponen memakai `APP_BRAND` agar alamat logo konsisten. Logo sekolah pada kop surat tetap mengikuti profil sekolah.

Nama berkas ikon dan gambar pratinjau memuat hash gambar sumber. Mengganti logo menghasilkan alamat baru untuk membedakan gambar yang tersimpan di cache. Setelah deploy, uji tautan dengan pesan baru; pratinjau pesan WhatsApp yang sudah terkirim dapat tetap memakai gambar sebelumnya. Foto profil akun/grup WhatsApp merupakan pengaturan WhatsApp tersendiri.

Halaman `/info-link/[token]` memakai metadata Open Graph generik agar judul/isi informasi bertoken tidak ditambahkan ke metadata publik.
