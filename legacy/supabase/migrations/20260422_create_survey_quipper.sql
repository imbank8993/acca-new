-- Migration: Create survey_quipper_responses table
-- Survey evaluasi penggunaan platform Quipper (Guru & Siswa)

CREATE TABLE IF NOT EXISTS survey_quipper_responses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    respondent_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    respondent_role VARCHAR(20) NOT NULL CHECK (respondent_role IN ('GURU', 'SISWA')),
    respondent_nama VARCHAR(100),
    respondent_nip  VARCHAR(30),
    tahun_ajaran    VARCHAR(20) DEFAULT '2025/2026',
    semester        INTEGER DEFAULT 2,
    answers         JSONB NOT NULL DEFAULT '{}',
    is_submitted    BOOLEAN DEFAULT false,
    submitted_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one submission per user per tahun ajaran/semester
CREATE UNIQUE INDEX IF NOT EXISTS survey_quipper_unique_respondent
    ON survey_quipper_responses(respondent_id, tahun_ajaran, semester)
    WHERE respondent_id IS NOT NULL;

-- Index for filtering by role
CREATE INDEX IF NOT EXISTS survey_quipper_role_idx
    ON survey_quipper_responses(respondent_role);

-- Index for stats queries
CREATE INDEX IF NOT EXISTS survey_quipper_submitted_idx
    ON survey_quipper_responses(is_submitted) WHERE is_submitted = true;

-- Enable RLS
ALTER TABLE survey_quipper_responses ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can INSERT their own response
CREATE POLICY "survey_quipper_insert_own"
    ON survey_quipper_responses
    FOR INSERT
    TO authenticated
    WITH CHECK (respondent_id = auth.uid());

-- Policy: authenticated users can SELECT to check their own submission status
CREATE POLICY "survey_quipper_select_own"
    ON survey_quipper_responses
    FOR SELECT
    TO authenticated
    USING (respondent_id = auth.uid());

-- Policy: ADMIN role can view all responses
CREATE POLICY "survey_quipper_admin_select_all"
    ON survey_quipper_responses
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE auth_id::text = auth.uid()::text
            AND role LIKE '%ADMIN%'
        )
    );

-- Policy: ADMIN can update responses (for corrections)
CREATE POLICY "survey_quipper_admin_update"
    ON survey_quipper_responses
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE auth_id::text = auth.uid()::text
            AND role LIKE '%ADMIN%'
        )
    );

COMMENT ON TABLE survey_quipper_responses IS 'Respons survey evaluasi Quipper untuk Guru dan Siswa';
COMMENT ON COLUMN survey_quipper_responses.answers IS 'JSON object: {"q1": "Ya", "q2": "Tidak", ...}';