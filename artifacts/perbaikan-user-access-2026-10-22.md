# Hasil perbaikan Pengaturan Users

Tanggal: 22 Oktober 2026.

## Perubahan

| Temuan audit | Perbaikan |
| --- | --- |
| A01 — Pilihan role berbeda dengan izin server | Satu penyimpanan memperbarui role, grant user, pengecualian user, dan salinan konfigurasi lama dalam transaksi yang sama. Kartu memuat role efektif dari server dan menampilkan pengecualian. |
| A02 — Revoke hilang saat query gagal | Kegagalan membaca pengecualian menghasilkan galat layanan, bukan daftar kosong yang mengaktifkan izin role. |
| A03 — Respons role lama menimpa role aktif | Permintaan lama dibatalkan dan responsnya diabaikan. Penyimpanan mensyaratkan role aktif sudah selesai dimuat. |
| A04 — Gagal baca dianggap daftar kosong | Galat pembacaan diteruskan. Kartu dikunci jika sumber konfigurasi atau daftar user/role gagal dimuat. Konfigurasi JSON rusak juga dikunci. |
| A05 — Akses umum lama tersembunyi | Kartu Pengelola Jurnal (semua fitur) dan Pengelola Semua Folder kini tersedia. Kartu khusus menjelaskan pengaruh izin umum tersebut. |
| A06 — Izin JWT lama tetap meloloskan halaman | Navigasi memeriksa sesi dan izin terkini di server. Klaim halaman lama dan cache izin yang kedaluwarsa tidak menjadi dasar pemberian akses. |
| A07 — Penyimpanan sebagian | Halaman, grup dan perubahan tema satu role disimpan bersama. Penggantian pemegang kapabilitas dan penulisan dua format tema juga memakai transaksi. |
| A08 — Simpan satu kartu menghapus draf kartu lain | Penyimpanan memperbarui kartu terkait saja. Pindah role/tab melalui kontrol pengaturan meminta keputusan jika ada perubahan. Penutupan/muat ulang halaman mempunyai peringatan perubahan. |
| A09 — Dropdown terpotong | Kontainer grup tidak memotong dropdown; pilihan di luar batas kartu dapat diklik. |
| A10 — Tampilan 320 px meluber | Kontrol tema dan Simpan tersusun ulang tanpa saling menimpa atau memperlebar halaman. |
| A11 — Pilihan tema massal terpotong | Tinggi multi-select menyesuaikan isinya, dengan area gulir untuk pilihan yang banyak. |
| A12 — Filter Kinerja Guru hilang | Grup Kinerja Guru tersedia; daftar filter juga mencakup grup dari katalog modul. |

Pengaturan Pengumuman juga menyebutkan akses bawaan OP_PENGUMUMAN secara tepat. Bank Data menghormati pengecualian user dan berhenti memakai salinan JSON sebagai sumber izin setelah konfigurasi diselaraskan.

## Penunjukan lama

Tidak ada migrasi data otomatis yang dijalankan ke database produksi. Jika suatu kartu menampilkan pesan **“Penunjukan lama turut dimuat”**, tinjau pilihan yang tampil lalu **Simpan** kartu tersebut sekali. Langkah ini menyelaraskan penunjukan lama dengan tabel izin server melalui transaksi baru.

Setelah diselaraskan, salinan JSON lama tidak dapat menghidupkan kembali role atau user yang sudah dicabut dari tabel izin. ADMIN/ADMINISTRATOR tetap memiliki akses penuh pada fitur yang memang memberikan pengecualian admin.

## Pemeriksaan

- **71 tes lulus**, mencakup 16 tes perbaikan baru serta tes akun/sesi, Bank Data dan peserta Klinik yang sudah ada.
- Pemeriksaan TypeScript API dan web lulus.
- Komponen aktual diuji di Chrome dengan API/data contoh pada lebar **320, 390, 768, dan 1280 px**: tidak ada luapan horizontal atau galat JavaScript.
- Interaksi yang diperiksa: penyimpanan kapabilitas satu permintaan, draf kartu lain tetap ada, pembatalan pergantian role yang belum disimpan, penyimpanan halaman/tema, dropdown di luar batas grup, dan pilihan massal.
- Pemeriksaan transaksi memakai penyimpanan contoh yang dapat melakukan rollback. Tidak mengubah atau menguji database produksi.
- Dua berkas tipe otomatis Next.js yang rusak di cache pengembangan telah diarsipkan di `.next/user-access-audit-types`; tipe rute dibuat ulang untuk menuntaskan pemeriksaan web.

## Berkas pemeriksaan

- [Tes izin dan penyimpanan](<D:/[1] ACCA Project/acca-new/apps/api/test/user-access-permissions.test.cjs>)
- [Hasil 71 tes](<D:/[1] ACCA Project/acca-new/artifacts/verified-user-access-tests-2026-10-22.txt>)
- [Pemeriksaan interaksi browser](<D:/[1] ACCA Project/acca-new/artifacts/verify-user-access-ui-2026-10-22.cjs>)
- [Ukuran tampilan](<D:/[1] ACCA Project/acca-new/artifacts/verified-user-access-ui-2026-10-22-metrics.json>)
- [Tampilan 320 px](<D:/[1] ACCA Project/acca-new/artifacts/verified-user-access-pages-320.png>)
- [Dropdown](<D:/[1] ACCA Project/acca-new/artifacts/verified-user-access-dropdown-1280.png>)
- [Pilihan massal](<D:/[1] ACCA Project/acca-new/artifacts/verified-user-access-bulk-1280.png>)

Penerapan memerlukan pembaruan API dan web bersama. Hasil pemeriksaan di atas menggunakan kode lokal dan data contoh.
