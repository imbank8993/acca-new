-- =============================================================================
-- Keuangan — kolom bukti pengajuan (opsional).
--
-- PJ boleh melampirkan SATU berkas pendukung saat mengajukan anggaran:
-- gambar (foto nota/penawaran/dokumentasi) atau PDF. Sifatnya opsional —
-- pengajuan tetap bisa dibuat tanpa lampiran.
--
-- Berkasnya sendiri disimpan di Supabase Storage bucket 'documents'
-- (folder 'bukti_keuangan/'); kolom ini hanya menyimpan URL publiknya,
-- sama seperti pola report_file_url yang sudah ada.
--
-- Jalankan manual lewat Supabase Dashboard > SQL Editor.
-- =============================================================================

ALTER TABLE budget_requests
    ADD COLUMN IF NOT EXISTS proof_file_url TEXT;

COMMENT ON COLUMN budget_requests.proof_file_url IS
    'URL bukti pendukung pengajuan (gambar/PDF) yang dilampirkan PJ. Opsional.';
