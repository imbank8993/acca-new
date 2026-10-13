# Bank Data — 13 Oktober 2026

Halaman Bank Data sekarang menampilkan tabel Siswa, Guru, atau Tendik dengan seluruh kolom yang diizinkan server. Dataset dapat dipilih melalui toolbar; di mobile pilihan tersebut tersedia melalui tombol filter. Pengaturan dataset dan riwayat tetap tersedia bagi pengelola berdasarkan izin yang dikirim server.

## Perilaku

- Tabel berpaginasi 10, 20, 50, atau 100 baris per halaman. Urutan nama memakai ID sebagai pembeda agar nama yang sama tidak menyebabkan urutan halaman berubah.
- Toolbar menyediakan pencarian pada kolom identitas induk yang diizinkan serta tahun ajaran, semester, dan kelas sesuai dukungan dataset. Pencarian tidak membaca kolom tersembunyi ataupun kolom pendukung.
- Ekspor XLSX mengikuti pencarian dan filter aktif, mencakup seluruh halaman hingga batas baris pengelola. Tabel memberi keterangan jika jumlah hasil melampaui batas tersebut.
- Kolom pendukung seperti kelas, ekskul, wali kelas, mapel, atau tugas tambahan tetap dirangkum dalam baris orang yang sama, sesuai konfigurasi kolom.
- Pada Guru/Tendik, tahun ajaran dan semester menyaring isi kolom pendukung, bukan menghilangkan pegawai yang belum memiliki penugasan. Pada Siswa, filter tersebut mempersempit daftar siswa melalui siswa_kelas.
- Tabel lebar dapat digeser di dalam panel mobile. Tombol unduh tetap tampil sebagai ikon dalam lingkaran; halaman tidak ikut melebar.
- Perubahan filter membatalkan permintaan lama, mengembalikan nomor halaman, dan mencegah hasil lama menimpa tampilan baru. Tersedia kondisi memuat, kosong, gagal, dan coba lagi.

## Koreksi izin dan batas

Konfigurasi kolom kosong tidak lagi membuka kembali kolom bawaan. Dataset tanpa kolom yang boleh dibaca tidak ditampilkan. Kolom sensitif memerlukan izin ekspor sensitif sekaligus izin konfigurasi. Pemeriksaan akses halaman yang telah menolak pengguna tidak ditimpa oleh fallback izin role lama.

Batas baris kini diterapkan pada tabel, pratinjau, dan ekspor; sebelumnya ekspor mengambil data tanpa batas konfigurasi. Pembacaan kolom sensitif wajib berhasil dicatat pada log sebelum hasil dikembalikan. Filter, pencarian, dan pagination diperiksa server. Respons katalog, tabel, dan file diberi kebijakan no-store.

## Verifikasi

- 11 pengujian backend lulus, meliputi izin dataset/kolom, kolom sensitif, pencabutan akses, pagination, pencarian, filter kelas, input tidak valid, ekspor XLSX, kegagalan log, dan kesesuaian seluruh katalog dengan schema Prisma.
- Pengujian komponen React nyata di Chrome lulus: pindah halaman, filter tahun ajaran, pencarian, ekspor sesuai filter tanpa pembatasan ke halaman aktif, reset, pindah dataset lewat filter mobile, serta keadaan kosong.
- Lebar 320, 390, 768, dan 1280 piksel tidak menyebabkan halaman melebar. Tombol unduh terlihat pada seluruh ukuran. Bukti disimpan dalam bank-data-visual-metrics.json, bank-data-390.png, dan bank-data-1280.png.
- Pemeriksaan tipe API lulus. Lint untuk view, tabel, dan proxy Bank Data lulus. Pemeriksaan whitespace perubahan lulus.

Pemeriksaan tipe seluruh frontend sebelumnya gagal pada `app/permintaan-surat/tabs/TabSemuaPermintaan.tsx` karena simbol `ActionGroup` dan `ActionButton` tidak ditemukan; tidak ada diagnostik Bank Data dalam hasil tersebut. Pemeriksaan menyeluruh terakhir berjalan terlalu lama dan tidak dipakai sebagai bukti kelulusan. Kesalahan halaman lain tidak diubah dalam pekerjaan ini.

Data pengujian adalah data tiruan. Belum ada deployment, perubahan konfigurasi dataset produksi, atau migrasi database untuk pekerjaan Bank Data ini. Pengujian Chrome tidak menggantikan pengujian Safari pada perangkat fisik.
