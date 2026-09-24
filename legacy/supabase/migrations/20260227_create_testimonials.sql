-- Migration: Create testimonials table
-- Untuk menyimpan testimoni pengguna portal akademik

CREATE TABLE IF NOT EXISTS testimonials (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT DEFAULT 'Anonim',
    quote       TEXT NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for sorting
CREATE INDEX IF NOT EXISTS idx_testimonials_created_at ON testimonials(created_at DESC);

-- RLS: allow public read for active testimonials
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_public_read_testimonials" ON testimonials
    FOR SELECT USING (is_active = true);

-- Allow all for service role (admin API)
CREATE POLICY "allow_service_role_all_testimonials" ON testimonials
    USING (true) WITH CHECK (true);
