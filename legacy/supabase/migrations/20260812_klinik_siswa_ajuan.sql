-- Klinik Pembelajaran: ajuan kelompok siswa + approval laporan
-- Date: 2026-08-12

-- Penanda siapa yang memulai pengajuan (guru vs kelompok siswa)
ALTER TABLE klinik_slots ADD COLUMN IF NOT EXISTS initiator_type VARCHAR(10) DEFAULT 'GURU'; -- 'GURU' | 'SISWA'
ALTER TABLE klinik_slots ADD COLUMN IF NOT EXISTS initiator_siswa_id BIGINT REFERENCES users(id);

-- Approval laporan (mirip pola laporan_guru_asuh_submissions)
ALTER TABLE klinik_laporan ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Draft'; -- Draft | Submitted | Approved | Revisi
ALTER TABLE klinik_laporan ADD COLUMN IF NOT EXISTS approved_by BIGINT REFERENCES users(id);
ALTER TABLE klinik_laporan ADD COLUMN IF NOT EXISTS approved_by_name VARCHAR(255);
ALTER TABLE klinik_laporan ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE klinik_laporan ADD COLUMN IF NOT EXISTS catatan_reviewer TEXT;

CREATE INDEX IF NOT EXISTS idx_klinik_laporan_status ON klinik_laporan(status);
CREATE INDEX IF NOT EXISTS idx_klinik_slots_initiator ON klinik_slots(initiator_type, status);

-- Backfill: laporan yg SUDAH final (is_finalized=true) dianggap otomatis Approved,
-- supaya sesi finished/paid yang sudah ada sebelumnya tidak mendadak "hilang"
-- dari kelayakan pembayaran gara-gara gerbang approval baru.
UPDATE klinik_laporan SET status = 'Approved', approved_at = COALESCE(approved_at, updated_at)
WHERE is_finalized = true AND status = 'Draft';

COMMENT ON COLUMN klinik_slots.initiator_type IS
  'GURU = dibuat guru (alur lama, langsung terhubung ke guru_id). SISWA = pengajuan kelompok siswa, guru_id dipilih siswa saat mengajukan.';
COMMENT ON COLUMN klinik_laporan.status IS
  'Draft (belum difinalisasi) -> Submitted (guru finalisasi) -> Approved/Revisi oleh ADMIN/OP_KLINIK. Approved = syarat tampil di halaman Pembayaran.';
