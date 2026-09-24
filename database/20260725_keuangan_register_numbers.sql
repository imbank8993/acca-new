-- =====================================================================
-- NOMOR REGISTER PENGAJUAN (1 pengajuan bisa punya >1 nomor register)
-- Diinput oleh PJ kegiatan pada tab "Pengajuan Saya".
--
-- Relasi one-to-many: budget_requests (1) -> budget_request_registers (N).
-- RLS dikunci seperti tabel keuangan lain: hanya service role (API) yang
-- boleh baca/tulis; client mengakses lewat /api/keuangan.
--
-- Jalankan manual via Supabase Dashboard > SQL Editor.
-- =====================================================================

CREATE TABLE IF NOT EXISTS budget_request_registers (
    id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    budget_request_id UUID REFERENCES budget_requests(id) ON DELETE CASCADE NOT NULL,
    register_number   VARCHAR(100) NOT NULL,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brr_request
    ON budget_request_registers (budget_request_id);

-- RLS: aktif tanpa policy => hanya service_role (API) yang punya akses.
ALTER TABLE budget_request_registers ENABLE ROW LEVEL SECURITY;
