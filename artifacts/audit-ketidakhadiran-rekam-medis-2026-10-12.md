# Audit ketidakhadiran dan rekam medis — 12 Oktober 2026

> Tindak lanjut: temuan di bawah telah diperbaiki. Cetak ulang tetap menghapus surat lama sesuai instruksi pengguna, kini dengan otorisasi dan transaksi penggantian. Bukti dan nomor baris di bawah adalah kondisi historis sebelum perbaikan. Rincian akhir ada di `artifacts/perbaikan-ketidakhadiran-rekam-medis-2026-10-12.md`; runner kini menjalankan 33 pemeriksaan regresi, bukan 11 reproduksi awal.

## Kesimpulan

Ditemukan 15 temuan: 1 kritis, 5 tinggi, dan 9 sedang. Prioritas utama adalah menutup pembuatan surat tanpa autentikasi, kebocoran data medis melalui endpoint ketidakhadiran, dan jalur HTML/URL yang tidak dibatasi.

Audit dilakukan terhadap source workspace saat ini, termasuk perubahan lokal yang sudah ada. Tidak mengubah implementasi aplikasi, tidak mengakses database produksi, tidak mengirim WhatsApp, dan tidak mengeksploitasi layanan aktif. Sebelas pemeriksaan lokal dengan stub database mereproduksi perilaku bermasalah. Pemeriksaan yang lulus berarti masalah berhasil direproduksi, bukan aplikasi aman. Temuan source tidak membuktikan adanya eksploitasi yang sudah terjadi. Reverse proxy atau pembatasan infrastruktur yang tidak ada dalam workspace belum diverifikasi.

## Temuan keamanan

### 1. Kritis — pembuatan dan penghapusan surat tanpa autentikasi

**Bukti:** `apps/web/app/api/ketidakhadiran/generate-letter/route.ts:57`, `:74`, `:323`; matcher `apps/web/middleware.ts:385` mengecualikan `/api`. Handler tidak memanggil pemeriksaan sesi/role dan langsung memakai Prisma. Guard Nest tidak dilewati karena route ini tidak menghubungi Nest.

**Pemicu:** POST tanpa token dengan `letterType` dan `row` dapat membuat surat resmi menggunakan identitas siswa, petugas, dan pejabat yang dipasok pemanggil. `forceReprint:true` dan `oldLetterId` menghapus surat berdasarkan ID sebelum validasi dan pembuatan pengganti. Respons duplicate juga mengembalikan record surat yang ditemukan.

**Dampak:** pemalsuan arsip/verifikasi surat; penghapusan surat jika ID diketahui; kemungkinan pengungkapan metadata melalui pencarian duplicate. Penghapusan bisa tetap terjadi sekalipun proses pengganti gagal.

**Perbaikan:** validasi sesi aktif dan hak OP_IZIN/OP_UKS sesuai jenis surat sebelum akses database; ambil data siswa dan petugas dari sumber server; izinkan cetak ulang dengan otorisasi record dan transaksi. Jangan mengandalkan middleware halaman.

### 2. Tinggi — endpoint log umum membocorkan data siswa lain

**Bukti:** `apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:81`; service `:756`, `:807`, `:835`. Endpoint `GET /ketidakhadiran/log` tidak memiliki RequiresPage/PegawaiGuard. PageAccessGuard meloloskan method tanpa metadata. Parameter `apiUser` tidak dipakai dalam `getLog`; query dan respons `...r` mencakup seluruh siswa, keluhan, tindakan, tindak lanjut, dan URL berkas.

**Pemicu:** akun SISWA/ORANG_TUA/TAMU yang memiliki JWT valid memanggil log history, tanpa pembatasan diri/anak/penugasan. Kontrol IDOR pada `getLogSiswa` tidak melindungi endpoint alternatif ini.

**Dampak:** kebocoran informasi kesehatan dan identitas lintas siswa. Direproduksi di stub dengan akun SISWA dan record siswa berbeda.

**Perbaikan:** batasi scope pada server untuk setiap jenis akun, berlaku juga pada statistik. Kembalikan kolom minimum untuk pembaca presensi; pisahkan rincian kesehatan dari log umum.

### 3. Tinggi — detail ketidakhadiran membuka seluruh rekam medis

**Bukti:** service `:324` menggunakan `include: { rekam_medis_siswa: true }`; controller `:279` tidak memeriksa akses halaman rekam-medis atau scope record.

**Pemicu:** OP_IZIN atau pegawai yang memiliki halaman ketidakhadiran mengambil ID ketidakhadiran sakit melalui daftar/log lalu memanggil detailnya. Detail mengembalikan riwayat penyakit, alergi, keluhan, alamat dan biodata medis meskipun pemanggil tidak memiliki akses rekam-medis.

**Perbaikan:** hapus full include dari endpoint umum; beri endpoint khusus rincian medis dengan otorisasi eksplisit. Hanya ID/nomor referensi yang perlu dikembalikan kepada pembaca ketidakhadiran.

### 4. Tinggi — URL arsip memungkinkan SSRF dan HTML pada origin aplikasi

**Bukti:** service `:1974` menerima `file_url/fileUrl` tanpa validasi; controller save-letter hanya memeriksa akses halaman, tanpa pemisahan jenis operator. `apps/web/app/api/ketidakhadiran/pdf-preview/route.ts:45` melakukan fetch URL tersebut; `:51` menyajikan URL berakhiran HTML sebagai `text/html` secara inline.

**Pemicu:** pengguna yang lolos guard save-letter mengganti URL arsip dengan alamat internal atau HTML yang dikuasainya, kemudian membuka preview publik berdasarkan barcode. Fetch mengikuti redirect secara default, tanpa allowlist tujuan, batas ukuran, atau timeout eksplisit.

**Dampak:** server mengakses layanan internal yang dapat dijangkaunya; untuk HTML berbahaya, script berjalan pada origin aplikasi saat korban membuka preview. Luas dampak SSRF bergantung pada jaringan server. XSS dapat memakai sesi korban melalui permintaan same-origin meskipun cookie HttpOnly.

**Perbaikan:** simpan identitas objek storage tepercaya, bukan URL bebas; batasi tujuan dan redirect serta ukuran/waktu fetch. Sajikan arsip HTML sebagai attachment atau dari origin terisolasi dengan sandbox. Periksa kewenangan jenis surat pada save-letter.

### 5. Tinggi — stored XSS dalam cetakan dan dialog medis

**Bukti:** `apps/web/app/rekam-medis/view.tsx:365`, `:398`, `:451`, `:468`, `:897`. Keluhan, tindakan, biodata dan preset dimasukkan langsung ke string HTML; printWindow.document.write menjalankannya. Preset juga dimasukkan mentah ke atribut `value` dialog SweetAlert. Service menerima teks tersebut tanpa pembatasan HTML.

**Pemicu:** teks medis berisi markup/event handler tersimpan, kemudian staf lain mencetak data atau membuka dialog edit preset. Popup dari window.open('','_blank') mewarisi origin pemanggil.

**Dampak:** script di browser staf/pencetak dapat membaca halaman atau melakukan operasi memakai sesi staf. Penulis awal membutuhkan hak UKS/admin atau jalur data lain yang memasukkan teks tersebut; bukan celah anonim yang berdiri sendiri.

**Perbaikan:** escape semua teks sebelum membuat HTML, gunakan DOM textContent untuk teks dan atribut, dan hindari SweetAlert `html` untuk data pengguna. Template surat ketidakhadiran tunggal/kolektif sudah memakai escapeHtml pada banyak kolom; masalah yang dikonfirmasi di sini ada pada cetakan medis.

### 6. Tinggi — perpindahan jenis melewati kewenangan operator

**Bukti:** service `:597` memeriksa jenis record lama, tetapi `:618` menerima perubahan `payload.jenis` tanpa memeriksa jenis tujuan. Input manual `:507` hanya menolak dua nilai persis IZIN/SAKIT; jenis lainnya diterima, berbeda dari jalur import yang memvalidasi enum. Schema memakai String, bukan enum.

**Pemicu:** OP_IZIN mengubah IZIN menjadi SAKIT. Pegawai pemegang halaman mengirim jenis lain seperti LAIN; record tersebut tidak terkena cabang pembatasan jenis pada update/remove.

**Perbaikan:** whitelist jenis/status pada DTO dan validasi server; jangan izinkan perubahan jenis atau periksa kewenangan atas jenis lama serta baru. Tolak nilai tidak dikenal secara default.

## Temuan fungsional dan integritas

### 7. Sedang — sinkronisasi manual dan preset salah diarahkan

**Bukti:** `apps/web/app/api/ketidakhadiran/rekam-medis-siswa/route.ts:11` tidak meneruskan query pada POST. UI `view.tsx:259` mengirim `?action=save_presets` dengan body hanya presets; `:696` mengirim `?action=sync_ketidakhadiran` dengan body id/mappedStatus. Controller memerlukan query action atau body.action.

**Akibat:** keduanya masuk ke createRekamMedisSiswa, bukan operasi yang dimaksud; body tidak punya NISN/nama sehingga gagal validasi Prisma. Preset UI sudah berubah secara lokal dan helper tidak memeriksa keberhasilan respons server, sehingga tampak tersimpan tetapi tidak persisten lintas perangkat.

**Perbaikan:** teruskan query POST atau kirim action eksplisit dalam body; cek status/ok dan tampilkan kegagalan sebelum menyatakan tersimpan.

### 8. Sedang — perubahan lintas tabel tidak atomik

**Bukti:** service `:1818`, `:1870`, `:1916`, `:1930`, `:1959`, `:1965` menjalankan perubahan medis/ketidakhadiran terpisah tanpa transaksi. update/remove ketidakhadiran juga memakai beberapa write terpisah.

**Akibat:** jika write kedua gagal, rekam medis tetap tersimpan/teredit/terhapus sementara ketidakhadiran berbeda, tetapi respons gagal. Pengguna yang mencoba ulang bisa membuat duplikat. Direproduksi dengan kegagalan auto-sync setelah create medis.

**Perbaikan:** transaksi untuk write terkait dan idempotency key untuk create/retry.

### 9. Sedang — nomor RM/surat dan sinkronisasi rentan kondisi balapan

**Bukti:** nomor RM `:1805` membaca nomor terakhir lalu membuat record; schema `:3800` hanya indeks non-unique. Surat generate-letter `:179` membaca nomor terakhir/sequence dan menulis kembali; nomor surat di schema unique. sync `:1617` memeriksa keberadaan sebelum create tanpa constraint satu record aktif per RM.

**Akibat:** dua input medis bersamaan mendapat nomor sama (direproduksi). Cetak surat bersamaan dapat gagal dengan benturan unique; sequence yang terpisah dari create juga bisa berubah walau create gagal. Sinkronisasi bersamaan dapat menggandakan ketidakhadiran.

**Perbaikan:** sequence/increment atomik atau lock transaksi; constraint unique sesuai aturan bisnis; upsert/idempotency untuk relasi sinkron.

### 10. Sedang — operasi ALL bisa mengenai record yang tidak satu rombongan

**Bukti:** service `:635` dan `:701` memakai seri_id jika ada, tetapi fallback mengelompokkan hanya tanggal, jenis, dan keterangan. Jalur import tidak menetapkan seri_id. Input manual menerima seri_id dari payload tanpa verifikasi keanggotaan.

**Akibat:** dua input terpisah yang kebetulan sama periode dan keterangannya dapat teredit/terhapus bersama. Record dalam seri yang sama tidak diverifikasi ulang kewenangannya satu per satu; update ALL juga hanya memperbarui RM milik record pertama.

**Perbaikan:** ALL wajib menggunakan grup eksplisit yang dibentuk server; batasi scope setiap anggota dan sinkronkan seluruh RM terkait dalam transaksi.

### 11. Sedang — status sakit tidak konsisten dengan tindak lanjut

**Bukti:** updateRekamMedisSiswa `:1930` memperbarui keluhan/tindakan/tindak_lanjut tanpa status. sync `:1614` menerima mappedStatus mentah termasuk NONE dan mapping default tidak menangani Kontrol. UI `:692` mengutamakan row.synced_status lama saat sinkron manual.

**Akibat:** tindak lanjut berubah tetapi kategori sakit tetap lama; NONE malah membuat record SAKIT dengan status NONE. Setelah bug nomor 7 diperbaiki, sinkron UI masih dapat mempertahankan status lama.

**Perbaikan:** satu fungsi mapping server yang memakai konfigurasi tervalidasi; tentukan makna NONE secara eksplisit dan konsistensi edit/sync.

### 12. Sedang — statistik durasi dan absensi per jam salah

**Bukti:** service `:834`, `:1273` memakai hari kalender × 8 tanpa waktu/is_kontinu. `getAbsensi` `:1327` menerima jamKe tetapi tidak memakainya. Sebaliknya `apps/web/lib/ketidakhadiran-jp.ts:16` mendefinisikan satu hari = 24 JP dan menghitung jam aktual; KehadiranSiswaTab memakai hasil backend untuk jumlah_jp dan helper 24 JP untuk konversi hari.

**Akibat:** izin 08.00–09.00 dihitung 8 JP (direproduksi); izin satu hari penuh bisa tampil sebagai 8 JP/24 hari, bukan satu hari. Siswa berizin sebagian jam terdeteksi absen pada jam lain melalui endpoint absensi.

**Perbaikan:** satukan perhitungan waktu di modul shared dengan aturan kalender/jam sekolah yang disepakati; gunakan jamKe dan jadwal dalam pembacaan absensi.

### 13. Sedang — cetak rekap gagal karena variabel origin tidak tersedia

**Bukti:** `apps/web/app/api/ketidakhadiran/generate-letter/route.ts:245` mengirim `appBase: origin`, sementara variabel lokal yang tersedia adalah scanBase.

**Akibat:** cabang REKAPAN_IZIN/REKAPAN_SAKIT berpotensi ReferenceError di runtime server; tidak dapat menghasilkan HTML/arsip rekap. Sequence izin sudah ditulis sebelumnya dan cetak ulang sudah dapat menghapus surat lama.

**Perbaikan:** pakai scanBase dan pastikan seluruh proses, termasuk cetak ulang, baru commit setelah validasi serta rendering berhasil. Temuan ini berasal dari source; branch belum dijalankan pada Next server dalam audit.

### 14. Sedang — validasi identitas, rentang waktu dan pagination tidak lengkap

**Bukti:** controller menerima body/query any; ValidationPipe global tidak mempunyai DTO tervalidasi untuk objek tersebut. Create medis `:1821` mempercayai nama, kelas, biodata dari browser; input manual tidak menolak siswa master yang tidak ditemukan atau tanggal akhir sebelum awal. `getLog :761`, `getRekamMedisSiswa :1731` mengizinkan hasil parseInt NaN; mode log selain history/today dapat mengambil semua baris tanpa pagination. getLog default tanggal UTC, sedangkan getSchoolToday tersedia tetapi tidak digunakan di sini.

**Akibat:** record palsu atau periode terbalik; request parameter salah menyebabkan 500; query besar tidak terbatasi pada sejumlah jalur; tanggal hari ini salah pada 00.00–07.59 WITA jika UI tidak mengirim tanggal.

**Perbaikan:** DTO dengan enum, batas panjang/jumlah, tanggal valid dan urutan rentang; lookup siswa server; parsing angka finite; whitelist mode serta batas pagination; pakai zona sekolah untuk tanggal default.

### 15. Sedang — identitas petugas pada import dapat dipalsukan

**Bukti:** service `:458` menerima petugas_nama, petugas_nip dan petugas_role dari setiap baris import sebelum fallback ke sesi. Nilai generated_by pada create surat backend `:2254` juga berasal dari row.petugas_nama. Tidak ada identitas aktor sesi yang terpisah pada operasi ini.

**Akibat:** operator sah dapat membuat catatan seolah petugas lain yang memasukkan; pertanggungjawaban arsip menjadi tidak dapat diandalkan. Import sejarah mungkin membutuhkan nama petugas asli, tetapi tetap harus merekam aktor import secara terpisah.

**Perbaikan:** pisahkan petugas historis dan actor yang melakukan write; identitas actor wajib dari sesi, dengan audit create/update/delete.

## Catatan tambahan

- Preview surat memang sengaja publik melalui barcode. Namun preview rekap menghitung ulang data kesehatan seluruh periode dari database terkini (`pdf-preview/route.ts:108`), bukan snapshot arsip. Isi surat dapat berubah setelah ditandatangani; siapa pun pemegang barcode mendapat data periode terbaru. Tetapkan apakah publik cukup memperoleh metadata verifikasi, sedangkan isi kesehatan memerlukan autentikasi atau izin berbagi khusus.
- Fallback cetak kolektif (`pdf-preview/route.ts:168`) mengambil seluruh ketidakhadiran pada tanggal tersebut jika daftar NISN tidak menghasilkan baris. Ini berpotensi menyertakan siswa di luar surat; fallback harus tetap dibatasi daftar penerima dan jenis.
- Preview HTML dinamis diberi `Cache-Control: public, max-age=60, s-maxage=300`. Untuk dokumen yang memuat kesehatan, gunakan kebijakan cache sesuai model berbagi dan mekanisme pencabutan; jangan menganggap barcode otomatis setara izin publik permanen.
- Barcode memakai Math.random dan tidak memiliki masa berlaku. Ini bukan bukti barcode dapat langsung ditebak, tetapi tidak sesuai untuk token pembagian akses data sensitif; gunakan token kriptografis, scope, dan pencabutan.

## Verifikasi dan urutan perbaikan

Jalankan `node artifacts/audit-ketidakhadiran-rekam-medis-checks.cjs` dari root workspace. Hasil audit: **11/11 pemeriksaan reproduksi lulus**. File ini hanya mengeksekusi source service dengan stub, ditambah pemeriksaan hubungan source proxy/handler; tidak menguji deploy, UI browser, jaringan SSRF, atau payload XSS secara langsung. Runner `node --test` gagal spawn EPERM dalam sandbox, sehingga file dijalankan langsung menggunakan node:test tanpa child process.

1. Tutup route generate-letter dan batasi log/detail medis (temuan 1–3).
2. Batasi URL arsip, aman-kan HTML medis, dan perketat hak jenis data (4–6).
3. Perbaiki action proxy serta rekap yang gagal (7, 13).
4. Terapkan transaksi, idempotency, nomor atomik dan grup eksplisit (8–10).
5. Satukan status/durasi, validasi input dan identitas audit (11–12, 14–15).

Tidak menjalankan build seluruh aplikasi karena workspace memiliki banyak perubahan lain dan audit ini tidak mengubah source aplikasi. Build/typecheck maupun uji browser dan akses per role pada deploy perlu dilakukan setelah perbaikan.

