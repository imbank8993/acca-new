-- Migration: Kunci prestasi yang sudah disetujui
-- Created: 2026-07-28
--
-- Sebelumnya setiap validator (ADMIN / OP_LOMBA / WKM_KESISWAAN) bisa mengubah
-- status_validasi kapan saja, termasuk menyetujui ulang atau menolak ajuan yang
-- sudah disetujui validator lain. Migrasi ini menjadikan keputusan 'Disetujui'
-- bersifat final: baris tersebut tidak lagi lolos policy UPDATE, sehingga
-- penguncian tidak bergantung pada UI.
--
-- Catatan: DELETE tidak diubah — validator tetap bisa menghapus baris bila
-- memang salah input.

DROP POLICY IF EXISTS "prestasi update hanya validator" ON prestasi_lomba;
DROP POLICY IF EXISTS "prestasi update validator kecuali disetujui" ON prestasi_lomba;

-- UPDATE: hanya validator, dan hanya untuk baris yang BELUM disetujui.
-- USING dievaluasi terhadap baris lama → 'Disetujui' otomatis tidak terpilih.
CREATE POLICY "prestasi update validator kecuali disetujui"
  ON prestasi_lomba FOR UPDATE
  TO authenticated
  USING (
    is_prestasi_validator(auth.uid())
    AND status_validasi IS DISTINCT FROM 'Disetujui'
  )
  WITH CHECK (is_prestasi_validator(auth.uid()));
