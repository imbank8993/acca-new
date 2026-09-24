-- =====================================================
-- ACCA App: Dukungan Kurikulum Peminatan / UTBK (Moving Class)
-- Konteks: kolom header Excel jadwal sekarang mewakili RUANG (bisa dipakai
-- kelas reguler pada satu jam dan kelompok peminatan pada jam lain),
-- bukan lagi identik dengan kelas. Kelompok peminatan/UTBK (mis. "Fisika 1",
-- "Fisika 2") didaftarkan sebagai rombel tersendiri di master_kelas dan
-- dipetakan dari indeks angka pada kode mapel (FIS1, FIS2, ...).
-- =====================================================

-- 1. master_kelas.kode — kode singkat kelompok peminatan/UTBK (mis. FIS1, FIS2, UTBK1).
--    NULL untuk kelas reguler/homeroom (kelas ini dipetakan dari nama ruang, bukan kode).
ALTER TABLE master_kelas ADD COLUMN IF NOT EXISTS kode TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_master_kelas_kode
    ON master_kelas(kode)
    WHERE kode IS NOT NULL;

COMMENT ON COLUMN master_kelas.kode IS
    'Kode kelompok peminatan/UTBK (mis. FIS1, FIS2) dipetakan dari indeks angka pada kode mapel saat generate jadwal dari Excel. NULL untuk kelas reguler (dipetakan dari nama ruang).';

-- 2. jadwal_guru.ruang — nama ruang fisik (header kolom Excel saat generate).
--    Berbeda dari kelas saat sesi peminatan (moving class). TIDAK disimpan di jurnal_guru
--    (jurnal hanya mencatat nama kelas, sesuai keputusan produk).
ALTER TABLE jadwal_guru ADD COLUMN IF NOT EXISTS ruang TEXT;

COMMENT ON COLUMN jadwal_guru.ruang IS
    'Nama ruang fisik tempat sesi berlangsung (dari header kolom Excel atau input manual). Boleh berbeda dari kolom kelas saat sesi peminatan/moving-class. Tidak muncul di jurnal_guru.';

-- =====================================================
-- CATATAN (revisi 2026-07-07): Fase 1 semula direncanakan memakai tabel baru
-- `siswa_kelompok` untuk memetakan siswa ke kelompok peminatan. Setelah ditinjau,
-- `siswa_kelas` yang sudah ada TERNYATA sudah dirancang untuk kasus ini — UI-nya
-- (SiswaKelasTab) sudah mengizinkan satu siswa punya lebih dari satu enrollment
-- sekaligus. Jadi TIDAK ADA tabel baru: peminatan cukup didaftarkan sebagai baris
-- tambahan di siswa_kelas (kelas = nama kelompok, mis. "XI Fisika 1"), dan siswa bisa
-- punya banyak baris sekaligus (1 homeroom + N kelompok peminatan). Perbaikan yang
-- diperlukan ada di kode aplikasi (dedup key siswa_kelas + cap enrollment di UI),
-- bukan di skema DB — lihat commit terpisah untuk itu.
--
-- Langkah manual lanjutan (di luar migrasi ini):
-- 1. Di tab Master > Kelas, daftarkan tiap kelompok peminatan/UTBK dengan
--    Program="Peminatan" (atau "UTBK") dan Kode diisi (mis. "FIS1").
-- 2. Di tab Master > Waktu, pastikan ada jam bel untuk program Peminatan/UTBK
--    (salin dari program Reguler jika jam bel sama).
-- 3. Di tab Siswa-Kelas, assign siswa ke kelompok peminatan sebagai baris TAMBAHAN
--    (bukan pengganti) homeroom mereka.
-- =====================================================
