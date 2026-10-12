# Audit Tugas Siswa — 12 Oktober 2026

Pemeriksaan mencakup halaman utama, formulir, tabel desktop, kartu mobile, proxy Next.js, unggahan, controller/service NestJS, helper deadline, serta skema Prisma. Modul yang tersedia adalah daftar tugas/pengingat dan checklist pribadi. Tidak ditemukan alur pengumpulan jawaban atau pemberian nilai pada modul ini.

Uraian F01–F10 di bawah mencatat kondisi sebelum perbaikan. Seluruh temuan tersebut dan risiko tambahan telah ditangani dalam kode lokal. Verifikasi memakai mock database dan penyimpanan; tidak ada unggahan nyata, permintaan jaringan, kredensial, atau perubahan data produksi.

## Status perbaikan

- F01: jalur unggahan lama mendelegasikan ke jalur utama; token, izin menulis, batas 10 MB, ekstensi, MIME dari nama file, dan registry pemilik wajib diperiksa. HTML/SVG/eksekutabel ditolak untuk folder tugas. MIME yang dipalsukan klien tidak dipakai untuk berkas tugas.
- F02: controller memakai JwtAuthGuard dan PageAccessGuard, serta service menolak role yang tidak berhak. Master dan izin upload juga memeriksa identitas/peran.
- F03: kelas wajib berupa daftar tidak kosong dan konsisten dengan kelas utama. Pengurus diperiksa terhadap enrollment kelas/tahun hasil gabungan update.
- F04: scope menggunakan pasangan kelas/tahun enrollment dan target NISN untuk daftar, detail, statistik, checklist. Daftar target NISN siswa lain disembunyikan dari respons siswa.
- F05: lampiran baru harus tercatat sebagai milik pemanggil di folder tugas; metadata diambil dari registry. Referensi lama yang tidak berubah tetap dipertahankan.
- F06: ID integer positif, boolean asli, teks, enum, kalender, urutan tanggal, master guru/mapel/kelas dan target anggota kelas divalidasi. Tahun dan semester diturunkan dari tanggal. Malformed JSON di proxy mengembalikan 400.
- F07–F08: filter multikelas dipakai konsisten untuk daftar/statistik. Statistik dan deadline menggunakan kalender Asia/Makassar.
- F09–F10: guru ID/nama berasal dari master terpilih, penginput tetap identitas sesi; guru biasa hanya boleh atas namanya sendiri. ADMINISTRATOR dikenali dan admin tidak wajib mempunyai NIP.
- Risiko tambahan: respons daftar/statistik lama diabaikan; checklist tidak diproses bersamaan dan tidak ditimpa fetch lama; form tidak dapat dikirim/ditutup saat upload atau penyimpanan. Update memakai versi updated_at; edit, delete, dan checklist memakai transaksi serta advisory lock per tugas. Kepemilikan diperiksa di dalam transaksi. Enrollment kelas/tahun dipasangkan untuk mencegah akses kelas tahun lain.

Verifikasi: 24 pengujian Tugas Siswa lulus, termasuk jalur upload utama dengan provider tiruan, MIME palsu, kegagalan registry, konflik update, rollback delete, dan privasi target. 36 pengujian regresi Keuangan/Prestasi juga lulus. Pemeriksaan tipe API/web, lint proxy/helper deadline, dan whitespace diff lulus.

Batas: belum ada integrasi PostgreSQL, R2, atau akun/perangkat pengguna nyata. Pengujian transaksi memakai database tiruan. Berkas publik/historis tetap mengikuti konfigurasi penyimpanan sebelumnya. Perubahan tidak memperbaiki data historis secara otomatis dan belum dideploy.

## Temuan utama

### F01 — P1 — Unggahan tanpa autentikasi dan tanpa pembatasan format

`apps/web/app/api/tugas-siswa/upload/route.ts:5–24` menerima multipart dan memanggil `uploadFile` tanpa pemeriksaan token, sesi, peran atau akses halaman. Middleware mengecualikan `/api`. Berkas HTML diterima pada pengujian tanpa sesi; pemeriksaan hanya batas ukuran setelah seluruh file sudah dibaca menjadi buffer.

Dampak: pihak tanpa akun dapat memakai kapasitas penyimpanan madrasah dan mengunggah konten aktif. Provider R2 menetapkan MIME dari nama file dan Content-Disposition inline (`apps/web/lib/storage/cloudflare-storage.ts:87–99`); HTML dapat menjadi halaman aktif pada origin penyimpanan. Ini bukan bukti eksekusi skrip pada origin aplikasi ACCA atau RCE pada server.

Registry pada jalur `uploadFile` juga tidak menerima identitas pemilik. Berkas tidak tercatat dengan pola folder `owner:<id>:...`, sehingga ownership berbeda dari jalur unggahan utama.

Perbaikan: wajibkan sesi dan izin menulis, gunakan validasi ekstensi/ukuran sebelum membaca buffer, tetapkan pemilik registry, serta batasi penyajian konten aktif.

### F02 — P1 — API baca terbuka untuk seluruh peran selain siswa

`apps/api/src/tugas-siswa/tugas-siswa.controller.ts:18` hanya memakai JwtAuthGuard. `scope()` pada `tugas-siswa.service.ts:39` mengembalikan `{}` untuk seluruh role yang bukan SISWA/PENGURUS_KELAS. Pengujian membuktikan akun TAMU mendapat tugas kelas lain. Pembatasan menu tidak melindungi panggilan API langsung, termasuk daftar master.

Perbaikan: periksa akses halaman di API, lalu fail closed terhadap peran yang tidak termasuk pembaca yang diizinkan. Tetapkan kebijakan eksplisit untuk guru, admin, siswa, dan pengurus.

### F03 — P1 — Pembatasan kelas pengurus dapat dilewati

`assertWriter()` (`tugas-siswa.service.ts:26–32`) memilih `kelas_list` jika berupa array, meskipun kosong. Payload `{kelas:'B', kelas_list:[]}` tidak memeriksa kelas B. `create()` tetap menyimpan kelas utama B. Pengurus kelas A berhasil membuat dan memindahkan tugas miliknya ke B dalam pengujian.

Perbaikan: normalisasi satu sumber daftar kelas, wajibkan minimal satu kelas, pastikan kelas utama masuk daftar, dan periksa semua kelas terhadap enrollment pengurus. Update parsial harus memeriksa hasil gabungan data lama dan data baru.

### F04 — P1 — target_siswa tidak menjadi pembatas akses

Schema dan formulir menyimpan mapping kelas ke NISN tertentu; komentar formulir menyatakan null berarti semua siswa. Namun scope daftar/detail/statistik hanya memeriksa kelas. Siswa NISN 001 di A tetap membaca tugas yang ditargetkan hanya ke NISN 999 di A. Checklist memanggil detail dengan scope yang sama, sehingga pembatasan target juga tidak diterapkan di sana.

Perbaikan: terapkan target siswa secara konsisten pada daftar, detail, statistik, dan checklist; siswa hanya boleh menerima data yang ditujukan kepadanya. Jangan mengandalkan filter tampilan.

### F05 — P2 — Referensi lampiran dan metadata tidak divalidasi

`create()` dan `update()` menerima file_url, file_name, file_size dan storage_type langsung dari klien (`tugas-siswa.service.ts:207`, `:258`). URL `javascript:alert(1)` diteruskan ke database dalam pengujian. Tidak ada pemeriksaan skema URL, registry pemilik, format atau relasi lampiran. Jalur viewer belum dibuktikan mengeksekusi URL tersebut; temuan ini adalah penerimaan referensi tidak aman, bukan klaim stored XSS yang sudah dieksekusi.

Perbaikan: ambil metadata dari registry unggahan sah milik pemanggil dan allowlist skema/provenance URL. Pertahankan lampiran lama hanya jika memang tidak berubah.

### F06 — P2 — Validasi input dan konversi checklist keliru

Controller `:51–53` menggunakan parseInt dan `!!is_done`: `tugas_id:'1garbage'` diproses sebagai 1, dan `is_done:'false'` menjadi true. Identitas checklist tetap dibandingkan dengan sesi sehingga pengujian ini tidak membuktikan perubahan checklist siswa lain.

Service juga meneruskan judul kosong dan Date tidak valid ke Prisma; nilai enum, semester, rentang tanggal, daftar kelas dan JSON target tidak tervalidasi menyeluruh. Input buruk dapat menimbulkan data tidak konsisten atau respons internal 500 dari Prisma. Pagination pecahan/Infinity tidak ditolak secara eksplisit. Proxy tambah/ubah/action membaca JSON tanpa penanganan malformed JSON.

Perbaikan: DTO/validasi integer positif dan boolean asli, teks wajib/batas panjang, tanggal kalender dan urutan rentang, enum, struktur JSON serta status 400 untuk input tidak sah.

### F07 — P2 — Filter kelas menghilangkan tugas multikelas

Daftar `:102–103` dan statistik `:316` memakai `where.kelas = filter.kelas`, padahal scope mendukung kelas_list. Tugas dengan kelas utama B dan kelas_list ['B','A'] tampil bagi siswa A tanpa filter, tetapi hilang ketika filter kelas A dipilih. Dibuktikan dengan pengujian.

Perbaikan: filter kelas harus mencocokkan kelas utama ATAU kelas_list pada daftar dan statistik.

### F08 — P2 — Statistik hari bergeser karena UTC

`getStats():303` memakai tanggal UTC dari toISOString. Pada 13 Oktober 2026 pukul 01.30 Makassar (12 Oktober 17.30 UTC), tugas dengan deadline 12 Oktober masih dihitung aktif. Pengujian menggunakan jam tiruan membuktikan hasil tersebut. UI deadline menggunakan hari lokal perangkat, sehingga kartu dan ringkasan dapat berbeda.

Perbaikan: tetapkan zona waktu kalender sekolah, misalnya Asia/Makassar, secara konsisten untuk statistik dan tampilan.

### F09 — P2 — Identitas guru terpilih tidak tersimpan konsisten

Form `TugasSiswaForm.tsx:278` mengirim guru_id terpilih dan nama guru, tetapi `create()` (`service:199`) selalu menetapkan guru_id ke NIP pemanggil untuk akun non-siswa. Admin atau pengurus yang memilih guru B bisa menghasilkan nama guru B dengan ID guru A/null. Filter identitas guru dan kepemilikan dapat salah membaca pasangan tersebut.

Perbaikan: bedakan pemilik/penginput dari guru pemberi tugas, validasi guru terpilih pada master, dan simpan pasangan ID/nama secara konsisten.

### F10 — P2 — Hak administrator tidak konsisten

`assertWriter():27` mewajibkan NIP sebelum mengenali ADMIN/ADMINISTRATOR; administrator tanpa NIP ditolak. Frontend `view.tsx:530` hanya mengenali ADMIN, sehingga ADMINISTRATOR tidak mendapat kontrol yang sesuai. Penolakan administrator tanpa NIP dibuktikan dengan pengujian; ketidaksesuaian frontend dibuktikan melalui kode.

Perbaikan: gunakan ID sesi untuk identitas, wajibkan NIP hanya pada peran yang memerlukannya, dan samakan pengenalan kedua role admin.

## Risiko tambahan pada audit awal (kini ditangani)

- Fetch daftar/statistik tidak memakai pembatalan atau pemeriksaan versi permintaan. Respons lama setelah perubahan filter dapat menimpa data baru atau status checklist hasil klik terbaru (`view.tsx:255–342`).
- Tombol simpan formulir hanya memakai loading penyimpanan, sedangkan proses unggahan memiliki flag uploading terpisah. Tidak ada penjagaan pada handleSubmit terhadap uploading (`TugasSiswaForm.tsx:303–388`, `:659`); tugas berpotensi tersimpan sebelum URL lampiran tersedia.
- Perubahan tugas menggunakan update ID biasa setelah membaca data lama, tanpa versi optimistic. Dua edit pemilik yang bersamaan berpotensi saling menimpa. Belum ada simulasi konflik database untuk jalur ini.
- Enrollment scope memeriksa aktif, tetapi tidak tahun_ajaran. Akses lintas tahun perlu diuji dengan data enrollment historis yang masih aktif sebelum diputuskan sebagai celah.

## Perlindungan yang sudah ada

Endpoint NestJS memerlukan sesi. Scope siswa ditentukan dari identitas server, bukan parameter siswaRole/siswaKelas. Perubahan/penghapusan tugas memeriksa pemilik atau admin. Checklist membatasi siswa_id ke pemanggil. Penghapusan tugas dan checklist dibungkus transaksi; pasangan tugas/siswa checklist memiliki unique constraint. Teks biasa ditampilkan lewat React; HTML SweetAlert pada validasi form memakai daftar label tetap, sehingga tidak ditemukan bukti XSS dari nama tugas pada bagian itu.

## Verifikasi

Jalankan `node artifacts/audit-tugas-siswa-checks.cjs` atau `node --test apps/api/test/tugas-siswa-security.test.cjs` dari root repositori. Skrip kini menjalankan pengujian regresi kondisi sesudah perbaikan. Database, penyimpanan, dan clock dimock; provider sebenarnya dan perangkat pengguna tidak diakses.

Perbaikan mengikuti urutan F01–F04, F05–F06, lalu F07–F10. Verifikasi integrasi dengan PostgreSQL pengujian dan akun peran yang sesuai tetap diperlukan sebelum deployment.
