# Audit Keuangan — 12 Oktober 2026

Audit mencakup keenam tab halaman Keuangan ACCA: Pengajuan Saya, Antrean Persetujuan, Pencairan, Pagu, Arsip & Laporan, serta Pengaturan. Pemeriksaan dilakukan pada kode frontend, proxy API Next.js, controller/service NestJS, adapter query Prisma, dan skema database dalam repositori.

Tidak ada transaksi, akun, atau data produksi yang diubah. Verifikasi memakai data tiruan dan browser terisolasi. Temuan belum merupakan hasil pengujian terhadap database produksi atau bukti bahwa celah telah dieksploitasi. Uraian F01–F12 di bawah mendokumentasikan kondisi sebelum perbaikan. Status implementasi dan pengujian terbaru tercantum pada bagian berikut.

## Status perbaikan

Seluruh temuan F01–F12 telah ditangani dalam kode lokal:

- F01: label nama item dan kategori pada dialog pencairan di-escape sebelum dimasukkan ke HTML.
- F02–F03: seluruh nominal item dan tautan bukti/laporan dimask untuk pembaca tanpa hak; pembacaan pencairan memeriksa hak terhadap pengajuan induk.
- F04–F05: mutasi Keuangan utama menggunakan transaksi database dan advisory lock lintas proses. Kesalahan adapter maupun respons gagal membatalkan seluruh perubahan. Realisasi item dicatat secara kumulatif.
- F06: persetujuan, pencairan, penyesuaian, dan transfer memeriksa pagu serta komitmen pengajuan tahun yang sama.
- F07: unggahan PDF memulai verifikasi KTU; penggantian laporan mengulang verifikasi. Pelaporan dibatasi pada tahap yang sesuai dan pengarsipan memerlukan dana, nota, serta penerimaan laporan yang lengkap.
- F08–F10: perhitungan pagu mengambil realisasi item; tab Pagu menampilkan ringkasan, tahun, tujuan transfer, arah penyesuaian, dan riwayat. Hanya Bendahara mendapatkan kontrol perubahan pagu.
- F11–F12: frontend mengenali ADMINISTRATOR dan revisi mempertahankan field bukti yang benar.

Penguatan tambahan: endpoint utama memakai PageAccessGuard; input item dan jabatan divalidasi; URL lampiran wajib HTTP/HTTPS dan tercatat sebagai milik pemanggil; PDF laporan diperiksa signature-nya. Unggahan keuangan mengembalikan kegagalan jika registry kepemilikan tidak berhasil disimpan.

Verifikasi: 19 pengujian backend dengan data tiruan lulus. Pemeriksaan browser terisolasi terhadap dialog XSS dan tab Pagu serta pengujian kegagalan registry juga lulus. Pemeriksaan tipe API dan web serta `git diff --check` lulus. Skrip `node artifacts/audit-keuangan-checks.cjs` kini menjalankan pengujian regresi kondisi sesudah perbaikan.

Batas verifikasi: belum diuji dengan PostgreSQL pengujian atau perangkat pengguna secara langsung. Simulasi transaksi membuktikan alur penanganan konflik dan rollback pada kode, tetapi tidak menggantikan pengujian integrasi PostgreSQL. Perubahan belum dideploy dan tidak mengoreksi transaksi historis secara otomatis.

## Cakupan per tab

| Tab | Temuan terkait |
| --- | --- |
| Pengajuan Saya | F01, F05, F07, F12: nama item dapat menjadi sumber XSS; revisi tidak atomik; pelaporan terlalu dini; lampiran dapat hilang saat revisi. |
| Antrean Persetujuan | F02, F06: nominal masih bocor di respons; persetujuan tidak memeriksa sisa pagu/pencadangan dana. |
| Pencairan | F01, F03, F04: XSS pada dialog; pembacaan pencairan lintas divisi; pencairan/akumulasi penerimaan berpotensi balapan. |
| Pagu | F05, F06, F08, F09, F10: mutasi tidak atomik, saldo tersedia tidak dipakai untuk transfer, realisasi tidak terambil, ringkasan tidak dirender, dan hak tombol berbeda dari API. |
| Arsip & Laporan | F02, F03, F07: kebocoran nominal, pembacaan lintas divisi, dan transisi pelaporan/arsip tidak konsisten. |
| Pengaturan | F11: akun berperan ADMINISTRATOR diterima backend tetapi tidak dikenali frontend. |

## Temuan

### F01 — P1 — Stored XSS pada dialog pencairan

Lokasi: `apps/web/app/keuangan/view.tsx:635`, sumber input `apps/api/src/keuangan/keuangan.service.ts:1391`.

Nama item dari pengajuan dimasukkan langsung ke string HTML SweetAlert, tanpa escaping/sanitasi. Nama barang hanya diperiksa agar tidak kosong sebelum disimpan. Ketika Bendahara membuka dialog pencairan pengajuan tersebut, HTML buatan pemohon dirender di origin aplikasi.

Terbukti dengan template asli dan SweetAlert terpasang: nama item berupa elemen gambar dengan event handler menyalakan penanda JavaScript pada browser terisolasi. Penanda hanya dipakai untuk pembuktian; tidak ada pengambilan cookie, pengiriman jaringan, atau operasi API nyata.

Dampak: JavaScript berjalan dalam sesi Bendahara. Cookie HttpOnly tidak mencegah skrip tersebut melakukan permintaan dengan sesi korban.

Perbaikan: bangun isi dialog dengan elemen React/DOM dan `textContent`, atau escape setiap nilai teks/atribut. Jangan menerima HTML aktif sebagai nama item.

### F02 — P1 — Nominal yang dimask masih bocor lewat rincian item

Lokasi: `apps/api/src/keuangan/keuangan.service.ts:563`, `:737`.

`maskRequest` mengosongkan `total_amount`, `total_disbursed`, dan `unit_price`, tetapi menyalin item secara utuh sehingga `total_price` dan `actual_price` tetap terkirim. Konteks `role_context=semua` sengaja bisa dipakai seluruh akun yang dikenali. Penyembunyian angka di tabel tidak menghilangkan data dari respons jaringan.

Verifikasi data tiruan: `total_amount=null` dan `unit_price=null`, tetapi nilai `total_price=400000` serta `actual_price=350000` masih terbaca.

Perbaikan: gunakan daftar field respons yang diizinkan untuk setiap kewenangan; hilangkan seluruh field nominal dan evaluasi juga lampiran yang memuat nominal.

### F03 — P1 — Kepala Divisi dapat membaca pencairan divisi lain

Lokasi: `apps/api/src/keuangan/keuangan.service.ts:756`.

Action `get_disbursements` hanya memeriksa apakah pemanggil admin atau memiliki jabatan keuangan apa pun. Pengajuan yang diminta tidak diperiksa terhadap `divisionIds` atau `canSeeNominal`. Ini bertentangan dengan aturan nominal Kepala Divisi yang dibatasi ke divisinya.

Verifikasi handler asli dengan database tiruan: Kepala Divisi A mendapat HTTP 200 beserta nilai pencairan pengajuan divisi B.

Perbaikan: ambil pengajuan induk, cek kewenangan per pengajuan, baru baca riwayat pencairannya.

### F04 — P1 — Pencairan bersamaan dapat melebihi total pengajuan

Lokasi: `apps/api/src/keuangan/keuangan.service.ts:1085`, `:1105`, `:1176`.

Pemeriksaan status dan sisa dana dilakukan terpisah dari INSERT pencairan. Tidak ada transaksi atau penguncian pengajuan yang mencakup pembacaan saldo, INSERT, perubahan status, dan log. Dua permintaan dapat membaca sisa yang sama sebelum keduanya memasukkan pencairan.

Verifikasi handler asli pada fixture: dua panggilan bersamaan masing-masing 80 terhadap pengajuan senilai 100 sama-sama mendapat HTTP 200; total pencairan menjadi 160.

Konfirmasi penerimaan mengklaim baris pencairan secara kondisional, sehingga klaim ulang baris yang sama sudah dibatasi. Namun konfirmasi dua kelompok pencairan berbeda masih memperbarui `total_disbursed` dengan read-modify-write; membaca ulang nilai bukan jaminan atomisitas.

Perbaikan: transaksi dengan penguncian pengajuan, batas saldo atomik, identitas permintaan untuk retry, serta akumulasi saldo di database.

### F05 — P1 — Mutasi dan revisi dapat meninggalkan data setengah tersimpan

Lokasi: `apps/api/src/keuangan/keuangan.service.ts:889`, `:897`, `:910`, `:980`.

Transfer mengurangi divisi asal, menambah divisi tujuan, lalu mencatat mutasi dalam operasi terpisah. Kegagalan operasi kedua/ketiga tidak mengembalikan operasi sebelumnya. Penyesuaian pagu juga memisahkan perubahan saldo dan riwayat mutasi.

Pada revisi pengajuan, header diubah, rincian lama dihapus, lalu rincian baru dimasukkan. Kegagalan INSERT terakhir dapat meninggalkan header baru tanpa rincian lama maupun baru. Beberapa hasil DELETE/UPDATE/log tidak diperiksa sebelum mengembalikan sukses.

Perbaikan: transaksi untuk satu aksi bisnis, penguncian baris yang sesuai, dan pemeriksaan seluruh hasil query. Transaksi penggantian register sudah ada, tetapi tidak melindungi operasi keuangan lainnya.

### F06 — P1 — Transfer memeriksa plafon, bukan saldo yang masih tersedia

Lokasi: `apps/api/src/keuangan/keuangan.service.ts:881`, `:1053`.

Pemeriksaan transfer memakai `fromB.total_budget`. Nilai ini tidak dikurangi oleh pencairan/konfirmasi pada service ini, sementara dana yang sudah dicadangkan baru dihitung terpisah pada `get_budgets`. Penyesuaian negatif juga tidak memperhitungkan pengajuan aktif. Persetujuan menuju antrean pencairan tidak melakukan pemeriksaan/cadangan sisa pagu.

Contoh dari alur kode: plafon 10 juta, pengajuan aktif 9 juta, sisa tersedia 1 juta. Transfer 5 juta masih lolos pemeriksaan plafon 10 juta dan dapat membuat sisa tampilan menjadi minus.

Perbaikan: definisikan satu sumber saldo tersedia, perhitungkan komitmen/pencairan, dan lakukan pemeriksaan serta pencadangan secara atomik.

### F07 — P1 — Alur laporan dapat macet atau dimulai terlalu dini

Lokasi: `apps/api/src/keuangan/keuangan.service.ts:1198`, `:1210`, `:1273`; skema `apps/api/prisma/schema.prisma:836`.

Skema menetapkan default `report_status="Belum Ada"`, tetapi unggahan pertama memulai verifikasi hanya bila `!reqRow.report_status`. Nilai default tersebut truthy sehingga unggahan pertama tidak beralih ke `Menunggu KTU`; `verify_report` kemudian tidak menerima status `Belum Ada`.

Untuk baris lama dengan `report_status=null`, handler sebaliknya menerima unggahan ketika pengajuan masih `Menunggu KTU`, lalu langsung mengganti status utama ke `Proses Laporan`. Tidak ada validasi bahwa dana telah diterima, status utama sudah memenuhi syarat, atau file benar-benar PDF terdaftar milik pengunggah.

Verifikasi handler dengan fixture mengonfirmasi kedua cabang tersebut. Verifikasi final juga tidak memeriksa kelengkapan nota, penerimaan Bendahara, keberadaan file, dan total pencairan sebelum menetapkan `Arsip Selesai`.

Perbaikan: state machine eksplisit, perlakukan `Belum Ada` sebagai status awal, validasi persyaratan pelaporan/arsip di backend, dan validasi referensi berkas.

### F08 — P2 — Perhitungan pagu tidak mengambil realisasi yang dipakai

Lokasi: `apps/api/src/keuangan/keuangan.service.ts:655`, `:673`.

Query mengambil `budget_request_items(category, total_price)` tetapi kalkulasi membaca `item.actual_price` untuk pengajuan selesai. Adapter memang hanya menghasilkan field relasi yang dipilih. Akibatnya realisasi tidak tersedia dan hitungan selalu jatuh ke nilai pengajuan.

Perbaikan: ambil field realisasi dan tetapkan dengan jelas apakah realisasi item adalah nilai kumulatif atau nilai tahap pencairan terakhir.

### F09 — P2 — Tab Pagu tidak menampilkan ringkasan/riwayat dan transfer tidak dapat diisi lengkap

Lokasi: `apps/web/app/keuangan/view.tsx:134`, `:980`; `apps/web/app/keuangan/tabs/KeuanganTabPagu.tsx:34`.

Data `budgets` dan `mutations` di-fetch lalu disimpan, tetapi tidak dikirim ke komponen tab atau dirender. Komponen hanya berisi formulir pengelolaan. Kepala Divisi/PPK yang tidak boleh mengelola mendapatkan judul/deskripsi tanpa ringkasan saldo atau riwayat.

Formulir menyediakan opsi `Transfer`, tetapi tidak merender pemilihan `to_division_id`, sedangkan handler mewajibkan divisi tujuan. Transfer tidak dapat diisi lengkap melalui UI.

Perbaikan: tampilkan tabel ringkasan/riwayat untuk pembaca yang berhak dan render pilihan tujuan saat jenis mutasi Transfer.

### F10 — P2 — Tombol kelola pagu KTU tidak sesuai izin backend

Lokasi: `apps/web/app/keuangan/view.tsx:38`; `apps/api/src/keuangan/keuangan.service.ts:820`, `:841`, `:869`.

Frontend memasukkan KTU ke `canManageBudget`, tetapi ketiga operasi tulis pagu hanya menerima Bendahara. KTU melihat formulir yang akan gagal HTTP 403. Admin murni juga dimasukkan ke variabel kelola meskipun backend melarang operasi tersebut; tab Pagu admin murni saat ini disembunyikan.

Perbaikan: gunakan definisi kapabilitas yang sama untuk frontend dan backend.

### F11 — P2 — ADMINISTRATOR tidak dikenali frontend Pengaturan

Lokasi: `apps/web/app/keuangan/view.tsx:35`, `:198`; backend `apps/api/src/keuangan/keuangan.service.ts:66`.

Backend menerima ADMIN dan ADMINISTRATOR, tetapi frontend hanya menguji ADMIN. Akun yang hanya membawa role ADMINISTRATOR tidak mendapatkan tab Pengaturan meskipun API mengizinkannya.

Perbaikan: gunakan helper pemeriksaan administrator yang sama atau kapabilitas eksplisit dari respons server.

### F12 — P2 — Lampiran bukti dapat terhapus saat revisi

Lokasi: `apps/web/app/keuangan/tabs/KeuanganTabPengajuan.tsx:221`; `apps/api/src/keuangan/keuangan.service.ts:979`.

Form revisi mengisi `proof_file_url` dari `r.proof_url`, padahal API menyimpan dan mengembalikan `proof_file_url`. Form menjadi kosong dan penyimpanan berikutnya mengirim `proof_url` kosong. Backend mengubahnya menjadi null sehingga referensi bukti yang ada hilang tanpa penghapusan yang disengaja.

Perbaikan: gunakan field respons yang benar dan bedakan "tidak diubah" dari "hapus lampiran".

## Perlindungan yang sudah ada

- Controller memakai JwtAuthGuard; permintaan tanpa sesi tidak langsung dapat memakai layanan Keuangan.
- Identitas PJ pengajuan baru dipaksa ke pemanggil, bukan mengikuti `pj_user_id` dari browser.
- Persetujuan memeriksa jabatan dan divisi pada tahap yang bersangkutan.
- Penghapusan nota memeriksa relasi nota dengan pengajuan.
- Klaim ulang baris pencairan yang sama dibatasi secara kondisional.
- Penggantian nomor register memakai transaksi.

Pada saat audit awal, perlindungan tersebut belum menutup temuan di atas dan endpoint Keuangan utama belum memakai PageAccessGuard. Hal itu kini diperbaiki sebagaimana status perbaikan di atas. Daftar seluruh pengajuan untuk semua akun memang ditulis sebagai kebijakan transparansi, sehingga audit ini membedakan akses daftar yang disengaja dari kebocoran nominal yang tidak disengaja.

## Verifikasi dan urutan perbaikan

Jalankan pengujian regresi terisolasi dari root repositori: `node artifacts/audit-keuangan-checks.cjs`. Skrip tidak menghubungi database produksi, tidak menggunakan kredensial, dan memakai penanda lokal untuk memastikan HTML berbahaya tidak dieksekusi.

Urutan perbaikan mengikuti F01–F04, F05–F07, lalu F08–F12. Sebelum deployment, validasi integrasi pada basis data pengujian dengan kombinasi role PJ/Kepala Divisi/KTU/PPK/Bendahara/Admin tetap diperlukan untuk melengkapi verifikasi terisolasi.
