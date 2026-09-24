-- Migration: Pindahkan approver_role ke tugas_tambahan & hapus master_tugas_tambahan
-- Jalankan manual via Supabase Dashboard SQL Editor.
--
-- Konteks:
-- 1. Master Tugas Tambahan dihapus; approver LCKH kini diatur per-penugasan (ploting).
-- 2. Wali Kelas paten disetujui WKM_AKADEMIK; Pembina Ekstrakurikuler paten WKM_KESISWAAN.
-- 3. Sync wali_kelas -> tugas_tambahan sebelumnya gagal karena semester 'Ganjil'/'Genap'
--    tidak bisa masuk kolom INTEGER; data yang hilang di-backfill di langkah 4.

-- 1. Tambah kolom approver_role di tugas_tambahan
ALTER TABLE tugas_tambahan
  ADD COLUMN IF NOT EXISTS approver_role VARCHAR(50) DEFAULT 'SEMUA_WKM';

COMMENT ON COLUMN tugas_tambahan.approver_role IS
  'Role WKM yang berhak approve LCKH pemegang tugas ini: WKM_AKADEMIK, WKM_KESISWAAN, atau SEMUA_WKM';

-- 2. Backfill dari master lama (dicocokkan berdasarkan nama tugas)
UPDATE tugas_tambahan t
SET approver_role = m.approver_role
FROM master_tugas_tambahan m
WHERE m.nama_tugas = t.jabatan
  AND m.approver_role IS NOT NULL;

-- 3. Aturan paten (override apapun hasil backfill)
UPDATE tugas_tambahan SET approver_role = 'WKM_AKADEMIK'
WHERE jabatan ILIKE 'Wali Kelas%';

UPDATE tugas_tambahan SET approver_role = 'WKM_KESISWAAN'
WHERE jabatan ILIKE 'Pembina Ekstrakurikuler%';

UPDATE tugas_tambahan SET approver_role = 'SEMUA_WKM'
WHERE approver_role IS NULL;

-- 4. Backfill penugasan Wali Kelas yang gagal tersinkron sebelumnya.
-- Pakai NOT EXISTS (bukan ON CONFLICT) karena tugas_tambahan belum tentu punya
-- unique constraint (nip, jabatan, tahun_ajaran, semester) di DB.
INSERT INTO tugas_tambahan (nip, nama_guru, jabatan, keterangan, tahun_ajaran, semester, approver_role)
SELECT
    w.nip,
    w.nama_guru,
    'Wali Kelas ' || w.nama_kelas,
    'Wali Kelas otomatis dari modul Pengaturan Kelas',
    w.tahun_ajaran,
    CASE WHEN w.semester = 'Genap' THEN 2 ELSE 1 END,
    'WKM_AKADEMIK'
FROM wali_kelas w
WHERE w.aktif = true
  AND NOT EXISTS (
      SELECT 1 FROM tugas_tambahan t
      WHERE t.nip = w.nip
        AND t.jabatan = 'Wali Kelas ' || w.nama_kelas
        AND t.tahun_ajaran = w.tahun_ajaran
        AND t.semester = CASE WHEN w.semester = 'Genap' THEN 2 ELSE 1 END
  );

-- 5. Hapus master (setelah backfill di atas selesai)
DROP TABLE IF EXISTS master_tugas_tambahan;
