-- Jalankan sebelum merilis fitur Jadwal Sementara.
CREATE TABLE IF NOT EXISTS public.jadwal_sementara (
  id BIGSERIAL PRIMARY KEY,
  jenis TEXT NOT NULL CHECK (jenis IN ('mengajar', 'piket')),
  mulai DATE NOT NULL,
  selesai DATE NOT NULL CHECK (selesai >= mulai),
  perubahan JSONB NOT NULL,
  alasan TEXT NOT NULL,
  dibuat_oleh TEXT NOT NULL,
  dibatalkan BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jadwal_sementara_jenis_mulai_selesai_idx
  ON public.jadwal_sementara (jenis, mulai, selesai);
ALTER TABLE public.jadwal_sementara ENABLE ROW LEVEL SECURITY;
