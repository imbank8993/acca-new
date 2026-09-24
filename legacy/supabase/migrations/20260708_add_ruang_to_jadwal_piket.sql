-- =====================================================
-- ACCA App: Jadwal Piket ikut mengadopsi pemisahan Ruang vs Kelas
-- Konteks: sama seperti jadwal_guru, header kolom Excel Piket sebenarnya RUANG
-- (bisa dipakai kelas berbeda antar jam), bukan kelas secara langsung. Guru piket
-- ditugaskan mengawasi RUANG (lokasi fisik) — kelas yang sedang berlangsung di
-- ruang itu adalah info kontekstual, diambil otomatis dari jadwal_guru (yang sudah
-- punya kolom ruang+kelas), bukan diketik manual di sel Piket.
-- =====================================================

-- 1. jadwal_piket.ruang — nama ruang fisik yang diawasi guru piket (identitas utama slot).
ALTER TABLE jadwal_piket ADD COLUMN IF NOT EXISTS ruang TEXT;

COMMENT ON COLUMN jadwal_piket.ruang IS
    'Nama ruang fisik yang diawasi guru piket (dari header kolom Excel atau input manual). Identitas utama slot piket.';

CREATE INDEX IF NOT EXISTS idx_jadwal_piket_ruang ON jadwal_piket(ruang, hari, aktif);

-- 2. jadwal_piket.kelas kini opsional — diisi otomatis via lookup ke jadwal_guru
--    (ruang+hari+jam_ke), bisa kosong bila ruang tsb tidak punya jadwal mengajar
--    aktif (mis. ruang non-kelas).
ALTER TABLE jadwal_piket ALTER COLUMN kelas DROP NOT NULL;

-- =====================================================
-- Catatan: identitas unik slot piket sekarang (hari, jam_ke, ruang) — BUKAN
-- (hari, jam_ke, kelas) seperti sebelumnya, karena kelas bisa kosong/berubah
-- sedangkan ruang tetap. Kode aplikasi (route.ts, import/route.ts) sudah
-- disesuaikan untuk dedup/upsert berdasarkan ruang.
-- =====================================================
