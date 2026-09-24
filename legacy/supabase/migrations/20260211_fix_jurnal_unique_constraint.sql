-- 1. Deteksi dan hapus constraint lama yang salah (berbasis NIP)
ALTER TABLE jurnal_guru DROP CONSTRAINT IF EXISTS unique_guru_jam_tanggal;
ALTER TABLE jurnal_guru DROP CONSTRAINT IF EXISTS jurnal_guru_nip_tanggal_jam_ke_id_key;

-- 2. Tambahkan constraint baru yang BENAR (berbasis SLOT: Kelas, Tanggal, Jam)
-- Ini memastikan hanya ada SATU catatan jurnal untuk satu kelas di jam tertentu,
-- tidak peduli siapa gurunya atau siapa yang menginput.
ALTER TABLE jurnal_guru 
ADD CONSTRAINT unique_jurnal_slot 
UNIQUE (kelas, tanggal, jam_ke_id);

-- 3. Tambahkan dokumentasi
COMMENT ON CONSTRAINT unique_jurnal_slot ON jurnal_guru 
IS 'Mencegah duplikasi jurnal pada slot waktu dan kelas yang sama.';
