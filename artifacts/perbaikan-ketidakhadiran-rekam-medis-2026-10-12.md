# Perbaikan ketidakhadiran dan rekam medis — 12 Oktober 2026

Cetak ulang tetap menghapus record surat lama dan membuat surat pengganti. Tombol tunggal, kolektif, rekap, dan jalur DOCX kini meneruskan ID surat lama ke server dalam permintaan cetak ulang. Server memeriksa kategori operator/penerima/periode sebelum mengganti record dalam satu transaksi. Barcode lama tidak berlaku setelah transaksi sukses; jika penyimpanan atau rendering server gagal, surat lama tetap tersedia. Rendering DOCX di browser terjadi sesudah transaksi server dan tidak termasuk jaminan rollback server.

Perbaikan lain:

- Pembuatan surat di Next memeriksa sesi dan akses terkini; data ketidakhadiran diambil dari record server, identitas pembuat dari sesi. Cetak surat medis membutuhkan kewenangan UKS. Alur keluar asrama untuk siswa sakit tetap dapat dipakai operator izin, dengan alasan kesehatan umum tanpa rincian keluhan.
- Log umum, statistik, detail, absensi, dan rekap memeriksa scope pengguna. Siswa hanya membaca dirinya; orang tua hanya anak yang ditautkan; guru hanya siswa kelas/asuhan yang ditugaskan. Rincian klinis dan relasi medis disembunyikan dari pembaca non-UKS. Daftar surat OP_IZIN tidak membocorkan URL surat medis.
- Isi surat medis/rekap membutuhkan sesi petugas. Verifikasi QR publik tetap berfungsi dengan metadata minimum untuk surat sensitif. Pratinjau tidak di-cache secara publik.
- Arsip yang di-proxy harus PDF HTTPS dari basis storage tepercaya. Sambungan dipatok pada IP publik hasil pemeriksaan DNS, redirect tidak diikuti, waktu/ukuran dibatasi, dan signature PDF diperiksa. HTML eksternal tidak disajikan pada origin aplikasi. Save-letter menuntut PDF terdaftar dan kewenangan atas kategori surat.
- Teks medis/biodata/preset pada HTML cetak dan dialog di-escape. Query action POST kini dipertahankan untuk preset dan sinkron manual. Kegagalan penyimpanan preset diberitahukan.
- Perubahan medis dan ketidakhadiran terkait dilakukan dalam transaksi. Penomoran dan sinkronisasi diproteksi lock transaksi bersama; input medis memakai token idempotensi agar retry tidak menggandakan record.
- Operasi ALL menggunakan seri eksplisit, tidak mencocokkan tanggal/keterangan yang kebetulan sama. Seluruh anggota diperiksa dan seluruh rekam medis terkait ikut diperbarui.
- Jenis/status, siswa master, tanggal/waktu, pagination, payload besar, preset, dan ID route divalidasi. Jenis record tersimpan tidak dipindah melalui edit; gunakan record baru bila jenisnya salah. Aktor create/update/delete tercatat dari sesi, bukan nama dalam import.
- Mapping tindak lanjut digunakan saat edit dan sinkron. NONE tidak membuat absensi baru dan menonaktifkan absensi terkait tanpa menghapus rekam medis. Nomor/tanggal default memakai zona sekolah.
- Durasi backend memakai jam aktual dan 24 JP/hari, sesuai helper frontend; absensi per jam memakai jadwal sekolah. Rekap menghitung bagian rentang kontinu di dalam periode; surat rekap mencakup record yang beririsan dengan bulan.
- Variabel origin cetak rekap diperbaiki. Surat dari renderer server menyimpan snapshot HTML pada penyimpanan internal `system_config`; pratinjau memakai snapshot sehingga arsip baru tidak berubah mengikuti data terkini. Snapshot dan token idempotensi memakai tabel yang sudah ada, tanpa migrasi schema baru.

## Verifikasi

`node artifacts/audit-ketidakhadiran-rekam-medis-checks.cjs` menjalankan 33 pemeriksaan regresi: semuanya lulus. Cakupannya akses per akun/operator, input, rollback ketika sinkron/audit/render/simpan gagal, penomoran serentak, retry idempoten, grup/status/durasi, preset, cetak ulang server, proteksi arsip serta snapshot. Source service dan handler Next dijalankan dengan database/session/network tiruan; tidak mengakses produksi.

Typecheck frontend lulus. Pemeriksaan backend tidak menemukan error pada file ketidakhadiran yang diubah, tetapi typecheck seluruh backend masih terhalang error `apps/api/src/tugas-siswa/tugas-siswa.service.ts:92` (`Parameter 'e' implicitly has an 'any' type`) pada perubahan modul lain di workspace. File tersebut tidak diubah untuk pekerjaan ini. Tidak menjalankan deployment atau uji browser dengan akun produksi.

## Batas penerapan

- Perubahan berada di workspace dan belum dideploy.
- Snapshot tersedia untuk surat baru dari renderer server; surat lama memakai fallback rendering bila tidak ada PDF tepercaya.
- Tidak membersihkan duplikat nomor/data historis yang sudah ada, serta tidak mencabut URL storage lama yang sudah dibagikan.
- Basis storage berasal dari konfigurasi R2/Supabase. `LETTER_ARCHIVE_BASE_URLS` dapat memuat basis HTTPS tambahan untuk arsip lama. URL di luar basis tepercaya memakai fallback rendering.
