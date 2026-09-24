-- Alter table to add durasi column
ALTER TABLE form_pendaftaran_kokurikuler ADD COLUMN IF NOT EXISTS durasi INTEGER DEFAULT 0;

-- Recreate index to include durasi in sorting/ranking
DROP INDEX IF EXISTS idx_form_kokurikuler_pilihan_pertama;
DROP INDEX IF EXISTS idx_form_kokurikuler_pilihan_kedua;

CREATE INDEX IF NOT EXISTS idx_form_kokurikuler_pilihan_pertama ON form_pendaftaran_kokurikuler(pilihan_pertama, status_pertama, skor_utama DESC, durasi ASC, submitted_at ASC);
CREATE INDEX IF NOT EXISTS idx_form_kokurikuler_pilihan_kedua ON form_pendaftaran_kokurikuler(pilihan_kedua, status_kedua, skor_utama DESC, durasi ASC, submitted_at ASC);
