-- Broadcast WA per kelas: pelacakan status kirim per peserta.
-- Dijalankan manual via Supabase Dashboard SQL Editor (proyek ini tidak pakai RPC exec_sql).

ALTER TABLE public.registrasi_sanggar
    ADD COLUMN IF NOT EXISTS wa_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS wa_last_status text;

COMMENT ON COLUMN public.registrasi_sanggar.wa_sent_at IS 'Waktu terakhir pesan WA kelas berhasil dikirim ke peserta ini (null = belum pernah).';
COMMENT ON COLUMN public.registrasi_sanggar.wa_last_status IS 'Status pengiriman WA terakhir: sent | failed | no_number.';
