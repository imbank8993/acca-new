# Pemeriksaan Hak Akses Fitur — 28 Oktober 2026

## Perbaikan

- Backend menolak format konfigurasi akses rusak atau daftar identitas tidak valid sebelum menulis data, termasuk penyimpanan massal. Role dinormalisasi; ID BIGINT tetap berupa string.
- Penunjukan kapabilitas lama yang hanya menyimpan NIP dicocokkan ke ID akun sebelum diselaraskan. Jika tidak ditemukan, penyimpanan dikunci agar penunjukan tidak hilang.
- Frontend memeriksa status HTTP dan isi respons sebelum menandai perubahan sebagai tersimpan.
- Editor menampilkan satu grup halaman secara awal dan ringkasan setiap fitur. Formulir dibuka lewat Atur akses. Ada indikator belum disimpan, filter Lihat perubahan, serta tombol simpan yang aktif hanya ketika diperlukan. Peringatan keluar halaman tetap ditangani UserSettingsPage.

## Cakupan

Katalog saat diperiksa berisi 48 fitur. Pemeriksaan alur UI dan gerbang backend utama mencakup:

| Halaman | Gerbang pengelolaan |
| --- | --- |
| Klinik Pembelajaran | Kapabilitas `klinik.*`; diperiksa di service dan UI |
| Bank Data | Kapabilitas `bank_data.kelola`, termasuk pencabutan dan kompatibilitas penunjukan lama |
| Pusat Dokumen | `dokumen_access_config`; FeatureAccessGuard pada endpoint pengelolaan |
| Jadwal | `jadwal_generate_access_config`; UI membaca izin server, endpoint generate memakai guard |
| Guru Asuh | `guru_asuh_approval_access_config`; guard persetujuan laporan |
| Jurnal | Izin umum serta input, review banding, dan generate; izin umum dapat memberi akses turunan |
| Informasi | Izin umum dan per kategori; hak umum berlaku ke kategori |
| Agenda Madrasah / Data Libur | `agenda_access_config` / `libur_access_config`; tab UI mengikuti izin server |
| Notulensi Rapat | `notulensi_access_config`; izin fitur tetap dibatasi kepemilikan/PIC dan hak membuka halaman |

## Verifikasi dan batas

Tes regresi meliputi penambahan/cabut izin role dan pengguna, penolakan non-admin, kesalahan baca/simpan, transaksi kapabilitas, penunjukan NIP lama, serta akses langsung backend. Tes Notulensi dan E-Supervisi juga dijalankan. Pemeriksaan tipe frontend dan backend dilakukan terpisah.

Ini pemeriksaan kode dan pengujian lokal; konfigurasi serta akun produksi tidak diubah dan tidak diuji melalui login produksi. Matriks di atas menunjukkan alur utama yang ditelusuri, bukan klaim audit menyeluruh setiap endpoint pada 48 fitur.

Hak membuka halaman (Akses Halaman) berbeda dari izin mengelola fitur. Memberikan izin fitur tidak otomatis menambahkan halaman ke menu. ADMIN dan role bawaan yang disebut pada kartu tetap mempunyai akses; hak bawaan tersebut tidak dapat dicabut dari pilihan role tambahan.
