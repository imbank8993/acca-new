-- Migration: Create ketidakhadiran table
-- Created: 2026-01-21
-- Description: Absence tracking system with bulk operations, overlap validation, and role-based access

-- Create ketidakhadiran table
CREATE TABLE ketidakhadiran (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  jenis VARCHAR(20) NOT NULL CHECK (jenis IN ('IZIN', 'SAKIT')),
  nisn VARCHAR(20) NOT NULL,
  nama VARCHAR(255) NOT NULL,
  kelas VARCHAR(20) NOT NULL,
  tgl_mulai DATE NOT NULL,
  tgl_selesai DATE NOT NULL,
  keterangan TEXT NOT NULL,
  status VARCHAR(50) NOT NULL,
  petugas_role VARCHAR(50),
  petugas_guru_id VARCHAR(20),
  petugas_nama VARCHAR(255),
  aktif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT tgl_valid CHECK (tgl_mulai <= tgl_selesai)
);

-- Basic indexes
CREATE INDEX idx_ketidakhadiran_nisn ON ketidakhadiran(nisn);
CREATE INDEX idx_ketidakhadiran_kelas ON ketidakhadiran(kelas);
CREATE INDEX idx_ketidakhadiran_tanggal ON ketidakhadiran(tgl_mulai, tgl_selesai);
CREATE INDEX idx_ketidakhadiran_aktif ON ketidakhadiran(aktif);
CREATE INDEX idx_ketidakhadiran_jenis ON ketidakhadiran(jenis);

-- Composite index for group operations (IZIN & SAKIT)
CREATE INDEX idx_ketidakhadiran_group 
  ON ketidakhadiran(jenis, tgl_mulai, tgl_selesai, keterangan) 
  WHERE aktif = TRUE;

-- Date range index for overlap validation using GIST
-- Note: NISN filtering done in WHERE clause, not in index
CREATE INDEX idx_ketidakhadiran_daterange 
  ON ketidakhadiran USING gist (
    daterange(tgl_mulai, tgl_selesai, '[]')
  ) WHERE aktif = TRUE;

-- Partial index for active records by class
CREATE INDEX idx_ketidakhadiran_active_class 
  ON ketidakhadiran(kelas, tgl_mulai DESC) 
  WHERE aktif = TRUE;

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER set_ketidakhadiran_timestamp
  BEFORE UPDATE ON ketidakhadiran
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- Enable Row Level Security
ALTER TABLE ketidakhadiran ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admin can do everything
CREATE POLICY admin_all ON ketidakhadiran
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
      AND raw_user_meta_data->>'role' = 'Admin'
    )
  );

-- OP_Izin can only see/manage IZIN
CREATE POLICY op_izin_select ON ketidakhadiran
  FOR SELECT TO authenticated
  USING (
    jenis = 'IZIN' 
    AND EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
      AND raw_user_meta_data->>'role' = 'OP_Izin'
    )
  );

CREATE POLICY op_izin_insert ON ketidakhadiran
  FOR INSERT TO authenticated
  WITH CHECK (
    jenis = 'IZIN'
    AND EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
      AND raw_user_meta_data->>'role' = 'OP_Izin'
    )
  );

CREATE POLICY op_izin_update ON ketidakhadiran
  FOR UPDATE TO authenticated
  USING (
    jenis = 'IZIN'
    AND EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
      AND raw_user_meta_data->>'role' = 'OP_Izin'
    )
  )
  WITH CHECK (jenis = 'IZIN');

CREATE POLICY op_izin_delete ON ketidakhadiran
  FOR DELETE TO authenticated
  USING (
    jenis = 'IZIN'
    AND EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
      AND raw_user_meta_data->>'role' = 'OP_Izin'
    )
  );

-- OP_UKS can only see/manage SAKIT
CREATE POLICY op_uks_select ON ketidakhadiran
  FOR SELECT TO authenticated
  USING (
    jenis = 'SAKIT'
    AND EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
      AND raw_user_meta_data->>'role' = 'OP_UKS'
    )
  );

CREATE POLICY op_uks_insert ON ketidakhadiran
  FOR INSERT TO authenticated
  WITH CHECK (
    jenis = 'SAKIT'
    AND EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
      AND raw_user_meta_data->>'role' = 'OP_UKS'
    )
  );

CREATE POLICY op_uks_update ON ketidakhadiran
  FOR UPDATE TO authenticated
  USING (
    jenis = 'SAKIT'
    AND EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
      AND raw_user_meta_data->>'role' = 'OP_UKS'
    )
  )
  WITH CHECK (jenis = 'SAKIT');

CREATE POLICY op_uks_delete ON ketidakhadiran
  FOR DELETE TO authenticated
  USING (
    jenis = 'SAKIT'
    AND EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
      AND raw_user_meta_data->>'role' = 'OP_UKS'
    )
  );

-- Comments for documentation
COMMENT ON TABLE ketidakhadiran IS 'Absence tracking with bulk operations and overlap validation';
COMMENT ON COLUMN ketidakhadiran.jenis IS 'IZIN or SAKIT';
COMMENT ON COLUMN ketidakhadiran.status IS 'IZIN: MADRASAH/PERSONAL, SAKIT: Ringan/Sedang/Berat/Kontrol';
COMMENT ON COLUMN ketidakhadiran.keterangan IS 'IZIN: NamaLomba|Penyelenggara|Alamat, SAKIT: detail sakit';
COMMENT ON COLUMN ketidakhadiran.aktif IS 'Soft delete flag - FALSE means deleted';
COMMENT ON INDEX idx_ketidakhadiran_group IS 'For bulk edit/delete operations on same group';
COMMENT ON INDEX idx_ketidakhadiran_daterange IS 'For overlap validation queries';
