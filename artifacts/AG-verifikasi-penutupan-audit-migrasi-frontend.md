# Verifikasi penutupan R1–R3

Tanggal: 18 September 2026.

## Hasil

Temuan spesifik R1, R2, dan R3 dapat ditutup berdasarkan pemeriksaan kode dan pengujian terarah. Delapan skenario lulus:

- CREATE Prestasi mengabaikan status Disetujui, validator palsu, dan tanggal validasi dari klien: data yang diteruskan ke Prisma berstatus Menunggu, validated_by null, validated_at null.
- UPDATE tanpa status mempertahankan metadata validator lama.
- UPDATE dengan status memakai identitas sesi dan waktu server.
- Lima skenario PDF (tanpa token, token ditolak, izin ditolak, backend 503, exception koneksi) mengembalikan status yang diharapkan tanpa mengunduh lampiran.

Pemeriksaan TypeScript backend terbaru lulus (exit 0). Bukti: `AG-verifikasi-penutupan-backend.txt` dan `AG-verifikasi-penutupan-reproduksi.json`. Reproduksi: `node artifacts/verify-migration-final.cjs artifacts/AG-verifikasi-penutupan-reproduksi.json`.

Pengujian menggunakan sumber service/handler aktual dengan database dan jaringan simulasi. Tidak ada perubahan kode aplikasi, penulisan data nyata, atau pengujian rendering PDF end-to-end. CBT/PTSP tidak diubah.

## Koreksi kecil untuk laporan pengguna

1. Header “SELESAI PENUH” sebaiknya berbunyi “R1–R3 selesai; V5 ditunda; V6 menunggu uji runtime”. Penutupan ketiga temuan tidak berarti seluruh migrasi atau semua jalur aplikasi telah diverifikasi.
2. Berkas hasil terbaru yang tersedia, `current-typecheck.txt`, berisi tepat 32 diagnostik dengan penanda `error TS`: 4 cbt-proktor, 7 cbt-question, 12 cbt-siswa, 7 PTSPClient, 1 CBTPlaceholders, 1 generated PTSP. Klaim sekitar 33 dan 8 pada cbt-question tidak sesuai berkas tersebut. Baris lanjutan pesan bukan diagnostik baru. Tidak ada diagnostik di luar CBT/PTSP pada berkas itu. Pemeriksaan frontend tidak dijalankan ulang pada putaran ini; angka tersebut merupakan pembacaan log yang tersedia.
3. Pernyataan “proteksi penuh pada seluruh entitas/SEMUA jalur tulis” terlalu luas untuk bukti ini. Klaim yang teruji adalah penolakan metadata validator dari payload pada CREATE dan UPDATE Prestasi serta pencegahan unduhan lampiran sebelum autentikasi berhasil.

Tidak ditemukan penghambat baru dalam lingkup verifikasi R1–R3. V5 dan V6 tetap merupakan pekerjaan lanjutan.
