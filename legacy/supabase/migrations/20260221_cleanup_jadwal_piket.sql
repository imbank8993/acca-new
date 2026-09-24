-- ============================================
-- Hapus Data Jadwal Piket Lama
-- ============================================

-- Opsi 1: Hapus semua jadwal piket yang tidak aktif
-- DELETE FROM jadwal_piket WHERE aktif = false;

-- Opsi 2: Hapus jadwal piket berdasarkan tanggal berlaku sebelum tanggal tertentu
-- Ganti '2026-01-01' dengan tanggal yang diinginkan
-- DELETE FROM jadwal_piket WHERE berlaku_mulai < '2026-01-01';

-- Opsi 3: Hapus jadwal piket DUPLIKAT, сохраня only the latest one per (hari + jam_ke + kelas)
-- This keeps the record with the LATEST berlaku_mulai date for each unique (hari + jam_ke + kelas) combination

DELETE FROM jadwal_piket
WHERE id NOT IN (
    SELECT MAX(id)
    FROM jadwal_piket
    WHERE aktif = true
    GROUP BY hari, jam_ke, kelas
);

-- Opsi 4: Hapus semua jadwal piket (hard reset)
-- DELETE FROM jadwal_piket;

-- ============================================
-- Atau jalankan dengan parameter tanggal:
-- ============================================
-- DELETE FROM jadwal_piket
-- WHERE berlaku_mulai < '2026-01-01' AND aktif = false;
