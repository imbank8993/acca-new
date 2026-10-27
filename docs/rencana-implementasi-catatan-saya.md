# Rencana Implementasi Catatan Saya

## 1. Tujuan

Membuat halaman Catatan Saya sebagai ruang pribadi bagi seluruh pengguna ACCA, termasuk siswa, guru, dan TU, untuk menyimpan catatan penting, checklist, serta draft agenda. Catatan dapat diekspor menjadi PDF yang rapi dan dilengkapi kalender bulanan elegan.

Dokumen ini adalah rencana implementasi, bukan instruksi untuk langsung mengubah aplikasi atau melakukan deployment.

## 2. Batasan fitur

- Seluruh catatan hanya dapat dilihat dan dikelola pemilik akun.
- Fitur berdiri sendiri dan tidak terhubung dengan Agenda Madrasah atau fitur lain.
- Tidak ada publikasi, berbagi catatan, penerima, penugasan kepada pengguna lain, atau notifikasi kepada orang lain.
- Draft agenda menjadi bahan persiapan pribadi. Pemindahan ke Agenda Madrasah dilakukan manual oleh pengguna melalui fitur yang sudah tersedia dan sesuai hak aksesnya.
- Tidak ada sinkronisasi kalender eksternal.

## 3. Jenis catatan

### Catatan bebas

Data: judul, isi, checklist, label, dan warna.

### Draft agenda

Data: seluruh data catatan bebas, ditambah tanggal, waktu, dan tempat opsional.

### Properti bersama

- Identitas pemilik akun ditentukan server, bukan dari input pengguna.
- Waktu dibuat dan terakhir diperbarui.
- Status disematkan, diarsipkan, atau berada dalam sampah.
- Penanda versi untuk mencegah perubahan dari dua tab saling menimpa tanpa pemberitahuan.

Tanggal kalender disimpan sebagai tanggal tanpa konversi zona waktu. Waktu agenda memakai zona waktu aplikasi. Format isi perlu terstruktur agar editor dan PDF menampilkan checklist serta daftar secara konsisten.

## 4. Akses dan penyimpanan

1. Tambahkan menu Catatan Saya untuk semua akun yang sudah masuk: siswa, guru, dan TU.
2. Sediakan penyimpanan khusus catatan pribadi, tanpa relasi bisnis ke agenda atau modul lain.
3. Setiap operasi membaca, membuat, mengubah, mengarsipkan, memulihkan, menghapus, dan menyiapkan ekspor harus memeriksa sesi serta kepemilikan di server.
4. Akun admin tidak otomatis memperoleh akses ke catatan pribadi pengguna lain melalui fitur ini.
5. Validasi panjang judul, isi, label, serta format tanggal dan waktu. Isi editor harus ditampilkan dengan aman.
6. Respons data pribadi tidak boleh disimpan dalam cache bersama.
7. Siapkan migrasi database yang mengikuti pola proyek dan dapat diterapkan saat rilis.

## 5. Halaman utama

Bagian atas memuat:

- Tombol Catatan Baru.
- Pencarian judul dan isi.
- Filter jenis, label, dan periode.
- Tombol Export PDF.
- Pemilih tampilan daftar/kartu atau kalender.

Susunan daftar:

1. Catatan yang disematkan.
2. Catatan aktif lainnya, diurutkan berdasarkan waktu perubahan terbaru.
3. Arsip dan Sampah melalui pilihan tampilan terpisah.

Kartu menampilkan judul, cuplikan isi, label, tanggal agenda bila ada, dan waktu terakhir diperbarui. Tampilan harus nyaman di ponsel dan desktop, termasuk mode terang dan gelap.

## 6. Editor

- Mendukung paragraf, daftar poin, dan checklist.
- Pengguna memilih Catatan bebas atau Draft agenda.
- Draft agenda menyediakan tanggal, waktu, serta tempat opsional.
- Simpan otomatis setelah pengguna berhenti mengetik.
- Tampilkan status Menyimpan, Tersimpan, atau Gagal menyimpan.
- Sediakan tombol Coba lagi jika penyimpanan gagal, tanpa menghapus isi yang sedang diketik.
- Peringatkan saat menutup editor jika perubahan belum tersimpan.
- Jika versi server sudah berubah dari tab lain, beri pilihan untuk meninjau atau menyimpan salinan; jangan menimpa diam-diam.
- Tombol Salin draft merangkai isi menjadi teks rapi untuk disalin manual.
- Hapus biasa memindahkan catatan ke Sampah. Sediakan Pulihkan dan Hapus permanen dengan konfirmasi.

## 7. Kalender bulanan

- Menampilkan bulan dan tahun, tombol bulan sebelumnya/berikutnya, serta Kembali ke bulan ini.
- Hari disusun konsisten dari Senin sampai Minggu.
- Tanggal yang memiliki draft agenda diberi penanda dan cuplikan judul.
- Jika satu tanggal berisi banyak agenda, tampilkan jumlah tambahan dan daftar lengkap saat tanggal dibuka.
- Catatan tanpa tanggal tetap berada di daftar catatan, bukan dipaksakan masuk ke kalender.
- Arsip dan Sampah tidak tampil dalam kalender aktif.
- Pemilihan tanggal dapat digunakan untuk membuat draft agenda dengan tanggal tersebut terisi.

## 8. Ekspor PDF

### Pilihan pengguna

- Satu catatan, beberapa catatan terpilih, atau catatan dalam bulan tertentu.
- Judul dokumen yang dapat diubah.
- Bulan dan tahun kalender.
- Sertakan atau sembunyikan kalender.

Kalender aktif secara default jika pilihan ekspor memuat draft bertanggal. Catatan tanpa tanggal tetap dapat dipilih. Jika catatan pilihan melintasi beberapa bulan, tawarkan kalender untuk setiap bulan terkait atau satu bulan pilihan, dengan penjelasan bahwa rincian seluruh catatan terpilih tetap ikut dicetak. Arsip hanya boleh disertakan jika dipilih secara eksplisit; Sampah tidak ikut ekspor.

### Susunan dokumen

1. Judul dokumen dan periode.
2. Kalender bulanan dengan penanda agenda.
3. Rincian draft agenda, diurutkan berdasarkan tanggal dan waktu.
4. Catatan bebas serta checklist.
5. Nomor halaman.

### Desain

- A4 tegak.
- Gaya minimalis dengan biru tua dan aksen biru lembut.
- Kalender memiliki garis halus, ruang sel yang cukup, serta penanda agenda yang jelas.
- Judul panjang pada kalender boleh diringkas dengan nomor rujukan ke rincian; isi lengkap harus tetap tersedia pada bagian rincian.
- Teks panjang diteruskan ke halaman berikutnya tanpa diperkecil berlebihan.
- Status checklist dicetak sebagai kotak kosong atau tercentang.
- Gunakan font yang mendukung karakter yang diperlukan dan uji simbol agar tidak menjadi kotak atau karakter rusak.
- Jangan memotong isi, menumpuk teks, atau menempatkan judul bagian sendirian di akhir halaman.
- Seluruh sumber teks disimpan sebagai UTF-8.
- Ekspor memakai isi terakhir yang sudah tersimpan; jika masih ada perubahan, selesaikan penyimpanan atau tampilkan kegagalannya sebelum membuat PDF.

## 9. Tahapan implementasi

| Tahap | Pekerjaan | Hasil yang diperiksa |
| --- | --- | --- |
| 1. Fondasi | Periksa pola proyek; siapkan model, migrasi, validasi, dan pemeriksaan pemilik | API pengelolaan catatan pribadi berfungsi dan terisolasi per akun |
| 2. Halaman dan editor | Tambahkan menu, daftar, pencarian, filter, editor, simpan otomatis, sematkan, arsip, dan sampah | Pengguna dapat mengelola catatan dengan aman tanpa kehilangan perubahan |
| 3. Kalender | Buat tampilan bulanan dan penanda agenda | Tanggal, urutan hari, dan daftar agenda benar |
| 4. PDF | Buat dialog ekspor, kalender, rincian, checklist, dan penomoran halaman | PDF lengkap dan nyaman dibaca |
| 5. Verifikasi | Uji hak akses, penyimpanan, tampilan, kalender, PDF, encoding, dan build | Seluruh kriteria penerimaan terpenuhi sebelum rilis |

## 10. Pengujian

### Privasi dan akses

- Pengguna yang belum masuk tidak dapat membaca atau mengubah catatan.
- Pengguna A tidak dapat membaca, mengubah, memulihkan, menghapus, atau mengekspor catatan pengguna B, termasuk lewat ID langsung atau pilihan ekspor campuran.
- Kepemilikan tidak dapat dipindahkan melalui input permintaan.
- Siswa, guru, dan TU memperoleh fungsi pribadi yang sama.

### Penyimpanan

- Simpan otomatis berhasil dan indikator sesuai hasil server.
- Kegagalan jaringan tidak menghilangkan isi yang sedang diketik.
- Perubahan dua tab tidak saling menimpa diam-diam.
- Pemulihan dari Sampah mengembalikan catatan dengan isi utuh.
- Pencarian, filter, sematkan, dan arsip menghasilkan daftar yang benar.

### Kalender

- Bulan dengan 28, 29, 30, dan 31 hari tersusun benar.
- Pergantian tahun dan tahun kabisat benar.
- Tanggal tidak bergeser karena zona waktu.
- Banyak agenda pada satu hari tetap dapat dibuka dan dibaca.

### PDF dan tampilan

- Pilihan catatan dan periode yang diekspor sesuai permintaan pengguna.
- Catatan tanpa tanggal dan catatan lintas bulan ditangani sesuai pilihan ekspor.
- Uji judul panjang, isi panjang, daftar, checklist, karakter khusus, serta banyak agenda dalam satu tanggal.
- Render PDF menjadi gambar dan periksa semua halaman: tidak ada potongan, tumpang tindih, atau simbol rusak.
- Verifikasi ukuran A4, isi teks lengkap, dan nomor halaman.
- Periksa tampilan ponsel, desktop, mode terang, serta mode gelap.
- Jalankan pemeriksaan tipe dan build produksi. Kompilasi satu komponen saja tidak menggantikan build penuh.

## 11. Kriteria selesai

- Menu tersedia untuk siswa, guru, dan TU.
- Catatan bersifat pribadi dan terisolasi pada tingkat server.
- Seluruh fungsi pengelolaan, simpan otomatis, serta pemulihan berfungsi.
- Kalender menampilkan draft pada tanggal yang benar.
- PDF cantik, lengkap, terbaca, dan sudah diperiksa secara visual.
- Tidak ada koneksi otomatis ke halaman atau aplikasi lain.
- Migrasi, pengujian relevan, dan build produksi lulus atau hambatan eksternal dilaporkan secara jelas.
- Commit dan push dilakukan setelah ada instruksi untuk melakukannya.

## 12. Status

Dokumen rencana siap digunakan. Implementasi fitur aplikasi belum dimulai.
