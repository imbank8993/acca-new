-- Migration: Create public.catatan_pribadi table for Catatan Saya (Personal Notes)
-- Date: 2026-10-27

CREATE TABLE IF NOT EXISTS public.catatan_pribadi (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    jenis VARCHAR(20) NOT NULL DEFAULT 'catatan' CHECK (jenis IN ('catatan', 'draft_agenda')),
    judul VARCHAR(200) NOT NULL DEFAULT '',
    isi JSONB NOT NULL DEFAULT '[]',
    label TEXT[] NOT NULL DEFAULT '{}',
    warna VARCHAR(20) NOT NULL DEFAULT 'default',
    tanggal_agenda DATE,
    waktu_agenda TIME,
    tempat_agenda VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pinned', 'archived', 'trashed')),
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    trashed_at TIMESTAMPTZ
);

-- Indexes for efficient querying and sorting
CREATE INDEX IF NOT EXISTS idx_catatan_pribadi_user_status 
    ON public.catatan_pribadi (user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_catatan_pribadi_agenda 
    ON public.catatan_pribadi (user_id, tanggal_agenda) 
    WHERE jenis = 'draft_agenda' AND tanggal_agenda IS NOT NULL AND status IN ('active', 'pinned');
