-- Master Ruangan & Kolom Ruangan pada Klinik Slots
--
-- 1. Membuat tabel public.master_ruangan sebagai referensi ruangan madrasah
--    (nama ruangan unik, kode, lokasi/gedung, kapasitas, keterangan, status aktif).
-- 2. Menambahkan kolom ruangan (nullable) pada tabel public.klinik_slots agar
--    setiap sesi klinik dapat mencatat lokasi/ruangan pelaksanaannya.

CREATE TABLE IF NOT EXISTS public.master_ruangan (
  id          bigserial PRIMARY KEY,
  kode        varchar(50),
  nama        varchar(150) NOT NULL UNIQUE,
  lokasi      varchar(150),
  kapasitas   integer,
  keterangan  text,
  aktif       boolean DEFAULT true,
  created_at  timestamptz(6) DEFAULT now(),
  updated_at  timestamptz(6) DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_master_ruangan_aktif ON public.master_ruangan (aktif);

ALTER TABLE public.klinik_slots
  ADD COLUMN IF NOT EXISTS ruangan varchar(150);
