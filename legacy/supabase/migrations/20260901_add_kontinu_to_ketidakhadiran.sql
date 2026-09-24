-- Migration: penanda entri "Kontinu Non-Stop" pada ketidakhadiran
-- Created: 2026-09-01
--
-- Latar: entri kontinu multi-hari (mis. 31 Agu 08.00 → 1 Sep 21.00) dipecah
-- menjadi satu baris per tanggal oleh /api/ketidakhadiran/bulk. Sebelum migrasi
-- ini tidak ada apa pun yang menandai bahwa baris-baris itu satu kesatuan, jadi
-- entri kontinu tidak bisa dibedakan dari mode "Berulang Setiap Hari" saat
-- ditampilkan, diedit, atau dihapus.
--
-- is_kontinu : baris ini bagian dari entri kontinu non-stop
-- seri_id    : pengikat baris-baris satu entri (satu siswa, satu pengajuan)

ALTER TABLE ketidakhadiran
  ADD COLUMN IF NOT EXISTS is_kontinu BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS seri_id UUID;

COMMENT ON COLUMN ketidakhadiran.is_kontinu IS
  'TRUE bila baris ini bagian dari entri kontinu non-stop (hari pertama/terakhir memakai jam sebelah).';
COMMENT ON COLUMN ketidakhadiran.seri_id IS
  'Pengikat baris-baris hasil pemecahan satu entri multi-hari untuk satu siswa.';

-- Dipakai saat edit/hapus satu seri sekaligus
CREATE INDEX IF NOT EXISTS idx_ketidakhadiran_seri
  ON ketidakhadiran(seri_id)
  WHERE seri_id IS NOT NULL;
