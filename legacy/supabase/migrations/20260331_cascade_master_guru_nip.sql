-- Ubah FK master_mapel_kelas.guru_nip -> master_guru.nip menjadi ON UPDATE CASCADE
-- Agar perubahan NIP di master_guru otomatis propagate ke semua tabel terkait
BEGIN;

-- 1. Drop FK lama
ALTER TABLE master_mapel_kelas
  DROP CONSTRAINT IF EXISTS master_mapel_kelas_guru_nip_fkey;

-- 2. Buat FK baru dengan ON UPDATE CASCADE
ALTER TABLE master_mapel_kelas
  ADD CONSTRAINT master_mapel_kelas_guru_nip_fkey
  FOREIGN KEY (guru_nip)
  REFERENCES master_guru(nip)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

COMMIT;
