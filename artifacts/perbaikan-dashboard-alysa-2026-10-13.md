# Pemeriksaan dashboard Alysa — 13 Oktober 2026

Penyebab: username login siswa bersifat khusus, sedangkan NISN disimpan pada kolom nip akun. Dashboard sebelumnya menganggap username sebagai NISN. Pembatasan data pada log ketidakhadiran juga mendahulukan username. Akibatnya data kelas/guru asuh/saudara asuh dan riwayat ketidakhadiran tidak ditemukan meskipun tersedia di basis data.

Perbaikan:
- Resolver identitas memeriksa NISN dari kolom nip dan username akun terverifikasi terhadap master siswa.
- Dashboard dan pembatasan log ketidakhadiran memakai resolver yang sama.
- NISN yang dikirim lewat parameter permintaan tidak bisa menggantikan identitas siswa; uji memastikan akses ke siswa lain tetap ditolak.
- DashboardContent mendahulukan identitas siswa yang tersedia pada akun dibanding username login.

Verifikasi terhadap basis data dalam transaksi READ ONLY menggunakan fungsi service yang diperbaiki:
- Kelas: X D.
- Guru asuh: Imran, S.Si.
- Saudara asuh: 6 siswa.
- Riwayat ketidakhadiran aktif yang terlihat: 6 catatan.
- Ketidakhadiran pada 13 Oktober 2026: 0. Mode Hari Ini memang kosong; gunakan Riwayat untuk catatan sebelumnya.

Pengujian: 7 uji dashboard dan 34 uji ketidakhadiran lulus. Pemeriksaan TypeScript backend dan whitespace perubahan lulus. Tidak ada perubahan akun, NISN, relasi guru asuh, atau catatan ketidakhadiran pada basis data. Perbaikan kode berada di workspace lokal; belum dilakukan deploy server.
