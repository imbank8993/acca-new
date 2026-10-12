# Audit dan perbaikan Prestasi Lomba — 12 Oktober 2026

Pemeriksaan mencakup tampilan siswa dan validator, proxy Next.js, controller dan service NestJS, skema Prisma, kebijakan lama, serta jalur unggahan. Temuan berikut telah diperbaiki dalam kode lokal. Tidak ada data produksi yang diubah.

| Prioritas | Kondisi sebelum perbaikan | Perbaikan |
| --- | --- | --- |
| P1 | Filter NISN hanya diterapkan browser. Pengguna dengan akses halaman dapat meminta daftar atau detail siswa lain. | Daftar dan detail memeriksa peran di server; siswa dibatasi NISN dari sesi. Manipulasi filter tidak mengubah pembatasan. |
| P1 | Pengajuan baru menerima NISN siapa pun dan catatan validator dari payload. | Pengajuan siswa wajib memakai identitas sendiri; status awal dan seluruh metadata keputusan ditentukan server. |
| P1 | Pemegang akses halaman dapat mengubah isi dan menyetujui prestasi sendiri melalui PUT. | Perubahan hanya boleh dilakukan ADMIN/ADMINISTRATOR, OP_LOMBA, atau WKM Kesiswaan. Persetujuan tetap bersifat final. |
| P1 | DELETE tidak memeriksa pemilik atau status dan dapat menghapus prestasi siswa lain maupun prestasi yang disetujui. | Penghapusan siswa memakai kondisi atomik ID, pemilik, dan status Menunggu/Ditolak. Validator tetap dapat menghapus koreksi data, sesuai kebijakan lama. |
| P1 | URL sertifikat bebas, termasuk URL skrip dan lampiran orang lain. Format dan ukuran tidak dibatasi server sesuai UI. | URL hanya HTTP/HTTPS tanpa kredensial; lampiran baru wajib tercatat di folder Prestasi milik pemanggil, berformat PDF/JPG/PNG dan maksimal 10 MB. Unggahan memeriksa signature berkas. |
| P2 | Validator dapat memutuskan berdasarkan tampilan lama; perubahan bersamaan selain persetujuan akhir dapat saling menimpa. | Browser mengirim versi updated_at yang dibuka. Server memeriksa versi, kemudian melakukan update bersyarat status dan rentang timestamp milidetik. Konflik meminta pemeriksaan ulang. Rentang milidetik mengakomodasi presisi mikrodetik PostgreSQL. |
| P2 | Status, kategori, tingkat, tanggal dan teks tidak divalidasi; alasan penolakan hanya wajib di UI. | Allowlist enum, tanggal kalender sah, batas teks, ID UUID dan alasan penolakan divalidasi server. Perubahan isi tanpa keputusan mengulang status Menunggu dan membersihkan metadata lama. |
| P2 | Ketukan kartu siswa di mobile selalu memanggil hapus, termasuk prestasi yang telah disetujui. | Ketukan kartu membuka sertifikat. Tombol hapus terpisah hanya muncul untuk Menunggu/Ditolak. Kegagalan jaringan saat hapus ditampilkan kepada pengguna. |
| P2 | ADMINISTRATOR tidak dikenali sebagai validator frontend. | ADMINISTRATOR dikenali konsisten dengan backend. |
| P2 | Daftar API tidak memiliki batas; respons fetch lama bisa menimpa hasil terbaru. | API menyediakan halaman maksimal 500 baris dengan urutan stabil; browser membaca seluruh halaman dan mengabaikan respons permintaan lama. Akun siswa tidak lagi meminta daftar induk kelas seluruh siswa untuk melengkapi tampilan. |
| P2 | Berkas bisa dilaporkan berhasil diunggah walaupun registry kepemilikan gagal. Input file dapat menyisakan pilihan lama setelah memilih file tidak sah; form bisa dikirim kembali selama unggahan. | Registry wajib berhasil untuk folder Prestasi. Pilihan tidak sah mengosongkan file, submit dijaga selama proses, dan modal tidak ditutup selama penyimpanan. |
| P2 | JSON tidak valid menghasilkan kesalahan internal pada proxy. | Proxy tambah/ubah mengembalikan 400 dan meng-encode ID pada jalur backend. |

## Verifikasi

- `node --test apps/api/test/prestasi-security.test.cjs`: 17 skenario lulus, mencakup akses lintas siswa, pemalsuan identitas/keputusan, lampiran, input, konflik, penghapusan dan pagination.
- 19 pengujian regresi Keuangan juga lulus setelah perubahan jalur unggahan bersama.
- Pemeriksaan tipe API dan web, lint utilitas unggahan/proxy Prestasi, dan pemeriksaan whitespace diff lulus.
- Pengujian tidak memakai kredensial atau database produksi. Database dan konkurensi disimulasikan; signature unggahan diuji terhadap berkas lokal tiruan.

## Batas verifikasi

Belum dilakukan pengujian integrasi PostgreSQL, penyimpanan R2 sebenarnya, atau alur browser menggunakan akun siswa/validator nyata. Tautan penyimpanan publik tetap mengikuti konfigurasi penyimpanan yang ada; pembatasan API tidak menjadikan URL berkas yang sudah diketahui bersifat privat. Referensi lampiran lama yang tidak berubah tetap dipertahankan saat validator memperbarui data. Tidak ada rekonsiliasi atau penghapusan data historis, migrasi database, maupun deployment pada tugas ini.
