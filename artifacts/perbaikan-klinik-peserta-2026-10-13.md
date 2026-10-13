# Perbaikan peserta klinik — 13 Oktober 2026

- Guru pengampu/pengelola dapat memilih beberapa peserta atau memilih semua peserta yang boleh dihapus, lalu menekan Hapus terpilih.
- Penghapusan satu peserta tetap tersedia. Siswa hanya dapat membatalkan pendaftarannya sendiri sesuai aturan penugasan.
- Konfirmasi, pesan berhasil, dan pesan gagal tampil di dialog peserta. Dialog tetap terbuka dan daftar serta kuota diperbarui tanpa memuat ulang seluruh halaman.
- Pengaju kelompok, peserta dengan absensi tercatat, dan sesi terkunci tetap dilindungi. Semua pilihan diperiksa sebelum satu perintah penghapusan.
- Tampilan pilihan, daftar, nama panjang, serta tombol disesuaikan untuk ponsel dan mode gelap.

## Verifikasi

- `node apps/api/test/klinik-participants.test.cjs`: 11 uji lulus.
- `node artifacts/verify-klinik-participants-ui.cjs`: lulus dengan data simulasi menggunakan komponen peserta serta fungsi penghapusan dan pembaruan asli halaman. Meliputi pilihan beberapa peserta, proteksi peserta, konfirmasi, pesan berhasil/gagal, daftar tetap terbuka, dan ukuran 320, 390, 768, 1280 piksel tanpa luapan horizontal.
- Pemeriksaan TypeScript backend lulus.
- Pemeriksaan TypeScript frontend belum lulus seluruh proyek karena enam kesalahan `ActionGroup`/`ActionButton` di `apps/web/app/permintaan-surat/tabs/TabSemuaPermintaan.tsx` (berkas sudah berubah sebelum pekerjaan ini). Tidak ada kesalahan dilaporkan pada berkas klinik yang diubah.
- Gambar tampilan: `klinik-peserta-390.png`, `klinik-peserta-1280.png`, `klinik-peserta-dark.png`.

Perubahan berada di workspace lokal. Tidak dilakukan deploy atau penghapusan data peserta nyata.
