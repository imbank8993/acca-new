-- Penandaan pembayaran honor Guru Asuh oleh Bendahara Komite
-- Date: 2026-08-11

ALTER TABLE laporan_guru_asuh_submissions ADD COLUMN IF NOT EXISTS dibayarkan BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE laporan_guru_asuh_submissions ADD COLUMN IF NOT EXISTS dibayarkan_at TIMESTAMPTZ;
ALTER TABLE laporan_guru_asuh_submissions ADD COLUMN IF NOT EXISTS dibayarkan_by VARCHAR;
ALTER TABLE laporan_guru_asuh_submissions ADD COLUMN IF NOT EXISTS dibayarkan_by_name VARCHAR;
ALTER TABLE laporan_guru_asuh_submissions ADD COLUMN IF NOT EXISTS catatan_pembayaran TEXT;

CREATE INDEX IF NOT EXISTS idx_laporan_guru_asuh_submissions_dibayarkan ON laporan_guru_asuh_submissions(dibayarkan);

COMMENT ON COLUMN laporan_guru_asuh_submissions.dibayarkan IS
  'Ditandai Bendahara Komite setelah honor guru asuh dibayarkan untuk periode ini. Hanya relevan untuk submission berstatus Approved.';

-- Registrasi halaman baru ke sistem role_pages (lihat migrasi 20260622_role_based_pages.sql).
-- Role BENDAHARA_KOMITE di-grant menyusul lewat UI Pengaturan Users > Akses per Role
-- setelah role tsb dibuat di Daftar Role.
INSERT INTO role_pages (role, page_id)
VALUES ('ADMIN', 'guru-asuh-pembayaran')
ON CONFLICT (role, page_id) DO NOTHING;

INSERT INTO master_permissions_list (category, resource, action, label, description) VALUES
('Guru Asuh Pembayaran', 'guru_asuh_pembayaran', 'view', 'View Pembayaran Guru Asuh', 'Melihat halaman pembayaran honor guru asuh (Bendahara Komite)'),
('Guru Asuh Pembayaran', 'guru_asuh_pembayaran', 'manage', 'Kelola Pembayaran Guru Asuh', 'Menandai laporan guru asuh sebagai sudah dibayarkan')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_name, resource, action, is_allowed) VALUES
('ADMIN', 'guru_asuh_pembayaran', 'view', true),
('ADMIN', 'guru_asuh_pembayaran', 'manage', true)
ON CONFLICT (role_name, resource, action) DO UPDATE SET is_allowed = true;
