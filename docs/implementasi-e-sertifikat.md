# Implementasi E-Sertifikat ACCA

## Halaman dan alur pengguna

Halaman pengelolaan: `/e-sertifikat`, dalam menu **Layanan & Surat → E-Sertifikat**.

1. Buat kegiatan: nama, penyelenggara, tanggal mulai/akhir, lokasi, keterangan, dan awalan nomor unik.
2. Unggah desain sertifikat final sebagai **PDF satu halaman, PNG, atau JPG**. Desain memuat dekorasi, judul, isi kegiatan, dan logo; identitas penerima, nomor, nama/jabatan penandatangan, serta QR ditambahkan aplikasi. PDF mengikuti ukuran CropBox dan rotasi halaman. PNG mengikuti metadata pHYs, JPG mengikuti density JFIF; tanpa metadata resolusi digunakan 96 dpi. Gambar tidak dipaksa ke A4.
3. Tambahkan 1–3 penandatangan dari daftar pegawai atau isi manual, lalu isi jabatannya. Matikan cetak nama/jabatan bila sudah tercetak pada desain; informasi tetap muncul pada verifikasi. Di editor visual, pilih nama, asal sekolah, setiap kolom identitas tambahan, nomor, nama/jabatan penandatangan, atau QR. Geser elemen atau klik tujuan di template. Koordinat X/Y dan lebar memakai milimeter dari sudut kiri atas dengan ketelitian input 0,01 mm, disimpan dalam point PDF hingga empat desimal. Tombol arah menggeser 0,1 mm; Shift 1 mm; Alt 0,01 mm. Gunakan zoom sampai 300%, kisi 5 mm, dan tombol tengah horizontal/vertikal. QR selalu dicetak berlatar putih dengan sisi minimal 20 mm. Nama wajib dicetak; unsur lainnya dapat dinonaktifkan.
4. Kanvas editor otomatis memakai PDF hasil render server yang sama dengan unduhan, sehingga font dan posisi mengikuti hasil cetak. Pilih peserta contoh dari daftar untuk memeriksa nama panjang. Perubahan posisi tidak disimpan otomatis per geseran; simpan perubahan atau pindah tab untuk menyimpannya. Simpan dan buka pratinjau PDF. Jika sudah ada peserta, pratinjau menggunakan peserta terpilih atau peserta pertama. Pratinjau memiliki tanda **BELUM DITERBITKAN** dan QR contoh yang tidak mewakili sertifikat aktif.
5. Impor data **Excel .xlsx atau CSV**, pilih kolom Nama dan kolom Asal Sekolah/Instansi bila tersedia. Pilih maksimal delapan kolom identitas tambahan, misalnya Peran, Kelas, Asal Madrasah, atau Jabatan. Pratinjau lima baris ditampilkan sebelum impor. Tidak ada pemetaan berdasarkan nama kolom yang dipaksakan.
6. Data masuk sebagai draf. Nama, asal sekolah, dan identitas tambahan bisa diperbaiki sebelum penerbitan. Draf yang salah dapat dihapus.
7. Pilih penerima dan terbitkan. Maksimal 100 peserta per penerbitan. Sistem memberi nomor berurutan dan QR unik serta menyimpan snapshot data dan template. Penerbitan memeriksa kemampuan render seluruh peserta; kegagalan membatalkan seluruh batch.
8. Unduh PDF per peserta atau pilih maksimal 25 sertifikat untuk ZIP. Daftar dapat dicari, difilter status, dan dibuka per 25 peserta. Pada mobile, data dan aksi muncul sebagai kartu tanpa perlu menggeser tabel.
9. Unggah dokumentasi kegiatan dan persuratan. Semuanya **internal** secara bawaan. Aktifkan **Tampil pada verifikasi** secara eksplisit untuk dokumen yang boleh dilihat penerima QR.
10. Bila sertifikat salah, cabut dengan alasan. QR lama akan menampilkan **Dicabut**; akses dokumen melalui QR tersebut ditutup. Pengelola dapat membuat draf pengganti dan menerbitkan nomor baru setelah identitas diperbaiki.

Arsip kegiatan menghentikan impor dan penerbitan baru, tetapi tidak membatalkan sertifikat yang sudah terbit. Sertifikat yang sudah dicabut tidak dapat diaktifkan kembali.

## Verifikasi publik

URL: `/e-sertifikat/verifikasi/<token-acak-48-karakter>`. Tidak memerlukan login dan tidak diindeks mesin pencari. Tidak tersedia daftar publik atau pencarian seluruh peserta.

Untuk sertifikat aktif, halaman menampilkan status, nomor, nama, asal sekolah/instansi, nama kegiatan, penyelenggara, tanggal, lokasi, keterangan, tanggal terbit, dokumentasi, dan persuratan yang dipublikasikan. Identitas tambahan dari Excel hanya dicetak dalam sertifikat; data tersebut tidak dimasukkan ke respons publik.

Untuk sertifikat dicabut, halaman hanya menampilkan nomor, status, tanggal, dan alasan pencabutan. Untuk kode tidak dikenal, halaman menampilkan kegagalan verifikasi.

## Akses dan penyimpanan

- Admin dapat mengelola seluruh kegiatan. Pegawai yang diberi akses halaman melalui Pengaturan Akses dapat membuat dan mengelola kegiatan miliknya sendiri. Akses halaman saja tidak mengizinkan siswa atau orang tua menjadi penerbit.
- Pemeriksaan pemilik dijalankan pada setiap endpoint pengelolaan, bukan hanya di antarmuka. Identitas pemilik berasal dari sesi server.
- Berkas disimpan privat sebagai `bytea` pada database, dibaca melalui endpoint dengan pemeriksaan pemilik atau QR aktif. Tidak ada URL penyimpanan publik permanen. Ini membuat publikasi dan pencabutan akses dokumen berlaku pada permintaan berikutnya.
- Batas awal: 5 MB per template/dokumen, 20 berkas per kegiatan termasuk riwayat template, gambar maksimal 24 megapiksel, dokumen PDF maksimal 50 halaman. Untuk volume besar, penyimpanan dapat dipindah ke bucket privat tanpa mengubah kontrak URL publik.
- Excel maksimal 2 MB, 500 peserta setiap impor, 30 kolom, delapan kolom tambahan, serta 2.000 peserta per kegiatan. Pembacaan peserta memakai ExcelJS, terpisah dari paket `xlsx` lama yang masih dipakai fitur lain. Arsip XLSX diperiksa terhadap ukuran ekstraksi sebenarnya (maksimal 25 MB), metadata ukuran palsu, serta koordinat sel/rentang gabungan yang berlebihan sebelum parsing workbook. Batas lembar berlaku pada seluruh worksheet dalam berkas. Formula XLSX ditolak; ubah menjadi nilai sebelum mengimpor. CSV mempertahankan nol di depan dan tidak mengubah teks menjadi angka atau tanggal otomatis.
- Pengelola dapat menghapus dokumen pendukung dan template yang belum dipakai. Template aktif harus diganti terlebih dahulu; template yang dirujuk sertifikat terbit/dicabut dipertahankan agar dokumen historis tidak berubah.
- Nomor, token, snapshot, dan identitas sertifikat yang telah terbit dilindungi trigger database. Semua tabel modul dikecualikan dari fitur penggantian data massal.
- Pembuatan/edit kegiatan, impor, perubahan draf, penerbitan, pencabutan, unggah, publikasi, dan penghapusan berkas dicatat dalam audit.
- QR memakai token acak 192-bit, tidak memuat NISN/NIP atau identitas peserta. Nomor sertifikat terpisah dari token.
- QR menunjuk ke `ECERT_PUBLIC_ORIGIN`, bawaan `https://acca.icgowa.sch.id`. Origin diambil dari konfigurasi terpercaya, bukan header Host pengguna. Ubah variabel ini bila domain berbeda; perubahan hanya berlaku bagi penerbitan berikutnya.

## Model data dan konsistensi

Migrasi berurutan: `apps/api/prisma/sql/20261016_e_sertifikat.sql`, kemudian `apps/api/prisma/sql/20261021_e_sertifikat_hardening.sql`.

| Tabel | Fungsi |
|---|---|
| `ecert_events` | Kegiatan, pemilik, template aktif, revisi, awalan nomor, dan penghitung urutan |
| `ecert_recipients` | Draf/sertifikat, identitas, nomor unik, token unik, snapshot penerbitan, pencabutan |
| `ecert_assets` | Template, dokumentasi, persuratan privat dan pilihan publikasi |
| `ecert_audit` | Riwayat tindakan pengelola |
| `ecert_public_limits` | Penghitung permintaan publik bersama seluruh proses server, dengan masa berlaku |

Tabel dikelola melalui SQL terparameterisasi Prisma. Tidak ada perubahan pada tabel nilai, CBT, atau data lama. RLS diaktifkan tanpa izin publik; koneksi aplikasi harus memakai pemilik tabel atau peran server yang berwenang. Pengelolaan tidak menggunakan klien database anonim.

Penerbitan memakai transaksi dengan kunci baris kegiatan dan penerima. Permintaan penerbitan berulang tidak menggandakan nomor pada peserta yang sama. Impor memakai UUID yang dibuat pada pratinjau agar pengulangan permintaan gagal tidak menyisipkan peserta dua kali. Mengunggah ulang Excel sebagai impor baru tetap membuat draf baru; periksa daftar sebelum menerbitkan.

Edit kegiatan dan identitas peserta draf memakai nomor revisi. PATCH peserta wajib menyertakan `revision` dari detail terakhir. Penyimpanan dengan revisi lama/tidak ada ditolak dengan HTTP 409; pembaruan yang berhasil menaikkan revisi secara atomik. Perubahan pada kegiatan tidak mengubah snapshot sertifikat terbit. Pencabutan mengubah status, bukan identitas dokumen historis.

Daftar kegiatan memakai pagination server, urutan `created_at DESC, id DESC`, dan filter yang diterapkan sebelum pagination. GET daftar menerima `page` (mulai 1), `pageSize` (bawaan 24, maksimal 100), `q` (judul/penyelenggara), dan `status` (`all`, `active`, `archived`). Respons `data` berbentuk `{ items, total, page, pageSize }`. Tidak ada lagi batas tersembunyi 200 kegiatan. Tanggal awal/akhir dan tahun awalan nomor kegiatan baru mengikuti pengaturan zona waktu aplikasi.

## Endpoint

Semua endpoint pengelolaan memerlukan sesi dan izin pengelola.

| Metode | URL setelah `/api/e-sertifikat` | Fungsi |
|---|---|---|
| GET / POST | `/` | Daftar / membuat kegiatan |
| GET | `/signers` | Daftar nama pegawai untuk penandatangan (akses pengelola) |
| GET | `/:eventId/geometry/:assetId` | Ukuran asli template, resolusi gambar, dan rotasi PDF |
| GET / PATCH | `/:eventId` | Detail / menyimpan kegiatan dan template |
| POST | `/excel` | Membaca dan memvalidasi lembar pertama Excel |
| POST | `/:eventId/recipients` | Impor peserta sebagai draf |
| PATCH / DELETE | `/:eventId/recipients/:id` | Memperbaiki / menghapus draf |
| POST | `/:eventId/preview` | Membuat pratinjau PDF |
| POST | `/:eventId/issue` | Penerbitan atomik peserta terpilih |
| GET | `/:eventId/certificates/:id/pdf` | Unduh PDF sertifikat aktif |
| POST | `/:eventId/download` | Unduh ZIP sertifikat aktif terpilih |
| POST | `/:eventId/certificates/:id/revoke` | Mencabut sertifikat |
| POST | `/:eventId/assets` | Mengunggah template/dokumentasi/persuratan |
| GET / PATCH / DELETE | `/:eventId/assets/:id` | Membaca / mengubah publikasi / menghapus berkas |

Endpoint publik hanya baca:

- `GET /api/public/e-sertifikat/:token`
- `GET /api/public/e-sertifikat/:token/files/:assetId`

Berkas publik harus terkait kegiatan dari token aktif, berstatus publik, dan bukan template. Token sertifikat dari kegiatan lain tidak dapat membuka berkas tersebut.

Pembatasan publik memakai upsert atomik di PostgreSQL: 120 permintaan per token per 60 detik (verifikasi dan berkas digabung), serta 1.200 permintaan publik secara keseluruhan per 60 detik. Batas global melindungi dari pergantian token; header `X-Forwarded-For`/`CF-Connecting-IP` tidak dipakai sebagai identitas terpercaya. Ini merupakan kuota bersama, bukan kuota per IP: satu token yang ramai dibagikan berbagi kuota, dan lonjakan/penyalahgunaan dapat menghabiskan kuota global. Respons kelebihan kuota adalah HTTP 429 dengan `Retry-After: 60`. Penghitung berlaku lintas proses/restart; bucket kedaluwarsa dibersihkan pada awal periode global berikutnya. Database tidak tersedia berarti permintaan tidak diteruskan tanpa pembatasan. Pembatasan trafik di proxy tetap diperlukan untuk serangan jaringan bervolume besar.

## Aktivasi dan deployment

Migrasi awal sudah dijalankan pada database aplikasi yang dikonfigurasi di lingkungan kerja; hasil awal tercatat pada `artifacts/e-sertifikat-migration.json`. Pada 21 Oktober 2026 migrasi tambahan juga diterapkan pada database yang dirujuk `apps/api/.env`: kolom `ecert_recipients.revision` tersedia dan tabel `ecert_public_limits` memiliki RLS aktif. Snapshot dan identitas sertifikat terbit tetap dipertahankan. Deployment produksi mengikuti workflow GitHub setelah perubahan dipush.

Migrasi bersifat tambahan dan dapat dijalankan ulang. Workflow deployment sudah menyertakan migrasi ini sebelum aplikasi baru diaktifkan. Untuk menjalankan secara manual, gunakan koneksi aplikasi:

```text
node node_modules/prisma/build/index.js db execute --schema apps/api/prisma/schema.prisma --file apps/api/prisma/sql/20261016_e_sertifikat.sql
node node_modules/prisma/build/index.js db execute --schema apps/api/prisma/schema.prisma --file apps/api/prisma/sql/20261021_e_sertifikat_hardening.sql
```

Admin mendapatkan halaman baru melalui resolver akses. Berikan akses halaman `e-sertifikat` kepada pegawai yang ditugaskan melalui Pengaturan Akses. Tidak ada pemberian izin penerbitan massal kepada seluruh guru secara otomatis.

Format Excel contoh tersedia di `apps/web/public/templates/peserta-e-sertifikat.xlsx` dan versi CSV pada folder yang sama.

## Verifikasi implementasi

Laporan implementasi awal di `artifacts/e-sertifikat-test-results.json` mencatat 85 pemeriksaan fungsi/keamanan. Laporan tersebut merupakan hasil historis; pengujian antarmuka, database, dan QR perlu dijalankan ulang bila alur terkait berubah.

Perbaikan 21 Oktober 2026 memiliki pengujian regresi terpisah (24 kasus) pada `apps/web/test/e-sertifikat-security.test.cjs`: impor XLSX/CSV, formula, header berbahaya, arsip dengan metadata palsu, koordinat sangat besar, alias lokasi worksheet, ID lembar berlebihan, konflik revisi, pagination lebih dari 200 kegiatan, pembatasan publik antar-handler dengan header IP palsu, konkurensi, pembersihan bucket, dan pergantian tanggal/tahun di zona waktu sekolah. Pengujian ini memakai batas database tiruan dan tidak mengubah data aplikasi.

Hasil perbaikan: 24 kasus regresi lokal, 95 pemeriksaan integrasi pada skema PostgreSQL sementara, dan pemeriksaan TypeScript web lolos. Pemeriksaan gabungan e-Sertifikat, Kinerja Guru, dan Notulensi mencakup 65 tes yang seluruhnya lolos. Hasil tercatat di `artifacts/e-sertifikat-hardening-results.json`. Migrasi tambahan telah diterapkan pada database konfigurasi lingkungan kerja. Pengujian browser e-Sertifikat telah dijalankan ulang: pembuatan kegiatan, unggah template, pemetaan Excel, perubahan peserta, penerbitan, publikasi berkas, verifikasi publik, pencarian kegiatan, serta layout 320–1280 piksel lolos dengan data tiruan. Hasil gambar disimpan sementara di `scratch/review-ui/`.

- `node --test --test-isolation=none apps/web/test/e-sertifikat-security.test.cjs`: regresi lokal tanpa database aplikasi.

- `node artifacts/verify-e-sertifikat.cjs`: pengujian terhadap skema PostgreSQL sementara yang dihapus setelah pengujian, termasuk otorisasi, transaksi, konkurensi, snapshot, pembacaan dokumen, pencabutan, validasi Excel, dan endpoint HTTP.
- `node artifacts/verify-e-sertifikat-ui.cjs`: pengujian browser dengan data contoh, termasuk unggah template, pemetaan Excel, perbaikan identitas, penerbitan, dokumen privat/publik, verifikasi aktif/dicabut/tidak ditemukan, serta lebar 320–1280 piksel.
- QR PDF contoh dirender menjadi gambar dan berhasil didekode ke URL verifikasi yang benar. Sertifikat contoh hanya memakai data uji; rekaman verifikasinya tidak disimpan sebagai sertifikat nyata.
- Hasil dan tangkapan layar tersimpan pada `artifacts/e-sertifikat-*`; contoh PDF pada `output/pdf/`.
- Pemeriksaan rute aplikasi langsung: endpoint pengelolaan anonim ditolak 401, halaman pengelolaan dialihkan ke login, halaman verifikasi anonim dapat dibuka 200, dan token tidak dikenal dijawab 404 oleh API publik.
- Server pengujian dapat memakai `DISABLE_WHATSAPP_AUTOSTART=true` agar pengujian tidak mengaktifkan koneksi WhatsApp otomatis; perilaku server normal tetap sama jika variabel tidak disetel.

## Batas versi awal

Template bukan editor desain grafis: dekorasi, isi kegiatan, logo, tanda tangan/stempel yang ingin dicetak disiapkan pada desain unggahan. Aplikasi menambahkan data penerima, nomor, nama/jabatan penandatangan, dan QR pada posisi yang diatur. Nama dan jabatan adalah keterangan penandatangan pada sertifikat; fitur ini belum melakukan penandatanganan elektronik tersertifikasi. Snapshot lama dengan posisi persentase tetap memakai aturan render lama, termasuk ukuran A4 gambar lama, agar sertifikat terbit tidak berubah. Font overlay menggunakan Helvetica/Helvetica Bold; karakter di luar cakupan font Latin ditolak saat pratinjau/penerbitan dengan pesan yang dapat diperbaiki, bukan dihilangkan diam-diam. Penerapan font khusus, penandatanganan digital eksternal, serta pengiriman otomatis melalui email/WhatsApp belum termasuk versi ini.

### Pemeriksaan editor presisi

Pengujian mencakup koordinat desimal, tombol arah dengan modifier, drag pada zoom berbeda, tiap kolom identitas dari Excel, penandatangan dan jabatan pada snapshot/verifikasi, ukuran PNG 96/300 dpi, PDF berotasi 90/180/270 derajat, penolakan ukuran halaman palsu, dan editor pada lebar 320–1280 piksel. Worker PDF disajikan dari aplikasi sendiri melalui `/api/public/e-sertifikat-worker`, tanpa CDN. Pratinjau menerima tata letak draf sementara dan tetap memeriksa kepemilikan template. Tidak ada perubahan skema database tambahan untuk editor ini.

### Konsistensi tampilan dan pemeriksaan sebelum push

Halaman menggunakan FAB bersama: tombol melayang pada desktop dan aksi Tambah di tombol tengah bottomnav mobile. Daftar kegiatan, filter, kartu, tombol aksi bersama, dan mode gelap disesuaikan dengan dashboard. Pengujian browser mencakup pembukaan modal melalui kedua FAB, pencarian/reset filter, serta alur lengkap sebelumnya. Pemeriksaan unggahan menolak dimensi PNG berlebih sebelum dekompresi dan menolak Excel melebihi 500 peserta tanpa pemotongan diam-diam.
