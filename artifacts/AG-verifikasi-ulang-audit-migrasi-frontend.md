# Verifikasi ulang perbaikan migrasi acca-new

## Kesimpulan terbaru

**Perbaikan utama telah diterapkan dan pemeriksaan tipe acca-new lulus dengan pengecualian CBT/PTSP. Belum dapat dinyatakan seluruh V1–V6 tuntas atau siap rilis tanpa catatan.**

Berkas `AG-verifikasi-audit-migrasi-frontend.md` yang ditunjuk masih berisi hasil pemeriksaan lama. Pembaruan implementasi dan klaim tindak lanjut ditemukan di `AG-audit-migrasi-frontend.md`. Verifikasi ini membandingkan keduanya dengan kode workspace saat pemeriksaan.

Tidak ada perubahan kode aplikasi atau database dalam verifikasi ini. CBT dan PTSP tidak diperbaiki. Hasil di bawah menggantikan angka/status verifikasi lama, bukan menghapus riwayatnya.

## Hasil yang sudah terkonfirmasi

| Pemeriksaan | Hasil |
|---|---|
| TypeScript backend | Lulus, exit 0. |
| TypeScript frontend di luar CBT/PTSP | **0 diagnostik** pada pemeriksaan penuh terbaru. |
| Diagnostik keseluruhan frontend | **32**, semuanya khusus CBT/PTSP; pemeriksaan global tetap exit 1. Angka 36 pada laporan implementasi perlu dikoreksi. |
| Prestasi: dua request bersamaan menyetujui/menolak | Simulasi lolos: satu berhasil, yang lain 409, status tetap Disetujui. Syarat status sekarang ada pada operasi tulis. |
| Jurnal yang sudah disentuh guru | Simulasi lolos: NIP tidak berubah, updated=0. |
| Placeholder Jurnal murni | Simulasi lolos: dapat diselaraskan, updated=1. |
| Guru mengedit setelah Generate membaca jurnal | Simulasi lolos: syarat filled_by pada operasi tulis menolak penggantian. |
| PDF tanpa token / backend menolak / backend gagal / exception | Mengembalikan 401 / 401 / 503 / 502 pada simulasi; tidak meneruskan render. |

Log: [frontend](/D:/acca-new/artifacts/AG-verifikasi-ulang-typecheck.txt), [backend](/D:/acca-new/artifacts/AG-verifikasi-ulang-backend.txt), [hasil reproduksi](/D:/acca-new/artifacts/AG-verifikasi-ulang-reproduksi.json).

## Temuan yang masih perlu diperbaiki

### R1 — P1: pengunduhan lampiran PDF terjadi sebelum autentikasi

Lokasi: [generate-pdf/route.ts:860](/D:/acca-new/apps/web/app/api/surat/generate-pdf/route.ts:860).

Ketika `suratData.lampiran_file` berisi URL HTTP, server memanggil `fetchFileToDataUrl` sebelum pemeriksaan token pada baris 872 dan sebelum NestJS memvalidasi token. Helper menerima URL dari payload dan menjalankan fetch langsung. Karena itu request tanpa token atau dengan token invalid masih dapat memicu akses jaringan dari server sebelum akhirnya ditolak.

**Reproduksi terisolasi:** POST dengan nomor surat, URL lampiran tiruan, dan tanpa token menghasilkan status 401, tetapi fungsi pengunduh sudah terpanggil satu kali. Tidak ada URL sungguhan diakses; pengunduh diganti mock.

**Tindak lanjut:** pindahkan seluruh akses lampiran sesudah validasi autentikasi/otorisasi backend berhasil. Utamakan ID file terdaftar yang diverifikasi backend daripada URL bebas; batasi tujuan unduhan sesuai storage yang diizinkan. Tambahkan uji bahwa request tanpa token dan token invalid tidak memicu fetch lampiran sama sekali.

### R2 — P2: identitas validator masih bisa diubah lewat payload tanpa status

Lokasi: [prestasi.service.ts:127](/D:/acca-new/apps/api/src/prestasi/prestasi.service.ts:127).

Identitas sesi sekarang dipakai saat payload menyertakan `status_validasi`. Namun cabang `else` masih menerima `validated_by` dan `validated_at` langsung dari payload. Pengguna yang lolos akses endpoint dapat memperbarui kedua field pada record belum disetujui dengan tidak mengirim status.

**Reproduksi:** sesi `{username:'REAL'}` mengirim `{catatan_validator:'note', validated_by:'FORGED', validated_at:'2020-01-01'}` tanpa `status_validasi`; data tulis masih berisi validator `FORGED`.

**Tindak lanjut:** keluarkan metadata validator dari daftar field yang dapat diubah klien pada semua cabang. Ketika ada tindakan validasi, isi identitas/waktu hanya dari server; ketika hanya mengedit data biasa, pertahankan metadata. Uji kedua bentuk payload. Perbaikan race status sudah benar dan tidak perlu dibatalkan.

## Catatan penutupan audit

- **V1:** penguncian status atomik lolos simulasi; metadata validator belum sepenuhnya terlindungi karena R2.
- **V2:** skenario regresi jurnal manual, placeholder sistem, dan edit setelah pembacaan lolos simulasi.
- **V3:** propagasi error backend diperbaiki; autentikasi sebelum efek jaringan belum terpenuhi karena R1.
- **V4:** klaim nol diagnostik acca-new terkonfirmasi. Sebagian pembersihan menggunakan `any`/cast; nol diagnostik tidak otomatis membuktikan seluruh perilaku UI benar. Contoh: `TabItem.badge` kini diterima tipenya tetapi komponen Tab tidak membaca/merender badge, sehingga penambahan tipe bukan bukti fitur badge sudah berfungsi.
- **V5:** pemusatan database ke NestJS dinyatakan ditunda dalam laporan baru. Ini status tertunda, bukan temuan selesai. Target pemusatan backend pada tugas awal masih memiliki pekerjaan tersisa.
- **V6:** rendering PDF/QR/DOCX aktual belum saya uji; belum ditemukan bukti hasil staging yang dapat diverifikasi pada artefak audit. Laporan menyebut rekomendasi pengujian staging sekaligus kalimat seolah sudah diverifikasi di staging; status sebaiknya dibuat konsisten menjadi **belum diverifikasi runtime** sampai ada hasil uji.
- Header laporan implementasi masih menyebut seluruh V1–V6 selesai, padahal matriksnya sendiri menunda V5. Sesuaikan menjadi **perbaikan inti diterapkan, typecheck acca-new lulus, masih ada tindak lanjut R1/R2 serta V5/V6**.

## Batas pengujian

Reproduksi menggunakan service asli dengan adapter database tiruan. Jalur error PDF menjalankan fungsi POST yang diekstrak langsung dari sumber TypeScript dengan dependensi jaringan/render diganti mock. Ini menguji logika alur dan parameter, bukan konkurensi PostgreSQL live, middleware HTTP penuh, browser, atau tampilan PDF. Tidak ada pengujian yang menulis data produksi atau mengunduh lampiran sungguhan.

Status siap rilis menyeluruh belum diberikan berdasarkan pemeriksaan statis dan simulasi ini saja.
