# Audit migrasi acca-app → acca-new

Tanggal audit awal: 18 September 2026.

Revisi cakupan: CBT dan PTSP dikeluarkan sesuai instruksi pengguna. Daftar ini berisi 12 kelompok perbaikan acca-new.

## Batas cakupan yang wajib dipatuhi

- CBT dan PTSP adalah project lain: kode, route, backend, integrasi, serta tabel khusus keduanya tidak termasuk perbaikan atau pembersihan.
- Temuan lama pada keduanya hanya dicatat sebagai pengecualian verifikasi; bukan tugas perbaikan acca-new.
- Komponen bersama hanya boleh diubah untuk kebutuhan acca-new dengan menjaga kontrak pemanggil lain. Jangan merombak pemanggil CBT/PTSP untuk menyelesaikan diagnostik.
- Surat/PDF, permintaan surat, dan storage milik acca-new tetap masuk cakupan. Jika suatu berkas ternyata khusus PTSP, keluarkan dari pekerjaan sebelum mengubahnya.

## Ruang lingkup dan bukti

- Membandingkan kode `D:/acca-new` dengan salinan sumber `C:/Users/imran/.gemini/antigravity/scratch/acca-app`.
- Mengelompokkan hasil TypeScript: 230 diagnostik, terdiri dari 194 pada 83 berkas sumber dan 36 pada keluaran generator Next.js. Angka diagnostik bukan jumlah bug independen.
- Memeriksa katalog PostgreSQL `acca_db` secara baca-saja untuk trigger Prestasi. Pemeriksaan CBT pada audit awal tidak dilanjutkan dan tidak menjadi dasar perubahan.
- Menjalankan reproduksi Jurnal dan Prestasi dengan data tiruan, tanpa menulis database.
- Belum menjalankan uji interaksi browser untuk semua fitur; database Supabase asal tidak diperiksa langsung.
- Audit ini tidak mengubah kode aplikasi. Perbaikan Jadwal PBM pada tahap sebelumnya tetap dipertahankan.

P1 = integritas data atau alur aktif gagal; P2 = kontrak dan fungsi bersyarat; P3 = pembersihan tipe/kode tidak terpakai. Kategori asal dibedakan antara regresi migrasi, bawaan sumber, dan belum dipastikan.

## Poin perbaikan

### 1. P1 — Generate Jurnal harus menggunakan versi jadwal pada tanggal target

**Bukti:** `apps/api/src/jurnal/jurnal.service.ts:142` mengambil semua jadwal aktif, lalu baris 165 hanya menyaring hari. `berlaku_mulai` dan versi penuh/parsial tidak dipakai. `upsert` menggunakan `update: {}`, sehingga baris pertama untuk satu slot dapat menetapkan guru lama dan tidak dikoreksi oleh baris berikutnya.

**Reproduksi:** satu jadwal Senin baru berlaku 1 Januari 2027; Generate untuk Senin 21 September 2026 tetap mencoba membuat satu jurnal. Hasil yang benar: nol.

**Perbandingan asal:** `acca-app/app/jurnal/lib/jurnalService.ts:176–221` masih memilih tanggal versi terbaru yang tidak melewati tanggal target. Logika ini hilang pada implementasi NestJS. Algoritme asal sendiri belum cukup untuk aturan penuh/parsial terbaru, jadi jangan disalin mentah.

**Perbaikan:** jadikan resolver versi Jadwal sebagai layanan bersama NestJS; gunakan pada Generate Jurnal. Audit jurnal lama yang mungkin terpengaruh melalui laporan baca-saja sebelum melakukan koreksi data. Bedakan jumlah benar-benar dibuat dan yang sudah ada.

**Kriteria selesai:** jadwal masa depan tidak dipakai; versi penuh meniadakan slot lama; versi parsial hanya mengganti slot terkait; Generate ulang tidak mengubah jurnal yang sudah diisi atau melebihkan hitungan hasil.

### 2. P1 — Pulihkan penguncian Prestasi setelah persetujuan

**Bukti:** `apps/web/app/prestasi/view.tsx:956` membaca `updated` yang tidak dideklarasikan setelah respons API berhasil. Pada backend, `apps/api/src/prestasi/prestasi.service.ts:96–122` hanya memperbarui berdasarkan ID, tanpa syarat status belum disetujui. Katalog database saat diperiksa tidak menunjukkan trigger pengguna pada `prestasi_lomba`.

**Reproduksi:** service menerima objek lama berstatus `Disetujui`, kemudian tetap memanggil update untuk status `Ditolak`.

**Perbandingan asal:** `acca-app/app/prestasi/view.tsx:963–969` mendefinisikan `updated` dari query Supabase dan memakai `.neq('status_validasi', 'Disetujui')`. Ini regresi migrasi frontend dan backend.

**Perbaikan:** tetapkan perubahan status secara atomik di NestJS, kembalikan konflik ketika sudah dikunci, ambil identitas validator dari sesi server, dan sesuaikan UI dengan `{ok,data}`. Periksa pula izin validasi dan penghapusan sesuai peran/aturan bisnis, bukan hanya akses halaman.

**Kriteria selesai:** persetujuan tidak dapat ditimpa oleh formulir lama atau permintaan bersamaan; penyimpanan sukses tidak menghasilkan pesan gagal; audit validator sesuai pengguna login.

### 3. P1 — Betulkan pengambilan data PDF Surat dari NestJS

**Bukti:** `apps/web/app/api/surat/generate-pdf/route.ts:874–878` memanggil `nestFetchAsUser(request, path, {body: object})`, lalu `.json()`. Helper sebenarnya menerima `(path, token, RequestInit)` dan mengembalikan `{status,body}` (`apps/web/lib/nest-api.ts:55`). Exception ditangkap dan proses PDF diteruskan, sehingga konfigurasi visual atau daftar lampiran dapat kosong/default tanpa membatalkan pembuatan PDF.

**Perbandingan asal:** route asal membaca konfigurasi dan daftar guru/siswa langsung melalui Supabase. Kesalahan kontrak terjadi saat penggantian ke NestJS.

**Perbaikan:** teruskan token yang diekstrak dari request, serialisasi body, baca `status/body`, validasi data wajib dan jangan menyamarkan kegagalan data penting sebagai PDF sukses.

**Kriteria selesai:** kop/logo dan lampiran guru/siswa sesuai data; token tidak sah ditolak; kegagalan backend dilaporkan jelas.

### 4. P1 — Perbaiki parameter rute API dinamis

**Bukti:** sejumlah route baru menggunakan `{params:{id:string}}` dan membaca `params.id` langsung, sementara tipe Next.js terpasang mengharapkan `params: Promise<...>`. Contoh `apps/web/app/api/observasi-kelas/[id]/route.ts:6`. Temuan lain mencakup pengumuman, dokumen personal, prestasi, sanggar, surat, kategori unggahan, dan dokumen unggahan.

**Asal:** setidaknya route observasi dan prestasi tidak ada pada jalur yang sama di sumber lama; route penghubung dibuat dalam migrasi. Dampak tiap route tetap perlu diuji HTTP.

**Perbaikan:** konsisten menunggu `params` sebelum membangun URL NestJS, lalu uji GET/PUT/DELETE dengan ID valid dan invalid. Perbaiki sumber route, bukan berkas `.next` yang dihasilkan otomatis.

### 5. P1 — Pulihkan import runtime yang hilang

- `apps/web/app/nilai-siswa/view.tsx:186`: memanggil `useRouter` tanpa import. Import tersebut ada di sumber lama (`:12`). Halaman aktif berisiko melempar ReferenceError saat komponen dirender.
- `apps/web/app/pengaturan-umum/tabs/SuratTab.tsx:225`: memakai `Spinner` tanpa import pada kondisi memuat. Sumber lama `components/SuratTab.tsx:5` memilikinya.

**Perbaikan:** gunakan import dari modul/komponen sekarang dan cocokkan propertinya; uji render awal, memuat, sukses dan gagal.

### 6. P1/P2 — Pulihkan kontrak konfigurasi penyimpanan

**Bukti:** `apps/web/lib/file-storage.ts:89–110` memakai tiga variabel cache yang tidak dideklarasikan. Di sumber lama `lib/file-storage.ts:47–49` ketiganya ada. Jalur ini dijalankan jika konfigurasi lingkungan R2 tidak menyediakan jalan keluar lebih awal. Salah satu pemanggil aktif ialah persiapan unggah dokumen personal.

**Perbaikan:** pusatkan pembacaan konfigurasi dan operasi storage di NestJS; jika cache masih diperlukan, deklarasikan dan batasi di server. Pastikan fallback tanpa konfigurasi R2 memberikan error terkontrol. Jangan hanya menutupi error tipe.

**Kriteria selesai:** persiapan unggah, unggah, dan baca file berhasil pada konfigurasi yang didukung; konfigurasi belum lengkap tidak menimbulkan ReferenceError.

### 7. P2 — Tombol aksi yang tidak dikenali menghilang

**Bukti:** `ActionButtons.tsx` tidak mendukung `approve`/`reject` dan mengembalikan `null` bila konfigurasi aksi tidak ditemukan. Ekstrakurikuler memakai keduanya (`view.tsx:772–773`); verifikasi kokurikuler memakai `reject`. Observasi kelas juga memasok `icon` tanpa `action`.

**Asal:** pasangan `approve`/`reject` dan keterbatasan komponen sudah ada di `acca-app`, jadi bukan murni akibat migrasi database. Properti seperti `size`, `align`, `tooltip`, `badge` pada berbagai komponen merupakan kelompok ketidaksesuaian tambahan; dampaknya tidak semuanya sama.

**Perbaikan:** tetapkan kontrak komponen yang konsisten dan lengkapi aksi yang memang diperlukan. Periksa setiap caller; jangan mengatasi semuanya dengan tipe `any`.

**Kriteria selesai:** tombol setujui, revisi/tolak, dan detail tampil serta menjalankan handler yang tepat sesuai izin.

### 8. P2 — Normalisasi kontrak data lintas frontend–backend

**Kelompok:** tanggal PostgreSQL `Date` versus string JSON, ID bigint versus string, semester angka versus teks, role string versus array, serta null pada data opsional. Contoh: `lib/settings-server.ts:65`, `lib/sidebar-badges.ts:300`, jurnal, tugas siswa, dan form permintaan surat.

**Asal campuran:** Prisma membuat sejumlah ketidaksesuaian baru lebih eksplisit; pola `.split()` pada kemungkinan array role serta tipe tugas/piket yang tidak lengkap sudah ada pada sumber lama. Tidak semua error menunjukkan kegagalan runtime: perbandingan semester dengan angka misalnya dapat menjadi cabang kompatibilitas yang kini tidak diperlukan.

**Perbaikan:** definisikan DTO bersama di `packages/shared`, normalisasi JSON di batas NestJS, tangani null secara eksplisit, dan gunakan satu fungsi normalisasi role. Uji data nyata serta data kosong, tanpa mengubah tipe secara paksa.

### 9. P2/P3 — Perbaiki import tipe dan buang wrapper yang sudah tidak dipakai

- Izin guru: tiga modal masih mengimpor `./TabSemuaIzin`, padahal file pindah ke `../tabs/TabSemuaIzin`. Simbol yang dipakai adalah tipe, sehingga dampaknya perlu dibedakan dari import runtime.
- Form publik: tipe masih diarahkan ke `../../(dashboard)/form/types` setelah struktur direktori berubah.
- WhatsApp: `KetidakhadiranPreviewPart` hilang; definisinya ada pada sumber lama `lib/whatsapp-group.ts:274`.
- `JurnalFilters` pada helper jurnal sudah tidak didefinisikan pada sumber lama pula.
- `DaftarSuratTab.tsx:716` mempunyai wrapper default yang merujuk `DaftarAccaPage`, tetapi halaman aktif mengimpor named export `DaftarSuratTab`. Hapus/perbaiki wrapper lama; ini bukan bukti bahwa tab aktif pasti crash.
- Helper Prisma lama `app/jurnal/lib/jurnalService.ts` tidak ditemukan dipanggil di sumber yang ditelusuri; jangan memprioritaskan refactor runtime helper ini di atas service NestJS aktif.

**Kriteria selesai:** import mengarah ke sumber tipe tunggal; kode tidak terpakai dihapus setelah referensi diperiksa; halaman publik dan modal terkait tetap berfungsi.

### 10. P2 — Perjelas migrasi backend yang masih tersebar

Inventaris awal lintas project menemukan 18 berkas yang langsung mengimpor `@/lib/prisma`; angka itu bukan jumlah pekerjaan dalam cakupan baru. Inventarisasi ulang hanya pemanggil acca-new seperti logger, helper, dan route terkait. Ini mencakup kode server Next.js, bukan berarti seluruhnya berjalan di browser. Akses database dan integrasi milik CBT/PTSP dibiarkan di luar pekerjaan.

**Perbaikan:** inventarisasi pemanggil aktif, pindahkan aturan bisnis serta otorisasi ke NestJS, dan jadikan route Next.js penerus request atau lapisan presentasi. Hapus helper lama setelah tidak ada pemanggil. Jangan menyatakan migrasi backend selesai hanya karena kode memakai PostgreSQL.

### 11. P2/P3 — Perbaiki pencatatan aktivitas dan kasus PDF tambahan

- `app/api/user/log/route.ts:32` mengirim string IP ke parameter keempat `logActivity`, padahal helper mengharapkan `Request`. Log tetap dapat dibuat tetapi IP menjadi `unknown`. Pemanggilan yang sama ada di sumber lama: masalah bawaan, bukan regresi baru.
- Respons Buffer/Uint8Array pada QR, DOCX dan tanda tangan PDF perlu diselaraskan dengan tipe response yang terpasang.
- Opsi `networkidle0` pada tiga pembuat PDF ditolak oleh tipe yang terpasang. Periksa versi/deklarasi library dan uji hasil PDF sebelum mengganti opsi; tidak cukup bukti untuk menyatakan seluruh fitur PDF tersebut gagal runtime.

### 12. P2 — Jadikan pemeriksaan tipe bagian dari syarat rilis

`apps/web/next.config.ts:24` mengaktifkan `ignoreBuildErrors: true`. Ini membuat build sukses tidak membuktikan kontrak tipe sudah benar.

**Perbaikan:** selesaikan akar masalah pada sumber acca-new, regenerasi tipe Next.js, dan laporkan pemeriksaan frontend/backend dengan memisahkan diagnostik CBT/PTSP. Pemeriksaan acca-new harus menjadi syarat rilis. Penghapusan `ignoreBuildErrors` secara global menunggu pemisahan build/typecheck antarproject yang jelas; jangan mengubah CBT/PTSP hanya untuk meluluskan pemeriksaan global. Jangan mengedit `.next` secara manual, menonaktifkan pengecekan seluruh project, atau menambahkan cast massal.

## Urutan pelaksanaan yang disarankan

1. Integritas data: Jurnal dan penguncian Prestasi.
2. Alur aktif: API dinamis, PDF Surat, import Nilai/Surat, dan storage.
3. Fungsi UI serta DTO lintas modul.
4. Pusatkan akses backend yang masih tersebar khusus acca-new; kecualikan CBT dan PTSP.
5. Bersihkan kode acca-new yang tidak dipakai, tuntaskan diagnostik dalam cakupan, dan aktifkan pemeriksaan rilis dengan pengecualian lintas project yang tercatat.

Perubahan data historis harus didahului daftar record terdampak yang dapat ditinjau. Pemeriksaan katalog pada audit ini tidak membuktikan bahwa database sumber dan target memiliki data identik.

## Inventaris diagnostik setelah pengecualian

Klasifikasi ulang log audit awal, bukan hasil pengujian baru. Log mentah dipertahankan: [frontend-typecheck.txt](/D:/acca-new/artifacts/frontend-typecheck.txt).

- Kandidat dalam cakupan acca-new: **162 diagnostik pada 77 berkas sumber**.
- Khusus CBT/PTSP, di luar pekerjaan: **32 diagnostik pada 6 berkas sumber**.
- Sisa 36 diagnostik berasal dari berkas generator Next.js, termasuk satu berkas khusus API PTSP; telusuri pemilik sumbernya sebelum memasukkannya ke pekerjaan.
- Jumlah pesan bukan jumlah bug. Pengecualian berdasarkan berkas yang jelas khusus project lain; dependensi bersama tetap dinilai per pemanggil.

### Berkas sumber acca-new

| Berkas | Diagnostik |
|---|---:|
| [apps/web/app/ekstrakurikuler/view.tsx](</D:/acca-new/apps/web/app/ekstrakurikuler/view.tsx:658>) | 16 |
| [apps/web/app/tugas-siswa/components/TugasSiswaForm.tsx](</D:/acca-new/apps/web/app/tugas-siswa/components/TugasSiswaForm.tsx:124>) | 9 |
| [apps/web/lib/file-storage.ts](</D:/acca-new/apps/web/lib/file-storage.ts:89>) | 9 |
| [apps/web/app/f/[id]/page.tsx](</D:/acca-new/apps/web/app/f/[id]/page.tsx:7>) | 7 |
| [apps/web/app/prestasi/view.tsx](</D:/acca-new/apps/web/app/prestasi/view.tsx:956>) | 7 |
| [apps/web/app/ketidakhadiran/components/ImportModal.tsx](</D:/acca-new/apps/web/app/ketidakhadiran/components/ImportModal.tsx:110>) | 6 |
| [apps/web/app/informasi/view.tsx](</D:/acca-new/apps/web/app/informasi/view.tsx:242>) | 5 |
| [apps/web/app/kinerja-guru/view.tsx](</D:/acca-new/apps/web/app/kinerja-guru/view.tsx:319>) | 5 |
| [apps/web/app/jurnal/input/view.tsx](</D:/acca-new/apps/web/app/jurnal/input/view.tsx:104>) | 4 |
| [apps/web/app/jurnal/lib/jurnalService.ts](</D:/acca-new/apps/web/app/jurnal/lib/jurnalService.ts:22>) | 4 |
| [apps/web/app/kokurikuler/admin/view.tsx](</D:/acca-new/apps/web/app/kokurikuler/admin/view.tsx:147>) | 4 |
| [apps/web/app/api/surat/generate-pdf/route.ts](</D:/acca-new/apps/web/app/api/surat/generate-pdf/route.ts:874>) | 3 |
| [apps/web/app/ketidakhadiran/tabs/RekapTab.tsx](</D:/acca-new/apps/web/app/ketidakhadiran/tabs/RekapTab.tsx:358>) | 3 |
| [apps/web/app/pengaturan-umum/tabs/TemplateSuratTab.tsx](</D:/acca-new/apps/web/app/pengaturan-umum/tabs/TemplateSuratTab.tsx:105>) | 3 |
| [apps/web/lib/settings-server.ts](</D:/acca-new/apps/web/lib/settings-server.ts:21>) | 3 |
| [apps/web/app/dokumen/tabs/ManageDokumenTab.tsx](</D:/acca-new/apps/web/app/dokumen/tabs/ManageDokumenTab.tsx:2223>) | 2 |
| [apps/web/app/dokumen/tabs/UnggahDokumenTab.tsx](</D:/acca-new/apps/web/app/dokumen/tabs/UnggahDokumenTab.tsx:39>) | 2 |
| [apps/web/app/e-supervisi/view.tsx](</D:/acca-new/apps/web/app/e-supervisi/view.tsx:56>) | 2 |
| [apps/web/app/jurnal/components/AjukanBandingModal.tsx](</D:/acca-new/apps/web/app/jurnal/components/AjukanBandingModal.tsx:135>) | 2 |
| [apps/web/app/jurnal/hooks/useJurnal.ts](</D:/acca-new/apps/web/app/jurnal/hooks/useJurnal.ts:123>) | 2 |
| [apps/web/app/lckh/verification/[code]/page.tsx](</D:/acca-new/apps/web/app/lckh/verification/[code]/page.tsx:35>) | 2 |
| [apps/web/app/nilai/view.tsx](</D:/acca-new/apps/web/app/nilai/view.tsx:269>) | 2 |
| [apps/web/app/observasi-kelas/view.tsx](</D:/acca-new/apps/web/app/observasi-kelas/view.tsx:266>) | 2 |
| [apps/web/app/pengaturan-data/tabs/EkskulSiswaTab.tsx](</D:/acca-new/apps/web/app/pengaturan-data/tabs/EkskulSiswaTab.tsx:534>) | 2 |
| [apps/web/app/piket/input/page.tsx](</D:/acca-new/apps/web/app/piket/input/page.tsx:420>) | 2 |
| [apps/web/app/sanggar-kurikulum/view.tsx](</D:/acca-new/apps/web/app/sanggar-kurikulum/view.tsx:1617>) | 2 |
| [apps/web/lib/whatsapp-group.ts](</D:/acca-new/apps/web/lib/whatsapp-group.ts:264>) | 2 |
| [apps/web/app/(dashboard)/bank-data/page.tsx](</D:/acca-new/apps/web/app/(dashboard)/bank-data/page.tsx:9>) | 1 |
| [apps/web/app/(dashboard)/catatan-keuangan/page.tsx](</D:/acca-new/apps/web/app/(dashboard)/catatan-keuangan/page.tsx:9>) | 1 |
| [apps/web/app/(dashboard)/dashboard/DashboardContent.tsx](</D:/acca-new/apps/web/app/(dashboard)/dashboard/DashboardContent.tsx:1180>) | 1 |
| [apps/web/app/(dashboard)/form/builder/page.tsx](</D:/acca-new/apps/web/app/(dashboard)/form/builder/page.tsx:9>) | 1 |
| [apps/web/app/(dashboard)/form/page.tsx](</D:/acca-new/apps/web/app/(dashboard)/form/page.tsx:9>) | 1 |
| [apps/web/app/(dashboard)/form/responses/page.tsx](</D:/acca-new/apps/web/app/(dashboard)/form/responses/page.tsx:9>) | 1 |
| [apps/web/app/(dashboard)/kinerja-guru/page.tsx](</D:/acca-new/apps/web/app/(dashboard)/kinerja-guru/page.tsx:9>) | 1 |
| [apps/web/app/(dashboard)/lckh-approval/page.tsx](</D:/acca-new/apps/web/app/(dashboard)/lckh-approval/page.tsx:9>) | 1 |
| [apps/web/app/(dashboard)/lckh/page.tsx](</D:/acca-new/apps/web/app/(dashboard)/lckh/page.tsx:9>) | 1 |
| [apps/web/app/(dashboard)/monitoring/page.tsx](</D:/acca-new/apps/web/app/(dashboard)/monitoring/page.tsx:9>) | 1 |
| [apps/web/app/(dashboard)/nilai/page.tsx](</D:/acca-new/apps/web/app/(dashboard)/nilai/page.tsx:9>) | 1 |
| [apps/web/app/(dashboard)/observasi-kelas/page.tsx](</D:/acca-new/apps/web/app/(dashboard)/observasi-kelas/page.tsx:9>) | 1 |
| [apps/web/app/(dashboard)/pembayaran/page.tsx](</D:/acca-new/apps/web/app/(dashboard)/pembayaran/page.tsx:9>) | 1 |
| [apps/web/app/(dashboard)/rekap-jurnal/page.tsx](</D:/acca-new/apps/web/app/(dashboard)/rekap-jurnal/page.tsx:9>) | 1 |
| [apps/web/app/(dashboard)/surat/page.tsx](</D:/acca-new/apps/web/app/(dashboard)/surat/page.tsx:9>) | 1 |
| [apps/web/app/(dashboard)/tugas-siswa/page.tsx](</D:/acca-new/apps/web/app/(dashboard)/tugas-siswa/page.tsx:9>) | 1 |
| [apps/web/app/(dashboard)/tugas-tambahan/page.tsx](</D:/acca-new/apps/web/app/(dashboard)/tugas-tambahan/page.tsx:9>) | 1 |
| [apps/web/app/api/ekskul/submission/pdf/route.ts](</D:/acca-new/apps/web/app/api/ekskul/submission/pdf/route.ts:15>) | 1 |
| [apps/web/app/api/guru-asuh/laporan-submission/pdf/route.ts](</D:/acca-new/apps/web/app/api/guru-asuh/laporan-submission/pdf/route.ts:17>) | 1 |
| [apps/web/app/api/klinik/laporan/pdf/route.ts](</D:/acca-new/apps/web/app/api/klinik/laporan/pdf/route.ts:13>) | 1 |
| [apps/web/app/api/qrcode/route.ts](</D:/acca-new/apps/web/app/api/qrcode/route.ts:24>) | 1 |
| [apps/web/app/api/reset-data/replace/route.ts](</D:/acca-new/apps/web/app/api/reset-data/replace/route.ts:134>) | 1 |
| [apps/web/app/api/surat/generate-docx-v2/route.ts](</D:/acca-new/apps/web/app/api/surat/generate-docx-v2/route.ts:174>) | 1 |
| [apps/web/app/api/surat/sign-pdf/route.ts](</D:/acca-new/apps/web/app/api/surat/sign-pdf/route.ts:374>) | 1 |
| [apps/web/app/api/user/log/route.ts](</D:/acca-new/apps/web/app/api/user/log/route.ts:32>) | 1 |
| [apps/web/app/bimbingan-konseling/view.tsx](</D:/acca-new/apps/web/app/bimbingan-konseling/view.tsx:307>) | 1 |
| [apps/web/app/guru-asuh/tabs/GuruAsuhTabKlaim.tsx](</D:/acca-new/apps/web/app/guru-asuh/tabs/GuruAsuhTabKlaim.tsx:274>) | 1 |
| [apps/web/app/izin-guru/components/ApprovalModal.tsx](</D:/acca-new/apps/web/app/izin-guru/components/ApprovalModal.tsx:10>) | 1 |
| [apps/web/app/izin-guru/components/DetailIzinModal.tsx](</D:/acca-new/apps/web/app/izin-guru/components/DetailIzinModal.tsx:9>) | 1 |
| [apps/web/app/izin-guru/components/EditIzinModal.tsx](</D:/acca-new/apps/web/app/izin-guru/components/EditIzinModal.tsx:8>) | 1 |
| [apps/web/app/jurnal/components/JournalModal.tsx](</D:/acca-new/apps/web/app/jurnal/components/JournalModal.tsx:113>) | 1 |
| [apps/web/app/jurnal/components/JurnalDetailModal.tsx](</D:/acca-new/apps/web/app/jurnal/components/JurnalDetailModal.tsx:750>) | 1 |
| [apps/web/app/jurnal/lib/jurnalApi.ts](</D:/acca-new/apps/web/app/jurnal/lib/jurnalApi.ts:5>) | 1 |
| [apps/web/app/jurnal/view.tsx](</D:/acca-new/apps/web/app/jurnal/view.tsx:321>) | 1 |
| [apps/web/app/ketidakhadiran/log-components/KetidakhadiranCards.tsx](</D:/acca-new/apps/web/app/ketidakhadiran/log-components/KetidakhadiranCards.tsx:96>) | 1 |
| [apps/web/app/ketidakhadiran/log-components/KetidakhadiranTable.tsx](</D:/acca-new/apps/web/app/ketidakhadiran/log-components/KetidakhadiranTable.tsx:201>) | 1 |
| [apps/web/app/ketidakhadiran/tabs/DaftarSuratTab.tsx](</D:/acca-new/apps/web/app/ketidakhadiran/tabs/DaftarSuratTab.tsx:716>) | 1 |
| [apps/web/app/kokurikuler/siswa/view.tsx](</D:/acca-new/apps/web/app/kokurikuler/siswa/view.tsx:221>) | 1 |
| [apps/web/app/kokurikuler/verifikasi/view.tsx](</D:/acca-new/apps/web/app/kokurikuler/verifikasi/view.tsx:288>) | 1 |
| [apps/web/app/nilai-siswa/view.tsx](</D:/acca-new/apps/web/app/nilai-siswa/view.tsx:186>) | 1 |
| [apps/web/app/pengaturan-umum/tabs/SuratTab.tsx](</D:/acca-new/apps/web/app/pengaturan-umum/tabs/SuratTab.tsx:225>) | 1 |
| [apps/web/app/pengaturan-umum/tabs/TimezoneTab.tsx](</D:/acca-new/apps/web/app/pengaturan-umum/tabs/TimezoneTab.tsx:165>) | 1 |
| [apps/web/app/pengaturan-users/tabs/RolePageAccessTab.tsx](</D:/acca-new/apps/web/app/pengaturan-users/tabs/RolePageAccessTab.tsx:553>) | 1 |
| [apps/web/app/permintaan-surat/components/FormPermintaanSurat.tsx](</D:/acca-new/apps/web/app/permintaan-surat/components/FormPermintaanSurat.tsx:44>) | 1 |
| [apps/web/app/permintaan-surat/view.tsx](</D:/acca-new/apps/web/app/permintaan-surat/view.tsx:39>) | 1 |
| [apps/web/app/surat/components/SuratPengaturanCard.tsx](</D:/acca-new/apps/web/app/surat/components/SuratPengaturanCard.tsx:34>) | 1 |
| [apps/web/lib/sidebar-badges.ts](</D:/acca-new/apps/web/lib/sidebar-badges.ts:300>) | 1 |
| [apps/web/lib/storage/supabase-storage.ts](</D:/acca-new/apps/web/lib/storage/supabase-storage.ts:67>) | 1 |
| [apps/web/lib/timezone.ts](</D:/acca-new/apps/web/lib/timezone.ts:46>) | 1 |
| [apps/web/lib/wa-sender.ts](</D:/acca-new/apps/web/lib/wa-sender.ts:64>) | 1 |

### Pengecualian verifikasi — jangan diperbaiki dalam tugas ini

Daftar ini hanya menjelaskan mengapa pemeriksaan global masih dapat gagal setelah perbaikan acca-new. Tidak ada rencana perubahan kode atau database CBT/PTSP.

| Berkas | Diagnostik |
|---|---:|
| [apps/web/app/actions/cbt-siswa.ts](</D:/acca-new/apps/web/app/actions/cbt-siswa.ts:83>) | 12 |
| [apps/web/app/actions/cbt-question.ts](</D:/acca-new/apps/web/app/actions/cbt-question.ts:127>) | 7 |
| [apps/web/app/layanan-ptsp/components/PTSPClient.tsx](</D:/acca-new/apps/web/app/layanan-ptsp/components/PTSPClient.tsx:112>) | 7 |
| [apps/web/app/actions/cbt-proktor.ts](</D:/acca-new/apps/web/app/actions/cbt-proktor.ts:40>) | 4 |
| [apps/web/app/(dashboard)/layanan-ptsp/page.tsx](</D:/acca-new/apps/web/app/(dashboard)/layanan-ptsp/page.tsx:9>) | 1 |
| [apps/web/components/cbt/CBTPlaceholders.tsx](</D:/acca-new/apps/web/components/cbt/CBTPlaceholders.tsx:18>) | 1 |
