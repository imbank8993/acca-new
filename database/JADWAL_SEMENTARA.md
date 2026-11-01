# Aktivasi Jadwal Sementara

1. Jalankan `20261101_create_jadwal_sementara.sql` pada database aplikasi sebelum merilis backend baru.
2. Regenerasi Prisma Client dari `apps/api/prisma/schema.prisma`, lalu bangun dan rilis backend serta frontend.
3. Admin membuka **Pengaturan Users → Hak Akses Fitur → Jadwal → Kelola Jadwal Sementara** untuk menunjuk role atau akun. Admin selalu memiliki akses.
4. Buka **Jadwal → Jadwal Sementara**, pilih PBM/piket, tanggal, kedua guru, slot berpasangan, dan alasan. Bawaan masa berlaku tujuh hari (tanggal mulai sampai tanggal mulai + enam hari, inklusif); batas 31 hari.

Jadwal normal tidak diubah. Pembacaan jadwal berjalan dan scope guru menerapkan tambalan hanya selama tanggal mulai–selesai. Setelahnya pembacaan otomatis menggunakan jadwal normal tanpa pekerjaan terjadwal. Tampilan penyuntingan versi tertentu tetap memakai jadwal dasar.

Penukaran mengikuti perilaku tukar jadwal yang sudah ada: guru dan mata pelajaran berpindah ke slot pasangan; kelas, hari, dan jam slot tetap. Pada piket, NIP dan kode guru ditukar; ruang serta kelas tetap. Urutan pemilihan menentukan pasangan slot. Seluruh baris satu tugas piket harus dipilih dan jumlah baris kedua kelompok harus sama.

Pembuatan memeriksa jadwal setiap hari dalam periode, bentrok, dan pertukaran sementara lain yang melibatkan guru yang sama. Pembuatan/pembatalan diserialkan dengan advisory lock PostgreSQL. Perubahan versi jadwal yang sudah dijadwalkan dalam periode akan menolak pembuatan. Jika jadwal dasar kemudian diubah atau diganti, tambalan yang tidak lagi cocok diabaikan utuh agar tidak menimpa versi baru.

Riwayat menyimpan periode, alasan, pembuat, slot asal, dan pengganti. Pengelola dapat membatalkan tambalan lebih awal. Pembatalan menonaktifkan tambalan untuk semua pembacaan, termasuk tanggal lampau.

Sebelum migrasi tabel dijalankan, jadwal normal tetap dapat dibaca; fitur pengelolaan sementara memerlukan tabel baru. Migrasi ini tidak dijalankan otomatis oleh aplikasi.
