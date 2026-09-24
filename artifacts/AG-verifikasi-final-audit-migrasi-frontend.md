# Verifikasi perubahan lanjutan audit migrasi

Tanggal: 18 September 2026. Lingkup: tindak lanjut R1/R2 dan konsistensi laporan terbaru; CBT/PTSP dikecualikan. Kode aplikasi tidak diubah.

## Kesimpulan

R1 (unduhan PDF sebelum autentikasi) dan R2 pada jalur UPDATE Prestasi sudah diperbaiki. Masih ada jalur CREATE yang menerima metadata validator dari klien, sehingga klaim proteksi penuh pada seluruh entitas belum tepat.

## Temuan tersisa — P2: pembuatan Prestasi menerima persetujuan dan validator dari klien

- Lokasi: `apps/api/src/prestasi/prestasi.service.ts:87–90`; controller CREATE memanggil service tanpa identitas sesi.
- Pengguna yang memiliki akses modul Prestasi dapat mengirim POST berisi `status_validasi: 'Disetujui'`, `validated_by: 'FORGED'`, dan `validated_at` pilihannya. Service meneruskan nilai tersebut ke operasi Prisma CREATE. Proxy web juga meneruskan body tanpa menghapusnya.
- Reproduksi menggunakan service aktual dengan Prisma mock memperlihatkan hasil CREATE berstatus Disetujui dan validator FORGED. Tidak ada penulisan database nyata.
- Dampak: data baru dapat langsung mengaku telah disetujui oleh identitas lain; perbaikan UPDATE tidak melindungi jalur ini.
- Perbaikan: tentukan status awal Menunggu di server dan kosongkan metadata validator saat penambahan biasa. Jika pembuatan sekaligus persetujuan memang diperlukan, periksa kewenangan validasi serta ambil identitas dan waktu hanya dari server.

## Hasil pengujian terarah

| Skenario | Hasil |
|---|---|
| UPDATE tanpa status, metadata palsu | Lulus: metadata lama dipertahankan |
| UPDATE dengan status, metadata palsu | Lulus: memakai identitas sesi dan waktu server |
| CREATE dengan metadata persetujuan palsu | Gagal: masih diterima |
| PDF tanpa token, dengan lampiran URL | Lulus: 401, nol unduhan lampiran |
| PDF token ditolak backend | Lulus: 401, nol unduhan lampiran |
| PDF izin ditolak | Lulus: 403, nol unduhan lampiran |
| PDF backend gagal | Lulus: 503, nol unduhan lampiran |
| PDF koneksi backend melempar error | Lulus: 502, nol unduhan lampiran |

Bukti: `AG-verifikasi-final-reproduksi.json`. Skrip yang dapat diulang: `node artifacts/verify-migration-final.cjs` dari root proyek. Pengujian memakai service aktual dan handler POST yang diekstrak dari sumber, dengan pengganti database/jaringan; tidak menguji PDF hasil render atau autentikasi end-to-end.

## Konsistensi laporan

- Badge tab kini benar-benar dirender dalam sumber JSX, termasuk pilihan mobile; pemeriksaan visual browser belum dilakukan.
- Laporan terbaru sudah menyebut V5 ditunda dan V6 belum diverifikasi runtime. Status tersebut sesuai batas bukti, bukan pekerjaan yang telah selesai.
- Klaim metadata validator dikeluarkan dari seluruh cabang kode perlu dibatasi pada UPDATE sampai jalur CREATE diperbaiki.
- Pemeriksaan tipe backend ulang lulus (exit 0), bukti `AG-verifikasi-final-backend.txt`.
- Pemeriksaan tipe frontend ulang selesai dengan exit 1: 32 diagnostik, seluruhnya CBT/PTSP (24 CBT + 7 PTSP sumber + 1 generated PTSP). Tidak ada diagnostik di luar pengecualian. Bukti `AG-verifikasi-final-typecheck.txt`. Angka 36 dalam laporan pengguna perlu dikoreksi menjadi 32.
