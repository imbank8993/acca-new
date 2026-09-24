-- Migration: Add RLS policies for all PTSP tables
-- Ensures service role can perform all operations on PTSP tables

-- ptsp_master_tracking
ALTER TABLE ptsp_master_tracking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role all on ptsp_master_tracking" ON ptsp_master_tracking;
CREATE POLICY "Service role all on ptsp_master_tracking" ON ptsp_master_tracking
    FOR ALL USING (auth.role() = 'service_role');

-- ptsp_buku_tamu
ALTER TABLE ptsp_buku_tamu ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role all on ptsp_buku_tamu" ON ptsp_buku_tamu;
CREATE POLICY "Service role all on ptsp_buku_tamu" ON ptsp_buku_tamu
    FOR ALL USING (auth.role() = 'service_role');

-- ptsp_izin_siswa
ALTER TABLE ptsp_izin_siswa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role all on ptsp_izin_siswa" ON ptsp_izin_siswa;
CREATE POLICY "Service role all on ptsp_izin_siswa" ON ptsp_izin_siswa
    FOR ALL USING (auth.role() = 'service_role');

-- ptsp_izin_magang
ALTER TABLE ptsp_izin_magang ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role all on ptsp_izin_magang" ON ptsp_izin_magang;
CREATE POLICY "Service role all on ptsp_izin_magang" ON ptsp_izin_magang
    FOR ALL USING (auth.role() = 'service_role');

-- ptsp_legalisir
ALTER TABLE ptsp_legalisir ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role all on ptsp_legalisir" ON ptsp_legalisir;
CREATE POLICY "Service role all on ptsp_legalisir" ON ptsp_legalisir
    FOR ALL USING (auth.role() = 'service_role');

-- ptsp_mutasi_siswa
ALTER TABLE ptsp_mutasi_siswa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role all on ptsp_mutasi_siswa" ON ptsp_mutasi_siswa;
CREATE POLICY "Service role all on ptsp_mutasi_siswa" ON ptsp_mutasi_siswa
    FOR ALL USING (auth.role() = 'service_role');

-- ptsp_pengganti_ijazah
ALTER TABLE ptsp_pengganti_ijazah ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role all on ptsp_pengganti_ijazah" ON ptsp_pengganti_ijazah;
CREATE POLICY "Service role all on ptsp_pengganti_ijazah" ON ptsp_pengganti_ijazah
    FOR ALL USING (auth.role() = 'service_role');

-- ptsp_sosialisasi
ALTER TABLE ptsp_sosialisasi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role all on ptsp_sosialisasi" ON ptsp_sosialisasi;
CREATE POLICY "Service role all on ptsp_sosialisasi" ON ptsp_sosialisasi
    FOR ALL USING (auth.role() = 'service_role');
