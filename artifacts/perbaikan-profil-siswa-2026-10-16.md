# Tab Biodata Siswa — 16 Oktober 2026

Pemeriksaan agregat baca-saja pada database menemukan 218 akun berstatus siswa, semuanya aktif. Pencarian lama menggunakan `username || nip` dan cocok dengan 207 akun. Sebanyak 214 akun mempunyai NISN yang cocok melalui kolom identitas `nip`; 7 di antaranya gagal ditemukan karena username didahulukan. Empat akun lainnya belum mempunyai kecocokan melalui identitas akun maupun username. Tidak ada data pribadi, akun, atau master siswa yang diubah selama pemeriksaan.

## Penyebab

API GET dan PUT profil siswa memakai username sebagai NISN selama username tidak kosong. Username dapat disunting sendiri di halaman akun, sedangkan tautan NISN disimpan pada `users.nip` dan hanya dapat diubah admin. Akibatnya biodata dapat hilang sesudah username diganti; lebih serius, username yang sama dengan NISN siswa lain dapat mengarah ke biodata yang salah.

Antarmuka hanya membuat tab jika API mengembalikan data. Kegagalan permintaan atau master yang belum cocok membuat tab menghilang tanpa penjelasan. Akun yang sekaligus memiliki role GURU dan SISWA juga sebelumnya melewati permintaan biodata siswa.

## Perbaikan kode lokal

- GET dan PUT menggunakan identitas NISN terlindungi dari `nip`, dinormalisasi tanpa menghilangkan angka nol di depan. Username tidak dipakai untuk membuktikan kepemilikan. Input `nisn` atau `id` dari body tetap tidak dapat mengubah sasaran penyimpanan.
- Tab Biodata tetap tersedia untuk role SISWA saat memuat, belum tertaut, atau terjadi kegagalan. Pesan membedakan data belum cocok dan kegagalan permintaan, disertai tombol coba lagi.
- Pengambilan biodata siswa tetap dilakukan jika akun memiliki role tambahan. Permintaan dibatalkan/diabaikan saat identitas akun berubah sehingga hasil akun lama tidak mengganti biodata akun baru.
- Perubahan CSS profil yang sudah ada sebelum pekerjaan ini dipertahankan.

Empat akun yang belum cocok memerlukan pemeriksaan NISN dan master siswa oleh operator. Sistem tidak menautkan berdasarkan nama secara otomatis karena berisiko menghubungkan orang yang salah. Perbaikan kode perlu deployment sebelum berpengaruh pada situs produksi; tidak memerlukan migrasi database.

## Verifikasi

Delapan pengujian backend lulus, termasuk pencocokan GET/PUT, username berbeda dari NISN, angka nol di depan, tidak memakai username saat tautan terlindungi kosong, penolakan pengubahan identitas melalui body, serta validasi nomor HP. Pemeriksaan tipe API lulus.

Pengujian komponen profil nyata di Chrome dengan data tiruan lulus untuk tab saat memuat, data tertaut, tautan tidak ditemukan, kegagalan permintaan dan coba lagi, kombinasi role SISWA/GURU, serta respons lama setelah berganti akun. Tidak ada data siswa produksi digunakan pada pengujian browser.

Pemeriksaan tipe terfokus pada komponen profil beserta dependensinya lulus. Pemeriksaan seluruh frontend dihentikan karena berjalan lama; hasil pemeriksaan terfokus tidak dinyatakan sebagai kelulusan seluruh aplikasi. Pemeriksaan whitespace perubahan lulus.
