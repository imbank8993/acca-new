-- Hapus semua CHECK constraint numeric-only yang blokir update NIP / kode_guru

-- 1. master_kode_guru: kode_guru (TEXT, bisa alphanumeric)
ALTER TABLE master_kode_guru DROP CONSTRAINT IF EXISTS master_kode_guru_kode_guru_check;

-- 2. master_kode_guru: nip column (CHECK numeric-only -> hapus)
ALTER TABLE master_kode_guru DROP CONSTRAINT IF EXISTS master_kode_guru_nip_check;

-- 3. master_guru: nip column (sudah dihapus sebelumnya, tapi aman ulang)
ALTER TABLE master_guru DROP CONSTRAINT IF EXISTS master_guru_nip_check;
