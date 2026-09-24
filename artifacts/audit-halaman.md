# Matriks pemeriksaan seluruh halaman ACCA

Pendamping [laporan utama](<D:/acca-new/artifacts/AG-audit-lengkap-backend-frontend-keamanan.md>). Seluruh baris merupakan pemetaan statis kode/import/API dan daftar acceptance test. **Tidak ada baris yang berarti seluruh interaksi UI sudah lulus.** Temuan yang dicantumkan memiliki bukti dalam laporan utama; halaman tanpa temuan tetap memerlukan uji runtime.

## /absensi

- Sumber: [apps/web/app/(dashboard)/absensi/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/absensi/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/absensi/view.tsx](<D:/acca-new/apps/web/app/absensi/view.tsx>), [apps/web/app/absensi/components/ExportModal.tsx](<D:/acca-new/apps/web/app/absensi/components/ExportModal.tsx>), [apps/web/app/absensi/components/CatatanSiswaModal.tsx](<D:/acca-new/apps/web/app/absensi/components/CatatanSiswaModal.tsx>), [apps/web/app/absensi/components/KeteranganModal.tsx](<D:/acca-new/apps/web/app/absensi/components/KeteranganModal.tsx>).
- Referensi API terdeteksi: `/api/site-settings`, `/api/auth/me`, `/api/jadwal`, `/api/scopes`, `/api/master/guru`, `/api/absensi/sesi`, `/api/absensi/detail`, `/api/siswa/`, `/api/ketidakhadiran`, `/api/catatan-siswa`, `/api/absensi/export`, `/api/master/kelas`, `/api/absensi/classes`, `/api/catatan-siswa/`.
- Temuan terkait: belum ada temuan spesifik terkonfirmasi pada putaran ini; tetap terdampak autentikasi bersama A04 sesuai sesi.
- Skenario wajib: Uji sesi guru sendiri/lain, input hadir-izin-sakit, simpan ulang tanpa duplikasi, pergantian tanggal dan ekspor; pastikan relasi kelas diperiksa backend.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /agenda-madrasah

- Sumber: [apps/web/app/(dashboard)/agenda-madrasah/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/agenda-madrasah/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/agenda-madrasah/view.tsx](<D:/acca-new/apps/web/app/agenda-madrasah/view.tsx>), [apps/web/app/agenda-madrasah/tabs/KalenderAgendaTab.tsx](<D:/acca-new/apps/web/app/agenda-madrasah/tabs/KalenderAgendaTab.tsx>), [apps/web/app/agenda-madrasah/components/AgendaDisplayView.tsx](<D:/acca-new/apps/web/app/agenda-madrasah/components/AgendaDisplayView.tsx>), [apps/web/app/agenda-madrasah/tabs/KelolaAgendaTab.tsx](<D:/acca-new/apps/web/app/agenda-madrasah/tabs/KelolaAgendaTab.tsx>), [apps/web/app/agenda-madrasah/tabs/LiburAgendaTab.tsx](<D:/acca-new/apps/web/app/agenda-madrasah/tabs/LiburAgendaTab.tsx>), [apps/web/app/agenda-madrasah/tabs/LiburTab.tsx](<D:/acca-new/apps/web/app/agenda-madrasah/tabs/LiburTab.tsx>).
- Referensi API terdeteksi: `/api/agenda-madrasah`, `/api/settings/libur`, `/api/agenda-madrasah/kategori`, `/api/agenda-madrasah/foto`, `/api/master/waktu`, `/api/master/kelas`.
- Temuan terkait: belum ada temuan spesifik terkonfirmasi pada putaran ini; tetap terdampak autentikasi bersama A04 sesuai sesi.
- Skenario wajib: Uji agenda publik vs internal, izin tambah/edit/hapus, unggah foto, hari libur dan perubahan urutan; role baca tidak boleh menulis.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /anak/[nisn]

- Sumber: [apps/web/app/(dashboard)/anak/[nisn]/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/anak/[nisn]/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/(dashboard)/anak/[nisn]/components/DetailAnakClient.tsx](<D:/acca-new/apps/web/app/(dashboard)/anak/[nisn]/components/DetailAnakClient.tsx>), [apps/web/app/(dashboard)/anak/[nisn]/tabs/ProfilTab.tsx](<D:/acca-new/apps/web/app/(dashboard)/anak/[nisn]/tabs/ProfilTab.tsx>), [apps/web/app/(dashboard)/anak/[nisn]/tabs/KehadiranTab.tsx](<D:/acca-new/apps/web/app/(dashboard)/anak/[nisn]/tabs/KehadiranTab.tsx>), [apps/web/app/(dashboard)/anak/[nisn]/tabs/NilaiTab.tsx](<D:/acca-new/apps/web/app/(dashboard)/anak/[nisn]/tabs/NilaiTab.tsx>).
- Referensi API terdeteksi: tidak ditemukan literal /api; periksa akses server, helper bersama atau URL dinamis.
- Temuan terkait: A11 (P1).
- Skenario wajib: Uji NISN anak terhubung dan anak lain, data nilai/absensi, relasi yang dicabut saat sesi masih aktif.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /bank-data

- Sumber: [apps/web/app/(dashboard)/bank-data/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/bank-data/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/bank-data/view.tsx](<D:/acca-new/apps/web/app/bank-data/view.tsx>), [apps/web/app/bank-data/components/ExportModal.tsx](<D:/acca-new/apps/web/app/bank-data/components/ExportModal.tsx>), [apps/web/app/bank-data/types.ts](<D:/acca-new/apps/web/app/bank-data/types.ts>), [apps/web/app/bank-data/tabs/RiwayatTab.tsx](<D:/acca-new/apps/web/app/bank-data/tabs/RiwayatTab.tsx>), [apps/web/app/bank-data/tabs/PengaturanTab.tsx](<D:/acca-new/apps/web/app/bank-data/tabs/PengaturanTab.tsx>).
- Referensi API terdeteksi: `/api/bank-data`, `/api/master/kelas`, `/api/bank-data/log`, `/api/admin/capabilities`, `/api/bank-data/config`, `/api/admin/users`.
- Temuan terkait: A16 (P1), A18 (P1).
- Skenario wajib: Uji katalog, kolom sensitif, dataset nonaktif, preview, XLSX nyata, log ekspor dan perubahan konfigurasi; lihat A16/A18.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /bimbingan-konseling

- Sumber: [apps/web/app/(dashboard)/bimbingan-konseling/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/bimbingan-konseling/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/bimbingan-konseling/view.tsx](<D:/acca-new/apps/web/app/bimbingan-konseling/view.tsx>).
- Referensi API terdeteksi: `/api/master/kelas`, `/api/catatan-siswa`, `/api/catatan-siswa/`.
- Temuan terkait: belum ada temuan spesifik terkonfirmasi pada putaran ini; tetap terdampak autentikasi bersama A04 sesuai sesi.
- Skenario wajib: Uji pembacaan catatan hanya oleh wali/guru asuh/petugas yang sah, tulis tindak lanjut, ID siswa lain, dan pembatasan lampiran.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /catatan-keuangan

- Sumber: [apps/web/app/(dashboard)/catatan-keuangan/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/catatan-keuangan/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/catatan-keuangan/view.tsx](<D:/acca-new/apps/web/app/catatan-keuangan/view.tsx>).
- Referensi API terdeteksi: `/api/master/guru`, `/api/catatan-keuangan`.
- Temuan terkait: A20 (P1).
- Skenario wajib: Uji guru hanya catatannya, nominal negatif/kosong, status penggantian khusus petugas, tanggal dan penghapusan lintas pemilik.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /dashboard

- Sumber: [apps/web/app/(dashboard)/dashboard/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/dashboard/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/(dashboard)/dashboard/DashboardContent.tsx](<D:/acca-new/apps/web/app/(dashboard)/dashboard/DashboardContent.tsx>), [apps/web/app/(dashboard)/dashboard/DashboardCharts.tsx](<D:/acca-new/apps/web/app/(dashboard)/dashboard/DashboardCharts.tsx>), [apps/web/app/(dashboard)/dashboard/ParentDashboard.tsx](<D:/acca-new/apps/web/app/(dashboard)/dashboard/ParentDashboard.tsx>).
- Referensi API terdeteksi: `/api/dashboard/summary`, `/api/agenda-madrasah`, `/api/admin/dashboard-charts`, `/api/jadwal`, `/api/settings/jadwal-piket`, `/api/ketidakhadiran/log/guru-asuh`, `/api/pengumuman`, `/api/ekskul/siswa`, `/api/tugas-siswa`, `/api/admin/dashboard-stats`, `/api/orangtua/anak`.
- Temuan terkait: A10 (P1), A22 (P2).
- Skenario wajib: Uji ringkasan setiap role, pengumuman target role, rich text berbahaya, data kosong dan backend gagal; angka gagal tidak boleh berubah menjadi nol sukses.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /dokumen

- Sumber: [apps/web/app/(dashboard)/dokumen/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/dokumen/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/dokumen/view.tsx](<D:/acca-new/apps/web/app/dokumen/view.tsx>), [apps/web/app/dokumen/tabs/PersonalDocumentsTab.tsx](<D:/acca-new/apps/web/app/dokumen/tabs/PersonalDocumentsTab.tsx>), [apps/web/app/dokumen/tabs/UnggahDokumenTab.tsx](<D:/acca-new/apps/web/app/dokumen/tabs/UnggahDokumenTab.tsx>), [apps/web/app/dokumen/tabs/ManageDokumenTab.tsx](<D:/acca-new/apps/web/app/dokumen/tabs/ManageDokumenTab.tsx>).
- Referensi API terdeteksi: `/api/site-settings`, `/api/personal/documents/download/folder`, `/api/personal/folders`, `/api/personal/documents`, `/api/personal/documents/move`, `/api/personal/documents/share/revoke`, `/api/personal/folders/share/revoke`, `/api/personal/documents/delete`, `/api/personal/folders/delete`, `/api/personal/documents/download/batch`, `/api/personal/documents/`, `/api/upload-categories`, `/api/uploaded-documents`, `/api/upload`, `/api/admin/bulk-upload-dokumen`, `/api/admin/bulk-upload-dokumen/delete`, `/api/pdf-proxy`, `/api/upload-categories/`.
- Temuan terkait: A02 (P1), A05 (P1), A06 (P1), A19 (P1), A24 (P2).
- Skenario wajib: Uji folder pribadi/bagikan/cabut akses, unggah/hapus/pindah, unduh batch, nama file duplikat, backend gagal sebagian dan pembatasan pemilik.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /e-supervisi

- Sumber: [apps/web/app/(dashboard)/e-supervisi/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/e-supervisi/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/e-supervisi/view.tsx](<D:/acca-new/apps/web/app/e-supervisi/view.tsx>).
- Referensi API terdeteksi: `/api/e-supervisi/tahun-ajaran`.
- Temuan terkait: A05 (P1), A14 (P1).
- Skenario wajib: Uji guru vs supervisor vs pengelola, penugasan lain, nilai dan metadata penilai, unggah dokumen, rekap dan cetak.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /ekstrakurikuler

- Sumber: [apps/web/app/(dashboard)/ekstrakurikuler/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/ekstrakurikuler/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/ekstrakurikuler/view.tsx](<D:/acca-new/apps/web/app/ekstrakurikuler/view.tsx>).
- Referensi API terdeteksi: `/api/ekskul/pembina`, `/api/ekskul`, `/api/ekskul/siswa`, `/api/ekskul/pertemuan`, `/api/ekskul/submission`, `/api/ekskul/absensi`, `/api/upload`, `/api/ekskul/submission/pdf`, `/api/ekskul/approval`.
- Temuan terkait: belum ada temuan spesifik terkonfirmasi pada putaran ini; tetap terdampak autentikasi bersama A04 sesuai sesi.
- Skenario wajib: Uji pembina hanya ekskulnya, siswa hanya keanggotaannya, absensi, perubahan pembina, persetujuan dan pembayaran laporan.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /form/builder

- Sumber: [apps/web/app/(dashboard)/form/builder/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/form/builder/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/form/builder/view.tsx](<D:/acca-new/apps/web/app/form/builder/view.tsx>), [apps/web/app/form/types.ts](<D:/acca-new/apps/web/app/form/types.ts>), [apps/web/app/form/field-registry.ts](<D:/acca-new/apps/web/app/form/field-registry.ts>), [apps/web/app/form/builder/components/FieldPalette.tsx](<D:/acca-new/apps/web/app/form/builder/components/FieldPalette.tsx>), [apps/web/app/form/builder/components/FormCanvas.tsx](<D:/acca-new/apps/web/app/form/builder/components/FormCanvas.tsx>), [apps/web/app/form/builder/components/CanvasField.tsx](<D:/acca-new/apps/web/app/form/builder/components/CanvasField.tsx>), [apps/web/app/form/builder/components/SettingsPanel.tsx](<D:/acca-new/apps/web/app/form/builder/components/SettingsPanel.tsx>).
- Referensi API terdeteksi: `/api/forms/`, `/api/forms`, `/api/upload`, `/api/forms/dynamic-options`.
- Temuan terkait: A01 (P1).
- Skenario wajib: Uji pemilik/pengelola form, draft/publik/privat, akses responses, validasi pertanyaan wajib, duplikasi submit, kuota dan dua submit bersamaan.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /form

- Sumber: [apps/web/app/(dashboard)/form/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/form/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/form/view.tsx](<D:/acca-new/apps/web/app/form/view.tsx>).
- Referensi API terdeteksi: `/api/forms`, `/api/forms/`.
- Temuan terkait: A01 (P1).
- Skenario wajib: Uji pemilik/pengelola form, draft/publik/privat, akses responses, validasi pertanyaan wajib, duplikasi submit, kuota dan dua submit bersamaan.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /form/responses

- Sumber: [apps/web/app/(dashboard)/form/responses/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/form/responses/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/form/responses/view.tsx](<D:/acca-new/apps/web/app/form/responses/view.tsx>), [apps/web/app/form/responses/tabs/SeleksiTab.tsx](<D:/acca-new/apps/web/app/form/responses/tabs/SeleksiTab.tsx>).
- Referensi API terdeteksi: `/api/forms/`.
- Temuan terkait: A01 (P1).
- Skenario wajib: Uji pemilik/pengelola form, draft/publik/privat, akses responses, validasi pertanyaan wajib, duplikasi submit, kuota dan dua submit bersamaan.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /guru-asuh

- Sumber: [apps/web/app/(dashboard)/guru-asuh/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/guru-asuh/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/guru-asuh/view.tsx](<D:/acca-new/apps/web/app/guru-asuh/view.tsx>), [apps/web/app/guru-asuh/tabs/GuruAsuhTabKehadiran.tsx](<D:/acca-new/apps/web/app/guru-asuh/tabs/GuruAsuhTabKehadiran.tsx>), [apps/web/app/ketidakhadiran/log-components/HistorySiswaModal.tsx](<D:/acca-new/apps/web/app/ketidakhadiran/log-components/HistorySiswaModal.tsx>), [apps/web/app/guru-asuh/tabs/GuruAsuhTabPenilaian.tsx](<D:/acca-new/apps/web/app/guru-asuh/tabs/GuruAsuhTabPenilaian.tsx>), [apps/web/app/guru-asuh/tabs/GuruAsuhTabKlaim.tsx](<D:/acca-new/apps/web/app/guru-asuh/tabs/GuruAsuhTabKlaim.tsx>), [apps/web/app/guru-asuh/components/GuruAsuhForm.tsx](<D:/acca-new/apps/web/app/guru-asuh/components/GuruAsuhForm.tsx>), [apps/web/app/guru-asuh/tabs/GuruAsuhTabLaporan.tsx](<D:/acca-new/apps/web/app/guru-asuh/tabs/GuruAsuhTabLaporan.tsx>), [apps/web/app/guru-asuh/tabs/GuruAsuhTabApproval.tsx](<D:/acca-new/apps/web/app/guru-asuh/tabs/GuruAsuhTabApproval.tsx>), [apps/web/app/guru-asuh/tabs/GuruAsuhTabKokurikuler.tsx](<D:/acca-new/apps/web/app/guru-asuh/tabs/GuruAsuhTabKokurikuler.tsx>), [apps/web/app/guru-asuh/tabs/GuruAsuhTabEkskul.tsx](<D:/acca-new/apps/web/app/guru-asuh/tabs/GuruAsuhTabEkskul.tsx>).
- Referensi API terdeteksi: `/api/ketidakhadiran/log/guru-asuh`, `/api/ketidakhadiran/log/siswa/`, `/api/nilai/siswa`, `/api/settings/guru-asuh`, `/api/settings/guru-asuh/bulk-copy`, `/api/settings/siswa-kelas`, `/api/guru-asuh/laporan`, `/api/guru-asuh/laporan-submission`, `/api/upload`, `/api/guru-asuh/laporan-submission/preview`, `/api/guru-asuh/laporan-submission/pdf`, `/api/guru-asuh/laporan-submission/approve`, `/api/guru-asuh/kokurikuler`, `/api/kokurikuler/siswa`, `/api/guru-asuh/ekskul`.
- Temuan terkait: belum ada temuan spesifik terkonfirmasi pada putaran ini; tetap terdampak autentikasi bersama A04 sesuai sesi.
- Skenario wajib: Uji hanya anak asuh aktif pada periode terkait, penggantian guru, laporan/approval/pembayaran, data lampiran dan akses verifikasi publik minimal.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /informasi/kelola

- Sumber: [apps/web/app/(dashboard)/informasi/kelola/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/informasi/kelola/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/informasi/kelola/view.tsx](<D:/acca-new/apps/web/app/informasi/kelola/view.tsx>), [apps/web/app/informasi/tabs/KelolaInformasiTab.tsx](<D:/acca-new/apps/web/app/informasi/tabs/KelolaInformasiTab.tsx>), [apps/web/app/informasi/tabs/KelolaPengumumanTab.tsx](<D:/acca-new/apps/web/app/informasi/tabs/KelolaPengumumanTab.tsx>).
- Referensi API terdeteksi: `/api/informasi-akademik`, `/api/upload`, `/api/storage/upload`, `/api/pengumuman`, `/api/pengumuman/`.
- Temuan terkait: A10 (P1), A22 (P2).
- Skenario wajib: Uji hak kelola fitur, target penerima, link bagikan kadaluarsa/dicabut, HTML konten, unggahan dan pencabutan akses file.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /informasi

- Sumber: [apps/web/app/(dashboard)/informasi/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/informasi/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/informasi/view.tsx](<D:/acca-new/apps/web/app/informasi/view.tsx>), [apps/web/app/informasi/components/ShareInformasiModal.tsx](<D:/acca-new/apps/web/app/informasi/components/ShareInformasiModal.tsx>).
- Referensi API terdeteksi: `/api/informasi-akademik`, `/api/informasi-akademik/share`.
- Temuan terkait: A10 (P1), A22 (P2).
- Skenario wajib: Uji hak kelola fitur, target penerima, link bagikan kadaluarsa/dicabut, HTML konten, unggahan dan pencabutan akses file.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /izin-guru

- Sumber: [apps/web/app/(dashboard)/izin-guru/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/izin-guru/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/izin-guru/view.tsx](<D:/acca-new/apps/web/app/izin-guru/view.tsx>), [apps/web/app/izin-guru/components/AddIzinModal.tsx](<D:/acca-new/apps/web/app/izin-guru/components/AddIzinModal.tsx>), [apps/web/app/izin-guru/components/AddDinasLuarModal.tsx](<D:/acca-new/apps/web/app/izin-guru/components/AddDinasLuarModal.tsx>), [apps/web/app/izin-guru/components/ApprovalModal.tsx](<D:/acca-new/apps/web/app/izin-guru/components/ApprovalModal.tsx>), [apps/web/app/izin-guru/components/StatusBadge.tsx](<D:/acca-new/apps/web/app/izin-guru/components/StatusBadge.tsx>), [apps/web/app/izin-guru/tabs/TabSemuaIzin.tsx](<D:/acca-new/apps/web/app/izin-guru/tabs/TabSemuaIzin.tsx>), [apps/web/app/izin-guru/components/EditIzinModal.tsx](<D:/acca-new/apps/web/app/izin-guru/components/EditIzinModal.tsx>), [apps/web/app/izin-guru/components/DetailIzinModal.tsx](<D:/acca-new/apps/web/app/izin-guru/components/DetailIzinModal.tsx>), [apps/web/app/izin-guru/components/PilihJenisModal.tsx](<D:/acca-new/apps/web/app/izin-guru/components/PilihJenisModal.tsx>).
- Referensi API terdeteksi: `/api/auth/me`, `/api/izin-guru`, `/api/izin-guru/`, `/api/upload`, `/api/site-settings`.
- Temuan terkait: belum ada temuan spesifik terkonfirmasi pada putaran ini; tetap terdampak autentikasi bersama A04 sesuai sesi.
- Skenario wajib: Uji pemohon hanya pengajuannya, approver sesuai peran, perubahan status bersamaan, rentang tanggal, pembatalan dan lampiran.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /jadwal

- Sumber: [apps/web/app/(dashboard)/jadwal/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/jadwal/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/jadwal/view.tsx](<D:/acca-new/apps/web/app/jadwal/view.tsx>), [apps/web/app/jadwal/components/JadwalLengkapModal.tsx](<D:/acca-new/apps/web/app/jadwal/components/JadwalLengkapModal.tsx>), [apps/web/app/jadwal/components/TukarJadwalModal.tsx](<D:/acca-new/apps/web/app/jadwal/components/TukarJadwalModal.tsx>), [apps/web/app/jadwal/tabs/JadwalPbmTab.tsx](<D:/acca-new/apps/web/app/jadwal/tabs/JadwalPbmTab.tsx>), [apps/web/app/jadwal/tabs/parts.tsx](<D:/acca-new/apps/web/app/jadwal/tabs/parts.tsx>), [apps/web/app/jadwal/tabs/JadwalPiketTab.tsx](<D:/acca-new/apps/web/app/jadwal/tabs/JadwalPiketTab.tsx>), [apps/web/app/jadwal/tabs/GeneratePbmTab.tsx](<D:/acca-new/apps/web/app/jadwal/tabs/GeneratePbmTab.tsx>), [apps/web/app/jadwal/lib/parseJadwalExcel.ts](<D:/acca-new/apps/web/app/jadwal/lib/parseJadwalExcel.ts>), [apps/web/app/jadwal/tabs/GeneratePiketTab.tsx](<D:/acca-new/apps/web/app/jadwal/tabs/GeneratePiketTab.tsx>), [apps/web/app/jadwal/tabs/TukarJadwalTab.tsx](<D:/acca-new/apps/web/app/jadwal/tabs/TukarJadwalTab.tsx>), [apps/web/app/jadwal/tabs/JadwalSiswaTab.tsx](<D:/acca-new/apps/web/app/jadwal/tabs/JadwalSiswaTab.tsx>), [apps/web/app/jadwal/tabs/JadwalSiswaPbmTab.tsx](<D:/acca-new/apps/web/app/jadwal/tabs/JadwalSiswaPbmTab.tsx>), [apps/web/app/jadwal/tabs/JadwalSiswaPiketTab.tsx](<D:/acca-new/apps/web/app/jadwal/tabs/JadwalSiswaPiketTab.tsx>), [apps/web/app/jadwal/OrangTuaWrapper.tsx](<D:/acca-new/apps/web/app/jadwal/OrangTuaWrapper.tsx>).
- Referensi API terdeteksi: `/api/jadwal/izin-saya`, `/api/settings/libur`, `/api/admin/tahun-ajaran`, `/api/settings/siswa-kelas`, `/api/jadwal`, `/api/settings/jadwal-piket`, `/api/tukar-jadwal`, `/api/settings/jadwal-guru`, `/api/master/waktu`, `/api/master/kelas`, `/api/tukar-jadwal/slots`, `/api/tukar-jadwal/guru`, `/api/settings/guru-mapel`, `/api/jadwal/save`, `/api/jadwal/delete-dates`, `/api/jadwal/move-date`, `/api/jadwal/generate`, `/api/jadwal/delete-rows`, `/api/master/kode-guru`, `/api/settings/jadwal-piket/import`, `/api/tukar-jadwal/`, `/api/orangtua/anak`.
- Temuan terkait: belum ada temuan spesifik terkonfirmasi pada putaran ini; tetap terdampak autentikasi bersama A04 sesuai sesi.
- Skenario wajib: Uji versi berlaku per tanggal, jadwal guru/orang tua, generate/save/move/delete, bentrok slot, tukar jadwal dua pihak dan rollback gagal.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /jurnal

- Sumber: [apps/web/app/(dashboard)/jurnal/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/jurnal/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/jurnal/view.tsx](<D:/acca-new/apps/web/app/jurnal/view.tsx>), [apps/web/app/jurnal/components/JournalModal.tsx](<D:/acca-new/apps/web/app/jurnal/components/JournalModal.tsx>), [apps/web/app/jurnal/types.ts](<D:/acca-new/apps/web/app/jurnal/types.ts>), [apps/web/app/jurnal/components/JurnalDetailModal.tsx](<D:/acca-new/apps/web/app/jurnal/components/JurnalDetailModal.tsx>), [apps/web/app/jurnal/components/AjukanBandingModal.tsx](<D:/acca-new/apps/web/app/jurnal/components/AjukanBandingModal.tsx>), [apps/web/app/jurnal/lib/bandingApi.ts](<D:/acca-new/apps/web/app/jurnal/lib/bandingApi.ts>), [apps/web/app/jurnal/components/JurnalHeader.tsx](<D:/acca-new/apps/web/app/jurnal/components/JurnalHeader.tsx>), [apps/web/app/jurnal/components/JurnalTable.tsx](<D:/acca-new/apps/web/app/jurnal/components/JurnalTable.tsx>), [apps/web/app/jurnal/components/JurnalCards.tsx](<D:/acca-new/apps/web/app/jurnal/components/JurnalCards.tsx>), [apps/web/app/jurnal/components/JurnalAdminPanel.tsx](<D:/acca-new/apps/web/app/jurnal/components/JurnalAdminPanel.tsx>), [apps/web/app/jurnal/components/JurnalLiburSection.tsx](<D:/acca-new/apps/web/app/jurnal/components/JurnalLiburSection.tsx>), [apps/web/app/agenda-madrasah/tabs/LiburTab.tsx](<D:/acca-new/apps/web/app/agenda-madrasah/tabs/LiburTab.tsx>), [apps/web/app/jurnal/hooks/useJurnal.ts](<D:/acca-new/apps/web/app/jurnal/hooks/useJurnal.ts>), [apps/web/app/jurnal/lib/exportUtils.ts](<D:/acca-new/apps/web/app/jurnal/lib/exportUtils.ts>), [apps/web/app/jurnal/banding/view.tsx](<D:/acca-new/apps/web/app/jurnal/banding/view.tsx>), [apps/web/app/jurnal/components/BandingTable.tsx](<D:/acca-new/apps/web/app/jurnal/components/BandingTable.tsx>), [apps/web/app/jurnal/components/BandingDetailModal.tsx](<D:/acca-new/apps/web/app/jurnal/components/BandingDetailModal.tsx>), [apps/web/app/jurnal/components/GenerateJurnalTab.tsx](<D:/acca-new/apps/web/app/jurnal/components/GenerateJurnalTab.tsx>), [apps/web/app/jurnal/input/view.tsx](<D:/acca-new/apps/web/app/jurnal/input/view.tsx>).
- Referensi API terdeteksi: `/api/sidebar-badges`, `/api/master/guru`, `/api/master/mapel`, `/api/master/kelas`, `/api/master/waktu`, `/api/settings/jadwal-guru`, `/api/master/dropdown`, `/api/jurnal/submit`, `/api/jurnal`, `/api/jurnal/banding`, `/api/jurnal/banding/`, `/api/jurnal/pengaturan`, `/api/settings/libur`, `/api/jurnal/pengaturan/generate-massal`, `/api/jurnal/pengaturan/delete-by-date`, `/api/jurnal/import`, `/api/admin/tahun-ajaran`, `/api/siswa/`, `/api/scopes`, `/api/laporan/jurnal-master`, `/api/jurnal/check-slot`.
- Temuan terkait: A03 (P1), A08 (P2).
- Skenario wajib: Uji pemilik slot, guru pengganti, edit materi/refleksi, placeholder hasil generate, banding, hari libur, operasi massal dan bentrok pembaruan.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /jurnal-banding

- Sumber: [apps/web/app/(dashboard)/jurnal-banding/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/jurnal-banding/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/jurnal/banding/view.tsx](<D:/acca-new/apps/web/app/jurnal/banding/view.tsx>), [apps/web/app/jurnal/components/BandingTable.tsx](<D:/acca-new/apps/web/app/jurnal/components/BandingTable.tsx>), [apps/web/app/jurnal/lib/bandingApi.ts](<D:/acca-new/apps/web/app/jurnal/lib/bandingApi.ts>), [apps/web/app/jurnal/components/BandingDetailModal.tsx](<D:/acca-new/apps/web/app/jurnal/components/BandingDetailModal.tsx>).
- Referensi API terdeteksi: `/api/jurnal/banding/`, `/api/jurnal/banding`.
- Temuan terkait: belum ada temuan spesifik terkonfirmasi pada putaran ini; tetap terdampak autentikasi bersama A04 sesuai sesi.
- Skenario wajib: Uji pemohon hanya jurnal sendiri, reviewer sah, ID banding orang lain, status berulang dan alasan kosong.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /ketidakhadiran

- Sumber: [apps/web/app/(dashboard)/ketidakhadiran/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/ketidakhadiran/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/ketidakhadiran/view.tsx](<D:/acca-new/apps/web/app/ketidakhadiran/view.tsx>), [apps/web/app/ketidakhadiran/tabs/InputDataTab.tsx](<D:/acca-new/apps/web/app/ketidakhadiran/tabs/InputDataTab.tsx>), [apps/web/app/ketidakhadiran/components/AddModal.tsx](<D:/acca-new/apps/web/app/ketidakhadiran/components/AddModal.tsx>), [apps/web/app/ketidakhadiran/components/StudentSelect.tsx](<D:/acca-new/apps/web/app/ketidakhadiran/components/StudentSelect.tsx>), [apps/web/app/ketidakhadiran/components/ImportModal.tsx](<D:/acca-new/apps/web/app/ketidakhadiran/components/ImportModal.tsx>), [apps/web/app/ketidakhadiran/components/EditModal.tsx](<D:/acca-new/apps/web/app/ketidakhadiran/components/EditModal.tsx>), [apps/web/app/ketidakhadiran/components/DeleteModal.tsx](<D:/acca-new/apps/web/app/ketidakhadiran/components/DeleteModal.tsx>), [apps/web/app/ketidakhadiran/components/PrintModal.tsx](<D:/acca-new/apps/web/app/ketidakhadiran/components/PrintModal.tsx>), [apps/web/app/ketidakhadiran/utils/PrintHelper.ts](<D:/acca-new/apps/web/app/ketidakhadiran/utils/PrintHelper.ts>), [apps/web/app/ketidakhadiran/utils/types.ts](<D:/acca-new/apps/web/app/ketidakhadiran/utils/types.ts>), [apps/web/app/ketidakhadiran/tabs/DaftarSuratTab.tsx](<D:/acca-new/apps/web/app/ketidakhadiran/tabs/DaftarSuratTab.tsx>), [apps/web/app/ketidakhadiran/tabs/KehadiranSiswaTab.tsx](<D:/acca-new/apps/web/app/ketidakhadiran/tabs/KehadiranSiswaTab.tsx>), [apps/web/app/ketidakhadiran/tabs/KetidakhadiranLogTab.tsx](<D:/acca-new/apps/web/app/ketidakhadiran/tabs/KetidakhadiranLogTab.tsx>), [apps/web/app/ketidakhadiran/log-components/KetidakhadiranTable.tsx](<D:/acca-new/apps/web/app/ketidakhadiran/log-components/KetidakhadiranTable.tsx>), [apps/web/app/ketidakhadiran/log-components/KetidakhadiranCards.tsx](<D:/acca-new/apps/web/app/ketidakhadiran/log-components/KetidakhadiranCards.tsx>), [apps/web/app/ketidakhadiran/tabs/RekapTab.tsx](<D:/acca-new/apps/web/app/ketidakhadiran/tabs/RekapTab.tsx>), [apps/web/app/ketidakhadiran/log-components/HistorySiswaModal.tsx](<D:/acca-new/apps/web/app/ketidakhadiran/log-components/HistorySiswaModal.tsx>).
- Referensi API terdeteksi: `/api/nilai`, `/api/auth/me`, `/api/master/kelas`, `/api/nilai/siswa/photos`, `/api/ketidakhadiran/notify-wa`, `/api/ketidakhadiran`, `/api/pdf-proxy`, `/api/ketidakhadiran/generate-letter`, `/api/ketidakhadiran/acca-letter/`, `/api/ketidakhadiran/acca-letter`, `/api/qrcode`, `/api/master/waktu`, `/api/upload`, `/api/ketidakhadiran/bulk`, `/api/siswa/`, `/api/settings/siswa-kelas`, `/api/ketidakhadiran/import`, `/api/ketidakhadiran/`, `/api/master/guru`, `/api/tugas-tambahan`, `/api/ketidakhadiran/generate-letter/route`, `/api/orangtua/anak`, `/api/ketidakhadiran/log/siswa/`, `/api/ketidakhadiran/log`, `/api/ketidakhadiran/rekap`.
- Temuan terkait: A05 (P1), A28 (P2).
- Skenario wajib: Uji batas kelas/wali/guru asuh, impor duplikat, surat izin, barcode publik, lampiran URL dan konsistensi rekap tanggal.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /keuangan

- Sumber: [apps/web/app/(dashboard)/keuangan/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/keuangan/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/keuangan/view.tsx](<D:/acca-new/apps/web/app/keuangan/view.tsx>), [apps/web/app/keuangan/tabs/KeuanganTabPengaturan.tsx](<D:/acca-new/apps/web/app/keuangan/tabs/KeuanganTabPengaturan.tsx>), [apps/web/app/keuangan/tabs/KeuanganTabPengajuan.tsx](<D:/acca-new/apps/web/app/keuangan/tabs/KeuanganTabPengajuan.tsx>), [apps/web/app/keuangan/tabs/KeuanganTabAntrean.tsx](<D:/acca-new/apps/web/app/keuangan/tabs/KeuanganTabAntrean.tsx>), [apps/web/app/keuangan/tabs/KeuanganTabPencairan.tsx](<D:/acca-new/apps/web/app/keuangan/tabs/KeuanganTabPencairan.tsx>), [apps/web/app/keuangan/tabs/KeuanganTabPagu.tsx](<D:/acca-new/apps/web/app/keuangan/tabs/KeuanganTabPagu.tsx>), [apps/web/app/keuangan/tabs/KeuanganTabMonitoring.tsx](<D:/acca-new/apps/web/app/keuangan/tabs/KeuanganTabMonitoring.tsx>).
- Referensi API terdeteksi: `/api/keuangan`, `/api/upload`.
- Temuan terkait: A20 (P1), A26 (P2).
- Skenario wajib: Uji PJ/KTU/kepala divisi/PPK/bendahara terpisah, transfer anggaran, approval dua kali, nota, nominal dan rollback perubahan multi-tabel.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /kinerja-guru

- Sumber: [apps/web/app/(dashboard)/kinerja-guru/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/kinerja-guru/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/kinerja-guru/view.tsx](<D:/acca-new/apps/web/app/kinerja-guru/view.tsx>), [apps/web/app/kinerja-guru/components/KinerjaGuruDetailModal.tsx](<D:/acca-new/apps/web/app/kinerja-guru/components/KinerjaGuruDetailModal.tsx>).
- Referensi API terdeteksi: `/api/admin/tahun-ajaran`, `/api/kinerja-guru`.
- Temuan terkait: belum ada temuan spesifik terkonfirmasi pada putaran ini; tetap terdampak autentikasi bersama A04 sesuai sesi.
- Skenario wajib: Uji periode lintas semester, filter guru, denominator hari efektif, tanggal yang diserialisasi dan akses di luar pemegang halaman.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /klinik

- Sumber: [apps/web/app/(dashboard)/klinik/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/klinik/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/klinik/view.tsx](<D:/acca-new/apps/web/app/klinik/view.tsx>), [apps/web/app/klinik/tabs/PengaturanTab.tsx](<D:/acca-new/apps/web/app/klinik/tabs/PengaturanTab.tsx>), [apps/web/app/klinik/components/CreateSlotModal.tsx](<D:/acca-new/apps/web/app/klinik/components/CreateSlotModal.tsx>), [apps/web/app/klinik/components/AdminSesiModal.tsx](<D:/acca-new/apps/web/app/klinik/components/AdminSesiModal.tsx>), [apps/web/app/klinik/components/AbsensiModal.tsx](<D:/acca-new/apps/web/app/klinik/components/AbsensiModal.tsx>), [apps/web/app/klinik/components/ReportModal.tsx](<D:/acca-new/apps/web/app/klinik/components/ReportModal.tsx>), [apps/web/app/klinik/components/ViewReportModal.tsx](<D:/acca-new/apps/web/app/klinik/components/ViewReportModal.tsx>), [apps/web/app/klinik/components/ParticipantsModal.tsx](<D:/acca-new/apps/web/app/klinik/components/ParticipantsModal.tsx>).
- Referensi API terdeteksi: `/api/klinik/route`, `/api/klinik`, `/api/auth/me`, `/api/admin/capabilities`, `/api/upload`, `/api/klinik/laporan/preview`, `/api/klinik/laporan/rekap/`, `/api/klinik/laporan/pdf`, `/api/admin/users`.
- Temuan terkait: belum ada temuan spesifik terkonfirmasi pada putaran ini; tetap terdampak autentikasi bersama A04 sesuai sesi.
- Skenario wajib: Uji guru/siswa/operator/capability, pemilihan peserta, bentrok jadwal, kuota, approve sesi/laporan, laporan rekap PDF dan akses peserta lain.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /kokurikuler

- Sumber: [apps/web/app/(dashboard)/kokurikuler/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/kokurikuler/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/kokurikuler/view.tsx](<D:/acca-new/apps/web/app/kokurikuler/view.tsx>), [apps/web/app/kokurikuler/siswa/view.tsx](<D:/acca-new/apps/web/app/kokurikuler/siswa/view.tsx>), [apps/web/app/kokurikuler/verifikasi/view.tsx](<D:/acca-new/apps/web/app/kokurikuler/verifikasi/view.tsx>), [apps/web/app/kokurikuler/admin/view.tsx](<D:/acca-new/apps/web/app/kokurikuler/admin/view.tsx>).
- Referensi API terdeteksi: `/api/tugas-tambahan`, `/api/orangtua/anak`, `/api/kokurikuler/master`, `/api/kokurikuler/siswa`, `/api/master/kelas`, `/api/kokurikuler/verifikasi`, `/api/kokurikuler/laporan`.
- Temuan terkait: belum ada temuan spesifik terkonfirmasi pada putaran ini; tetap terdampak autentikasi bersama A04 sesuai sesi.
- Skenario wajib: Uji log siswa sendiri, verifikasi pembina, data kelas lain, duplikasi log tanggal, master nonaktif dan rekap periode.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /layanan-ptsp

- Sumber: [apps/web/app/(dashboard)/layanan-ptsp/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/layanan-ptsp/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/layanan-ptsp/view.tsx](<D:/acca-new/apps/web/app/layanan-ptsp/view.tsx>), [apps/web/app/layanan-ptsp/components/PTSPClient.tsx](<D:/acca-new/apps/web/app/layanan-ptsp/components/PTSPClient.tsx>).
- Referensi API terdeteksi: `/api/ptsp`.
- Temuan terkait: A21 (P1), A23 (P2).
- Skenario wajib: Uji akses petugas vs siswa, tabel layanan allowlist, kolom pribadi, update/hapus status, lampiran, antrean WA dan typecheck; aplikasi eksternal tidak diuji.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /lckh

- Sumber: [apps/web/app/(dashboard)/lckh/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/lckh/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/lckh/view.tsx](<D:/acca-new/apps/web/app/lckh/view.tsx>).
- Referensi API terdeteksi: `/api/lckh/print/lembar-pengesahan`, `/api/lckh/periods`, `/api/lckh/submissions`, `/api/lckh/summary`, `/api/lckh/submissions/`, `/api/lckh/nilai-detail`.
- Temuan terkait: A07 (P2), A08 (P2), A15 (P1), A27 (P2).
- Skenario wajib: Uji ringkasan periode, pemilik submission, perubahan draft/final, status approval, cetak dan tanggal; manipulasi nip/id/status harus ditolak.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /lckh-approval

- Sumber: [apps/web/app/(dashboard)/lckh-approval/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/lckh-approval/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/lckh-approval/view.tsx](<D:/acca-new/apps/web/app/lckh-approval/view.tsx>).
- Referensi API terdeteksi: `/api/auth/me`, `/api/lckh/periods`, `/api/lckh/submissions`, `/api/lckh/approvals/`, `/api/tugas-tambahan`, `/api/lckh/summary`, `/api/lckh/nilai-detail`.
- Temuan terkait: A07 (P2), A15 (P1), A26 (P2), A27 (P2).
- Skenario wajib: Uji reviewer sesuai level, pengajuan orang lain, persetujuan bersamaan, kegagalan update status setelah approval dan ringkasan.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /master

- Sumber: [apps/web/app/(dashboard)/master/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/master/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/master/view.tsx](<D:/acca-new/apps/web/app/master/view.tsx>), [apps/web/app/master/tabs/SiswaTab.tsx](<D:/acca-new/apps/web/app/master/tabs/SiswaTab.tsx>), [apps/web/app/master/tabs/GuruTab.tsx](<D:/acca-new/apps/web/app/master/tabs/GuruTab.tsx>), [apps/web/app/master/tabs/PegawaiTab.tsx](<D:/acca-new/apps/web/app/master/tabs/PegawaiTab.tsx>), [apps/web/app/master/tabs/TendikTab.tsx](<D:/acca-new/apps/web/app/master/tabs/TendikTab.tsx>), [apps/web/app/master/tabs/KelasTab.tsx](<D:/acca-new/apps/web/app/master/tabs/KelasTab.tsx>), [apps/web/app/master/tabs/MapelTab.tsx](<D:/acca-new/apps/web/app/master/tabs/MapelTab.tsx>), [apps/web/app/master/tabs/WaktuTab.tsx](<D:/acca-new/apps/web/app/master/tabs/WaktuTab.tsx>), [apps/web/app/master/tabs/KodeGuruTab.tsx](<D:/acca-new/apps/web/app/master/tabs/KodeGuruTab.tsx>), [apps/web/app/master/tabs/TahunAjaranTab.tsx](<D:/acca-new/apps/web/app/master/tabs/TahunAjaranTab.tsx>), [apps/web/app/master/tabs/EkskulTab.tsx](<D:/acca-new/apps/web/app/master/tabs/EkskulTab.tsx>).
- Referensi API terdeteksi: `/api/master/students/card`, `/api/master/students`, `/api/master/students/bulk-status`, `/api/admin/tahun-ajaran`, `/api/qrcode`, `/api/master/guru`, `/api/master/guru/pindah`, `/api/master/kelas`, `/api/master/mapel`, `/api/master/waktu`, `/api/master/kode-guru`, `/api/ekskul`.
- Temuan terkait: belum ada temuan spesifik terkonfirmasi pada putaran ini; tetap terdampak autentikasi bersama A04 sesuai sesi.
- Skenario wajib: Uji read vs kolom sensitif, import, duplikasi NISN/NIP, relasi kelas dan penghapusan massal khusus admin.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /monitoring

- Sumber: [apps/web/app/(dashboard)/monitoring/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/monitoring/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/monitoring/view.tsx](<D:/acca-new/apps/web/app/monitoring/view.tsx>).
- Referensi API terdeteksi: `/api/monitoring/users`.
- Temuan terkait: belum ada temuan spesifik terkonfirmasi pada putaran ini; tetap terdampak autentikasi bersama A04 sesuai sesi.
- Skenario wajib: Uji role tanpa monitoring 403, pagination negatif/besar, data kosong, log dan penyamaran kolom sensitif.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /nilai

- Sumber: [apps/web/app/(dashboard)/nilai/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/nilai/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/nilai/view.tsx](<D:/acca-new/apps/web/app/nilai/view.tsx>), [apps/web/app/nilai/components/NilaiAdminPanel.tsx](<D:/acca-new/apps/web/app/nilai/components/NilaiAdminPanel.tsx>), [apps/web/app/nilai/components/SesiApresiasiModal.tsx](<D:/acca-new/apps/web/app/nilai/components/SesiApresiasiModal.tsx>), [apps/web/app/nilai/tabs/ApresiasiTab.tsx](<D:/acca-new/apps/web/app/nilai/tabs/ApresiasiTab.tsx>).
- Referensi API terdeteksi: `/api/scopes`, `/api/nilai`, `/api/nilai/apresiasi`, `/api/nilai/tagihan`, `/api/nilai/bobot`, `/api/nilai/admin`, `/api/nilai/guru-list`, `/api/nilai/filters`.
- Temuan terkait: A07 (P2), A11 (P1).
- Skenario wajib: Uji guru-mapel-kelas berizin, siswa lain, bobot total, nilai batas/rentang, impor duplikat dan semester.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /nilai-siswa

- Sumber: [apps/web/app/(dashboard)/nilai-siswa/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/nilai-siswa/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/nilai-siswa/view.tsx](<D:/acca-new/apps/web/app/nilai-siswa/view.tsx>).
- Referensi API terdeteksi: `/api/nilai/siswa/route`, `/api/nilai/siswa/photos`, `/api/orangtua/anak`, `/api/nilai/siswa/students/route`, `/api/nilai/siswa/students`, `/api/sidebar-badges/seen`, `/api/nilai/siswa`, `/api/nilai/siswa/apresiasi`.
- Temuan terkait: A07 (P2), A11 (P1).
- Skenario wajib: Uji siswa sendiri dan anak terhubung, NISN lain, bobot/periode/mapel serta ketepatan tanggal dan ringkasan.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /observasi-kelas

- Sumber: [apps/web/app/(dashboard)/observasi-kelas/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/observasi-kelas/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/observasi-kelas/view.tsx](<D:/acca-new/apps/web/app/observasi-kelas/view.tsx>).
- Referensi API terdeteksi: `/api/observasi-kelas`, `/api/observasi-kelas/`.
- Temuan terkait: A07 (P2).
- Skenario wajib: Uji identitas observer dari sesi, edit/hapus lintas observer sesuai kebijakan, field wajib, tanggal dan detail.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /pembayaran

- Sumber: [apps/web/app/(dashboard)/pembayaran/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/pembayaran/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/pembayaran/view.tsx](<D:/acca-new/apps/web/app/pembayaran/view.tsx>).
- Referensi API terdeteksi: `/api/auth/me`, `/api/guru-asuh/laporan-submission`, `/api/tarif-honor`, `/api/klinik`, `/api/ekskul/submission`, `/api/upload`, `/api/ekskul/submission/pembayaran`, `/api/guru-asuh/laporan-submission/pembayaran`.
- Temuan terkait: A15 (P1).
- Skenario wajib: Uji hanya petugas bayar, laporan disetujui, pembayaran ganda, nomor rekening, nominal dan konsistensi status.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /pengaturan-data

- Sumber: [apps/web/app/(dashboard)/pengaturan-data/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/pengaturan-data/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/pengaturan-data/view.tsx](<D:/acca-new/apps/web/app/pengaturan-data/view.tsx>), [apps/web/app/pengaturan-data/tabs/SiswaKelasTab.tsx](<D:/acca-new/apps/web/app/pengaturan-data/tabs/SiswaKelasTab.tsx>), [apps/web/app/pengaturan-data/tabs/EkskulSiswaTab.tsx](<D:/acca-new/apps/web/app/pengaturan-data/tabs/EkskulSiswaTab.tsx>), [apps/web/app/pengaturan-data/tabs/RelasiOrangtuaTab.tsx](<D:/acca-new/apps/web/app/pengaturan-data/tabs/RelasiOrangtuaTab.tsx>), [apps/web/app/pengaturan-data/tabs/GuruMapelTab.tsx](<D:/acca-new/apps/web/app/pengaturan-data/tabs/GuruMapelTab.tsx>), [apps/web/app/pengaturan-data/tabs/BulkReplaceTab.tsx](<D:/acca-new/apps/web/app/pengaturan-data/tabs/BulkReplaceTab.tsx>), [apps/web/app/pengaturan-data/tabs/DropdownTab.tsx](<D:/acca-new/apps/web/app/pengaturan-data/tabs/DropdownTab.tsx>).
- Referensi API terdeteksi: `/api/auth/me`, `/api/master/students`, `/api/master/kelas`, `/api/settings/siswa-kelas`, `/api/ekskul`, `/api/ekskul/siswa`, `/api/orangtua-siswa`, `/api/settings/guru-mapel`, `/api/master/guru`, `/api/master/mapel`, `/api/master/kode-guru`, `/api/reset-data/search`, `/api/reset-data/replace`, `/api/master-dropdown`, `/api/master-dropdown/column`.
- Temuan terkait: A03 (P1), A13 (P1).
- Skenario wajib: Uji izin per tab, mapping kelas/mapel/guru, impor, validasi periode, data referensi dan hak operasi massal jurnal.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /pengaturan-tugas

- Sumber: [apps/web/app/(dashboard)/pengaturan-tugas/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/pengaturan-tugas/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/pengaturan-tugas/view.tsx](<D:/acca-new/apps/web/app/pengaturan-tugas/view.tsx>), [apps/web/app/pengaturan-tugas/tabs/WaliKelasTab.tsx](<D:/acca-new/apps/web/app/pengaturan-tugas/tabs/WaliKelasTab.tsx>), [apps/web/app/pengaturan-tugas/tabs/GuruAsuhTab.tsx](<D:/acca-new/apps/web/app/pengaturan-tugas/tabs/GuruAsuhTab.tsx>), [apps/web/app/pengaturan-tugas/tabs/PlotingTugasTambahanTab.tsx](<D:/acca-new/apps/web/app/pengaturan-tugas/tabs/PlotingTugasTambahanTab.tsx>), [apps/web/app/pengaturan-tugas/tabs/EkskulTab.tsx](<D:/acca-new/apps/web/app/pengaturan-tugas/tabs/EkskulTab.tsx>).
- Referensi API terdeteksi: `/api/master/guru`, `/api/master/kelas`, `/api/settings/wali-kelas`, `/api/settings/siswa-kelas`, `/api/settings/guru-asuh`, `/api/tugas-tambahan`, `/api/admin/tahun-ajaran`, `/api/ekskul`, `/api/ekskul/pembina`.
- Temuan terkait: belum ada temuan spesifik terkonfirmasi pada putaran ini; tetap terdampak autentikasi bersama A04 sesuai sesi.
- Skenario wajib: Uji izin kelola vs guru pembaca, NIP lain, granted_role, periodisasi tugas dan dampak akses setelah pencabutan.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /pengaturan-umum

- Sumber: [apps/web/app/(dashboard)/pengaturan-umum/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/pengaturan-umum/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/pengaturan-umum/view.tsx](<D:/acca-new/apps/web/app/pengaturan-umum/view.tsx>), [apps/web/app/pengaturan-umum/tabs/ProfilSekolahTab.tsx](<D:/acca-new/apps/web/app/pengaturan-umum/tabs/ProfilSekolahTab.tsx>), [apps/web/app/pengaturan-umum/tabs/WhatsAppTab.tsx](<D:/acca-new/apps/web/app/pengaturan-umum/tabs/WhatsAppTab.tsx>), [apps/web/app/pengaturan-umum/tabs/TimezoneTab.tsx](<D:/acca-new/apps/web/app/pengaturan-umum/tabs/TimezoneTab.tsx>), [apps/web/app/pengaturan-umum/tabs/TemplateSuratTab.tsx](<D:/acca-new/apps/web/app/pengaturan-umum/tabs/TemplateSuratTab.tsx>), [apps/web/app/pengaturan-umum/tabs/FiturAccaTab.tsx](<D:/acca-new/apps/web/app/pengaturan-umum/tabs/FiturAccaTab.tsx>).
- Referensi API terdeteksi: `/api/profil-sekolah`, `/api/upload`, `/api/whatsapp/baileys/status`, `/api/whatsapp/baileys/logout`, `/api/site-settings`, `/api/whatsapp/test-text`, `/api/whatsapp/test-image`, `/api/surat/templates/route`, `/api/surat/templates`, `/api/surat/templates/`, `/api/pdf-proxy`, `/api/fitur-akademik`.
- Temuan terkait: A02 (P1), A06 (P1), A17 (P2), A24 (P2), A26 (P2), A28 (P2).
- Skenario wajib: Uji profil sekolah, template surat, kredensial storage, switching storage, konfigurasi WA, izin admin dan kegagalan unggah.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /pengaturan-users

- Sumber: [apps/web/app/(dashboard)/pengaturan-users/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/pengaturan-users/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/pengaturan-users/view.tsx](<D:/acca-new/apps/web/app/pengaturan-users/view.tsx>).
- Referensi API terdeteksi: tidak ditemukan literal /api; periksa akses server, helper bersama atau URL dinamis.
- Temuan terkait: A04 (P1).
- Skenario wajib: Uji tambah/nonaktifkan/reset password, role/capability/override, sesi lama setelah perubahan, admin vs operator terbatas.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /piket

- Sumber: [apps/web/app/(dashboard)/piket/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/piket/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/piket/view.tsx](<D:/acca-new/apps/web/app/piket/view.tsx>).
- Referensi API terdeteksi: `/api/laporan/piket`.
- Temuan terkait: A28 (P2).
- Skenario wajib: Uji input hanya petugas/guru berizin, dokumentasi, tanggal sekolah, verifikasi laporan dan pengiriman WA simulasi.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /prestasi

- Sumber: [apps/web/app/(dashboard)/prestasi/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/prestasi/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/prestasi/view.tsx](<D:/acca-new/apps/web/app/prestasi/view.tsx>).
- Referensi API terdeteksi: `/api/sidebar-badges/seen`, `/api/prestasi`, `/api/settings/siswa-kelas`, `/api/master/students`, `/api/prestasi/`, `/api/master/kelas`, `/api/upload`.
- Temuan terkait: A05 (P1), A06 (P1), A07 (P2), A19 (P1).
- Skenario wajib: Uji create Menunggu/null, update metadata server, approval bersamaan, tanggal, unggah bukti dan pembatasan validator sesuai kebijakan.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /profile

- Sumber: [apps/web/app/(dashboard)/profile/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/profile/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/profile/view.tsx](<D:/acca-new/apps/web/app/profile/view.tsx>).
- Referensi API terdeteksi: `/api/profile-guru`, `/api/profile-siswa`, `/api/upload`, `/api/user/profile`, `/api/auth/login`.
- Temuan terkait: A04 (P1), A06 (P1), A19 (P1).
- Skenario wajib: Uji perubahan hanya akun sendiri, foto, password, identitas tetap konsisten dan sesi setelah reset.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /rekam-medis

- Sumber: [apps/web/app/(dashboard)/rekam-medis/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/rekam-medis/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/rekam-medis/view.tsx](<D:/acca-new/apps/web/app/rekam-medis/view.tsx>), [apps/web/app/rekam-medis/tabs/InputMedisTab.tsx](<D:/acca-new/apps/web/app/rekam-medis/tabs/InputMedisTab.tsx>), [apps/web/app/rekam-medis/tabs/KonfigurasiMedisTab.tsx](<D:/acca-new/apps/web/app/rekam-medis/tabs/KonfigurasiMedisTab.tsx>), [apps/web/app/rekam-medis/tabs/DaftarMedisTab.tsx](<D:/acca-new/apps/web/app/rekam-medis/tabs/DaftarMedisTab.tsx>), [apps/web/app/rekam-medis/tabs/CetakMedisTab.tsx](<D:/acca-new/apps/web/app/rekam-medis/tabs/CetakMedisTab.tsx>).
- Referensi API terdeteksi: `/api/ketidakhadiran/rekam-medis-siswa`, `/api/master/kelas`, `/api/profil-sekolah`.
- Temuan terkait: belum ada temuan spesifik terkonfirmasi pada putaran ini; tetap terdampak autentikasi bersama A04 sesuai sesi.
- Skenario wajib: Uji pemegang halaman saja, siswa lain, lampiran, jenis sakit, filter/periode dan ekspor tanpa kolom berlebihan.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /rekap-jurnal

- Sumber: [apps/web/app/(dashboard)/rekap-jurnal/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/rekap-jurnal/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/rekap-jurnal/view.tsx](<D:/acca-new/apps/web/app/rekap-jurnal/view.tsx>).
- Referensi API terdeteksi: `/api/master/dropdown`, `/api/rekap-jurnal`.
- Temuan terkait: A03 (P1), A08 (P2).
- Skenario wajib: Uji endpoint jurnal-master, filter kelas/guru/periode, guru pengganti, data kosong dan cetak.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /sanggar-kurikulum

- Sumber: [apps/web/app/(dashboard)/sanggar-kurikulum/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/sanggar-kurikulum/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/sanggar-kurikulum/view.tsx](<D:/acca-new/apps/web/app/sanggar-kurikulum/view.tsx>).
- Referensi API terdeteksi: `/api/site-settings`, `/api/profil-sekolah`, `/api/sanggar-kurikulum/check`, `/api/sanggar-kurikulum/kuota`, `/api/storage/upload`, `/api/sanggar`, `/api/sanggar/`, `/api/sanggar-kurikulum/broadcast`.
- Temuan terkait: A09 (P2).
- Skenario wajib: Uji daftar/daftar baru dengan token, kuota bersamaan, duplikasi pendaftar, pembatalan, broadcast khusus petugas.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /surat

- Sumber: [apps/web/app/(dashboard)/surat/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/surat/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/surat/view.tsx](<D:/acca-new/apps/web/app/surat/view.tsx>), [apps/web/app/surat/daftar/view.tsx](<D:/acca-new/apps/web/app/surat/daftar/view.tsx>).
- Referensi API terdeteksi: `/api/qrcode`, `/api/config-surat`, `/api/surat/guru`, `/api/dropdown/jenis-surat`, `/api/profil-sekolah`, `/api/upload`, `/api/surat/generate-number`, `/api/surat/sign-pdf`, `/api/surat/`, `/api/auth/me`, `/api/surat/by-id`, `/api/surat/items`, `/api/surat/download`.
- Temuan terkait: A05 (P1), A06 (P1), A17 (P2), A19 (P1), A25 (P1).
- Skenario wajib: Uji pembuatan/arsip/pemilik, nomor bersamaan, hapus final, lampiran, PDF-DOCX, template dan verifikasi QR data minimal.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /surat-daftar

- Sumber: [apps/web/app/(dashboard)/surat-daftar/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/surat-daftar/page.tsx>).
- Dependensi lokal halaman: tidak ada import lokal khusus halaman yang ditemukan.
- Referensi API terdeteksi: tidak ditemukan literal /api; periksa akses server, helper bersama atau URL dinamis.
- Temuan terkait: A25 (P1).
- Skenario wajib: Uji daftar arsip sesuai akses, pencarian, unduh dan penghapusan milik orang lain.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /tugas-siswa

- Sumber: [apps/web/app/(dashboard)/tugas-siswa/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/tugas-siswa/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/tugas-siswa/view.tsx](<D:/acca-new/apps/web/app/tugas-siswa/view.tsx>), [apps/web/app/tugas-siswa/components/TugasSiswaTable.tsx](<D:/acca-new/apps/web/app/tugas-siswa/components/TugasSiswaTable.tsx>), [apps/web/app/tugas-siswa/deadline.ts](<D:/acca-new/apps/web/app/tugas-siswa/deadline.ts>), [apps/web/app/tugas-siswa/jenis.ts](<D:/acca-new/apps/web/app/tugas-siswa/jenis.ts>), [apps/web/app/tugas-siswa/components/MobileCards.tsx](<D:/acca-new/apps/web/app/tugas-siswa/components/MobileCards.tsx>), [apps/web/app/tugas-siswa/components/TugasSiswaForm.tsx](<D:/acca-new/apps/web/app/tugas-siswa/components/TugasSiswaForm.tsx>).
- Referensi API terdeteksi: `/api/siswa/`, `/api/auth/me`, `/api/tugas-siswa/master`, `/api/tugas-siswa`, `/api/tugas-siswa/action`, `/api/tugas-siswa/`, `/api/tugas-siswa/upload`.
- Temuan terkait: A06 (P1), A12 (P1), A19 (P1), A26 (P2).
- Skenario wajib: Uji hak guru/pengurus/siswa, tugas kelas lain, checklist siswa lain, tanggal tenggat, unggahan dan pagination.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /tugas-tambahan

- Sumber: [apps/web/app/(dashboard)/tugas-tambahan/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/tugas-tambahan/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/tugas-tambahan/view.tsx](<D:/acca-new/apps/web/app/tugas-tambahan/view.tsx>).
- Referensi API terdeteksi: `/api/settings/active-academic-year`, `/api/admin/tahun-ajaran`, `/api/tugas-tambahan`, `/api/tugas-tambahan/jurnal`, `/api/upload`.
- Temuan terkait: belum ada temuan spesifik terkonfirmasi pada putaran ini; tetap terdampak autentikasi bersama A04 sesuai sesi.
- Skenario wajib: Uji periode aktif, guru sendiri/lain, jurnal tugas, status dan sinkronisasi penugasan terhadap role.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /um-kelulusan

- Sumber: [apps/web/app/(dashboard)/um-kelulusan/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/um-kelulusan/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/um-kelulusan/view.tsx](<D:/acca-new/apps/web/app/um-kelulusan/view.tsx>), [apps/web/app/um-kelulusan/tabs/KelulusanTab.tsx](<D:/acca-new/apps/web/app/um-kelulusan/tabs/KelulusanTab.tsx>), [apps/web/app/um-kelulusan/tabs/NilaiUMTab.tsx](<D:/acca-new/apps/web/app/um-kelulusan/tabs/NilaiUMTab.tsx>), [apps/web/app/um-kelulusan/tabs/NilaiIjazahTab.tsx](<D:/acca-new/apps/web/app/um-kelulusan/tabs/NilaiIjazahTab.tsx>), [apps/web/app/um-kelulusan/tabs/PlottingMapelTab.tsx](<D:/acca-new/apps/web/app/um-kelulusan/tabs/PlottingMapelTab.tsx>).
- Referensi API terdeteksi: `/api/auth/me`, `/api/kelulusan`, `/api/scopes`, `/api/ujian-madrasah/kelas-xii`, `/api/ujian-madrasah`, `/api/settings/um-lock`, `/api/ujian-madrasah/config`, `/api/ujian-madrasah/import-raport`, `/api/master/mapel`, `/api/master/kelas`, `/api/master/guru`, `/api/jadwal`, `/api/settings/guru-mapel`, `/api/master/mapel-kelas`.
- Temuan terkait: A13 (P1).
- Skenario wajib: Uji admin/operator/guru/siswa, input UM sesuai mapel, kunci nilai, publikasi kelulusan terjadwal, impor dan status.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /wali-kelas

- Sumber: [apps/web/app/(dashboard)/wali-kelas/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/wali-kelas/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/wali-kelas/view.tsx](<D:/acca-new/apps/web/app/wali-kelas/view.tsx>), [apps/web/app/wali-kelas/tabs/WaliKelasTabJurnal.tsx](<D:/acca-new/apps/web/app/wali-kelas/tabs/WaliKelasTabJurnal.tsx>), [apps/web/app/wali-kelas/tabs/WaliKelasTabAbsensi.tsx](<D:/acca-new/apps/web/app/wali-kelas/tabs/WaliKelasTabAbsensi.tsx>), [apps/web/app/wali-kelas/tabs/WaliKelasTabNilai.tsx](<D:/acca-new/apps/web/app/wali-kelas/tabs/WaliKelasTabNilai.tsx>), [apps/web/app/wali-kelas/tabs/WaliKelasTabMapelPilihan.tsx](<D:/acca-new/apps/web/app/wali-kelas/tabs/WaliKelasTabMapelPilihan.tsx>), [apps/web/app/wali-kelas/tabs/WaliKelasTabKokurikuler.tsx](<D:/acca-new/apps/web/app/wali-kelas/tabs/WaliKelasTabKokurikuler.tsx>), [apps/web/app/wali-kelas/tabs/WaliKelasTabEkskul.tsx](<D:/acca-new/apps/web/app/wali-kelas/tabs/WaliKelasTabEkskul.tsx>), [apps/web/app/wali-kelas/tabs/WaliKelasTabCatatan.tsx](<D:/acca-new/apps/web/app/wali-kelas/tabs/WaliKelasTabCatatan.tsx>).
- Referensi API terdeteksi: `/api/auth/me`, `/api/wali-kelas/absensi-akumulasi`, `/api/master/waktu`, `/api/settings/wali-kelas`, `/api/settings/siswa-kelas`, `/api/jurnal`, `/api/wali-kelas/absensi-akumulasi/`, `/api/nilai/siswa`, `/api/master/kelas`, `/api/kokurikuler/siswa`, `/api/wali-kelas/ekskul`, `/api/catatan-siswa`.
- Temuan terkait: A07 (P2).
- Skenario wajib: Uji kelas yang ditugaskan, periode aktif, siswa pindah kelas, nilai/absensi, tanggal dan catatan pribadi.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /[...pageId]

- Sumber: [apps/web/app/(dashboard)/[...pageId]/page.tsx](<D:/acca-new/apps/web/app/(dashboard)/[...pageId]/page.tsx>).
- Dependensi lokal halaman: tidak ada import lokal khusus halaman yang ditemukan.
- Referensi API terdeteksi: tidak ditemukan literal /api; periksa akses server, helper bersama atau URL dinamis.
- Temuan terkait: belum ada temuan spesifik terkonfirmasi pada putaran ini; tetap terdampak autentikasi bersama A04 sesuai sesi.
- Skenario wajib: Uji halaman dinamis/alias, nama tidak dikenal, role tidak berhak, redirect CBT dan konten yang berasal dari database.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /f/[id]

- Sumber: [apps/web/app/f/[id]/page.tsx](<D:/acca-new/apps/web/app/f/[id]/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/form/types.ts](<D:/acca-new/apps/web/app/form/types.ts>).
- Referensi API terdeteksi: `/api/forms/`, `/api/auth/me`, `/api/forms/submit`.
- Temuan terkait: belum ada temuan spesifik terkonfirmasi pada putaran ini; tetap terdampak autentikasi bersama A04 sesuai sesi.
- Skenario wajib: Uji slug/ID tidak ada, form ditutup, draft, form privat, respons anonim sah, file berlebihan dan kuota bersamaan.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /info-link/[token]

- Sumber: [apps/web/app/info-link/[token]/page.tsx](<D:/acca-new/apps/web/app/info-link/[token]/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/info-link/[token]/ShareLinkClient.tsx](<D:/acca-new/apps/web/app/info-link/[token]/ShareLinkClient.tsx>).
- Referensi API terdeteksi: `/api/pdf-proxy`, `/api/informasi-akademik/share/file/`.
- Temuan terkait: belum ada temuan spesifik terkonfirmasi pada putaran ini; tetap terdampak autentikasi bersama A04 sesuai sesi.
- Skenario wajib: Uji token share acak/kedaluwarsa/dicabut, akses file, konten HTML, dan tidak memuat data lain dari pemilik.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /ketidakhadiran/verify/[barcode]

- Sumber: [apps/web/app/ketidakhadiran/verify/[barcode]/page.tsx](<D:/acca-new/apps/web/app/ketidakhadiran/verify/[barcode]/page.tsx>).
- Dependensi lokal halaman: tidak ada import lokal khusus halaman yang ditemukan.
- Referensi API terdeteksi: `/api/ketidakhadiran/acca-letter/verify`, `/api/ketidakhadiran/pdf-preview`.
- Temuan terkait: A05 (P1), A28 (P2).
- Skenario wajib: Uji batas kelas/wali/guru asuh, impor duplikat, surat izin, barcode publik, lampiran URL dan konsistensi rekap tanggal.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /lckh/print-lampiran

- Sumber: [apps/web/app/lckh/print-lampiran/page.tsx](<D:/acca-new/apps/web/app/lckh/print-lampiran/page.tsx>).
- Dependensi lokal halaman: tidak ada import lokal khusus halaman yang ditemukan.
- Referensi API terdeteksi: `/api/lckh/print/data`.
- Temuan terkait: A07 (P2), A08 (P2), A15 (P1), A27 (P2).
- Skenario wajib: Uji ringkasan periode, pemilik submission, perubahan draft/final, status approval, cetak dan tanggal; manipulasi nip/id/status harus ditolak.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /lckh/verification/[code]

- Sumber: [apps/web/app/lckh/verification/[code]/page.tsx](<D:/acca-new/apps/web/app/lckh/verification/[code]/page.tsx>).
- Dependensi lokal halaman: tidak ada import lokal khusus halaman yang ditemukan.
- Referensi API terdeteksi: tidak ditemukan literal /api; periksa akses server, helper bersama atau URL dinamis.
- Temuan terkait: A07 (P2), A08 (P2), A15 (P1), A27 (P2).
- Skenario wajib: Uji ringkasan periode, pemilik submission, perubahan draft/final, status approval, cetak dan tanggal; manipulasi nip/id/status harus ditolak.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /link-auth

- Sumber: [apps/web/app/link-auth/page.tsx](<D:/acca-new/apps/web/app/link-auth/page.tsx>).
- Dependensi lokal halaman: tidak ada import lokal khusus halaman yang ditemukan.
- Referensi API terdeteksi: `/api/admin/users/link-auth`.
- Temuan terkait: belum ada temuan spesifik terkonfirmasi pada putaran ini; tetap terdampak autentikasi bersama A04 sesuai sesi.
- Skenario wajib: Uji akses penghubung akun hanya pihak berwenang, username/NIP orang lain, akun sudah terhubung dan pesan error tanpa kebocoran.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /login

- Sumber: [apps/web/app/login/page.tsx](<D:/acca-new/apps/web/app/login/page.tsx>).
- Dependensi lokal halaman: tidak ada import lokal khusus halaman yang ditemukan.
- Referensi API terdeteksi: `/api/profil-sekolah`, `/api/auth/login`, `/api/auth/register-parent`.
- Temuan terkait: A04 (P1).
- Skenario wajib: Uji password salah, akun nonaktif, sesi lama, redirect login, cookie dan logout. Jalur login tidak membuktikan token lama dicabut.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /

- Sumber: [apps/web/app/page.tsx](<D:/acca-new/apps/web/app/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/login/page.tsx](<D:/acca-new/apps/web/app/login/page.tsx>).
- Referensi API terdeteksi: `/api/auth/me`, `/api/profil-sekolah`, `/api/auth/login`, `/api/auth/register-parent`.
- Temuan terkait: belum ada temuan spesifik terkonfirmasi pada putaran ini; tetap terdampak autentikasi bersama A04 sesuai sesi.
- Skenario wajib: Uji landing publik, tautan login/form, statistik publik tidak sensitif, error sumber data dan ukuran layar.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /piket/dokumentasi/[id]

- Sumber: [apps/web/app/piket/dokumentasi/[id]/page.tsx](<D:/acca-new/apps/web/app/piket/dokumentasi/[id]/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/piket/dokumentasi/[id]/GalleryClient.tsx](<D:/acca-new/apps/web/app/piket/dokumentasi/[id]/GalleryClient.tsx>).
- Referensi API terdeteksi: tidak ditemukan literal /api; periksa akses server, helper bersama atau URL dinamis.
- Temuan terkait: A28 (P2).
- Skenario wajib: Uji input hanya petugas/guru berizin, dokumentasi, tanggal sekolah, verifikasi laporan dan pengiriman WA simulasi.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /piket/input

- Sumber: [apps/web/app/piket/input/page.tsx](<D:/acca-new/apps/web/app/piket/input/page.tsx>).
- Dependensi lokal halaman: tidak ada import lokal khusus halaman yang ditemukan.
- Referensi API terdeteksi: `/api/jadwal`, `/api/master/waktu`, `/api/master/kelas`, `/api/master/guru`, `/api/master/dropdown`, `/api/upload`, `/api/laporan/piket`.
- Temuan terkait: A28 (P2).
- Skenario wajib: Uji input hanya petugas/guru berizin, dokumentasi, tanggal sekolah, verifikasi laporan dan pengiriman WA simulasi.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /redirect/[cardId]

- Sumber: [apps/web/app/redirect/[cardId]/page.tsx](<D:/acca-new/apps/web/app/redirect/[cardId]/page.tsx>).
- Dependensi lokal halaman: tidak ada import lokal khusus halaman yang ditemukan.
- Referensi API terdeteksi: `/api/config`.
- Temuan terkait: belum ada temuan spesifik terkonfirmasi pada putaran ini; tetap terdampak autentikasi bersama A04 sesuai sesi.
- Skenario wajib: Uji tujuan kartu dari konfigurasi yang sah, skema URL tidak aman, kartu hilang dan redirect lintas origin sesuai kebijakan.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /surat/scan/[id]

- Sumber: [apps/web/app/surat/scan/[id]/page.tsx](<D:/acca-new/apps/web/app/surat/scan/[id]/page.tsx>).
- Dependensi lokal halaman: tidak ada import lokal khusus halaman yang ditemukan.
- Referensi API terdeteksi: `/api/surat/verify`.
- Temuan terkait: A05 (P1), A06 (P1), A17 (P2), A19 (P1), A25 (P1).
- Skenario wajib: Uji pembuatan/arsip/pemilik, nomor bersamaan, hapus final, lampiran, PDF-DOCX, template dan verifikasi QR data minimal.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /tampilan-agenda

- Sumber: [apps/web/app/tampilan-agenda/page.tsx](<D:/acca-new/apps/web/app/tampilan-agenda/page.tsx>).
- Dependensi lokal halaman: [apps/web/app/agenda-madrasah/components/AgendaDisplayView.tsx](<D:/acca-new/apps/web/app/agenda-madrasah/components/AgendaDisplayView.tsx>).
- Referensi API terdeteksi: `/api/agenda-madrasah`, `/api/settings/libur`.
- Temuan terkait: belum ada temuan spesifik terkonfirmasi pada putaran ini; tetap terdampak autentikasi bersama A04 sesuai sesi.
- Skenario wajib: Uji agenda publik hanya data yang dipublikasikan, pergantian tanggal dan tampilan ketika sumber gagal.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /test-wa

- Sumber: [apps/web/app/test-wa/page.tsx](<D:/acca-new/apps/web/app/test-wa/page.tsx>).
- Dependensi lokal halaman: tidak ada import lokal khusus halaman yang ditemukan.
- Referensi API terdeteksi: `/api/whatsapp/send`, `/api/whatsapp`.
- Temuan terkait: A28 (P2).
- Skenario wajib: Uji halaman dan semua endpoint uji dibatasi petugas, token/target tidak bocor, gunakan transport simulasi tanpa pengiriman nyata.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /update-password

- Sumber: [apps/web/app/update-password/page.tsx](<D:/acca-new/apps/web/app/update-password/page.tsx>).
- Dependensi lokal halaman: tidak ada import lokal khusus halaman yang ditemukan.
- Referensi API terdeteksi: `/api/auth/me`, `/api/auth/update-password`.
- Temuan terkait: belum ada temuan spesifik terkonfirmasi pada putaran ini; tetap terdampak autentikasi bersama A04 sesuai sesi.
- Skenario wajib: Uji sesi cookie, token tautan, kode kedaluwarsa, konfirmasi password dan login memakai password baru; jangan mengasumsikan kode reset sama dengan JWT.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /verifikasi

- Sumber: [apps/web/app/verifikasi/page.tsx](<D:/acca-new/apps/web/app/verifikasi/page.tsx>).
- Dependensi lokal halaman: tidak ada import lokal khusus halaman yang ditemukan.
- Referensi API terdeteksi: `/api/profil-sekolah`, `/api/surat/verify`, `/api/qrcode`.
- Temuan terkait: belum ada temuan spesifik terkonfirmasi pada putaran ini; tetap terdampak autentikasi bersama A04 sesuai sesi.
- Skenario wajib: Uji nomor/ID surat valid-invalid, draft/final/dicabut, dokumen tidak ada, hanya metadata publik yang perlu.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## /verify/siswa/[nisn]

- Sumber: [apps/web/app/verify/siswa/[nisn]/page.tsx](<D:/acca-new/apps/web/app/verify/siswa/[nisn]/page.tsx>).
- Dependensi lokal halaman: tidak ada import lokal khusus halaman yang ditemukan.
- Referensi API terdeteksi: `/api/master/students/verify`.
- Temuan terkait: belum ada temuan spesifik terkonfirmasi pada putaran ini; tetap terdampak autentikasi bersama A04 sesuai sesi.
- Skenario wajib: Uji pengenal siswa invalid/valid dan data minimal, hindari publikasi NIK/alamat/kontak hanya karena NISN diketahui.
- Batas verifikasi: penelusuran statis; uji interaktif desktop/mobile dan PostgreSQL staging belum dilakukan.

## Alias dan halaman registry tambahan

Kunci berikut tidak memiliki page.tsx dengan URL yang persis sama; sebagian adalah alias, redirect, atau ditangani route dinamis. Perilakunya harus diverifikasi bersama halaman tujuan dan izin halaman. Bukan dianggap 404 hanya karena tidak memiliki berkas khusus.

- `/pengumuman`
- `/Formulir Dinamis`
- `/ProfileSaya`
- `/IzinGuru`
- `/Izin Guru`
- `/Dashboard`
- `/Absensi`
- `/Ketidakhadiran`
- `/RekamMedis`
- `/Rekam Medis Siswa`
- `/Piket`
- `/JurnalGuru`
- `/TugasTambahan`
- `/Master Data`
- `/Pengaturan Data`
- `/Pengaturan Tugas`
- `/LCKH`
- `/LCKHApproval`
- `/Nilai`
- `/GuruAsuh`
- `/WaliKelas`
- `/RekapJurnal`
- `/personal-documents`
- `/unggah-dokumen`
- `/Klinik`
- `/Keuangan`

Sumber: [apps/web/components/page-registry.tsx](<D:/acca-new/apps/web/components/page-registry.tsx>). Konten DynamicPageRenderer yang tersimpan di database belum dibaca pada audit ini. Referensi API pada matriks merupakan indikator penelusuran, bukan bukti endpoint aktif; fragmen template/komentar dapat memerlukan konfirmasi manual.
