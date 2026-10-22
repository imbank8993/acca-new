# Audit Pengaturan Users — Hak Akses Fitur dan Akses Halaman

> **Status setelah perbaikan:** 12 temuan di bawah sudah ditangani pada kode lokal. Lihat [hasil perbaikan dan pemeriksaan](<D:/[1] ACCA Project/acca-new/artifacts/perbaikan-user-access-2026-10-22.md>). Bagian audit ini mencatat kondisi sebelum perbaikan; skrip reproduksi lamanya merupakan arsip kondisi tersebut.

Tanggal: 22 Oktober 2026. Basis pemeriksaan: kode lokal pada branch `main`, commit awal `59b91e5`.

## Kesimpulan

**Kedua tab belum dapat dinyatakan berjalan normal sepenuhnya.** Ditemukan 12 masalah utama: 5 berprioritas tinggi, 5 sedang, dan 2 rendah. Beberapa memengaruhi pemberian/pencabutan izin; sisanya memengaruhi keandalan penyimpanan dan tampilan.

Gerbang penulisan konfigurasi tetap memeriksa ADMIN/ADMINISTRATOR di server. Tidak ditemukan jalur pada endpoint penulisan yang diperiksa yang membolehkan user biasa mengubah konfigurasi hanya karena diberi menu Pengaturan Users. Namun, keberadaan gerbang admin tersebut tidak mencegah masalah ketidaksesuaian konfigurasi, kegagalan pencabutan, dan penyimpanan ke role yang keliru di bawah ini.

### Metode dan batas pemeriksaan

- Menelusuri komponen kedua tab, proxy API Next.js, AccessController/AccessService, FeatureAccessGuard, PageAccessGuard, JwtStrategy, middleware, serta pemakai izin Klinik, Bank Data, Jurnal dan Informasi.
- Menjalankan 13 skenario reproduksi dari sumber aktual dengan respons/database contoh: 1 pemeriksaan perilaku normal dan 12 reproduksi masalah. Skenario ini sengaja membuktikan perilaku bermasalah, bukan tes regresi untuk versi yang sudah diperbaiki.
- Menjalankan 14 tes keamanan akun yang sudah tersedia: **14 lulus**.
- Merender komponen aktual di Chrome lokal dengan API contoh pada lebar 320, 390, 768 dan 1280 px. Memeriksa screenshot dan ukuran dropdown, halaman, serta pilihan tema massal.
- Tidak mengakses atau mengubah data produksi. Keberadaan konfigurasi lama di database produksi belum diperiksa. Temuan yang memerlukan konfigurasi lama ditandai sebagai kondisi khusus.
- Kode aplikasi tidak diubah. Berkas tambahan hanya laporan, reproduksi, hasil pemeriksaan, dan screenshot. Tidak ada commit/push pada pemeriksaan ini.

## Temuan prioritas tinggi

### A01 — Pilihan role Klinik tidak memperbarui izin yang dipakai server [P1]

**Lokasi:** [FeatureAccessTab.tsx:575](<D:/[1] ACCA Project/acca-new/apps/web/app/pengaturan-users/tabs/FeatureAccessTab.tsx:575>), [FeatureAccessTab.tsx:684](<D:/[1] ACCA Project/acca-new/apps/web/app/pengaturan-users/tabs/FeatureAccessTab.tsx:684>), [AccessService:205](<D:/[1] ACCA Project/acca-new/apps/api/src/access/access.service.ts:205>), [KlinikService:1107](<D:/[1] ACCA Project/acca-new/apps/api/src/klinik/klinik.service.ts:1107>).

Empat fitur Klinik memakai `can(user, 'klinik.…')`, yang membaca `role_capabilities` dan `user_capabilities`. Akan tetapi, pilihan **Role Pengelola** pada kartu Klinik hanya disimpan sebagai JSON di `site_settings`. Permintaan kapabilitas setelahnya hanya mengubah daftar user, bukan kapabilitas role.

Loader juga mengabaikan `roles` dari respons daftar pemegang kapabilitas dan mengambil role dari JSON `site_settings`. Akibatnya, role yang benar-benar sudah mendapat kapabilitas dapat tidak terlihat terpilih di layar.

**Reproduksi:** pilih GURU untuk “Bentuk & Kelola Sesi”, simpan; JSON menyimpan GURU dan layar melaporkan berhasil, tetapi kapabilitas efektif GURU tetap kosong. Sebaliknya, jika role GURU sudah diberi kapabilitas di tabel role, mengosongkan pilihan role pada kartu tidak mencabut baris tersebut.

**Dampak:** pemberian akses Klinik melalui role tidak bekerja; pencabutan melalui layar dapat memberikan kesan berhasil meskipun izin server masih ada. Bank Data juga menampilkan masalah daftar role efektif yang tersembunyi, tetapi memiliki pembacaan tambahan JSON, sehingga kasus pemberian role baru di Bank Data berbeda dari Klinik.

**Perbaikan:** gunakan satu sumber izin efektif untuk setiap kartu. Muat dan simpan kapabilitas role ke tabel yang dibaca server; tampilkan pengaruh grant/revoke per user secara jelas.

### A02 — Izin yang dicabut aktif kembali ketika query pengecualian gagal [P1]

**Lokasi:** [AccessService:164](<D:/[1] ACCA Project/acca-new/apps/api/src/access/access.service.ts:164>), [AccessService:183](<D:/[1] ACCA Project/acca-new/apps/api/src/access/access.service.ts:183>), [JwtStrategy:71](<D:/[1] ACCA Project/acca-new/apps/api/src/auth/jwt.strategy.ts:71>).

`getUserCapabilityOverrides()` mengubah kegagalan query menjadi `{ grants: [], revokes: [] }`. Resolver kemudian tetap memberikan seluruh kapabilitas role karena mengira user tidak memiliki pengecualian.

**Reproduksi:** GURU mempunyai kapabilitas kelola Klinik, user #9 mempunyai `revoke` untuk kapabilitas tersebut. Normalnya user ditolak. Saat query `user_capabilities` disimulasikan gagal, sementara pembacaan role masih tersedia, kapabilitas user kembali aktif dan pemeriksaan `can()` mengizinkannya.

**Dampak:** pengecualian pencabutan izin tidak aman terhadap kegagalan baca. Ini memengaruhi pemeriksaan izin server, bukan hanya tombol di layar. Syaratnya query identitas/peran masih dapat berjalan, sedangkan query pengecualian gagal.

**Perbaikan:** bedakan “tidak ada pengecualian” dengan “pengecualian gagal dibaca”; pada kegagalan, hentikan pemeriksaan dengan penolakan/galat layanan yang jelas.

### A03 — Respons role lama dapat menimpa pilihan role terbaru [P1]

**Lokasi:** [RolePageAccessTab.tsx:106](<D:/[1] ACCA Project/acca-new/apps/web/app/pengaturan-users/tabs/RolePageAccessTab.tsx:106>), [RolePageAccessTab.tsx:394](<D:/[1] ACCA Project/acca-new/apps/web/app/pengaturan-users/tabs/RolePageAccessTab.tsx:394>), [RolePageAccessTab.tsx:473](<D:/[1] ACCA Project/acca-new/apps/web/app/pengaturan-users/tabs/RolePageAccessTab.tsx:473>).

Permintaan akses per role tidak dibatalkan dan tidak membawa pemeriksaan bahwa respons masih milik role aktif. Pemilih role tetap dapat digunakan saat pemuatan atau penyimpanan berlangsung. Tombol Simpan juga tidak memasukkan status `loading` dalam syarat penonaktifannya.

**Reproduksi:** mulai memuat GURU lalu pindah ke SISWA. Selesaikan respons SISWA terlebih dahulu, kemudian respons GURU. Nama role tetap SISWA, tetapi daftar halaman berubah menjadi milik GURU. Setelah admin mengubah satu checkbox dan menyimpan, permintaan menulis daftar GURU tersebut ke role SISWA.

**Dampak:** role dapat menerima atau kehilangan akses halaman yang tidak dimaksudkan admin.

**Perbaikan:** kaitkan state dengan role yang selesai dimuat, abaikan/batalkan respons lama, dan tahan penyimpanan sampai role aktif benar-benar siap. Lindungi pergantian role ketika ada perubahan belum disimpan.

### A04 — Kegagalan membaca konfigurasi dianggap daftar izin kosong [P1]

**Lokasi:** [FeatureAccessTab.tsx:571](<D:/[1] ACCA Project/acca-new/apps/web/app/pengaturan-users/tabs/FeatureAccessTab.tsx:571>), [AccessService:115](<D:/[1] ACCA Project/acca-new/apps/api/src/access/access.service.ts:115>), [AccessService:647](<D:/[1] ACCA Project/acca-new/apps/api/src/access/access.service.ts:647>).

Terdapat tiga jalur yang saling memperburuk:

1. Kartu kapabilitas hanya ditandai gagal bila **kedua** sumber, `site_settings` dan daftar kapabilitas, gagal bersamaan. Satu sumber gagal sudah cukup membuat tampilan tidak lengkap, tetapi penyimpanan tetap dibolehkan.
2. `getCapabilityHolders()` mengembalikan daftar kosong saat query gagal; proxy kemudian membungkusnya sebagai respons berhasil.
3. `getRolePagesMap()` dan `getRoleFlatGroupsMap()` mengembalikan objek kosong saat query gagal; UI Akses Halaman menganggap konfigurasi berhasil dimuat. Banner perlindungan gagal muat tidak muncul pada jalur ini.

**Reproduksi:** buat pembacaan kapabilitas gagal, tetapi `site_settings` berhasil. Kartu tetap dapat disimpan dan mengirim `userIds: []`. Kegagalan query role pages juga menghasilkan respons berisi peta kosong tanpa penanda kegagalan.

**Dampak:** admin dapat tanpa sengaja menghapus penunjukan atau akses yang sebelumnya tersimpan saat mencoba menyimpan dari layar yang tidak lengkap.

**Perbaikan:** propagasikan kegagalan baca sebagai status galat, tahan penyimpanan jika salah satu sumber wajib gagal, dan jangan menggunakan daftar kosong sebagai pengganti kegagalan database.

### A05 — Konfigurasi izin umum lama masih berlaku tetapi tidak dapat dikelola dari tab ini [P1]

**Lokasi:** [JurnalController:40](<D:/[1] ACCA Project/acca-new/apps/api/src/jurnal/jurnal.controller.ts:40>), [InformasiService:91](<D:/[1] ACCA Project/acca-new/apps/api/src/informasi/informasi.service.ts:91>), [FeatureAccessTab.tsx:61](<D:/[1] ACCA Project/acca-new/apps/web/app/pengaturan-users/tabs/FeatureAccessTab.tsx:61>).

Endpoint input/generate/review Jurnal menerima izin dari konfigurasi spesifik **atau** `jurnal_access_config`. Pengelolaan Informasi juga menerima `informasi_access_config` sebagai izin untuk semua divisi. Kedua konfigurasi umum ini tidak tersedia dalam daftar kartu saat ini.

**Reproduksi:** kosongkan role/user tambahan pada konfigurasi Generate Jurnal, tetapi pertahankan GURU pada `jurnal_access_config`. User GURU masih diizinkan oleh guard. Tidak ada kartu di tab ini untuk melihat atau mencabut sumber izin umum tersebut.

**Dampak:** jika baris lama berisi penunjukan, menghapus penunjukan pada kartu spesifik tidak mencabut seluruh izin efektif. Admin dapat mengira akses sudah dibatasi padahal izin umum masih berlaku. Ini belum membuktikan bahwa baris tersebut berisi penunjukan di produksi.

**Perbaikan:** inventarisasi dan migrasikan izin lama, tampilkan asal setiap izin efektif, lalu hapus pembacaan jalur lama setelah migrasi terkonfirmasi. Jangan menghapus konfigurasi lama tanpa memetakan pemegang haknya.

## Temuan prioritas sedang

### A06 — Pencabutan akses halaman tidak membatalkan izin dalam token login lama [P2]

**Lokasi:** [middleware.ts:347](<D:/[1] ACCA Project/acca-new/apps/web/middleware.ts:347>), [AuthModule:32](<D:/[1] ACCA Project/acca-new/apps/api/src/auth/auth.module.ts:32>).

Middleware langsung mengizinkan halaman yang tercantum di JWT. Pemeriksaan akses terkini hanya dilakukan jika token belum mengizinkan halaman tersebut. Penyimpanan role pages tidak menerbitkan ulang atau membatalkan JWT lama.

**Reproduksi:** token sah masih berisi halaman `master`, sementara akses terkini sudah kosong. Middleware tetap meloloskan navigasi dan tidak memanggil resolver akses terkini.

**Dampak:** pencabutan akses navigasi tidak segera berlaku sampai token diperbarui/kedaluwarsa. Bawaan umur token di kode adalah 7 hari; konfigurasi deployment dapat berbeda. **Endpoint yang memakai PageAccessGuard tetap memeriksa hak dari server**, sehingga temuan ini tidak berarti semua API ikut dapat dilewati.

**Perbaikan:** gunakan versi izin/sesi yang dapat dibatalkan atau validasi akses terkini dengan cache berumur pendek yang mempunyai mekanisme pembatalan setelah perubahan.

### A07 — Penyimpanan beberapa bagian izin tidak bersifat satu transaksi [P2]

**Lokasi:** [AccessService:585](<D:/[1] ACCA Project/acca-new/apps/api/src/access/access.service.ts:585>), [FeatureAccessTab.tsx:684](<D:/[1] ACCA Project/acca-new/apps/web/app/pengaturan-users/tabs/FeatureAccessTab.tsx:684>), [AccessController:334](<D:/[1] ACCA Project/acca-new/apps/api/src/access/access.controller.ts:334>).

`setCapabilityHolders()` menghapus seluruh grant lama sebelum melakukan upsert satu per satu, tanpa transaksi bersama. UI juga menyimpan JSON `site_settings` dan daftar kapabilitas lewat dua permintaan. Penyimpanan role pages dan flat groups dilakukan dalam transaksi terpisah.

**Reproduksi:** grant lama user 1 dan 2 diganti user 3 dan 99. Simulasikan upsert user 99 gagal, misalnya karena user dihapus setelah daftar dimuat. Grant lama sudah hilang dan hanya user 3 yang tersisa meskipun penyimpanan berakhir galat.

**Dampak:** penyimpanan gagal dapat meninggalkan izin setengah berubah. Pada Bank Data, JSON dan tabel kapabilitas sama-sama dipakai untuk mengizinkan akses, sehingga pencabutan sebagian juga perlu diperhatikan.

**Perbaikan:** validasi target sebelum menulis dan satukan perubahan izin terkait dalam transaksi backend. Respons berhasil/gagal harus mewakili keseluruhan perubahan.

### A08 — Menyimpan satu kartu menghapus perubahan belum tersimpan pada kartu lain [P2]

**Lokasi:** [FeatureAccessTab.tsx:589](<D:/[1] ACCA Project/acca-new/apps/web/app/pengaturan-users/tabs/FeatureAccessTab.tsx:589>), [FeatureAccessTab.tsx:714](<D:/[1] ACCA Project/acca-new/apps/web/app/pengaturan-users/tabs/FeatureAccessTab.tsx:714>).

Setiap penyimpanan memanggil `muatSemua()`, yang mengganti seluruh state konfigurasi dan menampilkan pemuat untuk seluruh tab. Tidak ada pencatatan perubahan per kartu atau peringatan kehilangan perubahan.

**Reproduksi:** tambahkan GURU pada kartu Dokumen tanpa menyimpan. Simpan kartu Agenda. Setelah muat ulang, perubahan Dokumen hilang. Pergantian role pada Akses Halaman juga tidak meminta keputusan tentang checkbox yang belum disimpan.

**Perbaikan:** segarkan hanya kartu yang disimpan, simpan status perubahan per kartu, dan beri perlindungan saat berpindah role/tab dengan perubahan yang belum disimpan.

### A09 — Dropdown role/user terpotong oleh kontainer grup [P2]

**Lokasi:** [FeatureAccessTab.tsx:966](<D:/[1] ACCA Project/acca-new/apps/web/app/pengaturan-users/tabs/FeatureAccessTab.tsx:966>), [SearchableSelect.tsx:459](<D:/[1] ACCA Project/acca-new/apps/web/components/ui/SearchableSelect.tsx:459>).

Kontainer grup memakai `overflow: hidden`, sedangkan panel dropdown berposisi absolut di dalamnya. Nilai `z-index` tinggi tidak dapat mengatasi pemotongan oleh ancestor tersebut.

**Bukti visual:** dropdown pengguna Bank Data memiliki tinggi 256 px, tetapi hanya 63 px yang terlihat; bagian lain terpotong. [Screenshot dropdown](<D:/[1] ACCA Project/acca-new/artifacts/audit-user-access-dropdown-1280.png>).

**Dampak:** opsi sulit atau tidak bisa dipilih, terutama pada kartu terakhir dalam grup.

**Perbaikan:** render panel melalui portal atau atur struktur kontainer agar panel dapat keluar dari batas grup dengan posisi yang menyesuaikan ruang layar.

### A10 — Akses Halaman melebar keluar layar kecil [P2]

**Lokasi:** [RolePageAccessTab.tsx:810](<D:/[1] ACCA Project/acca-new/apps/web/app/pengaturan-users/tabs/RolePageAccessTab.tsx:810>), [RolePageAccessTab.tsx:1430](<D:/[1] ACCA Project/acca-new/apps/web/app/pengaturan-users/tabs/RolePageAccessTab.tsx:1430>).

Baris kontrol tema dan Simpan tidak cukup menyusut/membungkus pada layar kecil.

**Bukti visual:** pada lebar 320 px, dokumen berukuran 390 px dan tombol Simpan keluar ke kanan. Lebar 390, 768 dan 1280 px tidak menunjukkan luapan horizontal pada fixture yang sama. Tab Hak Akses Fitur tidak menunjukkan luapan horizontal pada empat ukuran tersebut. [Screenshot 320 px](<D:/[1] ACCA Project/acca-new/artifacts/audit-user-access-pages-320.png>).

**Perbaikan:** bungkus atau susun ulang kontrol pada layar sempit, hilangkan batas minimum yang memaksa luapan, dan pastikan tombol tetap terlihat tanpa geser horizontal.

## Temuan prioritas rendah

### A11 — Pilihan role pada modal tema massal terpotong [P3]

**Lokasi:** [RolePageAccessTab.tsx:335](<D:/[1] ACCA Project/acca-new/apps/web/app/pengaturan-users/tabs/RolePageAccessTab.tsx:335>), [RolePageAccessTab.tsx:715](<D:/[1] ACCA Project/acca-new/apps/web/app/pengaturan-users/tabs/RolePageAccessTab.tsx:715>).

Gaya tinggi 38 px yang sesuai untuk pilihan tunggal juga digunakan untuk multi-select. Saat memilih enam role, chip membungkus ke baris berikutnya tetapi kontainer tetap 38 px; beberapa nama role terpotong. [Screenshot modal](<D:/[1] ACCA Project/acca-new/artifacts/audit-user-access-bulk-1280.png>).

**Perbaikan:** gunakan tinggi otomatis atau daftar pilihan yang dapat digulir dengan ringkasan jumlah; tetap tampilkan seluruh target yang akan menerima perubahan sebelum Simpan.

### A12 — Grup Kinerja Guru tidak tersedia pada filter [P3]

**Lokasi:** [FeatureAccessTab.tsx:750](<D:/[1] ACCA Project/acca-new/apps/web/app/pengaturan-users/tabs/FeatureAccessTab.tsx:750>).

Kartu “Cetak Rekap 10 Besar” menggunakan grup Kinerja Guru. Render daftar kartu menambahkan grup di luar `GRUP_ORDER`, tetapi daftar pilihan filter hanya mengambil `GRUP_ORDER`. Kinerja Guru terlihat ketika semua grup ditampilkan, namun tidak dapat dipilih pada filter Grup Halaman.

**Perbaikan:** bentuk daftar filter dari grup modul aktual dan gunakan daftar urutan hanya untuk pengurutan.

## Bagian yang bekerja pada pemeriksaan ini

- Penulisan konfigurasi akses yang diperiksa menolak GURU, ADMINISTRASI, dan OP_MADRASAH; ADMIN dan ADMINISTRATOR diterima. Pencocokan role admin tidak sekadar mencari substring.
- Pada kondisi normal, konfigurasi fitur memberikan akses berdasarkan role atau user yang ditunjuk dan menolak user lain.
- Perhitungan kapabilitas menerapkan revoke setelah grant pada kondisi pembacaan database normal. Masalah A02 khusus penanganan kegagalannya.
- Penggantian daftar halaman satu role sendiri menggunakan transaksi delete/create; masalah A07 adalah gabungan beberapa bagian yang belum satu transaksi.
- Gerbang tampilan Pengaturan Users menolak user nonadmin meskipun menu halaman diberikan kepadanya.
- Keempat ukuran tab Hak Akses Fitur tidak menunjukkan luapan horizontal, dan kedua komponen tidak menimbulkan galat JavaScript saat fixture browser dijalankan. Hal ini tidak menghapus masalah dropdown/modal yang dijelaskan di atas.
- Ke-14 tes keamanan akun lulus, mencakup pembatasan role, perlindungan admin aktif terakhir, pengaitan akun, perubahan/reset password, pembatalan sesi lama setelah perubahan password, dan rollback penulisan akun.

## Urutan perbaikan yang disarankan

1. A02, A03, A04: cegah izin kembali aktif dan konfigurasi tertimpa/rusak.
2. A01, A05: satukan sumber izin dan tampilkan izin efektif beserta asalnya.
3. A06, A07, A08: buat pencabutan, transaksi, dan perubahan belum tersimpan dapat diandalkan.
4. A09–A12: perbaiki dropdown, ukuran layar kecil, modal massal, dan filter.

## Bukti pemeriksaan

- [Reproduksi logika dan server](<D:/[1] ACCA Project/acca-new/artifacts/audit-user-access-2026-10-22.cjs>)
- [Hasil 13 skenario](<D:/[1] ACCA Project/acca-new/artifacts/audit-user-access-2026-10-22-results.json>)
- [Pemeriksaan komponen di browser](<D:/[1] ACCA Project/acca-new/artifacts/audit-user-access-ui-2026-10-22.cjs>)
- [Ukuran tampilan dan hasil browser](<D:/[1] ACCA Project/acca-new/artifacts/audit-user-access-ui-2026-10-22-metrics.json>)

Perintah reproduksi dari root proyek:

```powershell
node artifacts/audit-user-access-2026-10-22.cjs
node artifacts/audit-user-access-ui-2026-10-22.cjs
node --test --test-isolation=none apps/api/test/user-settings-security.test.cjs
```

Script browser memerlukan Chrome lokal dan izin menjalankan proses pendukung. Fixture meniru respons API; hasil ini bukan pemeriksaan sesi/database produksi.
