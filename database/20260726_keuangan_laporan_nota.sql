-- =====================================================================
-- PELAPORAN: NOTA (fisik, akumulasi nilai) & LAPORAN (fisik + digital PDF)
--
-- Nota   : disetor fisik ke Bendahara. Bendahara mencatat NILAI nota yang
--          sudah disetor (bertahap) → tabel receipt_submissions. Sistem
--          mengakumulasi: sudah disetor vs sisa (total - disetor).
-- Laporan: dokumen fisik + PDF digital (report_file_url). Boleh diunggah PJ
--          maupun Bendahara. Bendahara mencentang bila sudah diterima lengkap
--          (report_received_by_bendahara). Kepala Divisi/KTU/PPK/PJ bisa view.
--
-- RLS tabel dikunci: hanya service role (API).
-- Jalankan manual via Supabase Dashboard > SQL Editor.
-- =====================================================================

-- Nota disetor bertahap (akumulasi nilai).
CREATE TABLE IF NOT EXISTS receipt_submissions (
    id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    budget_request_id UUID REFERENCES budget_requests(id) ON DELETE CASCADE NOT NULL,
    amount            NUMERIC(15, 2) NOT NULL,
    description       TEXT,
    created_by        BIGINT REFERENCES users(id),
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_receipt_sub_request
    ON receipt_submissions (budget_request_id);
ALTER TABLE receipt_submissions ENABLE ROW LEVEL SECURITY;

-- Penanda laporan (fisik + digital) sudah diterima lengkap oleh Bendahara.
ALTER TABLE budget_requests ADD COLUMN IF NOT EXISTS report_received_by_bendahara BOOLEAN DEFAULT false;

-- Pastikan kolom pelaporan ada (sebagian dibuat manual sebelumnya; IF NOT EXISTS aman).
ALTER TABLE budget_requests ADD COLUMN IF NOT EXISTS report_file_url TEXT;
ALTER TABLE budget_requests ADD COLUMN IF NOT EXISTS receipt_status VARCHAR(50);
ALTER TABLE budget_requests ADD COLUMN IF NOT EXISTS report_status VARCHAR(50);
