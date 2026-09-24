# Pemisahan kode CBT dan penelusuran hubungan PTSP

## Perubahan

- Mengeluarkan lima server action CBT (proktor, question, siswa, grading, security), helper supabase-cbt, komponen CBTPlaceholders, serta lima halaman placeholder CBT dari frontend ACCA.
- Seluruh 12 berkas asli diarsipkan ke `cbt-legacy-before-separation.zip` sebelum dihapus. Jumlah entri dan isi setiap berkas telah dibandingkan dengan sumber sebelum penghapusan. Arsip mempertahankan jalur relatif dari root repositori.
- Menghapus referensi placeholder dari registry halaman dan generator route agar tidak dibuat kembali.
- Mengarahkan lima URL lama (/cbt-dashboard, /cbt-bank-soal, /cbt-ujian, /cbt-nilai, /cbt-pantau) melalui redirect sementara ke /api/sso/cbt. Endpoint tersebut tetap memeriksa sesi dan hak akses sebelum mengarahkan ke aplikasi CBT eksternal. Pengguna akan masuk melalui aplikasi CBT, bukan layar placeholder ACCA.
- Menghapus pengecualian akses otomatis untuk semua nama halaman berawalan cbt- pada route dinamis.

## Bagian yang tetap berhubungan dengan ACCA

- Tombol CBT, izin cbt-app, serta endpoint /api/sso/cbt dipertahankan sebagai penghubung aplikasi eksternal. Tidak ditemukan referensi ke lima server action CBT lama di luar kelompok berkas yang dikeluarkan.
- PTSP masih memiliki konsumen langsung: halaman layanan-ptsp terdaftar di menu/registry, PTSPClient memanggil /api/ptsp untuk pengelolaan data, dan route tersebut meneruskan permintaan ke PtspModule NestJS. Karena berhubungan langsung dengan halaman ACCA yang tersedia, bagian ini tidak dianggap kode mati dan tidak dihapus.
- Tidak ada perubahan schema Prisma, tabel database, akun, data CBT/PTSP, atau proyek eksternal. Keberadaan model CBT pada schema belum dipisahkan; penghapusan model dapat memengaruhi migrasi database dan tidak diperlukan untuk membersihkan implementasi frontend yang tidak digunakan.

## Verifikasi

- Pencarian ulang tidak menemukan referensi CBTPlaceholders, supabase-cbt, lima server action lama, atau prisma.cbt_ di sumber web dan backend NestJS setelah pemisahan.
- Syntax generator route lulus pemeriksaan Node.
- Next.js typegen lulus dan mencatat lima alamat CBT sebagai redirect, bukan halaman aplikasi lokal.
- Login SSO ke aplikasi eksternal belum diuji dengan akun nyata; kode endpoint login tidak diubah.
- Typecheck frontend setelah membersihkan tipe route CBT yang tertinggal di cache menghasilkan 8 diagnostik PTSP (7 nama Row tidak didefinisikan dan 1 ekspor PTSP_TABLES pada route). Tidak tersisa diagnostik CBT atau referensi import kode CBT lama. Bukti: `pemisahan-cbt-typecheck-final.txt`.
- Lima redirect diuji dari konfigurasi aktual: seluruhnya menuju /api/sso/cbt dengan permanent=false. Aplikasi perlu dimulai ulang agar perubahan next.config.ts diterapkan pada server yang sudah berjalan.

Arsip merupakan salinan kode lama untuk pemulihan, bukan aplikasi CBT mandiri yang siap dijalankan. PTSP yang masih terintegrasi memerlukan keputusan pemisahan fungsi bila nantinya seluruh pengelolaannya hendak dipindahkan ke aplikasi eksternal.
