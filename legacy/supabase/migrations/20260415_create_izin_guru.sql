-- ============================================================
-- Tabel: izin_guru
-- Digunakan untuk pengajuan izin, sakit, dan dinas luar guru.
-- Persetujuan:
--   - Izin/Sakit  → oleh KAMAD
--   - Dinas Luar  → oleh OP_JURNAL
-- ============================================================

CREATE TABLE IF NOT EXISTS izin_guru (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Referensi guru via NIP (konsisten dengan tabel lain)
  nip              TEXT NOT NULL,
  nama_guru        TEXT NOT NULL,  -- snapshot nama saat submit

  jenis            TEXT NOT NULL CHECK (jenis IN ('izin', 'sakit', 'dinas_luar')),
  tanggal_mulai    DATE NOT NULL,
  tanggal_selesai  DATE NOT NULL,
  keterangan       TEXT,

  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'disetujui', 'ditolak')),

  -- Kolom khusus Dinas Luar
  nomor_surat      TEXT,
  instansi_tujuan  TEXT,
  surat_tugas_url  TEXT,   -- URL file dari Supabase Storage / PHP upload

  -- Data approver (snapshot saat approval)
  approved_by_nip  TEXT,
  approved_by_nama TEXT,
  approved_at      TIMESTAMPTZ,
  catatan_penolakan TEXT,

  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk performa query umum
CREATE INDEX IF NOT EXISTS idx_izin_guru_nip           ON izin_guru(nip);
CREATE INDEX IF NOT EXISTS idx_izin_guru_status        ON izin_guru(status);
CREATE INDEX IF NOT EXISTS idx_izin_guru_jenis         ON izin_guru(jenis);
CREATE INDEX IF NOT EXISTS idx_izin_guru_tanggal       ON izin_guru(tanggal_mulai, tanggal_selesai);
CREATE INDEX IF NOT EXISTS idx_izin_guru_jenis_status  ON izin_guru(jenis, status);

-- Trigger untuk auto-update updated_at
CREATE OR REPLACE FUNCTION update_izin_guru_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_izin_guru_updated_at ON izin_guru;
CREATE TRIGGER trg_izin_guru_updated_at
  BEFORE UPDATE ON izin_guru
  FOR EACH ROW EXECUTE FUNCTION update_izin_guru_updated_at();

-- RLS: nonaktifkan dulu, akses via service role key di API
ALTER TABLE izin_guru DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- Menu: tambahkan izin-guru ke pages
-- Sesuaikan dengan role yang perlu akses
-- ============================================================
-- Contoh update manual di tabel users:
-- UPDATE users SET pages = pages || ',IzinGuru' WHERE role LIKE '%GURU%';
-- UPDATE users SET pages = pages || ',IzinGuru' WHERE role LIKE '%KAMAD%';
-- UPDATE users SET pages = pages || ',IzinGuru' WHERE role LIKE '%OP_JURNAL%';
