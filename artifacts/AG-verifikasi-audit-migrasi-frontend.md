# Verifikasi independen laporan AG-audit-migrasi-frontend

## Kesimpulan

**Status yang didukung bukti: sebagian selesai, masih memerlukan perbaikan.** Klaim `SELESAI (100% Seluruh Kelompok Temuan Diterapkan)` dan bebas ReferenceError/TypeError pada laporan AG belum dapat disetujui.

Verifikasi dilakukan terhadap kode workspace saat ini, dokumen AG, pemeriksaan TypeScript frontend/backend, dan reproduksi service dengan data tiruan. Tidak ada perubahan kode aplikasi, database, atau berkas khusus CBT/PTSP dalam verifikasi ini. Dokumen AG asli dipertahankan. Belum ada uji browser menyeluruh atau render PDF aktual.

## Temuan yang menghalangi persetujuan

### V1 — P1: penguncian Prestasi belum atomik

Lokasi: [prestasi.service.ts](/D:/acca-new/apps/api/src/prestasi/prestasi.service.ts:97).

`findUnique` dan pemeriksaan status dilakukan terpisah dari `update({where:{id}})`. Dua request bisa sama-sama membaca `Menunggu`; request pertama menyetujui, request kedua tetap memperbarui menjadi `Ditolak`. Pemeriksaan status hanya melindungi request berurutan yang membaca status setelah persetujuan selesai.

**Hasil reproduksi deterministik dengan dua request tiruan:** dua request sukses; status akhir `Ditolak`. Jadi penambahan `ConflictException` belum memenuhi kriteria audit tentang request bersamaan.

**Perbaikan yang dibutuhkan:** letakkan syarat status pada operasi tulis atomik, periksa jumlah baris yang berubah, dan kembalikan 409 bila tidak memenuhi syarat. Tambahkan uji persetujuan bersamaan. Identitas validator juga masih diambil dari payload `validated_by/validated_at`, belum dari sesi backend seperti diminta audit; controller belum meneruskan user ke method update.

### V2 — P1: Generate dapat memindahkan jurnal yang sudah disentuh guru

Lokasi: [jurnal.service.ts](/D:/acca-new/apps/api/src/jurnal/jurnal.service.ts:195).

Syarat `is_generated && materi kosong` tidak membuktikan jurnal belum diedit manual. Method update jurnal mengisi `filled_by: GURU/ADMIN` tetapi tidak mereset `is_generated`; pengguna juga bisa mengisi refleksi, status kehadiran, guru pengganti, atau keterangan tanpa materi.

**Hasil reproduksi:** jurnal `is_generated=true`, `materi=null`, `filled_by=GURU`, refleksi terisi, dipindahkan dari NIP OLD ke NEW oleh Generate; `results.updated=1`. Isi refleksi guru lama tetap melekat pada pemilik baru.

**Perbaikan yang dibutuhkan:** bedakan placeholder sistem yang belum disentuh dari jurnal manual memakai penanda yang konsisten dan seluruh kondisi relevan. Gunakan update bersyarat atomik sehingga edit guru yang masuk setelah pembacaan tidak bisa tertimpa. Jangan otomatis mengubah jurnal historis yang sudah disentuh.

### V3 — P1/P2: kegagalan pengambilan data PDF masih dianggap boleh dilanjutkan

Lokasi: [generate-pdf/route.ts](/D:/acca-new/apps/web/app/api/surat/generate-pdf/route.ts:876).

Urutan argumen helper, token, JSON body, dan pembacaan `{status,body}` sudah diperbaiki. Namun respons gagal hanya menghasilkan `console.warn`; exception juga ditangkap lalu diteruskan dengan default. Sesudah backend 401/500 atau tidak tersedia, fungsi tetap membangun PDF dengan konfigurasi default dan daftar lampiran kosong.

**Perbaikan yang dibutuhkan:** kembalikan kegagalan HTTP untuk autentikasi/data wajib, bedakan aset opsional dari data lampiran wajib, dan uji backend gagal serta token tidak valid. Klaim bahwa alur sudah benar belum cukup hanya dengan menambah warning. Jalur ini diverifikasi melalui alur kode; PDF aktual belum dirender.

### V4 — P2: normalisasi tipe dan syarat rilis belum tuntas

Pemeriksaan ulang frontend keluar dengan kode gagal, bukan hanya karena CBT/PTSP:

| Kelompok | Diagnostik terbaru |
|---|---:|
| Berkas sumber acca-new, di luar CBT/PTSP | 74 pada 44 berkas |
| Berkas sumber khusus CBT/PTSP — dikecualikan | 32 |
| Berkas yang dihasilkan Next.js | 3: dua Piket, satu PTSP |
| Total | 109 |

Jumlah diagnostik bukan jumlah bug. Dibanding baseline, diagnostik sumber dalam cakupan turun dari 162 menjadi 74. Itu kemajuan yang terukur, tetapi bukan selesai seluruhnya.

Contoh sisa: data dashboard `attendance`, tipe `kelas_list/target_siswa/nip` pada Tugas Siswa, kontrak Jurnal/User/Libur, null pada impor ketidakhadiran, `oldValue` pada reset-data, properti komponen, serta query semester pada settings-server.

Log terbaru: [AG-verifikasi-typecheck.txt](/D:/acca-new/artifacts/AG-verifikasi-typecheck.txt). Pemeriksaan backend lulus: [AG-verifikasi-backend.txt](/D:/acca-new/artifacts/AG-verifikasi-backend.txt) kosong karena tidak ada diagnostik.

`ignoreBuildErrors: true` masih aktif. Sesuai batas cakupan, tidak perlu memperbaiki CBT/PTSP untuk meluluskan pemeriksaan global; perlu pemeriksaan acca-new dengan pengecualian yang tercatat. Klaim bagian 12 AG bahwa seluruh akar masalah tipe sudah selesai harus direvisi.

### V5 — P2: pemusatan backend belum dilaksanakan sesuai target audit

Contoh: [logger.ts](/D:/acca-new/apps/web/lib/logger.ts:1), helper informasi, laporan klinik, verifikasi LCKH, dan helper lainnya masih mengakses Prisma dari server Next.js. Ini bukan masalah sekadar lokasi file atau kode browser, melainkan target arsitektur audit yang belum dikerjakan.

Bagian 10 AG menjelaskan pemeliharaan helper, bukan migrasi operasi dan otorisasi acca-new ke NestJS. Status yang tepat ialah **belum selesai/ditunda secara eksplisit**, bukan selesai 100%. CBT/PTSP tetap di luar pekerjaan.

### V6 — P2: penghilangan diagnostik dengan `as any` bukan bukti kompatibilitas PDF

Bagian 11 AG menyebut casting aman. Kode respons biner dan opsi Puppeteer menggunakan `as any`; cast tersebut hanya melewati pemeriksaan tipe, tidak menguji nilai runtime. Tidak cukup bukti untuk menyimpulkan rendering pasti rusak, tetapi juga belum cukup untuk menyatakan kompatibilitas terverifikasi.

**Perbaikan yang dibutuhkan:** gunakan bentuk byte/response yang sesuai tipe, pastikan opsi library sesuai runtime, dan uji keluaran QR/DOCX/PDF. Jangan menyebut casting sebagai pengganti uji hasil.

## Matriks 12 kelompok laporan AG

| Kelompok | Status verifikasi | Catatan |
|---|---|---|
| 1. Generate Jurnal | Sebagian selesai | Resolver tanggal dipakai dengan benar; perlindungan jurnal manual belum aman (V2). |
| 2. Penguncian Prestasi | Sebagian selesai | 409 berurutan dan UI diperbaiki; race serta identitas validator belum selesai (V1). |
| 3. PDF Surat | Sebagian selesai | Kontrak helper benar; error masih diteruskan dengan default (V3). |
| 4. Parameter rute dinamis | Perubahan kode sesuai | Delapan berkas yang disebut sudah menunggu Promise params; uji HTTP semua handler belum dilakukan. |
| 5. Import runtime | Perubahan kode sesuai | Import useRouter dan Spinner dipulihkan; uji browser tetap diperlukan. |
| 6. Cache storage | Perbaikan deklarasi sesuai | Variabel cache kembali ada; alur unggah/R2/fallback end-to-end belum diuji. |
| 7. ActionButtons | Sebagian selesai | approve/reject dan caller observasi diperbaiki; kontrak komponen lain masih menyisakan diagnostik. Prop size diterima namun belum mengubah tampilan ukuran. |
| 8. Normalisasi data | Sebagian selesai | Beberapa kontrak diperbaiki, masih ada diagnostik lintas modul (V4). |
| 9. Import tipe/wrapper | Perubahan yang disebut sesuai | Beberapa helper/tipe terkait masih perlu dituntaskan, jangan mengklaim seluruh frontend selesai. |
| 10. Backend terpusat | Belum selesai | Akses Prisma server Next.js khusus acca-new masih ada (V5). |
| 11. Log aktivitas/PDF | Sebagian selesai | Penerusan Request/IP diperbaiki; cast PDF belum tervalidasi runtime (V6). |
| 12. Pemeriksaan tipe/rilis | Belum selesai | Backend lulus; frontend dalam cakupan masih gagal (V4). |

## Bukti reproduksi dan batas verifikasi

- Reproduksi negatif service Prestasi: dua request mulai dari Menunggu, keduanya sukses, status akhir Ditolak.
- Reproduksi negatif service Jurnal: jurnal dengan refleksi guru dan materi kosong berganti NIP ketika Generate.
- Kontrol positif: Generate meneruskan tanggal 2026-09-21 dan hari Senin ke resolver; ketika resolver mengembalikan kosong, tidak ada jurnal dibuat.
- Kontrol positif: Prestasi yang sudah Disetujui sebelum request dimulai menghasilkan 409 dan tidak memanggil update.
- Reproduksi menggunakan mock operasi database dan service asli, bukan uji konkurensi PostgreSQL live. Tidak ada penulisan data produksi.
- Pemeriksaan tipe backend: lulus. Frontend: gagal dengan jumlah di atas.
- Klaim bahwa tidak ada satu pun perubahan historis CBT/PTSP tidak dapat dibuktikan dari laporan saja karena workspace sudah memiliki banyak perubahan sebelum verifikasi. Pada verifikasi ini, keduanya tidak diubah atau dijadikan sasaran perbaikan.

## Koreksi status yang disarankan untuk AG

Ganti status eksekusi menjadi: **“Perbaikan sebagian telah diterapkan. Backend lolos pemeriksaan tipe; masih terdapat 74 diagnostik sumber frontend acca-new dan temuan integritas data yang harus diperbaiki sebelum dinyatakan tuntas.”**

Urutan tindak lanjut: V1 dan V2 → V3 → sisa kontrak frontend serta verifikasi PDF → pemusatan backend dan pemeriksaan rilis. Dokumen AG asli belum diubah agar catatan implementasi pengguna tetap utuh.

Uji regresi JadwalWriteService: 1 suite, 6 pengujian lulus pada verifikasi ini.
