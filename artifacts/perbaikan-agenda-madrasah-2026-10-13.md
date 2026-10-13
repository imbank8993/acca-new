# Perbaikan Agenda Madrasah — 13 Oktober 2026

Ketujuh temuan audit diperbaiki dan pilihan sasaran Guru, Staf, Siswa, Umum ditambahkan. Pilihan bisa lebih dari satu; minimal satu wajib dipilih. Sasaran ditampilkan pada daftar desktop, kartu ponsel, dan ringkasan/detail kalender. Agenda lama mendapatkan nilai bawaan Umum melalui migrasi.

## Perubahan

- Agenda yang berhasil dibuat segera menyimpan ID dalam formulir. Bila unggah foto gagal, pesan menjelaskan bahwa agenda sudah tersimpan; percobaan berikutnya memperbarui agenda yang sama.
- Seluruh perubahan array foto memakai pembaruan bersyarat berdasarkan keadaan terakhir. Benturan perubahan dicoba ulang dengan data terbaru. Unggahan bersamaan tidak membuang foto lain; edit urutan mempertahankan foto baru pengguna lain dan tidak menghidupkan kembali foto yang sudah dihapus. Batas 10 foto diperiksa kembali sebelum penulisan.
- Foto yang sudah terunggah dibersihkan bila unggahan berikutnya atau penyimpanan daftar gagal. Penghapusan berkas dilakukan setelah penghapusan pada basis data berhasil.
- Tombol kelola mengikuti izin server yang diteruskan dari halaman utama, termasuk pengguna yang ditunjuk melalui Hak Akses Fitur.
- Respons PUT keterangan/tanggal foto diperiksa; kegagalan tidak ditampilkan sebagai keberhasilan.
- Kalender menghitung tanggal yang relevan untuk bulan yang terlihat, tanggal terpilih, dan hari ini tanpa memotong durasi agenda menjadi 100 hari.
- API publik mendukung paginasi stabil dan kalender mengambil seluruh halaman, sehingga agenda baru setelah 50 entri tetap tersedia, termasuk untuk tab Mendatang.
- Gangguan server menampilkan pesan serta tombol Coba lagi. Respons 500 tidak dialihkan diam-diam ke data publik atau dianggap daftar kosong. Data sebelumnya dipertahankan bila tersedia.
- Backend memvalidasi dan menghilangkan duplikasi sasaran. Penyuntingan dari klien lama yang tidak mengirim sasaran mempertahankan nilai sebelumnya.

## Verifikasi

- `node apps/api/test/agenda.test.cjs`: 12 uji lulus, termasuk unggahan bersamaan, batas kuota dalam kondisi benturan, pembersihan unggahan gagal, perlindungan berkas ketika penulisan DB gagal, simpan ulang tanpa agenda ganda, kegagalan metadata foto, rentang panjang kalender, hari libur, 450 agenda publik, respons gagal, dan validasi sasaran.
- `node artifacts/verify-agenda-ui.cjs`: uji browser dengan data simulasi lulus. Memakai komponen asli untuk memeriksa pengguna GURU yang diberi izin kelola, pilihan sasaran tersimpan saat edit, gagal unggah lalu simpan ulang tanpa duplikasi, kegagalan metadata, pesan gagal serta coba lagi, dan label sasaran kalender.
- Tampilan 320, 390, 768, 1280 piksel tidak meluap secara horizontal. Pratinjau terang dan gelap diperiksa secara visual.
- Pemeriksaan TypeScript backend lulus. Klien Prisma lokal mengenali field sasaran; mesin runtime yang sudah ada tidak diganti.
- Pemeriksaan TypeScript frontend masih terhalang enam kesalahan lama `ActionGroup`/`ActionButton` pada halaman permintaan surat. Tidak ada kesalahan yang dilaporkan pada perubahan agenda.
- Pemeriksaan whitespace perubahan lulus.

## Penerapan

Kode berada di workspace lokal; belum ada deploy atau perubahan basis data server. Sebelum menerapkan backend baru, jalankan [migrasi sasaran](D:/acca-new/apps/api/prisma/sql/20261013_agenda_sasaran.sql), lalu regenerasi klien Prisma sesuai schema yang diperbarui. Migrasi menambahkan kolom, memberi agenda lama nilai Umum, serta membatasi nilai ke empat sasaran yang sah. Tidak ada agenda yang dihapus.

[Gambar komputer](D:/acca-new/artifacts/agenda-form-1280.png), [gambar ponsel](D:/acca-new/artifacts/agenda-form-390.png), [gambar mode gelap](D:/acca-new/artifacts/agenda-form-dark.png).
