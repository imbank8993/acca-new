-- =====================================================================
-- MUTASI / TRANSFER ANGGARAN (oleh Bendahara)
-- Bendahara dapat menyesuaikan pagu divisi atau memindahkan (transfer)
-- pagu antar divisi, disertai catatan alasan mutasi. Setiap kepala divisi
-- dapat melihat riwayat perubahan pagu divisinya (bertambah / berkurang).
--
--   amount  : nilai bertanda — (+) menambah, (-) mengurangi pagu divisi.
--   type    : 'Transfer' (antar divisi) | 'Penyesuaian' (satu divisi).
--   transfer_group_id : mengikat 2 baris pada satu transaksi transfer.
--
-- RLS dikunci seperti tabel keuangan lain: hanya service role (API).
-- Jalankan manual via Supabase Dashboard > SQL Editor.
-- =====================================================================

CREATE TABLE IF NOT EXISTS budget_mutations (
    id                       UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    division_id              UUID REFERENCES divisions(id) ON DELETE CASCADE NOT NULL,
    period                   VARCHAR(10) NOT NULL,
    amount                   NUMERIC(15, 2) NOT NULL,       -- bertanda (+/-)
    mutation_type            VARCHAR(20) NOT NULL,          -- 'Transfer' | 'Penyesuaian'
    reason                   TEXT NOT NULL,
    counterpart_division_id  UUID REFERENCES divisions(id), -- lawan transfer (opsional)
    transfer_group_id        UUID,                          -- pengikat pasangan transfer
    created_by               BIGINT REFERENCES users(id),
    created_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_mutations_division
    ON budget_mutations (division_id, period);

ALTER TABLE budget_mutations ENABLE ROW LEVEL SECURITY;
