# Pemeriksaan sebelum push — 16 Oktober 2026

Cakupan seluruh perubahan lokal: filter multiselect dan ekspor Bank Data, pencocokan biodata siswa berdasarkan identitas terlindungi, kondisi tab saat gagal/belum tertaut, perluasan Ganti Data Massal, serta tampilan dan status verifikasi kartu siswa.

Pemeriksaan menambahkan perlindungan permintaan yang sudah kedaluwarsa pada halaman verifikasi kartu: pergantian identifier membatalkan permintaan lama, membersihkan data/error sebelumnya, dan mencegah respons kartu lama mengganti hasil kartu baru. Skrip pengujian Bank Data diperbarui agar menguji SearchableSelect, pilihan jamak, ekspor desktop, dan pendaftaran aksi ekspor di navigasi mobile.

## Hasil

- 14 pengujian Bank Data lulus, termasuk beberapa tahun ajaran/semester/kelas dan isi sheet Excel.
- 14 pengujian Ganti Data Massal lulus, termasuk izin, transaksi, data kedaluwarsa, tipe data, presisi, dan audit.
- 8 pengujian keamanan profil siswa lulus.
- Empat pengujian komponen di Chrome lulus: Bank Data, Biodata Siswa, Ganti Data Massal, dan verifikasi kartu siswa. Semuanya memakai data tiruan.
- Pemeriksaan tipe seluruh frontend dan backend lulus. Lint untuk helper penggantian massal, route terkait, tab penggantian, dan tabel Bank Data lulus.
- Pemeriksaan whitespace Git lulus. Berkas environment dan cadangan database dalam scratch tetap di luar Git.

Tidak ada migrasi atau penggantian data produksi yang dijalankan pada pemeriksaan ini. Push tidak dipakai sebagai bukti bahwa deployment atau integrasi produksi telah berhasil.
