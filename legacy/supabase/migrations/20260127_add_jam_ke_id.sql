-- Add jam_ke_id column to support filtering by period number
ALTER TABLE jurnal_guru 
ADD COLUMN IF NOT EXISTS jam_ke_id INTEGER;

-- Optional: Comment/Documentation
COMMENT ON COLUMN jurnal_guru.jam_ke_id IS 'Angka jam ke-n (contoh: 1, 2, 6) untuk filtering, terpisah dari display waktu.';
