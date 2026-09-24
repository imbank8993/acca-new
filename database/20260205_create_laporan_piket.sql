-- Migration: Create laporan_piket table
-- Date: 2026-02-05

CREATE TABLE IF NOT EXISTS public.laporan_piket (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nip TEXT NOT NULL,
    nama_guru TEXT NOT NULL,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    shift TEXT CHECK (shift IN ('Pagi', 'Siang')),
    catatan_kejadian TEXT,
    jumlah_guru_terlambat INTEGER DEFAULT 0,
    jumlah_siswa_terlambat INTEGER DEFAULT 0,
    sarana_prasarana_notes TEXT,
    is_final BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_laporan_piket_nip ON public.laporan_piket(nip);
CREATE INDEX IF NOT EXISTS idx_laporan_piket_tanggal ON public.laporan_piket(tanggal);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_laporan_piket') THEN
        CREATE TRIGGER set_updated_at_laporan_piket
        BEFORE UPDATE ON public.laporan_piket
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
