-- E-Supervisi: index untuk mempercepat query pemuatan data.
-- Jalankan manual via Supabase Dashboard > SQL Editor (idempotent, aman diulang).

-- Penugasan sering difilter per tahun ajaran & per NIP
CREATE INDEX IF NOT EXISTS idx_sv_penugasan_tahun_ajaran ON sv_penugasan (tahun_ajaran_id);
CREATE INDEX IF NOT EXISTS idx_sv_penugasan_supervisor_nip ON sv_penugasan (supervisor_nip);
CREATE INDEX IF NOT EXISTS idx_sv_penugasan_guru_nip ON sv_penugasan (guru_nip);

-- Master dokumen difilter per tahun ajaran + aktif
CREATE INDEX IF NOT EXISTS idx_sv_master_dokumen_tahun_ajaran ON sv_master_dokumen (tahun_ajaran_id);

-- Indikator di-join lewat dokumen_id
CREATE INDEX IF NOT EXISTS idx_sv_indikator_dokumen ON sv_indikator (dokumen_id);

-- Rekam nilai difilter per penugasan (rekap & borang penilaian)
CREATE INDEX IF NOT EXISTS idx_sv_rekam_nilai_penugasan ON sv_rekam_nilai (penugasan_id);

-- Lookup nama guru & jadwal via NIP
CREATE INDEX IF NOT EXISTS idx_jadwal_guru_nip ON jadwal_guru (nip);
