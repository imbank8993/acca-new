# Database Scripts & Migrations

Folder ini memuat seluruh skrip skema SQL, migrasi DDL/DML, serta dump database untuk proyek ACCA.

## Consolidation Log (Penggabungan folder `sql/` ke `database/`)

Berikut adalah hasil penggabungan folder legacy `sql/` ke dalam `database/`:

| Nama File Asal (`sql/`) | Status Perbandingan | Keputusan |
| :--- | :--- | :--- |
| `20260205_create_academic_upload.sql` | Berkas Baru | Dipindahkan ke `database/20260205_create_academic_upload.sql` |
| `20260205_create_laporan_piket.sql` | Berkas Baru | Dipindahkan ke `database/20260205_create_laporan_piket.sql` |
| `20260205_create_testimonials.sql` | Berkas Baru | Dipindahkan ke `database/20260205_create_testimonials.sql` |
| `20260206_update_laporan_piket.sql` | Berkas Baru | Dipindahkan ke `database/20260206_update_laporan_piket.sql` |
| `20260213_user_monitoring.sql` | Berkas Baru | Dipindahkan ke `database/20260213_user_monitoring.sql` |
| `20260218_create_student_docs.sql` | Berkas Baru | Dipindahkan ke `database/20260218_create_student_docs.sql` |
| `20260219_add_category_to_docs.sql` | Berkas Baru | Dipindahkan ke `database/20260219_add_category_to_docs.sql` |
| `20260219_add_fk_dok_siswa.sql` | Berkas Baru | Dipindahkan ke `database/20260219_add_fk_dok_siswa.sql` |
| `20260219_add_fk_dok_siswa_quoted.sql` | Berkas Baru | Dipindahkan ke `database/20260219_add_fk_dok_siswa_quoted.sql` |
| `20260219_reset_dokumen_siswa.sql` | Berkas Baru | Dipindahkan ke `database/20260219_reset_dokumen_siswa.sql` |
| `20260219_reset_dokumen_siswa_no_fk.sql` | Berkas Baru | Dipindahkan ke `database/20260219_reset_dokumen_siswa_no_fk.sql` |
| `20260223_add_personal_documents_page.sql` | Berkas Baru | Dipindahkan ke `database/20260223_add_personal_documents_page.sql` |
| `20260402_fix_personal_docs_rls.sql` | Berkas Baru | Dipindahkan ke `database/20260402_fix_personal_docs_rls.sql` |
| `20260402_personal_docs_permissions.sql` | Berkas Baru | Dipindahkan ke `database/20260402_personal_docs_permissions.sql` |
| `20260412_um_lock_kelas.sql` | Berkas Baru | Dipindahkan ke `database/20260412_um_lock_kelas.sql` |
| `20260518_add_nip_nisn_to_uploaded_documents.sql` | Berkas Baru | Dipindahkan ke `database/20260518_add_nip_nisn_to_uploaded_documents.sql` |
| `add_absensi_rekap_lock.sql` | Berkas Baru | Dipindahkan ke `database/add_absensi_rekap_lock.sql` |
| `add_last_location.sql` | Berkas Baru | Dipindahkan ke `database/add_last_location.sql` |
| `add_rekam_medik_columns.sql` | Berkas Baru | Dipindahkan ke `database/add_rekam_medik_columns.sql` |
| `clear_users_for_reimport.sql` | Berkas Baru | Dipindahkan ke `database/clear_users_for_reimport.sql` |
| `create_catatan_keuangan.sql` | Berkas Baru | Dipindahkan ke `database/create_catatan_keuangan.sql` |
| `create_custom_forms.sql` | Berkas Baru | Dipindahkan ke `database/create_custom_forms.sql` |
| `create_fitur_akademik.sql` | Berkas Baru | Dipindahkan ke `database/create_fitur_akademik.sql` |
| `create_mapel_kelas.sql` | Berkas Baru | Dipindahkan ke `database/create_mapel_kelas.sql` |
| `create_master_mapel_kelas.sql` | Berkas Baru | Dipindahkan ke `database/create_master_mapel_kelas.sql` |
| `create_master_mapel_kelas_v2.sql` | Berkas Baru | Dipindahkan ke `database/create_master_mapel_kelas_v2.sql` |
| `create_pengumuman.sql` | Berkas Baru | Dipindahkan ke `database/create_pengumuman.sql` |
| `create_ujian_madrasah.sql` | Berkas Baru | Dipindahkan ke `database/create_ujian_madrasah.sql` |
| `e-supervisi-migration.sql` | Berkas Baru | Dipindahkan ke `database/e-supervisi-migration.sql` |
| `e-supervisi-unggahan.sql` | Berkas Baru | Dipindahkan ke `database/e-supervisi-unggahan.sql` |
| `update_ujian_madrasah_v2.sql` | Berkas Baru | Dipindahkan ke `database/update_ujian_madrasah_v2.sql` |
