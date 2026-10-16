# Perluasan Ganti Data Massal — 16 Oktober 2026

Pencarian dan penggantian tidak lagi bergantung pada daftar tabel/kolom lama. Struktur dibaca langsung dari katalog PostgreSQL pada schema `public`, sehingga kolom data baru ikut dikenali tanpa menambah daftar manual. Pemeriksaan rencana SQL secara baca-saja berhasil untuk 206 tabel dengan 2.007 kolom yang dapat dicakup pada struktur database saat ini.

## Cakupan dan perilaku

- Mendukung nilai teks, angka, boolean, tanggal/waktu, JSON, dan array. Pencarian memakai kecocokan nilai penuh, bukan penggantian potongan teks di dalam kalimat atau objek JSON.
- JSON dan array diisi dengan JSON yang valid. `null` berarti nilai SQL kosong, sedangkan `""` dapat dipakai untuk teks kosong. Konversi ke tipe kolom dan aturan domain/enum dilakukan PostgreSQL.
- Angka BIGINT/DECIMAL dan angka di dalam JSON dipertahankan tanpa pembulatan JavaScript. Lokasi baris memakai primary key asli, termasuk kunci gabungan, tanpa mengubah BIGINT menjadi Number.
- Seluruh tabel data dengan primary key dapat dikenali. ID utama, kolom generated/identity, kredensial, konfigurasi akses, dan riwayat audit tidak dibuka untuk penggantian umum. Tabel tanpa primary key tidak disertakan karena tidak mempunyai identitas baris yang stabil. Schema autentikasi tidak dipindai.
- Perubahan kolom role/administrasi akun hanya tersedia untuk admin. Gerbang hak akses fitur Ganti Data Massal tetap diperiksa sebelum katalog atau data dibaca.
- Pratinjau menampilkan jumlah tabel/kolom yang tercakup. Maksimal 1.000 sel per batch; jika hasil terpotong, halaman menjelaskannya. Setelah memproses batch, pengguna dapat mencari ulang untuk hasil berikutnya.
- Pilihan lama dibuang ketika input berubah, permintaan lama dibatalkan/diabaikan, dan baris berhasil dihapus dari pratinjau menggunakan ID sel yang konsisten.

## Konsistensi

Seluruh sel terpilih divalidasi, dikunci, dan diperiksa terhadap nilai lama sebelum ditulis. Jika data berubah sejak pratinjau atau satu pembaruan gagal, seluruh transaksi dibatalkan. Tidak lagi melaporkan keberhasilan parsial untuk pilihan yang gagal. Pencarian berjalan dalam transaksi baca-saja dengan batas waktu; respons HTTP menggunakan no-store.

Penggantian NIP/NISN pada master mencari kolom referensi tekstual dengan nama konvensional pada katalog saat ini, termasuk identitas akun `users.nip` dan username yang masih sama dengan identitas lama. Username khusus yang berbeda tetap dipertahankan. Aturan foreign key PostgreSQL tetap berlaku; jika relasi menolak perubahan, transaksi dibatalkan dan kegagalan dijelaskan. Tidak ada constraint database yang dilonggarkan oleh fitur ini. Referensi di dalam teks bebas/JSON atau dengan nama kolom nonkonvensional tidak ditulis ulang otomatis.

Eksekusi dicatat pada audit_logs dalam transaksi yang sama, termasuk pelaku, sel yang diproses, dan jumlah baris terkait. Nilai pengganti tidak disalin ke log audit.

## Verifikasi

- 14 pengujian backend lulus: penemuan schema, batas izin, identifier/value injection, primary key besar/gabungan, pratinjau kedaluwarsa, pembatalan transaksi, tipe data, duplikasi, identitas dan referensi, audit, serta presisi JSON.
- Pengujian komponen halaman di Chrome dengan data tiruan lulus: kolom/tabel dinamis, cakupan, pilih semua, pengiriman nilai lama bertipe, pembersihan hasil berhasil, pengabaian hasil lama, dan lebar 390/1280 piksel.
- Pemeriksaan tipe terfokus pada tab beserta route/dependensinya dan lint perubahan lulus.
- `verify-bulk-schema.cjs` memakai transaksi READ ONLY dan EXPLAIN tanpa ANALYZE untuk memeriksa rencana pencarian pada seluruh 206 tabel; tidak membaca record dan tidak menulis ke produksi. Operasi UPDATE nyata pada PostgreSQL produksi tidak dijalankan sebagai pengujian.

Perubahan masih lokal, belum dideploy. Tidak ada data Ahmad, Ghassani, atau pengguna lain yang diganti dalam pekerjaan ini. Tidak memerlukan migrasi database.
