-- Migration: Create survey_pengembangan_diri_responses table
-- Deskripsi: Tabel untuk menyimpan respons survey pengembangan diri siswa

CREATE TABLE IF NOT EXISTS survey_pengembangan_diri_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    siswa_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    kelas VARCHAR(10),
    minat_kegiatan VARCHAR(50),
    bidang_minat TEXT,
    bidang_minat_lainnya TEXT,
    keterampilan TEXT,
    bentuk_kegiatan TEXT,
    waktu_pelaksanaan TEXT,
    durasi_ideal VARCHAR(50),
    pembimbing TEXT,
    kendala TEXT,
    kesediaan VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE survey_pengembangan_diri_responses ENABLE ROW LEVEL SECURITY;

-- Policy: allow siswa to insert their own response
CREATE POLICY "siswa_insert_own_response"
    ON survey_pengembangan_diri_responses
    FOR INSERT
    TO authenticated
    WITH CHECK (siswa_id = auth.uid());

-- Policy: siswa can view all responses (for viewing/admin)
CREATE POLICY "siswa_can_view_all_responses"
    ON survey_pengembangan_diri_responses
    FOR SELECT
    TO authenticated
    USING (true);

COMMENT ON TABLE survey_pengembangan_diri_responses IS 'Respons survey pengembangan diri siswa';
COMMENT ON COLUMN survey_pengembangan_diri_responses.minat_kegiatan IS 'Tingkat ketertarikan mengikuti kegiatan pengembangan diri';
COMMENT ON COLUMN survey_pengembangan_diri_responses.bidang_minat IS 'Pilihan bidang kegiatan yang diminati (multi-select disimpan sebagai JSON atau teks)';
COMMENT ON COLUMN survey_pengembangan_diri_responses.keterampilan IS 'Keterampilan yang ingin dikembangkan';
COMMENT ON COLUMN survey_pengembangan_diri_responses.bentuk_kegiatan IS 'Bentuk kegiatan yang disukai';
COMMENT ON COLUMN survey_pengembangan_diri_responses.waktu_pelaksanaan IS 'Waktu pelaksanaan yang cocok';
COMMENT ON COLUMN survey_pengembangan_diri_responses.durasi_ideal IS 'Durasi kegiatan ideal';
COMMENT ON COLUMN survey_pengembangan_diri_responses.pembimbing IS 'Pembimbing yang dianggap tepat';
COMMENT ON COLUMN survey_pengembangan_diri_responses.kendala IS 'Kendala kurang mengikuti kegiatan';
COMMENT ON COLUMN survey_pengembangan_diri_responses.kesediaan IS 'Kesediaan mengikuti kegiatan secara rutin';
