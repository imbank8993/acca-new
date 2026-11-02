# Pemberitahuan surat masuk PTSP dan akumulasi pembayaran

## Pemberitahuan surat masuk

Fitur PTSP merupakan pemberitahuan bahwa ada surat/permohonan masuk. Petugas memilih pengguna penerima dan dapat menambahkan pesan opsional. Tidak ada instruksi disposisi, status proses, maupun laporan tindak lanjut wajib. Penerima melihat detail permohonan dan lampiran asli, serta dapat mengunduh PDF. Nama pemohon dan nomor WhatsApp ditampilkan sebagai teks.

Status pemberitahuan adalah Belum dibaca atau Sudah dibaca. Membuka detail menandai dibaca hanya untuk penerima. Petugas yang memantau kiriman pengguna lain tidak mengubah status tersebut. Jika pembaruan status gagal, penerima dapat mencoba tombol Tandai dibaca. Data layanan sumber tidak diubah oleh aktivitas membaca.

Daftar memakai paginasi 12 kiriman dan filter belum dibaca; ringkasan menghitung seluruh kiriman dalam lingkup hak akses. Notifikasi aplikasi membuka surat tertentu melalui parameter surat, termasuk kiriman di halaman lama. Pengiriman menggunakan ID percobaan sehingga retry dengan isi sama tidak membuat surat atau notifikasi ganda. Perubahan isi/penerima membuat ID percobaan baru.

Sumber masalah karakter kacau adalah teks antarmuka yang pernah tersimpan dengan encoding keliru. Separator kini memakai ikon; label data memakai pemetaan nama yang dapat dibaca. Metadata penyimpanan, token pelacakan, dan nama kolom internal tidak ditampilkan dalam detail/PDF. Tautan lampiran dibatasi ke HTTP(S) atau lokasi lokal aplikasi yang aman.

Nama tabel dan endpoint lama ptsp_disposisi dipertahankan untuk kompatibilitas. Migrasi 20261102_ptsp_surat_masuk.sql menambahkan read_at dan client_request_id tanpa menghapus kiriman sebelumnya, serta memperbarui judul dan tautan notifikasi lama. Workflow deployment menjalankan migrasi setelah 20261102_ptsp_disposisi.sql sebelum aplikasi dimulai ulang. Tidak ada pengiriman WhatsApp dalam alur ini.

## Pembayaran

Pembayaran klinik mengelompokkan kegiatan berdasarkan ID guru dan status pembayaran. Total Akumulasi tetap mempertahankan rincian kegiatan. Backend memeriksa kepemilikan, persetujuan, status, dan tarif sebelum memperbarui seluruh sesi dalam transaksi serializable. Filter bulan dan tahun berlaku untuk daftar, ringkasan, dan rekapan pembayaran; filter tab Nominal mengikuti tanggal terakhir perubahan tarif aktif.

## Verifikasi

- TypeScript frontend dan backend.
- node apps/api/test/ptsp-disposisi-payment.test.cjs: validasi pembayaran, isolasi akses penerima, tanda dibaca, penyimpanan lampiran, idempotensi pengiriman, paginasi, migrasi berulang, dan PDF beberapa halaman.
- node apps/web/test/ptsp-letter-ui.cjs: pengujian browser lokal dengan data sintetis, lebar 320-1280 piksel, mode terang/gelap, label dan encoding, detail/lampiran, tanda dibaca, pesan opsional, pencegahan klik ganda, dan pesan kesalahan aman.

Pengujian memakai database sementara dan halaman lokal, tanpa mengubah data produksi. Pengujian akun sebenarnya pada server tetap memerlukan deployment yang berhasil.

## Kegagalan memuat setelah pembaruan

Jika kode baru memakai read_at sementara database belum dimigrasikan, PostgreSQL mengembalikan 42703 (column read_at does not exist), lalu halaman menampilkan pesan gagal memuat. Ini berbeda dengan daftar surat kosong. Migrasi 20261102_ptsp_surat_masuk.sql memperbaiki struktur tanpa menghapus surat.

Deployment otomatis maupun scripts/deploy.sh kini menjalankan kedua migrasi PTSP lalu verify-ptsp-db.cjs --letters sebelum menjalankan versi baru. Pemeriksaan menolak database yang belum memiliki read_at, client_request_id, dan indeks pencegah pengiriman ganda. Pengujian regresi memverifikasi skema lama ditolak dan skema setelah migrasi diterima.
