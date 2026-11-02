# Disposisi PTSP dan akumulasi pembayaran klinik

Pembayaran klinik mengelompokkan kegiatan yang tampil berdasarkan ID guru dan status pembayaran. Kolom Total Akumulasi mempertahankan rincian setiap kegiatan. Satu tombol membayar seluruh sesi belum dibayar dalam kelompok tersebut. Konfirmasi memuat jumlah sesi dan total transfer. Backend memeriksa pemilik, persetujuan laporan, status sesi, serta tarif saat penyimpanan; seluruh sesi diperbarui dalam transaksi serializable.

Petugas ADMIN, ADMINISTRATOR, PTSP, OP_PTSP, dan OP_LAYANAN dapat mendisposisikan permohonan dari tombol Disposisi pada daftar desktop maupun seluler. Tracking diselesaikan ke data formulir sumber agar seluruh detail dan lampiran ikut diteruskan. Tujuan dipilih dari akun aktif. Disposisi menyimpan salinan detail permohonan dan tautan lampiran, nama pengirim/penerima, serta instruksi. Notifikasi pribadi dikirim di aplikasi. Penerima diberi akses halaman layanan-ptsp, dengan tampilan khusus kotak disposisinya sendiri. Tidak ada pengiriman WhatsApp dalam alur disposisi ini.

Penerima dapat mengunduh PDF detail permohonan dan membuka lampiran secara terpisah, kemudian memperbarui status dan catatan tindak lanjut. PDF dibentuk saat diunduh dan menampilkan status terkini. Nama pemohon dan nomor WhatsApp berupa teks. Disposisi selesai wajib menyertakan hasil tindak lanjut. Permohonan sumber yang sudah didisposisikan tidak dapat dihapus agar lampiran tetap tersedia.

## Aktivasi

Migrasi `apps/api/prisma/sql/20261102_ptsp_disposisi.sql` sudah dimasukkan ke workflow deployment sebelum aplikasi dimulai ulang. Untuk instalasi manual, jalankan migrasi tersebut melalui Prisma db execute sebelum menjalankan versi baru. Perubahan ini belum diterapkan ke server oleh sesi pengembangan ini.

## Pemeriksaan

- TypeScript frontend dan backend.
- `node apps/api/test/ptsp-disposisi-payment.test.cjs`: pembayaran gabungan, validasi total/status/pemilik, izin akses disposisi, tindak lanjut, salinan lampiran, akses halaman penerima, migrasi berulang, serta pembuatan PDF beberapa halaman dan penolakan unduhan tanpa izin.
- `node apps/web/scripts/test-payment-nominal.cjs`: pembacaan nominal pembayaran lama.

Pemeriksaan database memakai PostgreSQL lokal sementara (PGlite), tanpa mengubah data aplikasi. Integrasi sesi pengguna dan tampilan browser pada server berjalan masih memerlukan pemeriksaan setelah deployment.
