# Pemeriksaan sebelum push — 17 Oktober 2026

Perubahan: modul E-Sertifikat lengkap (unggahan template, impor Excel, editor visual presisi, penandatangan, penerbitan PDF/ZIP, QR verifikasi publik, dokumen pendukung, pencabutan), migrasi dan deployment, akses/menu, FAB serta konsistensi tampilan. Pengaturan menu juga menyembunyikan Pengumuman yang terintegrasi di halaman Informasi.

Hasil pemeriksaan:

- TypeScript seluruh frontend: lolos (`tsc --noEmit --incremental false -p apps/web/tsconfig.json`).
- TypeScript seluruh backend: lolos (`tsc --noEmit --incremental false -p apps/api/tsconfig.json`).
- 85 pemeriksaan fungsi/keamanan E-Sertifikat: lolos pada skema PostgreSQL sementara; data aplikasi yang ada tidak diubah.
- Browser: pembuatan kegiatan, FAB desktop dan registrasi aksi bottomnav mobile, impor dan pemetaan Excel, edit identitas, editor PDF, penandatangan, koordinat, zoom, drag, penerbitan, unduhan, dokumen, pencarian/reset filter, verifikasi aktif/dicabut/tidak ditemukan: lolos.
- Tampilan lebar 320, 390, 768, 1280 piksel serta pemeriksaan terang/gelap: lolos, tanpa overflow halaman.
- QR pada PDF contoh berhasil didekode ke alamat verifikasi.
- Menu E-Sertifikat tampil sesuai akses; Pengumuman tetap terintegrasi dan tidak diatur sebagai menu tersendiri.
- Semua tabel ecert_* dikecualikan dari pencarian/penggantian data massal.
- Pemindaian pola kredensial pada seluruh perubahan: tidak ditemukan.
- git diff --check: lolos.

Perbaikan dari peninjauan: dimensi PNG diperiksa sebelum dekompresi; impor Excel melebihi 500 peserta ditolak, termasuk ketika batas pembacaan melewati baris kosong, sehingga peserta tidak terpotong diam-diam.

Migrasi E-Sertifikat disertakan dalam workflow sebelum restart aplikasi. Berkas lingkungan, sesi WhatsApp, dan dump CSV database lokal tetap diabaikan Git.
