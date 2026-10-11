ALTER TABLE public.klinik_slots
  ADD COLUMN IF NOT EXISTS nominal_dibayarkan numeric(12,0),
  ADD COLUMN IF NOT EXISTS dibayarkan_at timestamptz;
-- Pembayaran lama tetap NULL: nominal historis tidak dapat ditebak dari tarif saat ini.
