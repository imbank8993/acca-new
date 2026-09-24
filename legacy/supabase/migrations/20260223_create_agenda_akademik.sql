
-- Migration: Create agenda_akademik table
-- Untuk menyimpan agenda/kegiatan akademik sekolah

CREATE TABLE IF NOT EXISTS agenda_akademik (
    id              BIGSERIAL PRIMARY KEY,
    judul           TEXT NOT NULL,
    deskripsi       TEXT,
    tanggal_mulai   DATE NOT NULL,
    tanggal_selesai DATE,
    waktu_mulai     TIME,
    waktu_selesai   TIME,
    lokasi          TEXT,
    kategori        TEXT NOT NULL DEFAULT 'Umum',
    warna           TEXT NOT NULL DEFAULT '#3083FF',
    is_publik       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index untuk query berdasarkan tanggal
CREATE INDEX IF NOT EXISTS idx_agenda_akademik_tanggal ON agenda_akademik(tanggal_mulai);
CREATE INDEX IF NOT EXISTS idx_agenda_akademik_publik ON agenda_akademik(is_publik);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_agenda_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agenda_updated_at
BEFORE UPDATE ON agenda_akademik
FOR EACH ROW EXECUTE FUNCTION update_agenda_updated_at();

-- RLS: allow public read for publik agendas
ALTER TABLE agenda_akademik ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_public_read_agenda" ON agenda_akademik
    FOR SELECT USING (is_publik = true);

CREATE POLICY "allow_service_role_all" ON agenda_akademik
    USING (true) WITH CHECK (true);
