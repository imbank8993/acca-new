-- Hapus CHECK constraint master_guru_nip_check agar NIP bisa diedit bebas
ALTER TABLE master_guru DROP CONSTRAINT IF EXISTS master_guru_nip_check;
