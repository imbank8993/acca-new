-- Hasil seleksi / penempatan kuota untuk formulir pendaftaran.
-- Diisi oleh POST /api/forms/[id]/allocate (tombol "Simpan Hasil Seleksi").
ALTER TABLE custom_form_responses
    ADD COLUMN IF NOT EXISTS placement_option text,
    ADD COLUMN IF NOT EXISTS placement_stage  text,   -- pilihan_1 | pilihan_2 | cadangan | tidak_diterima
    ADD COLUMN IF NOT EXISTS placement_rank   integer,
    ADD COLUMN IF NOT EXISTS placed_at        timestamptz;

CREATE INDEX IF NOT EXISTS idx_cfr_form_placement
    ON custom_form_responses (form_id, placement_option, placement_rank);

-- Satu akun login = satu tanggapan per formulir.
-- Partial index: tanggapan anonim (user_id NULL) tidak ikut terkunci.
-- Kalau perintah ini gagal karena sudah terlanjur ada duplikat, bersihkan dulu:
--   DELETE FROM custom_form_responses a USING custom_form_responses b
--   WHERE a.form_id = b.form_id AND a.user_id = b.user_id
--     AND a.user_id IS NOT NULL AND a.created_at < b.created_at;
CREATE UNIQUE INDEX IF NOT EXISTS uq_cfr_form_user
    ON custom_form_responses (form_id, user_id)
    WHERE user_id IS NOT NULL;
