# Upload bukti pembayaran massal

Pada halaman Pembayaran, Bendahara Komite atau Admin dapat membuka **Upload Bukti Massal**. Modal menggunakan `components/ui/Modal.tsx`, `InlineSelect`, dan `Button` bersama.

Paket dibatasi ke satu jenis pembayaran dan satu bulan/tahun kegiatan. Unggah maksimal 30 gambar JPG/PNG/WEBP, maksimal 5 MB masing-masing. Gambar dibaca satu per satu; kegagalan satu gambar tidak membuang hasil gambar lainnya. Paket terakhir pada periode yang sama dapat dibuka kembali dalam tab browser yang sama. Metadata paket tersimpan di sessionStorage, tanpa menyimpan gambar atau isi rekening di sana. Draf yang tidak diterapkan dihapus setelah tujuh hari pada unggahan berikutnya.

Gambar dibaca lokal di server menggunakan **Tesseract**, mesin OCR yang juga dipakai ACCA TOOLS melalui `pytesseract`. Karena backend ACCA menggunakan Node.js, integrasi memakai `tesseract.js` (port WebAssembly dari mesin Tesseract), bukan Python. Mesin dan data bahasa Inggris/Indonesia dipasang sebagai dependensi aplikasi. Tidak diperlukan API key, unduhan model saat pembacaan, maupun pengiriman gambar ke layanan luar. Dokumentasi mesin: https://github.com/naptha/tesseract.js dan https://tesseract-ocr.github.io/tessdoc/.

Gambar dirapikan orientasinya, diperbesar bila perlu, dijadikan grayscale, lalu dibaca beserta tingkat kepercayaan setiap kata. Aplikasi memisahkan bagian pengirim dan penerima, mengambil rekening tujuan serta nominal pokok transfer, dan mengabaikan biaya admin/total debit. Pembacaan kedua dengan tata letak berbeda dicoba bila hasil pertama belum lengkap. Nilai yang tidak jelas atau berbeda antarpembacaan memerlukan pemeriksaan manual; digit rekening tidak ditebak atau diperbaiki otomatis.

## Aktivasi

1. Instal dependensi sesuai `package-lock.json`, atau bangun ulang image API melalui deployment biasa. Paket `tesseract.js`, `@tesseract.js-data/eng`, `@tesseract.js-data/ind`, dan `sharp` sudah tercantum sebagai dependensi produksi. Tidak perlu memasang program Tesseract/Python terpisah atau mengisi kunci layanan OCR.
2. Jalankan migrasi `apps/api/prisma/sql/20261103_payment_receipts.sql` sebelum aplikasi baru dimulai. Alur deployment GitHub dan `scripts/deploy.sh` sudah mencakup migrasi ini. Migrasi dapat dijalankan ulang tanpa menghapus data.
3. Mulai ulang API setelah paket terbaru terpasang. Saat bekerja, OCR memakai maksimal dua pekerjaan bersamaan dan batas 60 detik per gambar. Data bahasa sementara dibuat di direktori sementara sistem dan dibersihkan setelah pekerjaan; tidak ada salinan gambar bukti yang ditulis ke direktori itu.
4. Uji dengan sampel bukti bank yang biasa digunakan, termasuk rekening disamarkan, nominal dengan biaya admin, transaksi gagal/tertunda, dan bukti duplikat. Pengujian otomatis membaca gambar sintetis dengan Tesseract asli dan tidak menjamin akurasi untuk setiap desain bukti bank.

## Aturan pembayaran

- Hanya laporan Guru Asuh `Approved`, Ekskul `Disahkan`, dan kegiatan Klinik `finished` dengan laporan `Approved` yang masuk kandidat. Tarif dihitung ulang di server. Klinik menggabungkan kegiatan satu penerima pada periode yang dipilih. Ekskul menggunakan jumlah pertemuan Internal/Eksternal yang terhubung ke laporan.
- Rekening tujuan lengkap dan bank harus cocok, penerima unik, nominal persis sesuai, serta status bukti berhasil untuk dipilih otomatis. Kata pada bagian rekening, bank, nominal, dan status minimal memiliki kepercayaan OCR 85. Nama saja, rekening disamarkan, bank dari judul bukti, nominal tanpa label, maupun hasil OCR ambigu hanya memberi saran.
- Pemetaan manual melalui InlineSelect memerlukan pemeriksaan dan centang konfirmasi. Nominal tidak cocok dan status transfer tidak berhasil tetap ditolak. Versi ini tidak menyediakan pembayaran sebagian atau pembagian transfer lintas jenis pembayaran.
- Satu klik **Terapkan Pembayaran** memperbarui seluruh pilihan dalam transaksi serializable. Perubahan tarif/tagihan, dua bukti untuk satu tagihan, atau bukti yang sudah digunakan menggagalkan seluruh pilihan. Bukti yang tidak dipilih tetap berupa draf.
- Sidik SHA-256 gambar dan referensi transaksi dicegah digunakan ulang melalui indeks unik ketika pembayaran diterapkan. Referensi yang terbaca kurang dari enam karakter dianggap tidak tersedia. Gambar yang diubah dan tidak memiliki referensi terbaca mungkin tidak terdeteksi sebagai duplikat; pencocokan mutasi bank belum tersedia.
- Percobaan ulang sesudah respons terputus aman: pembayaran tidak dicatat dua kali. Bukti yang pernah diterapkan tetap tercatat bila pembayaran dibatalkan lewat fitur lama, dan tidak dapat dipakai ulang untuk membayar tujuan lain.
- Bukti gambar bukan konfirmasi settlement bank. Tampilan “Dibayar” merupakan pencatatan bendahara berdasarkan bukti yang diterapkan.

## Penyimpanan dan akses

Gambar asli disimpan dalam tabel `payment_receipts` bersama sidik file, hasil ekstraksi, kandidat saat analisis, pemetaan final, waktu, serta nama petugas. Penyimpanan berada di database sehingga memerlukan perencanaan kapasitas dan backup; belum ada kompresi atau pengarsipan otomatis untuk bukti yang diterapkan. Endpoint gambar memerlukan sesi. Draf hanya terlihat oleh pengunggahnya (Bendahara Komite/Admin/Administrator); bukti yang sudah diterapkan dapat dilihat bendahara serta pengguna yang berhak membaca rekapan pembayaran (mis. KAMAD, KTU). Kolom catatan pembayaran Guru Asuh/Ekskul memuat tautan bukti; Klinik menampilkan tautan bukti pada baris sesi. Endpoint dan respons memakai `no-store` untuk gambar.

## Verifikasi

- `node apps/api/test/payment-receipts.test.cjs`: aturan pencocokan, penolakan akses, status/nominal, rollback transaksi, duplikat, riwayat, percobaan ulang, kandidat, dan migrasi berulang dengan PostgreSQL sementara (PGlite).
- `node apps/api/test/receipt-ocr-parser.test.cjs`: pemisahan pengirim/penerima, label di baris terpisah, biaya admin, rekening disamarkan, digit ambigu, nominal/tanggal, status, dan kepercayaan OCR.
- `node --require ./apps/api/test/helpers/offline-ocr.cjs apps/api/test/local-receipt-ocr.test.cjs`: mesin Tesseract asli membaca JPG/PNG/WEBP serta status gagal/tertunda dengan jaringan dimatikan pada proses utama dan worker.
- `node apps/web/test/bulk-payment.browser.cjs`: modal asli, InlineSelect, sepuluh gambar sintetis, kesalahan per berkas, konfirmasi manual, penerapan, lebar 320/390/1280 piksel dan mode gelap. Memerlukan Chrome lokal sesuai pengaturan pengujian proyek.
- Pemeriksaan TypeScript API dan web, serta regresi pembayaran yang sudah ada.
