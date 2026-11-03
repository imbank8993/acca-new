-- Catatan & bukti pembayaran manual per sesi Klinik (JSON: text, url, nominal, paid_at),
-- setara catatan_pembayaran pada Guru Asuh dan Ekstrakurikuler.
ALTER TABLE public.klinik_slots ADD COLUMN IF NOT EXISTS catatan_pembayaran text;
