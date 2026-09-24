-- UPSERTing standard permissions for Halaman and Tab Access
-- Using tab:<tab_key> for specific tab visibility

INSERT INTO master_permissions_list (category, resource, action, label, description)
VALUES
    -- Master Data
    ('Master Data', 'master', 'view', 'View (Utama)', 'Akses ke dashboard master data'),
    ('Master Data', 'master', 'manage', 'Full Access (manage)', 'Mengelola seluruh data master'),
    ('Master Data', 'master', 'tab:tahun_ajaran', 'Tab: Tahun Ajaran', 'Hak akses melihat tab Tahun Ajaran'),
    ('Master Data', 'master', 'tab:siswa', 'Tab: Siswa', 'Hak akses melihat tab Siswa'),
    ('Master Data', 'master', 'tab:guru', 'Tab: Guru', 'Hak akses melihat tab Guru'),
    ('Master Data', 'master', 'tab:kode_guru', 'Tab: Kode Guru', 'Hak akses melihat tab Kode Guru'),
    ('Master Data', 'master', 'tab:mapel', 'Tab: Mapel', 'Hak akses melihat tab Mapel'),
    ('Master Data', 'master', 'tab:kelas', 'Tab: Kelas', 'Hak akses melihat tab Kelas'),
    ('Master Data', 'master', 'tab:waktu', 'Tab: Waktu', 'Hak akses melihat tab Waktu'),
    ('Master Data', 'master', 'tab:tugas_tambahan', 'Tab: Tugas Tambahan', 'Hak akses melihat tab Tugas Tambahan'),
    ('Master Data', 'master', 'import', 'Aksi: Import Excel', 'Kemampuan mengunggah data massal via Excel'),
    ('Master Data', 'master', 'export', 'Aksi: Export Excel', 'Kemampuan mengunduh data massal ke Excel'),
    
    -- Pengaturan Data
    ('Pengaturan Data', 'pengaturan_data', 'view', 'View (Utama)', 'Akses ke dashboard pengaturan data'),
    ('Pengaturan Data', 'pengaturan_data', 'manage', 'Full Access (manage)', 'Mengelola seluruh pengaturan data'),
    ('Pengaturan Data', 'pengaturan_data', 'tab:siswa_kelas', 'Tab: Siswa - Kelas', 'Hak akses melihat tab Siswa Kelas'),
    ('Pengaturan Data', 'pengaturan_data', 'tab:wali_kelas', 'Tab: Wali Kelas', 'Hak akses melihat tab Wali Kelas'),
    ('Pengaturan Data', 'pengaturan_data', 'tab:guru_asuh', 'Tab: Guru Asuh', 'Hak akses melihat tab Guru Asuh'),
    ('Pengaturan Data', 'pengaturan_data', 'tab:dropdown', 'Tab: Master Dropdown', 'Hak akses melihat tab Master Dropdown'),
    ('Pengaturan Data', 'pengaturan_data', 'tab:libur', 'Tab: Hari Libur', 'Hak akses melihat tab Hari Libur'),
    ('Pengaturan Data', 'pengaturan_data', 'tab:generate_jurnal', 'Tab: Generate Jurnal', 'Hak akses melihat tab Generate Jurnal'),

    -- Pengaturan Tugas
    ('Pengaturan Tugas', 'pengaturan_tugas', 'view', 'View (Utama)', 'Akses ke dashboard pengaturan tugas'),
    ('Pengaturan Tugas', 'pengaturan_tugas', 'tab:guru_mapel', 'Tab: Guru Mapel', 'Hak akses melihat tab Guru Mapel'),
    ('Pengaturan Tugas', 'pengaturan_tugas', 'tab:jadwal_guru', 'Tab: Jadwal Guru', 'Hak akses melihat tab Jadwal Guru'),
    ('Pengaturan Tugas', 'pengaturan_tugas', 'tab:ploting_tugas', 'Tab: Plotting Tugas', 'Hak akses melihat tab Plotting Tugas Tambahan'),

    -- Jurnal & Transaksi
    ('Jurnal & Absensi', 'jurnal', 'view', 'Aksi: Lihat Jurnal', 'Melihat daftar riwayat jurnal'),
    ('Jurnal & Absensi', 'jurnal', 'create', 'Aksi: Buat Jurnal', 'Membuat entri jurnal mengajar baru'),
    ('Jurnal & Absensi', 'jurnal', 'edit', 'Aksi: Edit Jurnal', 'Mengubah entri jurnal yang sudah dibuat'),
    ('Jurnal & Absensi', 'jurnal', 'delete', 'Aksi: Hapus Jurnal', 'Menghapus entri jurnal'),
    ('Jurnal & Absensi', 'jurnal', 'export', 'Aksi: Export Jurnal', 'Mengunduh laporan jurnal ke Excel'),

    ('Jurnal & Absensi', 'absensi', 'view', 'Lihat Absensi', 'Melihat status absensi siswa'),
    ('Jurnal & Absensi', 'absensi', 'take', 'Lakukan Absensi', 'Membuka sesi absensi dan mengisi kehadiran'),
    ('Jurnal & Absensi', 'absensi', 'finalize', 'Simpan Akhir (Final)', 'Menyimpan absensi sebagai data resmi'),
    ('Jurnal & Absensi', 'absensi', 'save_draft', 'Buka Kunci / Edit', 'Mengubah data absensi yang sudah dikunci'),
    ('Jurnal & Absensi', 'absensi', 'refresh_ketidakhadiran', 'Sinkron Data Izin', 'Mengambil otomatis data dari modul ketidakhadiran'),
    ('Jurnal & Absensi', 'absensi', 'export', 'Export Absensi', 'Mengunduh laporan absensi ke Excel'),

    ('Jurnal & Absensi', 'piket', 'view', 'Lihat Laporan Piket', 'Melihat daftar laporan piket'),
    ('Jurnal & Absensi', 'piket', 'create', 'Buat Laporan Piket', 'Membuat laporan piket baru'),
    ('Jurnal & Absensi', 'piket', 'edit', 'Edit Laporan', 'Mengubah laporan piket'),
    ('Jurnal & Absensi', 'piket', 'delete', 'Hapus Laporan', 'Menghapus laporan piket'),

    -- Akademik
    ('Akademik', 'nilai', 'view', 'Aksi: Lihat Nilai', 'Melihat daftar nilai siswa'),
    ('Akademik', 'nilai', 'input', 'Aksi: Input/Simpan Nilai', 'Mengisi dan menyimpan skor nilai'),
    ('Akademik', 'nilai', 'config', 'Aksi: Atur Bobot', 'Mengatur rasio bobot nilai rapor'),
    ('Akademik', 'nilai', 'add_materi', 'Aksi: Tambah Materi (SUM)', 'Menambah kolom materi/sumatif baru'),
    ('Akademik', 'nilai', 'delete_materi', 'Aksi: Hapus Materi (SUM)', 'Menghapus kolom materi/sumatif'),
    ('Akademik', 'nilai', 'import', 'Aksi: Import Nilai Excel', 'Upload nilai massal via Excel'),
    ('Akademik', 'nilai', 'export', 'Aksi: Export Nilai Excel', 'Download nilai ke Excel'),

    ('Akademik', 'lckh', 'view', 'View (Utama)', 'Melihat riwayat LCKH'),
    ('Akademik', 'lckh', 'create', 'Aksi: Buat LCKH', 'Membuat entri LCKH baru'),
    ('Akademik', 'lckh', 'print', 'Aksi: Cetak Form LCKH', 'Mencetak form LCKH untuk fisik'),
    ('Akademik', 'lckh_approval', 'view', 'View (Utama)', 'Akses ke dashboard persetujuan LCKH'),
    ('Akademik', 'lckh_approval', 'approve', 'Aksi: Setujui LCKH', 'Memberikan approval pada riwayat guru'),

    ('Akademik', 'dokumen_siswa', 'view', 'View (Utama)', 'Melihat kumpulan dokumen digital siswa'),
    ('Akademik', 'dokumen_siswa', 'upload', 'Aksi: Upload Dokumen', 'Mengunggah file dokumen baru'),
    ('Akademik', 'dokumen_siswa', 'delete', 'Aksi: Hapus Dokumen', 'Menghapus file dokumen'),

    -- Pengaturan Sistem
    ('Pengaturan User', 'pengaturan_users', 'view', 'View (Utama)', 'Akses ke dashboard manajemen user'),
    ('Pengaturan User', 'pengaturan_users', 'manage', 'Full Access (manage)', 'Akses penuh manajemen role dan user'),
    ('Pengaturan User', 'pengaturan_users', 'tab:user_data', 'Tab: Data User', 'Hak akses melihat tab Data & Status'),
    ('Pengaturan User', 'pengaturan_users', 'tab:page_access', 'Tab: Akses Menu', 'Hak akses melihat tab Akses Halaman (Navigasi)'),
    ('Pengaturan User', 'pengaturan_users', 'tab:role_permissions', 'Tab: Izin Role', 'Hak akses melihat tab Izin Role & Fungsi'),
    ('Pengaturan User', 'pengaturan_users', 'tab:bulk_replace', 'Tab: Ganti Massal', 'Hak akses melihat tab Ganti Data Massal')

ON CONFLICT (resource, action) DO UPDATE 
SET 
    category = EXCLUDED.category,
    label = EXCLUDED.label,
    description = EXCLUDED.description;
