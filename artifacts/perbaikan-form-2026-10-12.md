# Perbaikan halaman Form — 12 Oktober 2026

Seluruh temuan F01–F16 dalam audit telah ditangani pada kode lokal. Cakupan mencakup dashboard, builder, pengisian, tanggapan, seleksi, unggahan, ekspor, API, dan skema identitas database. Migrasi identitas berhasil dijalankan pada 13 Oktober 2026; kode aplikasi belum dideploy dalam pekerjaan ini.

## Hasil perbaikan

| Temuan | Perbaikan |
| --- | --- |
| F01 | Izin responden dipisahkan dari izin pengelola. Pembacaan, penghapusan, perhitungan skor, dan seleksi memerlukan peran serta kepemilikan yang sah di server. |
| F02 | Form privat wajib memiliki sesi sah; token tidak sah ditolak, bukan dianggap pengunjung anonim. |
| F03 | Jawaban di dialog hapus di-escape sehingga tidak menjalankan HTML atau skrip. |
| F04 | Validasi jawaban berdasarkan schema, field terlihat, pilihan sah, batas angka, dan tipe. Skor pilihan tunggal tidak menerima array; checkbox dideduplikasi. Bobot skor tidak diberikan kepada responden. |
| F05 | Sumber opsi dinamis hanya tersedia untuk pengelola; NIP tidak dikirim sebagai data opsi. |
| F06 | Navbar hanya memuat metadata form publik aktif, tanpa membuka schema privat. |
| F07 | Pembuatan dan pengelolaan form diperiksa berdasarkan peran di server. |
| F08 | Pembatasan satu tanggapan mewajibkan login dan diperiksa dalam transaksi dengan penguncian berdasarkan ID form kanonis. |
| F09 | Disiapkan migrasi kolom pemilik/responden menjadi teks agar menerima identitas aplikasi maupun UUID lama. |
| F10 | Penghapusan form/tanggapan dan perhitungan skor dilakukan secara atomik. |
| F11 | File benar-benar diunggah; ukuran, jenis, signature, registrasi, kepemilikan, serta cakupan form/field diperiksa. File yang gagal diunggah tidak diterima sebagai jawaban. |
| F12 | Sumber kelas/mapel dan penanganan kegagalan pengambilan opsi diperbaiki. |
| F13 | Jawaban baru menggunakan ID field. Pembacaan jawaban lama mempertahankan label unik beserta akhiran duplikat. |
| F14 | Peran Pengurus dan pencocokan identitas pemilik diselaraskan antara antarmuka dan server. |
| F15 | Rating dapat membungkus baris; padding mobile dan ukuran input diperbaiki. Palet builder memakai portal, penguncian scroll, dan safe area. |
| F16 | Nilai default diterapkan dan label/kontrol serta rating diberi hubungan aksesibilitas. |

Ekspor tanggapan/seleksi memakai XLSX asli dengan jawaban sebagai teks. Pola validasi regex dibatasi untuk mencegah komputasi berlebihan. Daftar API memiliki pagination, perubahan schema memeriksa versi, dan permintaan lama tidak menggantikan hasil form yang baru dibuka.

Koreksi audit awal: pengisian otomatis identitas sebenarnya sudah tersedia. Perbaikan sekarang memakai pengaturan eksplisit dan identitas terverifikasi, tanpa heuristik label atau identitas dari localStorage. Masalah nilai default tetap terbukti dan telah diperbaiki.

## Verifikasi

- 28 pengujian regresi Form lulus: otorisasi, schema responden/pengelola, validasi, skor, transaksi, pengiriman ganda, identitas, file, ekspor, dan kontrak validator.
- 60 pengujian regresi Keuangan, Prestasi, dan Tugas Siswa lulus pada pemeriksaan gabungan sebelumnya.
- Pemeriksaan tipe frontend dan backend lulus; validasi schema Prisma dan pembuatan client berhasil. Pemeriksaan lint pada route/helper baru lulus.
- Pengujian browser terhadap komponen React nyata lulus untuk escaping XSS, default, penolakan file terlalu besar, unggahan, dan pengiriman jawaban menggunakan ID field.
- Lebar 320, 390, 768, dan 1280 piksel tidak menunjukkan elemen melebar di luar viewport. Bukti: `form-fixed-visual-metrics.json` dan `form-fixed-mobile-320.png`.

Database dan penyimpanan dalam pengujian menggunakan tiruan. Integrasi PostgreSQL/R2 produksi serta Safari pada iPhone fisik belum diuji. Hasil ini tidak menyatakan tidak mungkin ada bug lain.

## Status migrasi — 13 Oktober 2026

Migrasi diterapkan pada database `acca_db` setelah uji transaksi yang dibatalkan dan pembuatan cadangan terenkripsi untuk dua tabel terdampak beserta metadata kolom, constraint, indeks, kebijakan, serta grants. File cadangan dan kunci tersimpan di `scratch/form-backups/`, yang diabaikan Git. Cadangan berhasil dibaca kembali dan diverifikasi sebelum perubahan dijalankan.

Seluruh isi 4 form dan 276 tanggapan identik sebelum/sesudah migrasi. Dua kolom identitas menjadi teks; dua foreign key identitas dan dua kebijakan akses langsung lama dilepas. Constraint lainnya tetap dipertahankan, termasuk hubungan tanggapan ke form. Role database API yang dikonfigurasi adalah `postgres` dan memiliki izin bypass RLS. Pemeriksaan melalui koneksi baru setelah commit memastikan kolom teks tersimpan dan kebijakan lama telah dihapus.

Kesalahan delimiter blok SQL pada skrip awal diperbaiki sebelum uji transaksi. Skrip pelaksana `scripts/migrate-form-identity.cjs` menyediakan mode uji bawaan dan mode `--apply` yang membuat cadangan, memverifikasi data, dan menerapkan perubahan secara atomik.

## Sebelum deployment

Migrasi `apps/api/prisma/sql/20261012_forms_identity.sql` sudah diterapkan; langkah berikutnya adalah deployment kode aplikasi ketika diminta. Migrasi mempertahankan nilai UUID lama sebagai teks, melepas relasi identitas lama, dan menambahkan indeks. Kebijakan akses langsung lama ditutup menggunakan RLS; koneksi database API harus menggunakan pemilik tabel atau role dengan BYPASSRLS. Pengelolaan akses tetap diperiksa pada API.

Migrasi tidak menulis ulang jawaban historis. Jawaban lama yang labelnya pernah diubah tanpa histori tidak dapat dipetakan kembali secara pasti. Form dengan pola regex kompleks yang tidak lagi didukung perlu disunting pengelolanya. Agregasi antarmuka dibatasi 10.000 tanggapan; data lebih besar tetap tersedia melalui API berpaginasi. Form publik yang mengizinkan banyak tanggapan tetap dapat diisi anonim, sedangkan satu tanggapan per akun memerlukan login.

Validator API disimpan lokal untuk menjaga kompatibilitas runtime Nest; salinannya pada paket shared dijaga identik melalui pengujian kontrak.
