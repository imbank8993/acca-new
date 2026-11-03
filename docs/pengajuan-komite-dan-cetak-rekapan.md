# Pengajuan Komite dan cetak rekapan pembayaran

## Pengajuan Komite

Tab Pengajuan Komite tersedia pada halaman Pembayaran. PJ/guru juga memiliki pintu masuk **Pengajuan Komite** pada menu, yang menampilkan komponen yang sama dengan hanya tab pengajuan. Pintu masuk ini tidak memberi akses ke data honor rutin, Rekapan, atau Nominal.

Satu kegiatan berisi nama, PJ (akun pembuat), keterangan, dan tanggal pelaksanaan. Setiap kegiatan memiliki termin bulanan dan rincian item. Tidak ada pengajuan persetujuan, verifikator persetujuan, atau tahap disahkan. PJ dapat langsung menyimpan kegiatan, mengunggah ampra, dan mengubah rincian yang belum dibayar.

- Termin memiliki nama, bulan/tahun, dan maksimal sepuluh lampiran ampra (PDF/gambar/Excel, maksimal 15 MB masing-masing). Satu kegiatan memiliki satu termin per bulan. Bulan termin harus berada dalam periode kegiatan.
- Item berisi uraian, penerima/penyedia, jumlah (maksimal dua desimal), satuan, dan harga satuan rupiah. Subtotal dibulatkan ke rupiah oleh database.
- **Salin rincian dari termin** menyalin item kegiatan yang sama ke termin baru. Lampiran dan pembayaran tidak ikut disalin.
- Hanya Bendahara Komite/Admin dapat mencatat pembayaran. Setiap pembayaran mencatat nominal, tanggal, bukti transfer, catatan, dan petugas. Pembayaran sebagian didukung; sisa tagihan diperiksa kembali dalam transaksi.
- Status Belum Dibayar, Dibayar Sebagian, dan Lunas dihitung dari pembayaran aktif, bukan kolom yang dapat diubah pengguna.
- Item, termin, dan metadata kegiatan yang sudah dibayar hanya dapat dikoreksi bendahara dengan alasan perubahan. Nominal item tidak dapat dikurangi di bawah pembayaran aktif. Riwayat sebelum/sesudah perubahan disimpan.
- Bendahara dapat membatalkan pembayaran dengan alasan wajib. Bukti, pencatatan asli, dan audit tetap disimpan; pembayaran yang dibatalkan tidak dihitung ke jumlah terbayar. Item yang mempunyai riwayat pembayaran tidak dapat dihapus.
- Pembayaran memakai ID percobaan; percobaan ulang tidak membuat pembayaran ganda. Data berbeda dengan ID yang sama ditolak. Revisi mencegah data lama menimpa perubahan terbaru.

Pengajuan Komite memiliki ringkasan internal kegiatan dan secara tegas tidak masuk total maupun cetakan **Rekapan** rutin. Tidak ada tarif Pengajuan Komite pada tab **Nominal**.

## Cetak rekapan rutin

Pada tab Rekapan, tombol **Cetak Rekapan** membuka modal bulan kegiatan/laporan, tahun, dan kategori (semua/Guru Asuh/Klinik/Ekstrakurikuler). PDF dibuat langsung di memori dan dapat dilihat/dicetak dari modal pratinjau. Dokumen tidak diunggah ulang ke penyimpanan.

PDF A4 portrait memuat:

1. Kop dari `renderKopHTML` dan `CENTERED_KOP_CSS`, sumber yang juga digunakan laporan Guru Asuh, beserta profil sekolah yang sama.
2. Ringkasan jumlah pembayaran dan nominal tercatat per kategori.
3. Ampra per kategori: nama/NIP, uraian, jumlah kegiatan, nominal tersimpan, tanggal pembayaran, dan nomor lampiran.
4. Daftar lampiran dan bukti transfer. Gambar dipertahankan proporsinya. Setiap halaman bukti PDF dimasukkan ke halaman A4. Satu URL bukti yang dipakai beberapa baris dicetak sekali dan dirujuk dari seluruh baris terkait.

Periode mengikuti **bulan kegiatan/laporan**, sesuai filter Rekapan. Tanggal transfer ditampilkan sebagai informasi tersendiri. Pengajuan Komite tidak diterima sebagai kategori cetak oleh backend.

Nominal cetakan dan total Rekapan menggunakan snapshot pembayaran. Pembayaran lama tanpa nominal tersimpan diberi keterangan **Nominal belum tercatat** dan tidak ditaksir memakai tarif sekarang. Seluruh pembayaran manual baru Guru Asuh/Ekskul juga menyimpan nominal berdasarkan tarif dan jumlah pertemuan yang diperiksa server.

Lampiran kosong atau gagal diunduh ditandai dalam ringkasan serta rincian; tidak disembunyikan. Pengunduhan eksternal mengikuti allowlist penyimpanan, pemeriksaan DNS/redirect, dan pembatasan ukuran yang sudah dipakai aplikasi. Token pengguna hanya diteruskan ke endpoint internal untuk bukti upload massal. Chromium tidak boleh mengakses jaringan atau menjalankan JavaScript dokumen saat mencetak.

Batas satu cetakan: 2.000 baris, 200 bukti, 150 MB data lampiran, dan 20 halaman per bukti PDF. Jika terlampaui, cetak satu kategori. Tidak ada penggantian nominal historis secara otomatis untuk data lama.

## Aktivasi dan verifikasi

Jalankan `20261103_payment_receipts.sql` lalu `20261103_committee_payments.sql` sebelum aplikasi baru dimulai. Kedua alur deployment sudah memuatnya. Saat instalasi pertama, migrasi memberikan halaman `pengajuan-komite` kepada peran GURU, ADMIN, ADMINISTRATOR, BENDAHARA_KOMITE, KAMAD, KTU, dan OP_MADRASAH. Pengaturan akses berikutnya dikelola melalui Akses per Role; migrasi berulang tidak mengembalikan izin yang sudah dicabut admin.

Pengujian memakai data sintetis dan database sementara:

- `node apps/api/test/committee-payments.test.cjs`: kegiatan empat bulan tanpa persetujuan, isolasi PJ, pembayaran sebagian/idempotensi/pembatalan, koreksi, penyalinan termin, migrasi berulang, dan pemisahan rekap.
- `node apps/web/test/payment-period.test.cjs`: periode konsisten dan snapshot nominal historis.
- `node apps/web/test/committee.browser.cjs`: halaman PJ tidak memuat data rutin; modal bersama/InlineSelect; empat termin; edit item; pencatatan pembayaran; pilihan cetak; ponsel dan mode gelap.
- `node apps/web/test/payment-report.pdf.cjs`: contoh ampra 55 baris, halaman A4, kop bersama, satu bukti untuk banyak baris, lampiran gambar/PDF, dan penanda lampiran tidak tersedia. PDF contoh dirender untuk pemeriksaan visual; bukan laporan produksi.
- Pemeriksaan TypeScript web/API dan regresi pembayaran yang sudah ada.
