-- Catatan Pembelajaran: catatan positif/negatif siswa selama guru mengajar
-- (Absensi) + tindak lanjut oleh Bimbingan Konseling (BK)
-- Date: 2026-08-12

CREATE TABLE catatan_siswa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sesi_id TEXT REFERENCES absensi_sesi(sesi_id) ON DELETE SET NULL, -- TEXT (bukan UUID native) mengikuti tipe kolom absensi_sesi.sesi_id; nullable + SET NULL: catatan perilaku tidak boleh ikut hilang kalau sesi absensi dihapus admin
    nisn TEXT NOT NULL,
    nama_snapshot TEXT NOT NULL,
    kelas TEXT NOT NULL, -- snapshot, supaya query wali-kelas/BK tidak perlu join ke sesi
    tanggal DATE NOT NULL,
    jam_ke TEXT,
    mapel TEXT,
    nip TEXT NOT NULL, -- guru pencatat
    nama_guru TEXT NOT NULL,
    jenis VARCHAR(10) NOT NULL CHECK (jenis IN ('POSITIF', 'NEGATIF')),
    catatan TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'BARU' CHECK (status IN ('BARU', 'DITINDAKLANJUTI', 'SELESAI')),
    tahun_ajaran TEXT,
    semester INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE catatan_siswa_tindak_lanjut (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    catatan_id UUID NOT NULL REFERENCES catatan_siswa(id) ON DELETE CASCADE,
    nip TEXT NOT NULL, -- staf BK
    nama TEXT NOT NULL,
    catatan TEXT NOT NULL,
    status_baru VARCHAR(20) NOT NULL CHECK (status_baru IN ('DITINDAKLANJUTI', 'SELESAI')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_catatan_siswa_sesi ON catatan_siswa(sesi_id);
CREATE INDEX idx_catatan_siswa_kelas_tanggal ON catatan_siswa(kelas, tanggal);
CREATE INDEX idx_catatan_siswa_nisn ON catatan_siswa(nisn);
CREATE INDEX idx_catatan_siswa_status ON catatan_siswa(status);
CREATE INDEX idx_catatan_siswa_tindak_lanjut_catatan ON catatan_siswa_tindak_lanjut(catatan_id);

ALTER TABLE catatan_siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE catatan_siswa_tindak_lanjut ENABLE ROW LEVEL SECURITY;
-- Tidak ada policy permissive: semua akses lewat API route (service-role client
-- di lib/supabase-server.ts), auth + role check dilakukan di server — sama
-- seperti pola modul Keuangan.

COMMENT ON COLUMN catatan_siswa.jenis IS 'POSITIF = sikap baik, NEGATIF = pelanggaran, dicatat guru saat mengajar/mengambil absensi';
COMMENT ON COLUMN catatan_siswa.status IS 'BARU -> DITINDAKLANJUTI/SELESAI oleh BK. Guru hanya boleh edit/hapus catatan miliknya selama status masih BARU.';
