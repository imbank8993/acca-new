# Perbaikan penandatangan surat rekomendasi UKS

Akar masalah: PrintModal rekomendasi tidak mengisi pilihan penandatangan, sementara endpoint cetak memakai nama bawaan Imran, S.Si. Endpoint backend lama memiliki fallback yang sama.

Perbaikan kode:

- Penandatangan rekomendasi diambil dari petugas rekam medis yang tertaut, kemudian petugas ketidakhadiran bila tidak ada rekam medis terkait.
- Nama dari klien dan nama akun yang sekadar mencetak tidak menggantikan petugas pemeriksa.
- Jabatan menjadi Petugas UKS. Jika petugas tidak tersedia, pembuatan rekomendasi ditolak dengan pesan jelas.
- Surat kolektif dengan petugas berbeda ditolak agar tidak salah atribusi.
- Pratinjau tidak lagi mengganti nama kosong dengan nama pribadi bawaan.

Koreksi database telah dijalankan secara transaksional:

- 37 metadata surat dikoreksi: 17 untuk Asmiruwanti, S.Kep., Ns.; 20 untuk Muh. Firman Alif F, S.Kep., Ns.
- 14 arsip HTML diperbaiki hanya pada blok tanda tangan.
- 2 tautan PDF lama yang salah dilepas dari metadata agar aplikasi menampilkan hasil render yang benar. Berkas eksternal tidak dihapus atau ditulis ulang.
- Nomor surat, barcode/QR, penerima, periode, isi, tanggal pembuatan, serta pembuat surat dipertahankan dan dibandingkan di dalam transaksi.
- Cadangan privat dibuat di scratch/uks-letter-backups/ yang diabaikan Git. Tidak ada data siswa/isi medis dimasukkan ke laporan atau commit.
- Simulasi ulang setelah koreksi menemukan 0 kandidat tersisa.

Skrip `node scripts/fix-uks-recommendation-signers.cjs` menjalankan simulasi. Tambahkan `--apply` hanya untuk menerapkan koreksi pada koneksi DATABASE_URL yang dikonfigurasi. Skrip aman dijalankan ulang dan berhenti jika sumber petugas atau struktur arsip tidak dapat dipastikan.

Validasi akhir: 42 pengujian ketidakhadiran/UKS lolos; TypeScript seluruh backend dan frontend lolos, pemeriksaan ulang modul surat setelah penyesuaian paket bersama lolos; helper runtime dapat dimuat melalui CommonJS sebagaimana dipakai container API; git diff --check lolos.
