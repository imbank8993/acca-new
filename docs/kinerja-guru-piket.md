# Kinerja Guru: kop laporan dan kategori Tidak Piket

Perbaikan 21 Oktober 2026.

## Kop surat

Kinerja Guru membaca profil dari kolom `nama` pada `/api/profil-sekolah`. Sebelumnya pemeriksaan `nama_sekolah`/`namaSekolah` membuat profil yang valid diabaikan, sehingga kop kehilangan nama, logo, alamat, dan kontak sekolah.

Kinerja Guru dan laporan Guru Asuh menggunakan `renderKopHTML` serta `CENTERED_KOP_CSS` yang sama. Margin cetak disamakan menjadi atas 10 mm, kanan 15 mm, bawah 15 mm, kiri 20 mm. Pencetakan ditahan bila data periode masih dimuat, permintaan gagal, atau profil sekolah belum tersedia. Kegagalan periode baru membersihkan hasil lama agar tidak tercetak dengan label periode yang salah.

## Dasar perhitungan

- Satu unit adalah guru/tanggal/JP, bukan jumlah kelas dan bukan jumlah hari. Satu JP yang mencakup beberapa kelas tetap dihitung sekali bila masih ada kelas yang belum dilaporkan. Rincian dan penghitung memakai unit yang sama.
- Versi piket adalah jadwal lengkap dengan `berlaku_mulai` terbesar yang tidak melebihi tanggal yang dinilai, mengikuti aturan `SettingsService.getJadwalPiket(asOf)`. Slot yang hilang pada versi berikutnya tidak diteruskan dari versi sebelumnya.
- Tanggal dan waktu hari ini mengikuti pengaturan zona waktu sekolah. Tugas hari ini baru dinilai setelah waktu selesainya. Bila waktu selesai tidak dapat dibaca, tugas tersebut baru dinilai esok hari.
- Hari libur memperhatikan tanggal, JP, serta lingkup semua kelas/kelas tertentu/tingkat tertentu. Minggu tidak dihitung.
- Laporan kelas dicocokkan berdasarkan tanggal, kelas, dan JP. Laporan dengan beberapa JP berkoma dipecah menjadi jam tunggal. Laporan pengganti/rekan yang sudah menutup slot kelas tetap dianggap selesai, sesuai perilaku sebelumnya. Untuk tugas tanpa kelas tertentu, laporan harus berasal dari NIP petugas dan jam yang sesuai.
- Izin/sakit tetap ditampilkan sebagai keterangan dan tidak otomatis mengurangi angka. Jika kedua data mempunyai NIP, kecocokan nama tidak boleh mengalahkan perbedaan NIP.
- Kegagalan perhitungan tidak ditelan menjadi angka nol.

## Batas akurasi historis

Kategori ini menunjukkan slot tugas yang belum mempunyai laporan, sehingga tidak sendirinya membuktikan ketidakhadiran fisik. Perhitungan memakai data jadwal yang masih tersimpan. Pengeditan NIP/tanggal berlaku secara langsung, pertukaran jadwal yang memperbarui baris lama, atau penghapusan versi lama dapat mengubah acuan periode lampau. Riwayat sebelum baris ditimpa tidak bisa dipulihkan hanya dari tabel jadwal saat ini. Menjaga laporan historis konsisten memerlukan penyimpanan versi perubahan jadwal tanpa menimpa versi sebelumnya; alur penyuntingan/pertukaran jadwal tersebut belum diubah pada pekerjaan ini.

## Pemeriksaan

Pengujian regresi mencakup versi jadwal, libur sesuai lingkup, normalisasi JP/tanggal, penghitungan beberapa kelas, batas hari/waktu sekolah, rincian, pencocokan izin, pemuatan profil sekolah, kop surat bersama, serta respons filter yang datang terlambat atau gagal.

Hasil: 18 tes regresi lulus; pemeriksaan TypeScript API dan web lulus. Enam pemeriksaan pengamanan permintaan PDF Guru Asuh dengan browser tiruan juga lulus. Tampilan PDF/cetak belum diperiksa ulang secara visual pada browser.

```text
node --test --test-isolation=none apps/api/test/kinerja-guru.test.cjs apps/api/test/kinerja-filter-race.test.cjs apps/api/test/kinerja-print.test.cjs
```
