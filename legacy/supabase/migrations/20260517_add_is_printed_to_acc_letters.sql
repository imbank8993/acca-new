-- Add is_printed flag to acca_letters for one-time print enforcement on REKOMENDASI_KONTROL
ALTER TABLE acca_letters ADD COLUMN IF NOT EXISTS is_printed BOOLEAN NOT NULL DEFAULT false;

-- Also add a link to the source ketidakhadiran row for REKOMENDASI_KONTROL
ALTER TABLE acca_letters ADD COLUMN IF NOT EXISTS ketidakhadiran_id UUID REFERENCES ketidakhadiran(id) ON DELETE SET NULL;

-- Index for quick lookup of printed letters per ketidakhadiran row
CREATE INDEX IF NOT EXISTS idx_acc_letters_ketidakhadiran_id ON acca_letters(ketidakhadiran_id) WHERE ketidakhadiran_id IS NOT NULL;

-- Index for filtering by is_printed
CREATE INDEX IF NOT EXISTS idx_acc_letters_is_printed ON acca_letters(is_printed) WHERE is_printed = true;
