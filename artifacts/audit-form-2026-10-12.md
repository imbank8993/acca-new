# Audit halaman Form — 12 Oktober 2026

Cakupan: dashboard `/form`, builder, tanggapan/seleksi, viewer `/f/[id]`, API Next.js, controller/service NestJS, mesin skor/alokasi, dan skema Prisma. Dokumen ini mencatat keadaan sebelum perbaikan; nomor baris mengacu pada kode saat audit. Perbaikan F01–F16 telah diterapkan pada kode lokal dan diverifikasi. Lihat [laporan perbaikan](./perbaikan-form-2026-10-12.md) untuk status akhir dan batas verifikasi. Pengujian memakai form, identitas, database, dan penyimpanan tiruan tanpa data produksi.

## Temuan keamanan prioritas tinggi

### F01 — P1 — Hak mengisi form publik dipakai sebagai hak mengelola tanggapan

`apps/api/src/forms/forms.service.ts:219`, `:230`, `:400`, `:453` memanggil `getFormById()`, yang memperbolehkan semua pemanggil pada form publik, tanpa pemeriksaan pemilik/pengelola berikutnya.

Terbukti akun SISWA bukan pemilik dapat membaca jawaban, menghapus jawaban, menghitung ulang skor, serta menyimpan hasil seleksi. Pembatasan React tidak melindungi akses langsung ke API. Dampaknya mencakup kebocoran data responden dan perubahan/penghapusan hasil seleksi.

Perbaikan: pisahkan izin membaca/mengisi schema dari izin mengelola form dan tanggapan. Terapkan pemeriksaan pemilik serta kapabilitas pengelola pada seluruh operasi respons/seleksi di server.

### F02 — P1 — Pengiriman anonim diterima pada form privat

`submitResponse()` (`forms.service.ts:313–393`) menghitung status publik tetapi tidak menolak sesi kosong ketika form privat. OptionalJwtAuthGuard mengembalikan null untuk token kosong maupun token tidak sah. Jika userId null, pengecekan duplikasi dilewati.

Terbukti form is_public=false menerima jawaban anonim `{}`. Pengisian privat tidak memakai kebijakan akses detail form yang sama. API langsung dapat mencemari hasil atau melewati batas pengisian meskipun viewer menolak membuka form privat.

Perbaikan: wajibkan sesi sah dan kebijakan responden yang eksplisit untuk form privat; bedakan token tidak sah dari pengisian anonim form publik.

### F03 — P1 — Stored XSS pada konfirmasi hapus tanggapan

`apps/web/app/form/responses/view.tsx:75` memasukkan jawaban pertama responden ke SweetAlert `html` tanpa escaping. Browser terisolasi dengan template asli membuktikan `<img src=x onerror="window.__formAudit=1">` dieksekusi saat dialog dibuka.

Dampak: jawaban publik dapat menjalankan skrip di sesi pengelola ketika ia meninjau penghapusan. Isi sel tabel yang memakai React tidak menghilangkan celah pada dialog ini.

Perbaikan: gunakan text/textContent atau escape seluruh interpolasi HTML. Jangan menampilkan jawaban mentah melalui html.

### F04 — P1 — Jawaban tidak divalidasi sehingga skor bisa dimanipulasi

Server hanya mewajibkan form_id dan data truthy. Required field, tipe data, pilihan sah, batas angka, kardinalitas checkbox, conditional visibility, excludeChosenFrom, dan provenance berkas tidak diperiksa terhadap schema.

Terbukti required field boleh kosong, pilihan `evil` diterima, dan field radio bernilai `['a','a','a']` memperoleh skor 30 untuk opsi yang seharusnya bernilai 10. `computeScores()` menjumlahkan array tanpa deduplikasi atau pembatasan tipe (`apps/api/src/forms/form-allocation.ts:35–39`). Field tersembunyi juga tidak dibuang oleh server.

Detail publik turut mengirim option.score, allocation, dan metadata pengelola. Pada form penilaian yang mengandalkan bobot sebagai kunci jawaban, metadata tersebut memudahkan memilih jawaban dengan skor tertinggi.

Perbaikan: validasi jawaban di server berdasarkan ID field dan schema; tolak kunci/tipenya yang tidak sah, deduplikasi checkbox, serta jangan kirim bobot/konfigurasi internal ke responden.

### F05 — P1 — Endpoint opsi publik mengekspos data induk

`GET /forms/dynamic-options` tidak memakai guard; proxy Next.js sengaja meneruskan token kosong. `getDynamicOptions()` mengembalikan daftar nama semua siswa aktif dan nama+NIP guru. Akses tidak terkait form tertentu atau kebutuhan field yang sedang diisi.

Perbaikan: batasi impor database kepada pengelola. Jika responden memerlukan opsi dinamis, sediakan opsi minimum untuk field/form yang memang diizinkan, tanpa data induk yang tidak diperlukan.

### F06 — P1 — Form privat bocor melalui daftar navbar publik

`getPublicForms()` (`forms.service.ts:243`) langsung meloloskan schema.show_in_academic_navbar=true sebelum memeriksa is_public. Terbukti form privat muncul dengan record dan schema lengkap di endpoint anonim, meskipun getFormById anonim untuk form itu ditolak.

Perbaikan: flag tampil navbar tidak boleh menimpa privasi. Daftar publik hanya mengembalikan metadata minimum form yang benar-benar boleh diakses publik; status link, publik, dan pengelola harus terpisah.

## Bug fungsi dan integritas data

### F07 — P2 — Setiap akun login dapat membuat form lewat API

CreateForm hanya memakai JwtAuthGuard, tanpa PageAccessGuard/peran/kapabilitas pengelola. Terbukti akun SISWA biasa dapat membuat form melalui API meskipun dashboard hanya memberi kontrol kepada admin, OP_FORM, atau pengurus kelas.

Perbaikan: tegakkan izin pengelolaan di server, termasuk create/list/update/delete, dan samakan kebijakan frontend/backend.

### F08 — P2 — Batas satu tanggapan tidak efektif

`allowMultiple = isPublicForm || schema.allow_multiple_responses === true` selalu memperbolehkan banyak tanggapan untuk form publik, meskipun allow_multiple_responses=false. Form privat melakukan findFirst kemudian create tanpa transaksi/constraint untuk identitas yang sama. Pengujian bersamaan membuktikan kedua create dapat berjalan.

Perbaikan: definisikan batas identitas untuk form publik dan privat secara eksplisit; gunakan proteksi atomik/idempotensi untuk kebijakan satu respons. Untuk publik anonim, jelaskan batas yang memang dapat dijamin.

### F09 — P2 — Identitas numerik tidak cocok dengan kolom UUID

getUserIdentifier() mengembalikan String(user.id) ketika auth_id kosong. Namun custom_forms.created_by dan custom_form_responses.user_id masih bertipe UUID dan berelasi ke auth_users, sedangkan identitas utama aplikasi sekarang dapat berupa public_users.id numerik.

Pengujian membuktikan create meneruskan `'7'` ke field created_by. GetForms nonadmin dan pengecekan duplikasi juga menambahkan kondisi String(user.id) ke kolom UUID, termasuk ketika auth_id sah tersedia. Nilai tersebut tidak valid untuk kolom UUID dan berpotensi membuat query gagal sebelum alur bisnis berjalan.

Perbaikan: tentukan satu representasi identitas yang valid dengan skema database, lakukan migrasi relasi bila diperlukan, dan jangan mencampur UUID dengan ID numerik dalam kondisi query. Efek database perlu dikonfirmasi di PostgreSQL pengujian; audit tidak menjalankan query produksi.

### F10 — P2 — Hapus form dan hitung ulang skor tidak atomik

DeleteForm menghapus respons terlebih dahulu lalu form, tanpa transaksi, padahal relasi respons sudah memiliki onDelete:Cascade. Pengujian dengan kegagalan penghapusan form membuktikan form masih ada sementara responsnya sudah hilang. RecalculateScores mengubah respons satu per satu tanpa transaksi sehingga kegagalan di tengah dapat menyisakan skor campuran.

Perbaikan: transaksi/cascade untuk penghapusan; hitung ulang sebagai perubahan atomik atau job yang status dan kegagalannya dapat diperiksa. Alokasi persisten sudah memakai transaksi, tetapi haknya bermasalah pada F01.

### F11 — P2 — Field file tidak mengunggah berkas dan batas ukuran hanya teks

Viewer `/f/[id]/page.tsx:1126–1153` mengubah pilihan file menjadi array nama berkas. Tidak ada pengiriman byte, URL hasil unggahan, atau validasi maxSize.

Browser asli terisolasi membuktikan berkas 2 MB diterima saat maxSize=1, lalu JSON submission hanya berisi `['acca-form-audit-large.pdf']`. Pengelola tidak dapat memperoleh isi sertifikat dari nama tersebut; responden berpotensi mengira berkas sudah diterima.

Perbaikan: implementasikan unggahan yang terotorisasi dan simpan referensi sah, atau nonaktifkan komponen file sampai didukung. Periksa ukuran/format/pemilik di server.

### F12 — P2 — Impor opsi database tidak bekerja

Builder mengirim source `kelas`/`mapel`, tetapi service hanya mengenali `classes` dan tidak mempunyai case mapel. Service mengembalikan `{options}` tanpa ok, sedangkan SettingsPanel.tsx:305 hanya memasang opsi jika `res.ok && data.ok`. Sumber guru/students pun tidak diterapkan oleh builder karena kontrak ini.

Perbaikan: satu enum sumber dan kontrak respons yang sama; validasi sumber tidak dikenal serta uji keberhasilan impor pada semua jenis master.

### F13 — P2 — Label duplikat menyebabkan jawaban dan skor salah dibaca

Viewer menambah suffix `(2)` pada label duplikat saat submit. Mesin skor, tabel respons, dan ekspor tetap membaca data[f.label] tanpa suffix. Terbukti dua pertanyaan label Jawaban dengan jawaban a dan b menghasilkan skor 1, padahal keduanya semestinya berkontribusi 1+10.

Perbaikan: simpan dan baca jawaban berdasarkan ID field stabil; label hanya untuk tampilan. Sediakan pemetaan/migrasi untuk respons lama.

### F14 — P2 — Hak pengurus/owner tidak konsisten di tampilan

Dashboard canManage memasukkan PENGURUS_KELAS. Builder dan ResponsesContent hanya memasukkan ADMIN/ADMINISTRATOR/OP_FORM. Pemeriksaan owner membandingkan created_by UUID/string dengan user.id numerik (`builder/view.tsx:116`, `responses/view.tsx:48`), sehingga pemilik sah yang tidak masuk canManage dapat ditolak.

Perbaikan: gunakan kapabilitas dan identitas owner yang sama dari server pada dashboard, builder, serta tanggapan. Jangan membandingkan bentuk identitas berbeda secara langsung.

## Bug visual dan renderer

### F15 — P2 — Rating 10 bintang terpotong pada layar kecil

RenderField rating memakai satu baris flex tanpa wrap dan tiap ikon berukuran 24 px. Kontainer form memiliki padding horizontal 36 px tetap, termasuk mobile.

Pengukuran renderer asli dengan 10 bintang pada viewport 320 px menemukan elemen bintang mencapai x=349 px, melewati batas layar 29 px. Screenshot menunjukkan bintang terakhir terpotong. Fixture yang sama tidak melampaui layar pada 390, 768, dan 1280 px; ini bukan klaim seluruh form selalu overflow.

Perbaikan: kurangi padding mobile, buat rating responsif/wrap, dan uji kombinasi foto, jumlah bintang, serta indikator nilai. Bukti: [mobile 320](audit-form-mobile-320.png), [mobile 390](audit-form-mobile-390.png), [desktop 1280](audit-form-desktop-1280.png), [metrik](audit-form-visual-metrics.json).

### F16 — P2 — Nilai bawaan dan label kontrol tidak diterapkan benar

FormField.defaultValue tersedia dalam tipe dan builder, tetapi viewer tidak menginisialisasinya. Browser membuktikan field defaultValue='Nama bawaan' tetap kosong. Setting autoFillUser juga tidak dipakai sebagai sumber kebijakan; viewer memakai heuristik label/name/email/NIP.

Label pertanyaan input umum merupakan elemen label terpisah tanpa htmlFor dan input tidak memiliki id/aria-labelledby terkait. Mengklik label tidak fokus ke input; nama aksesibel kontrol tidak selalu tersedia.

Perbaikan: inisialisasi default sesuai tipe, ikuti autoFillUser eksplisit, dan hubungkan label/control dengan ID yang unik. Uji dengan keyboard dan pembaca layar.

## Risiko tambahan yang belum dibuktikan pada aplikasi/perangkat sebenarnya

- Ekspor Excel berupa HTML berlabel .xls. Nilai jawaban di-escape, tetapi label field dan kategori skor diinterpolasi tanpa escaping; metadata dapat merusak struktur HTML ekspor. Eksekusi formula/HTML di Excel belum diuji, sehingga tidak diklaim terbukti.
- Regex pattern dari schema dijalankan langsung di browser. Pola dengan backtracking berat berpotensi membekukan validasi; belum dilakukan uji beban.
- Daftar form dan respons tidak memakai pagination/batas server; GET responses mengabaikan parameter query. Data besar dapat memperlambat API, grafik, ekspor, dan tampilan.
- Builder mobile palette menggunakan fixed bottom:0 tanpa safe-area padding dan 75vh. Konten dekat home indicator/keyboard Safari perlu diuji di perangkat. Input viewer berukuran 13 px juga berpotensi memicu zoom fokus Safari; belum diuji pada iPhone nyata.
- Fetch form/respons tidak memakai pembatalan/versi; respons lama dapat menimpa halaman setelah perpindahan ID. Save builder juga tidak memakai versi data untuk konflik edit.

## Perlindungan yang sudah ada

Update/delete form memeriksa pemilik/admin. User ID respons ditentukan server, bukan mengikuti field metadata dari body. Skor dihitung server dari schema, meskipun validasi inputnya kurang. submitResponse menolak schema.is_active=false. Viewer mempunyai penjagaan submit ganda pada satu sesi browser. Teks umum memakai React, dan isi jawaban pada ekspor sudah di-escape. Backend memiliki ThrottlerGuard global 120 permintaan per 60 detik; audit ini tidak mengklaim endpoint tanpa rate limit.

## Verifikasi dan batas

- `node --test artifacts/audit-form-checks.cjs`: 16 skenario audit lulus, membuktikan perilaku bermasalah saat ini, bukan regresi setelah perbaikan.
- `node artifacts/audit-form-visual.cjs`: renderer React asli dibundle dengan navigasi/fetch tiruan; CSS hasil build lokal dan ikon lokal digunakan. Jaringan browser diblokir. XSS, field file, defaultValue dan ukuran 320/390/768/1280 diperiksa.
- Pengujian database memakai mock; tidak ada pengujian integrasi PostgreSQL atau data akun sebenarnya. Browser adalah Chrome terisolasi, bukan Safari iOS. Tidak ada perubahan kode aplikasi, migrasi, maupun deployment dalam audit ini.

Prioritas: tutup F01–F06 terlebih dahulu; lanjutkan integritas F07–F14 dan visual/aksesibilitas F15–F16. Semua temuan masih belum diperbaiki pada tugas audit ini.
