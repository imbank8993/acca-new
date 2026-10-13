# Audit Agenda Madrasah — 13 Oktober 2026

Tujuh temuan direproduksi menggunakan kode aktual dan data simulasi. Audit mencakup halaman agenda/kelola, API agenda/kategori/foto, serta tab data libur. Tidak ada perubahan kode aplikasi, koneksi ke basis data asli, atau penghapusan data. Temuan berikut membuktikan perilaku kode; audit ini bukan bukti bahwa insiden sudah terjadi pada server produksi.

## Temuan

### 1. [P1] Agenda ganda saat pengguna mengulang simpan setelah unggah foto gagal

Lokasi: [KelolaAgendaTab.tsx](D:/acca-new/apps/web/app/agenda-madrasah/tabs/KelolaAgendaTab.tsx:342).

Agenda baru sudah dibuat melalui POST, kemudian syncFoto dijalankan. Jika unggah gagal, dialog tetap dalam mode tambah dan editingId tetap null. Menekan Simpan lagi membuat POST baru, bukan memperbaiki agenda yang sudah dibuat. Reproduksi dua percobaan simpan menghasilkan dua agenda dan dua pesan unggah gagal.

Saran: setelah agenda berhasil dibuat, simpan ID hasilnya dan ubah status formulir menjadi edit sebelum mengunggah foto. Pisahkan keberhasilan simpan agenda dari keberhasilan unggah, serta pastikan percobaan ulang tidak membuat agenda baru.

### 2. [P1] Unggahan foto bersamaan saling menimpa

Lokasi: [agenda.service.ts](D:/acca-new/apps/api/src/agenda/agenda.service.ts:532).

Setiap unggahan membaca array foto awal, menambahkan foto sendiri, lalu menulis ulang keseluruhan array. Dua permintaan yang membaca keadaan yang sama menulis dua versi berbeda; tulisan terakhir menghilangkan referensi foto permintaan pertama. Reproduksi menghasilkan dua unggahan sukses tetapi hanya satu foto dalam penulisan terakhir. Berkas yang kehilangan referensi juga bisa tertinggal di penyimpanan. Pola serupa ada pada pembaruan urutan dan penghapusan foto.

Saran: serialisasikan perubahan daftar foto per agenda dengan penguncian/transaksi atau kontrol versi, kemudian baca keadaan terbaru sebelum menulis. Tangani pembersihan berkas pada kegagalan unggah/penyimpanan.

### 3. [P2] Pengelola yang ditunjuk melalui Hak Akses Fitur kehilangan tombol kelola

Lokasi: [KelolaAgendaTab.tsx](D:/acca-new/apps/web/app/agenda-madrasah/tabs/KelolaAgendaTab.tsx:128).

Halaman utama memakai izin server untuk membuka tab Kelola Agenda, tetapi tab menghitung izin sendiri hanya dari ADMIN, ADMINISTRATOR, OP_AGENDA. Guru yang ditunjuk secara individual mendapat serverCanManage=true namun clientCanManage=false. Akibatnya tab terbuka tetapi tombol tambah, kategori, edit, dan hapus disembunyikan.

Saran: teruskan izin server ke tab sebagai properti dan gunakan keputusan tersebut secara konsisten.

### 4. [P2] Perubahan keterangan/tanggal foto bisa gagal tetapi dianggap berhasil

Lokasi: [KelolaAgendaTab.tsx](D:/acca-new/apps/web/app/agenda-madrasah/tabs/KelolaAgendaTab.tsx:305).

syncFoto menunggu PUT foto tanpa memeriksa status HTTP atau respons success. Ketika server mengembalikan 500, fungsi tetap selesai normal; jika tidak ada foto baru, handleSave menutup dialog dan menampilkan keberhasilan. Reproduksi respons 500 tidak menghasilkan kesalahan di pemanggil.

Saran: periksa status dan isi respons PUT, tampilkan kegagalan, dan pertahankan perubahan formulir agar dapat dicoba ulang.

### 5. [P2] Agenda panjang hilang dari kalender setelah 100 hari

Lokasi: [AgendaDisplayView.tsx](D:/acca-new/apps/web/app/agenda-madrasah/components/AgendaDisplayView.tsx:205).

Pembangunan daftar agenda per tanggal berhenti pada limit < 100. Agenda 1 Januari–31 Desember 2026 hanya masuk ke 100 tanggal pertama; pada 13 Oktober tidak muncul, meskipun tanggal akhirnya masih Desember. Tidak ada batas panjang tersebut dalam formulir/API.

Saran: hitung perpotongan tanggal agenda dengan bulan yang sedang ditampilkan, bukan membatasi seluruh durasi agenda menjadi 100 hari.

### 6. [P2] Tampilan publik hanya menerima 50 agenda paling lama

Lokasi: [agenda.service.ts](D:/acca-new/apps/api/src/agenda/agenda.service.ts:152) dan [AgendaDisplayView.tsx](D:/acca-new/apps/web/app/agenda-madrasah/components/AgendaDisplayView.tsx:115).

API publik mengurutkan tanggal mulai ascending dengan batas bawaan 50, sedangkan kalender memanggilnya tanpa bulan/paginasi dan tidak mengambil ulang ketika bulan berubah. Jika jumlah agenda publik melampaui 50, agenda yang lebih baru dapat hilang dari kalender. Reproduksi 60 agenda mengembalikan 50 pertama dan tidak menyertakan agenda terakhir. Jalur ini berlaku pada tampilan tanpa login atau ketika kalender beralih ke data publik.

Saran: kirim bulan yang sedang ditampilkan, ambil ulang saat navigasi bulan, dan tangani paginasi/kelengkapan agenda bulan tersebut.

### 7. [P2] Gangguan API terlihat seperti daftar agenda kosong

Lokasi: [AgendaDisplayView.tsx](D:/acca-new/apps/web/app/agenda-madrasah/components/AgendaDisplayView.tsx:114) dan [KelolaAgendaTab.tsx](D:/acca-new/apps/web/app/agenda-madrasah/tabs/KelolaAgendaTab.tsx:194).

Kalender mencoba jalur publik untuk seluruh respons gagal, lalu membaca JSON tanpa memeriksa status jalur publik. Bila kedua permintaan mengembalikan 500 dengan JSON error, state error tetap null dan daftar diubah menjadi kosong. Tab Kelola juga mengubah respons error JSON menjadi daftar kosong. Pengguna bisa menyangka agenda hilang atau belum pernah dibuat.

Saran: bedakan kebutuhan autentikasi dari gangguan server; periksa status HTTP dan success, tampilkan pesan gagal beserta opsi coba lagi, dan pertahankan data terakhir bila tersedia.

## Bukti reproduksi

Jalankan `node artifacts/audit-agenda-reproductions.cjs` dari akar workspace. Skrip menjalankan fungsi yang diekstrak dari kode aktual serta service aktual dengan API/Prisma/storage simulasi; tidak memakai data produksi.

Hasil: tujuh skenario berhasil direproduksi. Detail terstruktur tersedia di [agenda-audit-reproductions.json](D:/acca-new/artifacts/agenda-audit-reproductions.json).

Prioritas perbaikan: cegah agenda ganda dan kehilangan referensi foto, kemudian seragamkan izin, periksa respons simpan foto, dan benahi pengambilan/penampilan data kalender.
