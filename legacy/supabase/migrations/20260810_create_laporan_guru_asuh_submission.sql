-- Ajuan + approval bulanan untuk Laporan Guru Asuh (ditandatangani WKM Keasramaan)
-- Date: 2026-08-10

CREATE TABLE IF NOT EXISTS laporan_guru_asuh_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nip VARCHAR NOT NULL,
    nama_guru_snap VARCHAR,
    bulan INT NOT NULL,
    tahun INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Submitted', -- Submitted | Approved | Revisi
    total_laporan INT DEFAULT 0,
    catatan_guru TEXT,
    catatan_reviewer TEXT,
    approved_by VARCHAR,        -- auth id approver (WKM Keasramaan / Admin)
    approved_by_name VARCHAR,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    pdf_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(nip, bulan, tahun)
);

CREATE INDEX IF NOT EXISTS idx_laporan_guru_asuh_submissions_nip ON laporan_guru_asuh_submissions(nip);
CREATE INDEX IF NOT EXISTS idx_laporan_guru_asuh_submissions_status ON laporan_guru_asuh_submissions(status);

-- Tautkan entri laporan ke ajuan bulanan yang menaunginya. NULL = belum
-- pernah diajukan (guru masih bebas edit/hapus). Diisi saat "Ajukan",
-- dikosongkan lagi kalau WKM mengembalikan (Revisi).
ALTER TABLE laporan_guru_asuh ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES laporan_guru_asuh_submissions(id);
CREATE INDEX IF NOT EXISTS idx_laporan_guru_asuh_submission_id ON laporan_guru_asuh(submission_id);

COMMENT ON TABLE laporan_guru_asuh_submissions IS
  'Ajuan rekap bulanan Laporan Guru Asuh untuk ditinjau/ditandatangani WKM Keasramaan. 1 baris = 1 guru + 1 bulan + 1 tahun.';

-- Catatan: approval WKM Keasramaan bukan halaman terpisah — jadi tab
-- "Approval Laporan" di dalam halaman `guru-asuh` (muncul otomatis utk role
-- WKM_KEASRAMAAN/ADMIN). Jadi tidak perlu registrasi role_pages/permission
-- terpisah di sini; role WKM_KEASRAMAAN cukup di-grant akses ke halaman
-- `guru-asuh` yang sudah ada lewat UI Pengaturan Users > Akses per Role
-- setelah role tsb dibuat di Daftar Role.
