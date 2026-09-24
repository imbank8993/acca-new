# Audit backend, frontend, dan keamanan ACCA

Tanggal: 18 September 2026. Basis kode: D:\acca-new, working tree lokal setelah pemisahan kode CBT lama.

## Kesimpulan

Ditemukan **28 temuan** (18 P1 dan 10 P2). **0 skenario reproduksi terarah** mengonfirmasi perilaku bermasalah memakai kode aktual dengan database/jaringan simulasi. Temuan lain ditetapkan dari penelusuran controller, service, proxy, dan pemakai frontend; status bukti dijelaskan per temuan. Tidak ada P0 yang ditetapkan karena paparan deployment dan data nyata belum diuji.

Masalah dominan adalah kewenangan backend yang berhenti pada login, kebocoran konfigurasi, proxy URL bebas, serta kontrak hasil migrasi yang tidak cocok dengan frontend. Perbaikan R1–R3 sebelumnya tetap bernilai, tetapi tidak membuktikan modul lain aman.

## Cakupan dan batas bukti

- Inventaris seluruh **68 route halaman fisik**, **308 route API Next.js**, dan **471 method endpoint pada 51 kelas controller NestJS**. Import lokal dan referensi API halaman dipetakan; endpoint ditriase lewat guard, parameter user, panggilan service dan kontrak respons.
- Penelusuran manual diperdalam pada jalur berisiko dan temuan di bawah. Lampiran mencatat setiap halaman dengan API/dependensi lokal serta skenario uji khususnya. Pemeriksaan ini **audit statis menyeluruh dan reproduksi unit terarah**, bukan uji interaktif setiap tombol atau sertifikasi bebas bug.
- Halaman alias/dinamis dicatat terpisah; konten halaman yang hanya tersimpan di database belum diinventarisasi tanpa membaca database.
- Tidak menjalankan request penghapusan/eksploitasi ke layanan nyata, tidak mengambil secret produksi, tidak mengirim WhatsApp, tidak mengubah skema/data PostgreSQL, tidak mengaudit aplikasi CBT/PTSP eksternal. PTSP yang masih menjadi halaman/backend ACCA termasuk cakupan integrasi.
- Perubahan aplikasi pada rangkaian tugas ini hanya pemisahan CBT yang telah diminta sebelumnya. Pada tahap audit lanjutan, yang ditambahkan adalah dokumentasi dan skrip simulasi.
- P1: perlu diprioritaskan karena otorisasi, data sensitif, integritas, atau fungsi inti terblokir. P2: gangguan fungsi/konsistensi atau kelemahan yang perlu ditangani setelah penutupan akses utama.

## Hasil pemeriksaan yang dijalankan

| Pemeriksaan | Hasil | Bukti |
|---|---|---|
| TypeScript backend | Exit 0; ini bukan bukti semua perilaku benar, dua service masih ts-nocheck | [artifacts/audit-backend-typecheck.txt](<D:/acca-new/artifacts/audit-backend-typecheck.txt>) |
| TypeScript frontend setelah pemisahan CBT/cache lama | Exit 1; 8 diagnostik, seluruhnya komponen/route PTSP di ACCA | [artifacts/pemisahan-cbt-typecheck-final.txt](<D:/acca-new/artifacts/pemisahan-cbt-typecheck-final.txt>) |
| Reproduksi pertama | 11 perilaku berhasil direproduksi | [artifacts/audit-reproduksi.json](<D:/acca-new/artifacts/audit-reproduksi.json>) |
| Reproduksi lanjutan | 6 perilaku berhasil direproduksi | [artifacts/audit-reproduksi-lanjutan.json](<D:/acca-new/artifacts/audit-reproduksi-lanjutan.json>) |
| Generate tipe route Next.js & syntax generator | Lulus pada tahap pemisahan; lima URL CBT menjadi redirect SSO | [artifacts/pemisahan-cbt-ptsp.md](<D:/acca-new/artifacts/pemisahan-cbt-ptsp.md>) |
| Login nyata / CRUD PostgreSQL / rendering PDF-DOCX / browser per role | Belum dilakukan; wajib menjadi acceptance test sebelum rilis | Lampiran per halaman |

Angka REPRODUCED berarti **bug berhasil diperlihatkan**, bukan tes keamanan lulus. Seluruh data contoh adalah data fiktif. Skrip tidak membuka koneksi jaringan/database untuk simulasi yang ditulis.

## Indeks temuan

| ID | Prioritas | Masalah |
|---|---|---|
| A01 | P1 | Survei pengembangan diri masih dapat dibaca dan dihapus tanpa login |
| A02 | P1 | Konfigurasi penyimpanan membuka kolom rahasia dan izin tulis terlalu luas |
| A03 | P1 | Operasi massal Jurnal tidak memeriksa kewenangan |
| A04 | P1 | Token lama masih diterima setelah akun dinonaktifkan |
| A05 | P1 | Proxy berkas publik menerima URL bebas dan dapat menyajikan HTML dalam origin ACCA |
| A06 | P1 | Upload dan hapus berkas gagal karena bentuk konfigurasi berbeda |
| A07 | P2 | Tanggal dari Prisma berubah menjadi objek kosong saat diserialisasi |
| A08 | P2 | Route jurnal-master tertangkap route ID jurnal |
| A09 | P2 | Sanggar tidak meneruskan autentikasi untuk daftar dan pendaftaran |
| A10 | P1 | Konten pengumuman disimpan dan dirender tanpa sanitasi HTML |
| A11 | P1 | Nilai siswa dapat dibaca dengan mengganti NISN |
| A12 | P1 | Tugas Siswa menerima perubahan lintas pemilik dan checklist siswa lain |
| A13 | P1 | Status kelulusan dan data UM belum dibatasi peran penulis |
| A14 | P1 | Akses halaman e-Supervisi belum membatasi penilai dan penugasan |
| A15 | P1 | LCKH memungkinkan persetujuan dan perubahan submission tanpa pemeriksaan pemilik |
| A16 | P1 | Bank Data mengabaikan izin halaman dan pembatasan kolom sensitif |
| A17 | P2 | Operasi template surat mengirim ID ke resolver yang membutuhkan objek pengguna |
| A18 | P1 | Kontrak Bank Data tidak cocok dengan UI dan ekspor belum diimplementasikan |
| A19 | P1 | Route upload hanya memeriksa keberadaan token, belum keabsahan dan kepemilikan |
| A20 | P1 | Catatan Keuangan hanya dibatasi login, tanpa peran atau kepemilikan |
| A21 | P1 | Daftar PTSP yang masih berada di ACCA terbuka untuk semua sesi |
| A22 | P2 | Target role pengumuman dapat dilewati lewat parameter klien |
| A23 | P2 | Build mengabaikan error tipe dan PTSP ACCA masih memiliki delapan diagnostik |
| A24 | P2 | Registry unggahan dapat ditulis dan dihapus tanpa autentikasi |
| A25 | P1 | Hapus arsip surat tidak memeriksa pemilik atau petugas |
| A26 | P2 | Beberapa operasi multi-langkah belum atomik |
| A27 | P2 | Ringkasan LCKH dipanggil frontend tetapi belum tersedia di backend |
| A28 | P2 | Pengambilan konfigurasi WhatsApp memakai kunci internal yang tidak dikenali guard opsional |

## Rincian dan kriteria perbaikan

### A01 — P1: Survei pengembangan diri masih dapat dibaca dan dihapus tanpa login

**Halaman/area:** /form, /form/responses.

**Lokasi:** [apps/api/src/forms/forms.controller.ts:43](<D:/acca-new/apps/api/src/forms/forms.controller.ts:43>); [apps/api/src/forms/forms.service.ts:505](<D:/acca-new/apps/api/src/forms/forms.service.ts:505>).

**Bukti:** Reproduksi A01: metadata controller tidak memiliki guard pada GET/DELETE survei; service melakukan soft-delete pada ID mock.

**Pemicu:** Pemanggil tanpa token mengakses GET /api/forms/pengembangan-diri untuk memperoleh ID, lalu DELETE dengan parameter id. Backend masih memuat endpoint ini walaupun halaman survei lama telah dihapus.

**Dampak:** Data respons dapat diambil dan disembunyikan oleh pihak tanpa sesi. Global guard yang ditemukan hanya pembatasan frekuensi, bukan autentikasi.

**Perbaikan:** Jika fitur sudah pensiun, keluarkan endpoint dari controller. Jika masih diperlukan, wajibkan sesi dan izin pengelola survei untuk membaca/menghapus; pertahankan submit publik hanya sesuai kebutuhan bisnis.

**Kriteria selesai:** Tanpa token: 401 pada daftar/hapus; siswa tanpa izin: 403; pengelola yang berhak: berhasil. Pastikan tidak ada soft-delete saat ditolak.

### A02 — P1: Konfigurasi penyimpanan membuka kolom rahasia dan izin tulis terlalu luas

**Halaman/area:** /pengaturan-umum, /dokumen.

**Lokasi:** [apps/api/src/site-settings/site-settings.controller.ts:216](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:216>); [apps/api/src/site-settings/site-settings.service.ts:176](<D:/acca-new/apps/api/src/site-settings/site-settings.service.ts:176>); [apps/api/prisma/schema.prisma:1986](<D:/acca-new/apps/api/prisma/schema.prisma:1986>).

**Bukti:** Reproduksi A02 mengembalikan cloudflare_secret_access_key fiktif dan menunjukkan optional guard menerima pengguna null. Tidak membaca rahasia nyata.

**Pemicu:** GET /api/site-settings/file-storage-config?all=true memakai OptionalJwtAuthGuard dan mengembalikan seluruh model. Endpoint switch/update cukup JwtAuthGuard. GET site-settings juga membuka semua key untuk semua pengguna login; PUT config tidak memeriksa admin.

**Dampak:** Jika kolom kredensial terisi, endpoint publik dapat membocorkannya. Pengguna biasa dapat mengubah konfigurasi penyimpanan/system_config. Lokasi endpoint backend juga dapat dijangkau lewat rewrite /api/nest.

**Perbaikan:** Pisahkan konfigurasi publik dan rahasia. Batasi pembacaan/penulisan sensitif pada administrator atau service internal yang sah, pilih kolom respons secara eksplisit, dan jangan kirim secret ke browser. Tinjau rotasi kredensial jika endpoint pernah terekspos dengan secret terisi.

**Kriteria selesai:** Anonim dan siswa tidak menerima secret; PUT/switch oleh siswa 403. Admin hanya menerima metadata yang diperlukan; service storage tetap mendapat konfigurasi melalui jalur internal khusus.

### A03 — P1: Operasi massal Jurnal tidak memeriksa kewenangan

**Halaman/area:** /jurnal, /rekap-jurnal, /pengaturan-data.

**Lokasi:** [apps/api/src/jurnal/jurnal.controller.ts:31](<D:/acca-new/apps/api/src/jurnal/jurnal.controller.ts:31>); [apps/api/src/jurnal/jurnal.controller.ts:60](<D:/acca-new/apps/api/src/jurnal/jurnal.controller.ts:60>); [apps/api/src/jurnal/jurnal.service.ts:81](<D:/acca-new/apps/api/src/jurnal/jurnal.service.ts:81>).

**Bukti:** Reproduksi A03: service melakukan deleteMany berdasarkan rentang tanggal tanpa lingkup guru; controller hanya memiliki JwtAuthGuard.

**Pemicu:** Pengguna login tanpa izin pengelola mengirim generate-massal, pengaturan, atau delete-by-date langsung ke backend.

**Dampak:** Siswa/guru biasa dapat memicu operasi massal dan menghapus jurnal lintas guru. Perlindungan placeholder pada generator yang telah diperbaiki tidak menutup endpoint hapus massal.

**Perbaikan:** Terapkan capability pengelola jurnal pada semua operasi massal, batas rentang tanggal, dan audit pelaku. Teruskan identitas dari sesi, bukan body.

**Kriteria selesai:** SISWA dan GURU tanpa capability ditolak sebelum query tulis. Operator berizin berhasil dalam rentang terbatas; jurnal manual tidak ikut terhapus tanpa kebijakan eksplisit.

### A04 — P1: Token lama masih diterima setelah akun dinonaktifkan

**Halaman/area:** /login, /pengaturan-users, /profile.

**Lokasi:** [apps/api/src/auth/jwt.strategy.ts:28](<D:/acca-new/apps/api/src/auth/jwt.strategy.ts:28>); [apps/api/src/auth/auth.service.ts:49](<D:/acca-new/apps/api/src/auth/auth.service.ts:49>).

**Bukti:** Reproduksi A04: JwtStrategy.validate mengembalikan pengguna mock dengan aktif=false.

**Pemicu:** Admin menonaktifkan akun yang sudah memiliki JWT belum kedaluwarsa. Login baru memeriksa aktif, tetapi validasi setiap permintaan tidak melakukannya.

**Dampak:** Penonaktifan akun belum menghentikan sesi yang sudah terbit. Besar dampak mengikuti izin akun tersebut dan sisa masa berlaku token.

**Perbaikan:** Tolak user yang tidak aktif pada JwtStrategy; untuk pencabutan sesi/reset password gunakan versi sesi atau revoked-before yang diperiksa server. Samakan aturan pada jalur web dan backend.

**Kriteria selesai:** Login, nonaktifkan akun, lalu ulang request memakai token lama: harus 401. Akun aktif tetap bekerja.

### A05 — P1: Proxy berkas publik menerima URL bebas dan dapat menyajikan HTML dalam origin ACCA

**Halaman/area:** /dokumen, /surat, /e-supervisi, /prestasi, /ketidakhadiran.

**Lokasi:** [apps/web/app/api/proxy-image/route.ts:14](<D:/acca-new/apps/web/app/api/proxy-image/route.ts:14>); [apps/web/app/api/pdf-proxy/route.ts:21](<D:/acca-new/apps/web/app/api/pdf-proxy/route.ts:21>); [apps/web/app/api/proxy-docx/route.ts:14](<D:/acca-new/apps/web/app/api/proxy-docx/route.ts:14>); [apps/web/app/api/proxy/image/route.ts:15](<D:/acca-new/apps/web/app/api/proxy/image/route.ts:15>).

**Bukti:** Reproduksi A05: tanpa sesi, URL loopback diteruskan ke fetch simulasi; respons text/html diteruskan kembali. Tidak ada akses jaringan internal nyata.

**Pemicu:** GET proxy-image/pdf-proxy/proxy-docx/proxy/image dengan url kiriman. Tidak ada pemeriksaan sesi, host, IP tujuan, redirect, batas ukuran atau timeout yang memadai pada jalur yang dibaca.

**Dampak:** Risiko SSRF menuju jaringan server dan konsumsi memori. Proxy gambar/PDF yang meneruskan text/html secara inline juga dapat mengeksekusi konten eksternal dalam origin ACCA saat dibuka sebagai dokumen; eksekusi browser belum diuji.

**Perbaikan:** Utamakan ID berkas terdaftar dengan pemeriksaan akses. Terapkan daftar host storage, validasi IP IPv4/IPv6 dan setiap redirect, timeout serta batas ukuran. Tolak konten HTML/SVG aktif atau sajikan dari origin terpisah dengan sandbox yang sesuai.

**Kriteria selesai:** URL loopback/private/link-local dan redirect ke alamat tersebut ditolak sebelum fetch; HTML tidak tampil sebagai dokumen aktif origin ACCA; berkas sah tetap dapat ditampilkan.

### A06 — P1: Upload dan hapus berkas gagal karena bentuk konfigurasi berbeda

**Halaman/area:** /dokumen, /surat, /prestasi, /tugas-siswa, /profile, /pengaturan-umum.

**Lokasi:** [apps/web/app/api/upload/route.ts:18](<D:/acca-new/apps/web/app/api/upload/route.ts:18>); [apps/api/src/site-settings/site-settings.service.ts:176](<D:/acca-new/apps/api/src/site-settings/site-settings.service.ts:176>).

**Bukti:** Reproduksi A06: respons backend valid berupa objek aktif menghasilkan null di helper upload.

**Pemicu:** Backend tanpa all=true menggunakan findFirst dan mengirim data objek; route upload hanya menerima Array.isArray(body.data). POST/DELETE kemudian menganggap konfigurasi belum diset.

**Dampak:** Operasi yang memakai /api/upload dapat gagal 500 meskipun konfigurasi penyimpanan sudah tersedia. Ini dapat memblokir unggahan dokumen, template, foto, dan lampiran.

**Perbaikan:** Tetapkan satu kontrak konfigurasi aktif berupa objek; gunakan tipe bersama dan uji kontrak producer-consumer. Perbaiki bersamaan dengan autentikasi A19, bukan membuka upload tanpa verifikasi.

**Kriteria selesai:** Dengan satu konfigurasi aktif valid, POST/DELETE mencapai adaptor storage. Konfigurasi kosong menghasilkan kesalahan terkontrol; uji semua tipe storage yang benar-benar digunakan.

### A07 — P2: Tanggal dari Prisma berubah menjadi objek kosong saat diserialisasi

**Halaman/area:** /prestasi, /observasi-kelas, /nilai, /nilai-siswa, /lckh, /lckh-approval, /wali-kelas.

**Lokasi:** [apps/api/src/prestasi/prestasi.service.ts:4](<D:/acca-new/apps/api/src/prestasi/prestasi.service.ts:4>); [apps/api/src/observasi-kelas/observasi-kelas.service.ts:4](<D:/acca-new/apps/api/src/observasi-kelas/observasi-kelas.service.ts:4>); [apps/api/src/nilai/nilai.service.ts:4](<D:/acca-new/apps/api/src/nilai/nilai.service.ts:4>); [apps/api/src/lckh/lckh.service.ts:4](<D:/acca-new/apps/api/src/lckh/lckh.service.ts:4>); [apps/api/src/wali-kelas/wali-kelas.service.ts:14](<D:/acca-new/apps/api/src/wali-kelas/wali-kelas.service.ts:14>).

**Bukti:** Reproduksi A07 menjalankan helper aktual dari setiap service: Date menjadi {} pada lima service tersebut; helper yang sudah menangani Date tidak dimasukkan.

**Pemicu:** Respons memuat kolom DateTime Prisma. Rekursi Object.entries(Date) tidak menghasilkan entri dan mengembalikan {}.

**Dampak:** Format tanggal menjadi Invalid Date, pengurutan rusak, formulir edit dan periode laporan menerima bentuk data yang salah. Typecheck tidak mendeteksinya karena any.

**Perbaikan:** Gunakan serializer bersama yang menangani Date sebelum object, atau serializer JSON dengan replacer BigInt. Hindari mengubah Decimal/tipe khusus secara sembarang.

**Kriteria selesai:** Uji objek bertingkat/array dengan Date, null, BigInt: tanggal ISO, BigInt string. Halaman Prestasi dan LCKH dapat mengurutkan serta menampilkan tanggal benar.

### A08 — P2: Route jurnal-master tertangkap route ID jurnal

**Halaman/area:** /rekap-jurnal, /lckh, /jurnal.

**Lokasi:** [apps/api/src/jurnal/jurnal.controller.ts:119](<D:/acca-new/apps/api/src/jurnal/jurnal.controller.ts:119>); [apps/api/src/jurnal/jurnal.controller.ts:114](<D:/acca-new/apps/api/src/jurnal/jurnal.controller.ts:114>).

**Bukti:** Reproduksi A08 membangun router Express menurut urutan metadata controller: /jurnal-master masuk findById.

**Pemicu:** GET /api/jurnal/jurnal-master. Route :id didaftarkan sebelum route statis; handler mengubah jurnal-master menjadi NaN.

**Dampak:** Laporan yang meminta master jurnal gagal atau mendapat hasil endpoint yang salah, walaupun token dan parameter laporan benar.

**Perbaikan:** Letakkan seluruh route statis sebelum parameter dinamis; gunakan ParseIntPipe untuk ID dan uji dispatch route.

**Kriteria selesai:** GET jurnal-master memanggil getJurnalMaster; GET /123 memanggil findById; ID tidak valid menghasilkan 400, bukan query dengan NaN.

### A09 — P2: Sanggar tidak meneruskan autentikasi untuk daftar dan pendaftaran

**Halaman/area:** /sanggar-kurikulum.

**Lokasi:** [apps/web/app/api/sanggar/route.ts:9](<D:/acca-new/apps/web/app/api/sanggar/route.ts:9>); [apps/web/app/api/sanggar/route.ts:20](<D:/acca-new/apps/web/app/api/sanggar/route.ts:20>); [apps/web/app/sanggar-kurikulum/view.tsx:274](<D:/acca-new/apps/web/app/sanggar-kurikulum/view.tsx:274>).

**Bukti:** Reproduksi A09: GET dengan header token tetap menghasilkan fetch backend tanpa Authorization. POST memiliki pola yang sama pada sumber.

**Pemicu:** Pengguna login membuka daftar atau mendaftar melalui /api/sanggar; route menggunakan fetch biasa, sementara backend memakai JwtAuthGuard dan PageAccessGuard.

**Dampak:** Daftar dan pendaftaran dapat selalu ditolak 401; halaman dapat terlihat kosong jika error diubah menjadi array kosong.

**Perbaikan:** Gunakan proxy/nestFetchAsUser dengan token sesi dan teruskan status error. Pastikan aturan akses halaman sanggar cocok dengan siapa yang boleh mendaftar.

**Kriteria selesai:** Akun berizin dapat memuat dan mendaftar; tanpa token 401; tanpa izin 403; error tidak ditampilkan sebagai data kosong sukses.

### A10 — P1: Konten pengumuman disimpan dan dirender tanpa sanitasi HTML

**Halaman/area:** /dashboard, /informasi/kelola, /informasi.

**Lokasi:** [apps/api/src/pengumuman/pengumuman.service.ts:53](<D:/acca-new/apps/api/src/pengumuman/pengumuman.service.ts:53>); [apps/web/app/(dashboard)/dashboard/DashboardContent.tsx:3923](<D:/acca-new/apps/web/app/(dashboard)/dashboard/DashboardContent.tsx:3923>).

**Bukti:** Reproduksi A10 menyimpan HTML dengan atribut event inert tanpa perubahan; sink HTML pada dashboard ditinjau langsung. Tidak menjalankan payload di browser.

**Pemicu:** Pemegang hak menulis pengumuman mengirim HTML beratribut event/script melalui API, kemudian pengguna lain membuka pengumuman.

**Dampak:** Potensi stored XSS. Walaupun cookie sesi HttpOnly, skrip dalam origin aplikasi dapat melakukan aksi dengan sesi korban dan membaca respons yang dapat diaksesnya.

**Perbaikan:** Sanitasi server dengan daftar elemen/atribut yang diizinkan, hindari raw HTML jika tidak diperlukan, dan sanitasi kembali sebelum render bila data historis belum dibersihkan.

**Kriteria selesai:** Konten rich text sah tetap tampil; event handler, javascript URL, script, iframe berbahaya terhapus. Uji konten lama dan konten baru.

### A11 — P1: Nilai siswa dapat dibaca dengan mengganti NISN

**Halaman/area:** /nilai-siswa, /nilai, /anak/[nisn].

**Lokasi:** [apps/api/src/nilai/nilai.controller.ts:55](<D:/acca-new/apps/api/src/nilai/nilai.controller.ts:55>); [apps/api/src/nilai/nilai.service.ts:415](<D:/acca-new/apps/api/src/nilai/nilai.service.ts:415>).

**Bukti:** Reproduksi A11: service mengambil NISN_OTHER tanpa konteks pemanggil. Controller hanya mewajibkan login dan tidak meneruskan user ke operasi ini.

**Pemicu:** Akun siswa/orang tua mengganti parameter nisn pada /api/nilai/siswa atau siswa/apresiasi.

**Dampak:** Nilai dan apresiasi siswa lain dapat terbaca di luar relasi siswa-orang tua atau penugasan guru.

**Perbaikan:** Turunkan lingkup NISN dari sesi; orang tua wajib relasi anak, guru wajib penugasan, operator memakai capability eksplisit. Terapkan untuk daftar siswa dan endpoint turunannya.

**Kriteria selesai:** Siswa A tidak dapat membaca siswa B; orang tua hanya anak terhubung; guru di luar penugasan ditolak; operator berizin tetap dapat mengakses.

### A12 — P1: Tugas Siswa menerima perubahan lintas pemilik dan checklist siswa lain

**Halaman/area:** /tugas-siswa.

**Lokasi:** [apps/api/src/tugas-siswa/tugas-siswa.service.ts:218](<D:/acca-new/apps/api/src/tugas-siswa/tugas-siswa.service.ts:218>); [apps/api/src/tugas-siswa/tugas-siswa.service.ts:275](<D:/acca-new/apps/api/src/tugas-siswa/tugas-siswa.service.ts:275>); [apps/api/src/tugas-siswa/tugas-siswa.controller.ts:47](<D:/acca-new/apps/api/src/tugas-siswa/tugas-siswa.controller.ts:47>).

**Bukti:** Reproduksi A12: user SISWA mengubah tugas milik OTHER pada service aktual. Parameter apiUser diterima tetapi tidak dipakai untuk menolak perubahan.

**Pemicu:** PUT/DELETE tugas dengan ID milik pengguna lain; POST action dengan siswa_id pengguna lain; parameter scope daftar dikirim dari klien.

**Dampak:** Tugas dapat diubah/dihapus, identitas pembuat dipalsukan saat create, dan checklist pengguna lain dapat dimanipulasi. Pembatasan tombol frontend tidak melindungi API.

**Perbaikan:** Periksa hak membuat tugas, kepemilikan/penugasan kelas untuk update/delete, dan siswa_id checklist harus dari sesi. Gabungkan filter lingkup server dengan AND, bukan OR yang memperlebar akses.

**Kriteria selesai:** Siswa tidak dapat mengubah tugas guru; guru A ditolak untuk tugas guru B kecuali hak operator; checklist siswa lain ditolak; filter pencarian tidak memperlebar lingkup kelas.

### A13 — P1: Status kelulusan dan data UM belum dibatasi peran penulis

**Halaman/area:** /um-kelulusan, /pengaturan-data.

**Lokasi:** [apps/api/src/um-kelulusan/um-kelulusan.controller.ts:20](<D:/acca-new/apps/api/src/um-kelulusan/um-kelulusan.controller.ts:20>); [apps/api/src/um-kelulusan/um-kelulusan.service.ts:131](<D:/acca-new/apps/api/src/um-kelulusan/um-kelulusan.service.ts:131>).

**Bukti:** Reproduksi A13: service menulis status LULUS tanpa konteks pelaku. Controller operasi kelulusan hanya dilindungi JwtAuthGuard.

**Pemicu:** Pengguna login mengirim perubahan status/publish_at kelulusan atau operasi konfigurasi/import UM. Cek penguncian nilai di sebagian jalur tidak menggantikan hak penulis.

**Dampak:** Status kelulusan, jadwal publikasi, dan nilai dapat berubah di luar kewenangan akademik.

**Perbaikan:** Terapkan capability per operasi dan lingkup guru/mapel; validasi enum status, nilai, tahun ajaran. Pisahkan operasi admin dari input guru.

**Kriteria selesai:** SISWA/ORANG_TUA ditolak sebelum query tulis; guru hanya mapel yang ditugaskan; kunci UM tetap berlaku; operator sah dapat publikasi.

### A14 — P1: Akses halaman e-Supervisi belum membatasi penilai dan penugasan

**Halaman/area:** /e-supervisi.

**Lokasi:** [apps/api/src/e-supervisi/e-supervisi.controller.ts:40](<D:/acca-new/apps/api/src/e-supervisi/e-supervisi.controller.ts:40>); [apps/api/src/e-supervisi/e-supervisi.service.ts:155](<D:/acca-new/apps/api/src/e-supervisi/e-supervisi.service.ts:155>).

**Bukti:** Reproduksi A14: scored_by FORGED diteruskan ke upsert nilai. Service tidak menerima identitas sesi; controller hanya memeriksa akses halaman.

**Pemicu:** Pengguna yang boleh membuka e-Supervisi mengirim penugasan_id lain atau scored_by palsu. UI memfilter supervisor, tetapi server tidak menegakkan hubungan itu pada tulis nilai.

**Dampak:** Pemilik akses halaman dapat memberi nilai atas nama supervisor lain, mengubah penugasan atau data di luar tanggung jawabnya.

**Perbaikan:** Tambahkan izin terpisah guru/supervisor/pengelola; periksa penugasan dari database dan gunakan scored_by dari sesi. Batasi pengelolaan dokumen/penugasan pada capability yang sesuai.

**Kriteria selesai:** Guru tidak dapat menilai dirinya; supervisor A tidak dapat menilai penugasan B; operator dapat mengatur penugasan; metadata penilai selalu berasal dari server.

### A15 — P1: LCKH memungkinkan persetujuan dan perubahan submission tanpa pemeriksaan pemilik

**Halaman/area:** /lckh, /lckh-approval, /pembayaran.

**Lokasi:** [apps/api/src/lckh/lckh.service.ts:121](<D:/acca-new/apps/api/src/lckh/lckh.service.ts:121>); [apps/api/src/lckh/lckh.service.ts:78](<D:/acca-new/apps/api/src/lckh/lckh.service.ts:78>); [apps/api/src/lckh/lckh.service.ts:57](<D:/acca-new/apps/api/src/lckh/lckh.service.ts:57>).

**Bukti:** Reproduksi A15: service menyetujui submission OTHER untuk user SISWA. Update/delete tidak membatasi pemilik; filter daftar dapat menerima nip klien untuk pengguna non-approver.

**Pemicu:** POST approvals/:id, POST submissions dengan id/nip/status kiriman, DELETE submission atau GET submissions?nip=orang_lain.

**Dampak:** Laporan dapat disetujui, ditolak, diubah atau dihapus di luar alur pemeriksa. Hal ini berpengaruh pada dokumen pengesahan dan proses pembayaran yang bergantung pada status.

**Perbaikan:** Terapkan mesin transisi status dan kewenangan per level; pemilik hanya mengubah draft miliknya; reviewer sesuai penugasan. Jangan spread payload langsung ke model. Abaikan nip klien untuk non-operator.

**Kriteria selesai:** SISWA/non-reviewer mendapat 403; pemilik tidak dapat mengubah laporan yang telah disetujui; update status mencatat pelaku yang sah; akses lintas NIP ditolak.

### A16 — P1: Bank Data mengabaikan izin halaman dan pembatasan kolom sensitif

**Halaman/area:** /bank-data.

**Lokasi:** [apps/api/src/bank-data/bank-data.service.ts:8](<D:/acca-new/apps/api/src/bank-data/bank-data.service.ts:8>); [apps/api/src/bank-data/bank-data.service.ts:121](<D:/acca-new/apps/api/src/bank-data/bank-data.service.ts:121>); [apps/api/src/bank-data/bank-data.service.ts:71](<D:/acca-new/apps/api/src/bank-data/bank-data.service.ts:71>).

**Bukti:** Reproduksi A16: preview dengan user SISWA mengembalikan NIK fiktif dan katalog menetapkan bolehSensitif=true.

**Pemicu:** Pengguna login memanggil preview master_siswa/master_guru langsung; parameter user tidak dipakai. Konfigurasi aktif/kolom yang boleh keluar tidak diterapkan pada query preview.

**Dampak:** Identitas pribadi dapat terbaca meskipun halaman master sudah memfilter kolom sensitif. Konfigurasi dataset juga dapat diubah tanpa izin pengelola.

**Perbaikan:** Tegakkan akses halaman dan capability pengelola pada backend. Gunakan allowlist dataset/kolom, filter aktif dan batas baris dari konfigurasi. Jangan mengembalikan seluruh model.

**Kriteria selesai:** Akun tanpa bank-data 403; kolom sensitif tidak muncul jika tidak diizinkan; dataset nonaktif tidak dapat dipreview; perubahan konfigurasi hanya oleh pengelola.

### A17 — P2: Operasi template surat mengirim ID ke resolver yang membutuhkan objek pengguna

**Halaman/area:** /pengaturan-umum, /surat.

**Lokasi:** [apps/api/src/surat/surat.controller.ts:52](<D:/acca-new/apps/api/src/surat/surat.controller.ts:52>); [apps/api/src/access/access.service.ts:275](<D:/acca-new/apps/api/src/access/access.service.ts:275>).

**Bukti:** Reproduksi A17 menunjukkan argumen bigint diteruskan controller. Resolver aktual membaca user.role, user.nip, user.id; tipe argumen dari req:any menutupi kesalahan ini.

**Pemicu:** Administrator membuat, mengubah atau menghapus template surat.

**Dampak:** Resolusi role kehilangan identitas dan dapat menolak admin dengan 403 atau gagal saat membaca override pengguna.

**Perbaikan:** Teruskan req.user utuh, gunakan tipe request terautentikasi dan hentikan penggunaan any pada batas autentikasi.

**Kriteria selesai:** Admin sah dapat create/update/delete template; non-admin 403; resolver menerima objek dengan id/role/nip yang benar.

### A18 — P1: Kontrak Bank Data tidak cocok dengan UI dan ekspor belum diimplementasikan

**Halaman/area:** /bank-data.

**Lokasi:** [apps/web/app/bank-data/view.tsx:121](<D:/acca-new/apps/web/app/bank-data/view.tsx:121>); [apps/api/src/bank-data/bank-data.service.ts:8](<D:/acca-new/apps/api/src/bank-data/bank-data.service.ts:8>); [apps/api/src/bank-data/bank-data.service.ts:238](<D:/acca-new/apps/api/src/bank-data/bank-data.service.ts:238>); [apps/web/app/bank-data/components/ExportModal.tsx:109](<D:/acca-new/apps/web/app/bank-data/components/ExportModal.tsx:109>).

**Bukti:** Reproduksi A16 juga membuktikan katalog tidak memiliki kolom dan akses .kolom.filter melempar TypeError. Sumber backend hanya menangani action preview.

**Pemicu:** Halaman berhasil mengambil katalog lalu merender kartu. Setelah kontrak kartu diperbaiki, tombol ekspor mengirim action export yang belum didukung.

**Dampak:** Halaman gagal tampil. Ekspor dapat mengunduh JSON error sebagai .xlsx karena backend mengembalikan ok:false dengan HTTP 200 dan UI menganggap res.ok sebagai file sukses.

**Perbaikan:** Samakan DTO katalog, preview, konfigurasi dan ekspor dengan tipe frontend. Implementasikan respons berkas atau non-2xx pada kegagalan; verifikasi MIME sebelum mengunduh.

**Kriteria selesai:** Katalog merender semua kartu; kolom yang diizinkan muncul; ekspor menghasilkan XLSX yang dapat dibuka; action tidak dikenal memberi 400 dan tidak memicu unduhan palsu.

### A19 — P1: Route upload hanya memeriksa keberadaan token, belum keabsahan dan kepemilikan

**Halaman/area:** /dokumen, /surat, /prestasi, /profile, /tugas-siswa.

**Lokasi:** [apps/web/app/api/upload/route.ts:467](<D:/acca-new/apps/web/app/api/upload/route.ts:467>); [apps/web/app/api/upload/route.ts:581](<D:/acca-new/apps/web/app/api/upload/route.ts:581>); [apps/web/lib/app-jwt.ts:55](<D:/acca-new/apps/web/lib/app-jwt.ts:55>).

**Bukti:** Analisis jalur sumber: extractRequestToken hanya mengambil string; tidak ada verifyAppToken/getApiUser/nestFetchAsUser untuk membuktikan identitas sebelum operasi storage.

**Pemicu:** Bearer sembarang memenuhi syarat kehadiran token. DELETE menerima file_url dan menggunakan kredensial server tanpa pemeriksaan pemilik berkas.

**Dampak:** Saat A06 diperbaiki, jalur ini dapat mengizinkan unggah/hapus berkas dengan token palsu atau penghapusan berkas milik orang lain. Saat ini bug konfigurasi A06 menghalangi jalur storage normal; jangan menganggap hambatan itu sebagai kontrol keamanan.

**Perbaikan:** Perbaiki bersamaan dengan A06: verifikasi sesi melalui backend, resolve file ID dari registry, periksa pemilik/capability, batasi jenis/ukuran, dan hilangkan rejectUnauthorized:false pada adaptor hosting.

**Kriteria selesai:** Token acak 401 sebelum memuat storage; pengguna A tidak dapat menghapus berkas B; file di luar registry ditolak; upload sah berhasil.

### A20 — P1: Catatan Keuangan hanya dibatasi login, tanpa peran atau kepemilikan

**Halaman/area:** /catatan-keuangan, /keuangan.

**Lokasi:** [apps/api/src/keuangan/keuangan.controller.ts:11](<D:/acca-new/apps/api/src/keuangan/keuangan.controller.ts:11>); [apps/api/src/keuangan/keuangan.service.ts:137](<D:/acca-new/apps/api/src/keuangan/keuangan.service.ts:137>); [apps/api/src/keuangan/keuangan.service.ts:174](<D:/acca-new/apps/api/src/keuangan/keuangan.service.ts:174>).

**Bukti:** Analisis controller dan namespace CK: GET/POST/PUT/DELETE tidak memanggil getApiUser/assert, sedangkan service hanya menerima dan meneruskan body/query ke adaptor database.

**Pemicu:** Akun login biasa membaca semua catatan tanpa nip atau menulis/menghapus ID lain. Status dan nominal juga berasal dari body.

**Dampak:** Catatan pengeluaran/penggantian dapat diubah lintas pemilik dan ditandai terganti tanpa kewenangan. Ini berbeda dari alur keuangan utama yang memiliki pemeriksaan tersendiri.

**Perbaikan:** Terapkan akses modul, kepemilikan NIP dan capability penggantian; allowlist field, nominal non-negatif, enum status, dan audit pelaku.

**Kriteria selesai:** Siswa ditolak; guru hanya catatannya; penggantian hanya bendahara/operator; nilai tidak valid ditolak dan tidak mengubah data.

### A21 — P1: Daftar PTSP yang masih berada di ACCA terbuka untuk semua sesi

**Halaman/area:** /layanan-ptsp.

**Lokasi:** [apps/api/src/ptsp/ptsp.controller.ts:15](<D:/acca-new/apps/api/src/ptsp/ptsp.controller.ts:15>); [apps/api/src/ptsp/ptsp.service.ts:80](<D:/acca-new/apps/api/src/ptsp/ptsp.service.ts:80>).

**Bukti:** Analisis jalur baca: controller tidak meneruskan user, service mengambil seluruh row tabel yang diizinkan. canManage hanya dipakai operasi update/delete.

**Pemicu:** Akun siswa/orang tua meminta /api/ptsp?table=ptsp_pengaduan atau tabel layanan lain tanpa memiliki halaman layanan-ptsp.

**Dampak:** Data layanan, identitas, catatan admin dan URL lampiran berpotensi terbaca di luar petugas. Temuan hanya mengenai komponen PTSP di repositori ACCA, bukan aplikasi PTSP eksternal.

**Perbaikan:** Tambahkan izin baca layanan-ptsp/role petugas dan scope pemohon jika ada portal mandiri. Pilih kolom respons dan batasi ukuran halaman.

**Kriteria selesai:** Akun tanpa akses ditolak; petugas berizin dapat membaca; pemohon hanya datanya sendiri jika fitur tersebut memang tersedia.

### A22 — P2: Target role pengumuman dapat dilewati lewat parameter klien

**Halaman/area:** /dashboard, /informasi, /informasi/kelola.

**Lokasi:** [apps/api/src/pengumuman/pengumuman.controller.ts:11](<D:/acca-new/apps/api/src/pengumuman/pengumuman.controller.ts:11>); [apps/api/src/pengumuman/pengumuman.service.ts:19](<D:/acca-new/apps/api/src/pengumuman/pengumuman.service.ts:19>).

**Bukti:** Reproduksi A10: getPengumuman tanpa role mengembalikan pengumuman mock target ADMIN.

**Pemicu:** Pengguna login menghilangkan parameter role atau menggantinya dengan ADMIN. Backend tidak menurunkan target role dari sesi.

**Dampak:** Pengumuman yang ditujukan pada kelompok terbatas bisa terbaca oleh kelompok lain. Besar dampak tergantung apakah target role dimaksudkan sebagai kerahasiaan atau hanya preferensi tampilan.

**Perbaikan:** Derivasikan role efektif dari user untuk endpoint pembaca; pisahkan endpoint pengelola yang boleh melihat seluruh target.

**Kriteria selesai:** Siswa tidak melihat konten target admin lewat penggantian/hilangnya query; konten publik tetap tampil. Konfirmasi kebijakan target dengan pemilik produk.

### A23 — P2: Build mengabaikan error tipe dan PTSP ACCA masih memiliki delapan diagnostik

**Halaman/area:** /layanan-ptsp, seluruh halaman.

**Lokasi:** [apps/web/next.config.ts:24](<D:/acca-new/apps/web/next.config.ts:24>); [apps/web/app/layanan-ptsp/components/PTSPClient.tsx:113](<D:/acca-new/apps/web/app/layanan-ptsp/components/PTSPClient.tsx:113>); [apps/web/app/api/ptsp/route.ts:8](<D:/acca-new/apps/web/app/api/ptsp/route.ts:8>).

**Bukti:** Typecheck akhir setelah pembersihan CBT: 7 nama Row tidak didefinisikan dan 1 ekspor route PTSP tidak valid. Backend typecheck lulus, tetapi dua service memakai ts-nocheck.

**Pemicu:** Build dapat tetap diteruskan dengan ignoreBuildErrors. Cast any dan ts-nocheck membuat kontrak yang rusak seperti A18 lolos pemeriksaan tipe.

**Dampak:** Status build berhasil tidak cukup sebagai bukti migrasi benar. Error Row bukan bukti crash runtime tersendiri, tetapi kontrak halaman belum didefinisikan; ekspor PTSP_TABLES melanggar kontrak route Next.

**Perbaikan:** Definisikan tipe Row, pindahkan konstanta dari route ke modul biasa, aktifkan pemeriksaan tipe build setelah baseline bersih. Kurangi any/ts-nocheck pada batas API dengan DTO bersama.

**Kriteria selesai:** tsc frontend dan backend exit 0 tanpa mengecualikan halaman PTSP aktif; build menolak kontrak tipe yang sengaja dibuat salah.

### A24 — P2: Registry unggahan dapat ditulis dan dihapus tanpa autentikasi

**Halaman/area:** /dokumen, /pengaturan-umum.

**Lokasi:** [apps/api/src/site-settings/site-settings.controller.ts:272](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:272>); [apps/api/src/site-settings/site-settings.controller.ts:282](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:282>); [apps/api/src/site-settings/site-settings.service.ts:362](<D:/acca-new/apps/api/src/site-settings/site-settings.service.ts:362>).

**Bukti:** Analisis decorator dan service: kedua endpoint tanpa guard; unregister menghapus metadata berdasarkan fileUrl kiriman.

**Pemicu:** Pemanggil tanpa sesi mengirim URL untuk didaftarkan atau dihapus dari registry.

**Dampak:** Catatan pemakaian storage dan inventaris berkas dapat dipalsukan. Endpoint ini tidak langsung membuktikan penghapusan objek fisik, sehingga dampaknya dibatasi pada metadata.

**Perbaikan:** Jadikan operasi server-to-server dengan guard internal khusus atau sesi dengan ownership; validasi ukuran/nama/URL serta idempotensi.

**Kriteria selesai:** Anonim 401; token pengguna biasa tidak dapat memalsukan registry berkas orang lain; service internal sah tetap dapat mencatat unggahan.

### A25 — P1: Hapus arsip surat tidak memeriksa pemilik atau petugas

**Halaman/area:** /surat, /surat-daftar.

**Lokasi:** [apps/api/src/surat/surat.controller.ts:223](<D:/acca-new/apps/api/src/surat/surat.controller.ts:223>); [apps/api/src/surat/surat.service.ts:250](<D:/acca-new/apps/api/src/surat/surat.service.ts:250>).

**Bukti:** Analisis jalur: controller hanya JwtAuthGuard; service menerima ID tanpa user dan langsung delete setelah memastikan row ada.

**Pemicu:** Akun login mengirim DELETE /api/surat/items/:id milik orang lain. Daftar arsip juga dapat memberi ID karena endpoint daftar hanya login.

**Dampak:** Arsip surat dapat hilang tanpa izin penerbit/pengelola; aturan permintaan surat yang lebih ketat tidak melindungi arsip ini.

**Perbaikan:** Periksa capability pengelola arsip atau kepemilikan serta status dokumen. Pertimbangkan soft-delete untuk arsip final dengan audit trail.

**Kriteria selesai:** Siswa/guru tanpa hak pengelola ditolak untuk surat orang lain; arsip final mengikuti kebijakan retensi; petugas sah tercatat sebagai pelaku.

### A26 — P2: Beberapa operasi multi-langkah belum atomik

**Halaman/area:** /lckh-approval, /tugas-siswa, /pengaturan-umum, /keuangan.

**Lokasi:** [apps/api/src/lckh/lckh.service.ts:121](<D:/acca-new/apps/api/src/lckh/lckh.service.ts:121>); [apps/api/src/tugas-siswa/tugas-siswa.service.ts:275](<D:/acca-new/apps/api/src/tugas-siswa/tugas-siswa.service.ts:275>); [apps/api/src/site-settings/site-settings.service.ts:201](<D:/acca-new/apps/api/src/site-settings/site-settings.service.ts:201>); [apps/api/src/keuangan/keuangan.service.ts:1262](<D:/acca-new/apps/api/src/keuangan/keuangan.service.ts:1262>).

**Bukti:** Analisis urutan tulis: create approval lalu update submission; delete checklist lalu delete tugas; nonaktifkan seluruh storage lalu aktifkan target; hapus register lalu insert. Tidak ada transaction pada batas operasi tersebut.

**Pemicu:** Operasi kedua gagal, target storage tidak ditemukan, atau dua permintaan berjalan bersamaan.

**Dampak:** Approval dan status tidak konsisten, checklist hilang tanpa tugas terhapus, tidak ada storage aktif, atau register lama hilang saat insert gagal.

**Perbaikan:** Gunakan transaksi Prisma untuk perubahan satu database, validasi seluruh input sebelum tulis, dan constraint/conditional update untuk konflik. Efek storage/network gunakan pola kompensasi atau antrean setelah commit.

**Kriteria selesai:** Suntik kegagalan pada langkah kedua dan pastikan langkah pertama rollback. Dua permintaan bersamaan tidak menggandakan approval atau menghasilkan dua storage aktif.

### A27 — P2: Ringkasan LCKH dipanggil frontend tetapi belum tersedia di backend

**Halaman/area:** /lckh, /lckh-approval.

**Lokasi:** [apps/web/app/api/lckh/summary/route.ts:9](<D:/acca-new/apps/web/app/api/lckh/summary/route.ts:9>); [apps/web/app/lckh/view.tsx:303](<D:/acca-new/apps/web/app/lckh/view.tsx:303>); [apps/api/src/lckh/lckh.controller.ts:15](<D:/acca-new/apps/api/src/lckh/lckh.controller.ts:15>).

**Bukti:** Pemetaan controller menemukan tidak ada GET lckh/summary, sedangkan proxy dan kedua halaman memanggil endpoint tersebut.

**Pemicu:** Memuat perhitungan periode/ringkasan LCKH atau detail persetujuan.

**Dampak:** Proxy meneruskan 404, sehingga ringkasan gagal atau tampil kosong. Ini tidak terselesaikan hanya dengan merapikan tipe response.

**Perbaikan:** Implementasikan kontrak ringkasan di NestJS sesuai perhitungan yang dibutuhkan frontend dan terapkan scope NIP dari A15; atau arahkan frontend ke endpoint pengganti yang setara.

**Kriteria selesai:** Permintaan periode valid menghasilkan struktur ringkasan yang diharapkan, dengan hitungan cocok data sumber; bukan 404 dan bukan nol palsu ketika backend gagal.

### A28 — P2: Pengambilan konfigurasi WhatsApp memakai kunci internal yang tidak dikenali guard opsional

**Halaman/area:** /piket, /ketidakhadiran, /test-wa, /pengaturan-umum.

**Lokasi:** [apps/web/app/api/whatsapp/send/route.ts:18](<D:/acca-new/apps/web/app/api/whatsapp/send/route.ts:18>); [apps/api/src/site-settings/site-settings.controller.ts:217](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:217>); [apps/api/src/auth/optional-jwt-auth.guard.ts:6](<D:/acca-new/apps/api/src/auth/optional-jwt-auth.guard.ts:6>); [apps/api/src/site-settings/site-settings.service.ts:9](<D:/acca-new/apps/api/src/site-settings/site-settings.service.ts:9>).

**Bukti:** Analisis rantai panggilan: nestFetch hanya mengirim x-internal-key; OptionalJwtAuthGuard tidak memiliki bypass internal; controller menetapkan isPublic=true dan service menolak key wa_*.

**Pemicu:** Pengiriman WhatsApp mengambil token/target/provider konfigurasi dengan nestFetch setelah pengguna web berhasil diautentikasi.

**Dampak:** Pengaturan yang sebenarnya tersedia dapat dianggap tidak ada; pengiriman berhenti dengan No target configured/No API token configured. Jangan menyelesaikannya dengan membuka semua setting secara publik.

**Perbaikan:** Buat endpoint konfigurasi internal khusus yang memverifikasi kunci service, atau teruskan identitas sah melalui jalur akses yang sempit. Pisahkan secret dari konfigurasi publik sebagaimana A02.

**Kriteria selesai:** Pengiriman simulasi mendapatkan konfigurasi untuk service sah; anonim dan siswa tetap tidak bisa membaca token WA; pengujian tidak mengirim pesan nyata.

## Urutan perbaikan yang disarankan

1. Tutup pembacaan rahasia dan akses tanpa kewenangan: A02, A05, A01, A03, A04, A11–A16, A20, A21, A24, A25. Uji langsung ke backend maupun proxy; menyembunyikan tombol tidak cukup.
2. Perbaiki upload **A06 bersama A19** agar pemulihan fungsi tidak sekaligus membuka celah token palsu. Selesaikan sanitasi A10 dan filter target A22.
3. Pulihkan kontrak halaman Bank Data A18, tanggal A07, routing Jurnal A08, token Sanggar A09, template A17, ringkasan LCKH A27 dan konfigurasi WA A28.
4. Terapkan transaksi A26, DTO bersama, dan gerbang typecheck A23. Sesudah itu jalankan matriks regresi per halaman di staging dengan akun admin, operator, guru, siswa, orang tua dan akun nonaktif.

## Bagian yang sudah memiliki kontrol dan perlu dijaga

- Registrasi admin dibatasi RolesGuard; pendaftaran orang tua memiliki jalur tersendiri. Ini tidak menutup A04 yang berada pada validasi token lama.
- Master data memiliki pemisahan baca sensitif dan tulis; endpoint Bank Data A16 menjadi jalur alternatif yang belum mengikuti pembatasan tersebut.
- Monitoring memeriksa akses halaman; dokumen pribadi memiliki helper kepemilikan; Libur memeriksa role/capability penulis; sebagian endpoint Ekskul memeriksa penugasan pembina. Kontrol ini terlihat di sumber, tetapi seluruh kombinasi role belum diuji end-to-end.
- Prestasi CREATE menetapkan Menunggu/null dan UPDATE memakai identitas sesi; generator jurnal memiliki conditional update placeholder. Audit ini menemukan masalah tanggal A07 dan pengelolaan massal A03 yang berbeda dari temuan terdahulu.
- Middleware memang mengecualikan /api. Karena itu setiap route API/backend harus menjaga dirinya sendiri. Throttler backend mengurangi frekuensi, tetapi bukan pengganti otorisasi.

## Artefak dan cara mengulang

- [artifacts/audit-halaman.md](<D:/acca-new/artifacts/audit-halaman.md>): matriks semua halaman, ketergantungan, API dan skenario regresi.
- [artifacts/audit-endpoint-matrix.md](<D:/acca-new/artifacts/audit-endpoint-matrix.md>): seluruh endpoint NestJS dan route API frontend; indikator otomatis tidak ditafsirkan sebagai keputusan aman/tidak aman.
- [artifacts/audit-inventory.json](<D:/acca-new/artifacts/audit-inventory.json>): inventaris terstruktur.
- [artifacts/audit-source-hashes.json](<D:/acca-new/artifacts/audit-source-hashes.json>): hash sumber yang dicatat saat laporan dibuat untuk mendeteksi perubahan sesudah audit.
- Jalankan dari root repo: `node artifacts/audit-reproduce.cjs` dan `node artifacts/audit-reproduce-more.cjs`. Keduanya hanya memakai data mock. Exit 0 berarti perilaku bug yang ditargetkan berhasil direproduksi; sesudah perbaikan assertion lama memang perlu diubah menjadi tes penolakan/perilaku benar.

Dokumen ini merupakan daftar kerja perbaikan yang dapat ditinjau. Temuan tidak otomatis membuktikan eksploitasi pernah terjadi; verifikasi produksi, isi konfigurasi nyata, hak database, ketahanan beban, layout mobile, dan rendering hasil cetak belum tercakup.
