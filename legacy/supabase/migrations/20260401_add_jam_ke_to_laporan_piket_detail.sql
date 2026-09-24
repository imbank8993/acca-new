
-- Add jam_ke column to laporan_piket_detail to support multi-select jams
ALTER TABLE laporan_piket_detail ADD COLUMN IF NOT EXISTS jam_ke TEXT;

-- Update existing detail records to use the header's jam_ke if available
UPDATE laporan_piket_detail d
SET jam_ke = h.jam_ke
FROM laporan_piket h
WHERE d.piket_id = h.id AND d.jam_ke IS NULL;

COMMENT ON COLUMN laporan_piket_detail.jam_ke IS 'Jam ke untuk laporan piket (dapat kosong jika tidak spesifik)';
