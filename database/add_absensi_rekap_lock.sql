-- Jalankan manual via Supabase Dashboard SQL Editor (proyek ini tidak punya RPC exec_sql).
-- Snapshot rekap absensi bulanan per kelas yang dikunci wali kelas. Guru mapel
-- tetap bisa mengisi/mengubah absensi kapan saja; begitu bulan dikunci, rekap
-- yang ditampilkan ke wali kelas dibekukan dari perubahan tsb sampai dibuka lagi.
CREATE TABLE IF NOT EXISTS absensi_rekap_lock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kelas TEXT NOT NULL,
    tahun_ajaran TEXT NOT NULL,
    bulan TEXT NOT NULL, -- format YYYY-MM
    snapshot JSONB NOT NULL, -- hasil computeRekapAbsensiKelas() saat dikunci
    locked_by_nip TEXT,
    locked_by_nama TEXT,
    locked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (kelas, bulan)
);

CREATE INDEX IF NOT EXISTS idx_absensi_rekap_lock_kelas_bulan ON absensi_rekap_lock(kelas, bulan);

COMMENT ON TABLE absensi_rekap_lock IS 'Snapshot rekap absensi bulanan per kelas yang dikunci wali kelas; perubahan absensi guru mapel setelah dikunci tidak mengubah rekap yang sudah dibekukan.';
COMMENT ON COLUMN absensi_rekap_lock.snapshot IS 'Hasil computeRekapAbsensiKelas() (siswa[], summary, holidays) pada saat dikunci.';
