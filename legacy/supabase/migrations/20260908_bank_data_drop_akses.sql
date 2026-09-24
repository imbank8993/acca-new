-- ============================================================================
-- BANK DATA — hapus penunjukan petugas per subjek
--
-- `bank_data_akses` menjawab "dataset yang mana untuk orang ini". Pertanyaan itu
-- sudah tidak ada lagi: siapa yang boleh mengunduh = siapa yang rolenya diberi
-- akses halaman `bank-data` di Akses per Role (role_pages). Kapabilitas
-- `bank_data.export` juga dihapus dari lib/capabilities.ts karena alasan yang
-- sama — keduanya lapisan "siapa orangnya" yang kedua di atas keputusan yang
-- sudah diambil di Akses per Role.
--
-- Yang TETAP berupa izin per orang:
--   bank_data.export_sensitif — NIK, alamat, kontak orang tua, rekening
--   bank_data.kelola          — menyalakan subjek, memilih kolom, baca riwayat
--
-- Tabelnya kosong (0 baris per 2026-09-08), jadi tidak ada data yang hilang.
-- `bank_data_dataset_config` dan `bank_data_log` TIDAK disentuh.
--
-- Jalankan MANUAL lewat Supabase Dashboard → SQL Editor (RPC exec_sql tidak
-- tersedia di project ini).
-- ============================================================================

drop table if exists bank_data_akses;

-- Baris konfigurasi bersandar pada id subjek di kode. Id lama ('siswa.master',
-- 'guru.master', 'akademik.jadwal', dst.) sudah tidak ada di katalog dan tidak
-- akan pernah terbaca lagi — dibuang supaya tabelnya tidak menyimpan keputusan
-- atas sesuatu yang tak bisa lagi ditunjuk.
delete from bank_data_dataset_config
 where dataset_id not in ('siswa', 'guru', 'tendik');
