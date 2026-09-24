-- Migration: Create site_settings table for admin maintenance control
-- Allows admin to lock pages with custom maintenance message

CREATE TABLE IF NOT EXISTS site_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    label VARCHAR(255) NOT NULL,
    description TEXT,
    value TEXT DEFAULT 'false',
    message TEXT DEFAULT 'Halaman sedang dalam perbaikan. Mohon tunggu beberapa saat.',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default maintenance settings for ALL app pages (except master-data, pengaturan-data, pengaturan-users)
INSERT INTO site_settings (key, label, description, value, message)
VALUES
    ('maintenance_home', 'Beranda', 'Kunci halaman utama /', 'false', 'Halaman sedang dalam perbaikan. Mohon tunggu beberapa saat.'),
    ('maintenance_dashboard', 'Dashboard', 'Kunci halaman utama /dashboard', 'false', 'Halaman dashboard sedang dalam perbaikan.'),
    ('maintenance_absensi', 'Absensi', 'Kunci halaman /absensi', 'false', 'Halaman absensi sedang dalam perbaikan.'),
    ('maintenance_agenda_akademik', 'Agenda Akademik', 'Kunci halaman /agenda-akademik', 'false', 'Halaman agenda akademik sedang dalam perbaikan.'),
    ('maintenance_analisis_beban_kerja', 'Analisis Beban Kerja', 'Kunci halaman /analisis-beban-kerja', 'false', 'Halaman analisis beban kerja sedang dalam perbaikan.'),
    ('maintenance_arsip_siswa', 'Arsip Siswa', 'Kunci halaman /arsip-siswa', 'false', 'Halaman arsip siswa sedang dalam perbaikan.'),
    ('maintenance_catatan_keuangan', 'Catatan Keuangan', 'Kunci halaman /catatan-keuangan', 'false', 'Halaman catatan keuangan sedang dalam perbaikan.'),
    ('maintenance_personal_documents', 'Dokumen Pribadi', 'Kunci halaman /personal-documents', 'false', 'Halaman dokumen pribadi sedang dalam perbaikan.'),
    ('maintenance_dokumen_siswa', 'Dokumen Siswa', 'Kunci halaman /dokumen-siswa', 'false', 'Halaman dokumen siswa sedang dalam perbaikan.'),
    ('maintenance_guru_asuh', 'Guru Asuh', 'Kunci halaman /guru-asuh', 'false', 'Halaman guru asuh sedang dalam perbaikan.'),
    ('maintenance_informasi', 'Informasi', 'Kunci halaman /informasi', 'false', 'Halaman informasi sedang dalam perbaikan.'),
    ('maintenance_informasi_akademik', 'Informasi Akademik', 'Kunci halaman /informasi-akademik', 'false', 'Halaman informasi akademik sedang dalam perbaikan.'),
    ('maintenance_jurnal', 'Jurnal Mengajar', 'Kunci halaman /jurnal', 'false', 'Halaman jurnal mengajar sedang dalam perbaikan.'),
    ('maintenance_jurnal_banding', 'Jurnal - Banding', 'Kunci halaman /jurnal/banding', 'false', 'Halaman banding jurnal sedang dalam perbaikan.'),
    ('maintenance_jurnal_input', 'Jurnal - Input', 'Kunci halaman /jurnal/input', 'false', 'Halaman input jurnal sedang dalam perbaikan.'),
    ('maintenance_ketidakhadiran', 'Ketidakhadiran', 'Kunci halaman /ketidakhadiran', 'false', 'Halaman ketidakhadiran sedang dalam perbaikan.'),
    ('maintenance_ketidakhadiran_log', 'Ketidakhadiran - Log', 'Kunci halaman /ketidakhadiran-log', 'false', 'Halaman log ketidakhadiran sedang dalam perbaikan.'),
    ('maintenance_kinerja_guru', 'Kinerja Guru', 'Kunci halaman /kinerja-guru', 'false', 'Halaman kinerja guru sedang dalam perbaikan.'),
    ('maintenance_laporan_pengembangan_diri', 'Laporan Pengembangan Diri', 'Kunci halaman /laporan/pengembangan-diri', 'false', 'Halaman laporan pengembangan diri sedang dalam perbaikan.'),
    ('maintenance_laporan_guru_asuh', 'Laporan Guru Asuh', 'Kunci halaman /laporan-guru-asuh', 'false', 'Halaman laporan guru asuh sedang dalam perbaikan.'),
    ('maintenance_layanan_ptsp', 'Layanan PTSP', 'Kunci halaman /layanan-ptsp', 'false', 'Halaman layanan PTSP sedang dalam perbaikan.'),
    ('maintenance_lckh', 'LCKH', 'Kunci halaman /lckh', 'false', 'Halaman LCKH sedang dalam perbaikan.'),
    ('maintenance_lckh_print_lampiran', 'LCKH - Print Lampiran', 'Kunci halaman /lckh/print-lampiran', 'false', 'Halaman print lampiran LCKH sedang dalam perbaikan.'),
    ('maintenance_lckh_approval', 'LCKH - Approval', 'Kunci halaman /lckh-approval', 'false', 'Halaman approval LCKH sedang dalam perbaikan.'),
    ('maintenance_link_auth', 'Link Auth', 'Kunci halaman /link-auth', 'false', 'Halaman link auth sedang dalam perbaikan.'),
    ('maintenance_master', 'Master', 'Kunci halaman /master', 'false', 'Halaman master sedang dalam perbaikan.'),
    ('maintenance_monitoring', 'Monitoring', 'Kunci halaman /monitoring', 'false', 'Halaman monitoring sedang dalam perbaikan.'),
    ('maintenance_nilai', 'Nilai', 'Kunci halaman /nilai', 'false', 'Halaman nilai sedang dalam perbaikan.'),
    ('maintenance_pengaturan_tugas', 'Pengaturan Tugas', 'Kunci halaman /pengaturan-tugas', 'false', 'Halaman pengaturan tugas sedang dalam perbaikan.'),
    ('maintenance_piket', 'Piket', 'Kunci halaman /piket', 'false', 'Halaman piket sedang dalam perbaikan.'),
    ('maintenance_piket_input', 'Piket - Input', 'Kunci halaman /piket/input', 'false', 'Halaman input piket sedang dalam perbaikan.'),
    ('maintenance_rekap_jurnal', 'Rekap Jurnal', 'Kunci halaman /rekap-jurnal', 'false', 'Halaman rekap jurnal sedang dalam perbaikan.'),
    ('maintenance_reset_data', 'Reset Data', 'Kunci halaman /reset-data', 'false', 'Halaman reset data sedang dalam perbaikan.'),
    ('maintenance_tugas_siswa', 'Tugas Siswa', 'Kunci halaman /tugas-siswa', 'false', 'Halaman tugas siswa sedang dalam perbaikan.'),
    ('maintenance_tugas_tambahan', 'Tugas Tambahan', 'Kunci halaman /tugas-tambahan', 'false', 'Halaman tugas tambahan sedang dalam perbaikan.'),
    ('maintenance_ujian_madrasah', 'Ujian Madrasah', 'Kunci halaman /ujian-madrasah', 'false', 'Halaman ujian madrasah sedang dalam perbaikan.'),
    ('maintenance_global', 'Situs Global', 'Kunci seluruh situs (kecuali admin)', 'false', 'Situs sedang dalam pemeliharaan. Mohon tunggu beberapa saat.')
ON CONFLICT (key) DO NOTHING;

-- RLS: Only ADMIN can read/write
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (make migration idempotent)
DROP POLICY IF EXISTS "Only authenticated users can read site_settings" ON site_settings;
DROP POLICY IF EXISTS "Only admin can update site_settings" ON site_settings;
DROP POLICY IF EXISTS "Only admin can insert site_settings" ON site_settings;

CREATE POLICY "Only authenticated users can read site_settings"
    ON site_settings FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Only admin can update site_settings"
    ON site_settings FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_id = auth.uid()
            AND role ILIKE '%admin%'
        )
    );

CREATE POLICY "Only admin can insert site_settings"
    ON site_settings FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_id = auth.uid()
            AND role ILIKE '%admin%'
        )
    );

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_site_settings_updated_at ON site_settings;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_site_settings_updated_at
    BEFORE UPDATE ON site_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
