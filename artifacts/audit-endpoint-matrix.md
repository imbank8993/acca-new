# Matriks endpoint backend dan proxy frontend

Inventaris statis; guard yang tidak tercantum tidak otomatis berarti endpoint rentan karena pengecekan dapat dilakukan di body/helper. Sebaliknya JwtAuthGuard hanya membuktikan login, bukan hak atas operasi atau row. Rujuk temuan terkonfirmasi dalam laporan utama.

## apps/api/src/absensi/absensi.controller.ts

Dekorator kelas: `Controller('absensi'); UseGuards(JwtAuthGuard)`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/absensi/absensi.controller.ts:35](<D:/acca-new/apps/api/src/absensi/absensi.controller.ts:35>) — getSesi | Get('sesi') | this.absensiService.getSesi |
| [apps/api/src/absensi/absensi.controller.ts:43](<D:/acca-new/apps/api/src/absensi/absensi.controller.ts:43>) — getSesiById | Get('sesi/:id') | this.absensiService.getSesiById |
| [apps/api/src/absensi/absensi.controller.ts:49](<D:/acca-new/apps/api/src/absensi/absensi.controller.ts:49>) — createSesi | Post('sesi') | this.absensiService.createSesi |
| [apps/api/src/absensi/absensi.controller.ts:56](<D:/acca-new/apps/api/src/absensi/absensi.controller.ts:56>) — updateSesi | Patch('sesi/:id') | this.absensiService.updateSesi |
| [apps/api/src/absensi/absensi.controller.ts:63](<D:/acca-new/apps/api/src/absensi/absensi.controller.ts:63>) — deleteSesi | Delete('sesi/:id') | this.absensiService.deleteSesi |
| [apps/api/src/absensi/absensi.controller.ts:71](<D:/acca-new/apps/api/src/absensi/absensi.controller.ts:71>) — getDetail | Get('detail') | this.absensiService.getDetail |
| [apps/api/src/absensi/absensi.controller.ts:77](<D:/acca-new/apps/api/src/absensi/absensi.controller.ts:77>) — saveDetail | Post('detail') | this.absensiService.upsertDetail |
| [apps/api/src/absensi/absensi.controller.ts:83](<D:/acca-new/apps/api/src/absensi/absensi.controller.ts:83>) — getTeacherClasses | Get('classes') | this.absensiService.getTeacherClasses |
| [apps/api/src/absensi/absensi.controller.ts:92](<D:/acca-new/apps/api/src/absensi/absensi.controller.ts:92>) — exportAbsensi | Post('export') | this.absensiService.exportAbsensi |

## apps/api/src/access/access.controller.ts

Dekorator kelas: `ApiTags('Access Control'); Controller('access/internal')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/access/access.controller.ts:68](<D:/acca-new/apps/api/src/access/access.controller.ts:68>) — userByAuthId | Get('user/:authId'); ApiOperation({ summary: 'Identitas + akses berdasarkan auth_id (service-to-service)' }) | this.accessService.resolveUserAccess |
| [apps/api/src/access/access.controller.ts:82](<D:/acca-new/apps/api/src/access/access.controller.ts:82>) — userByUsername | Get('username/:username'); ApiOperation({ summary: 'Identitas + akses berdasarkan username (service-to-service)' }) | this.accessService.resolveUserAccess |

## apps/api/src/access/access.controller.ts

Dekorator kelas: `ApiTags('Access Control'); ApiBearerAuth(); UseGuards(JwtAuthGuard); Controller('access')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/access/access.controller.ts:106](<D:/acca-new/apps/api/src/access/access.controller.ts:106>) — me | Get('me'); ApiOperation({ summary: 'Identitas + role, halaman, capabilities, dan tema user yang login' }) | this.accessService.resolveUserAccess |
| [apps/api/src/access/access.controller.ts:115](<D:/acca-new/apps/api/src/access/access.controller.ts:115>) — rolePages | Get('role-pages'); ApiOperation({ summary: 'Peta role → page_id (untuk UI Akses per Role)' }) | this.accessService.getRolePagesMap, this.accessService.getRoleFlatGroupsMap |
| [apps/api/src/access/access.controller.ts:125](<D:/acca-new/apps/api/src/access/access.controller.ts:125>) — setRolePages | Put('role-pages/:role'); ApiOperation({ summary: 'Ganti seluruh halaman sebuah role' }) | this.accessService.setRolePages |
| [apps/api/src/access/access.controller.ts:137](<D:/acca-new/apps/api/src/access/access.controller.ts:137>) — setRoleFlatGroups | Put('role-flat-groups/:role'); ApiOperation({ summary: 'Ganti group yang dirender flat untuk sebuah role' }) | this.accessService.setRoleFlatGroups |
| [apps/api/src/access/access.controller.ts:149](<D:/acca-new/apps/api/src/access/access.controller.ts:149>) — roleCapabilities | Get('role-capabilities'); ApiOperation({ summary: 'Peta role → capability_key' }) | this.accessService.getRoleCapabilitiesMap |
| [apps/api/src/access/access.controller.ts:155](<D:/acca-new/apps/api/src/access/access.controller.ts:155>) — setRoleCapabilities | Put('role-capabilities/:role'); ApiOperation({ summary: 'Ganti seluruh kapabilitas sebuah role' }) | this.accessService.setRoleCapabilities |
| [apps/api/src/access/access.controller.ts:167](<D:/acca-new/apps/api/src/access/access.controller.ts:167>) — userCapabilities | Get('user-capabilities/:userId'); ApiOperation({ summary: 'Grant/revoke kapabilitas milik satu user' }) | this.accessService.getUserCapabilityOverrides |
| [apps/api/src/access/access.controller.ts:173](<D:/acca-new/apps/api/src/access/access.controller.ts:173>) — setUserCapabilities | Put('user-capabilities/:userId'); ApiOperation({ summary: 'Ganti seluruh pengecualian kapabilitas milik satu user' }) | this.accessService.setUserCapabilities |
| [apps/api/src/access/access.controller.ts:188](<D:/acca-new/apps/api/src/access/access.controller.ts:188>) — capabilityHolders | Get('capability-holders'); ApiOperation({ summary: 'Siapa saja pemegang satu kapabilitas' }) | this.accessService.getCapabilityHolders |
| [apps/api/src/access/access.controller.ts:194](<D:/acca-new/apps/api/src/access/access.controller.ts:194>) — setCapabilityHolders | Put('capability-holders/:key'); ApiOperation({ summary: 'Ganti daftar orang untuk satu kapabilitas' }) | this.accessService.setCapabilityHolders |
| [apps/api/src/access/access.controller.ts:206](<D:/acca-new/apps/api/src/access/access.controller.ts:206>) — themeRoles | Get('theme-roles'); ApiOperation({ summary: 'Peta role → mode tema (ALL/LIGHT/DARK)' }) | this.accessService.getRoleThemeMap |
| [apps/api/src/access/access.controller.ts:212](<D:/acca-new/apps/api/src/access/access.controller.ts:212>) — setThemeRoles | Put('theme-roles'); ApiOperation({ summary: 'Simpan peta mode tema per role' }) | this.accessService.setRoleThemeMap |
| [apps/api/src/access/access.controller.ts:225](<D:/acca-new/apps/api/src/access/access.controller.ts:225>) — getRoles | Get('roles'); ApiOperation({ summary: 'Daftar semua role' }) | this.accessService.getRoles |
| [apps/api/src/access/access.controller.ts:233](<D:/acca-new/apps/api/src/access/access.controller.ts:233>) — createRole | Post('roles'); ApiOperation({ summary: 'Buat role baru' }) | this.accessService.createRole |
| [apps/api/src/access/access.controller.ts:248](<D:/acca-new/apps/api/src/access/access.controller.ts:248>) — getRoleById | Get('roles/:id'); ApiOperation({ summary: 'Get role details (placeholder)' }) |  |
| [apps/api/src/access/access.controller.ts:255](<D:/acca-new/apps/api/src/access/access.controller.ts:255>) — updateRole | Put('roles/:id'); ApiOperation({ summary: 'Update sebuah role' }) | this.accessService.updateRole |
| [apps/api/src/access/access.controller.ts:274](<D:/acca-new/apps/api/src/access/access.controller.ts:274>) — deleteRole | Delete('roles/:id'); ApiOperation({ summary: 'Hapus sebuah role' }) | this.accessService.deleteRole |
| [apps/api/src/access/access.controller.ts:292](<D:/acca-new/apps/api/src/access/access.controller.ts:292>) — getUserRoles | Get('users/:id/roles'); ApiOperation({ summary: 'Lihat role milik seorang user' }) | this.accessService.getUserRoles |
| [apps/api/src/access/access.controller.ts:304](<D:/acca-new/apps/api/src/access/access.controller.ts:304>) — updateUserRoles | Post('users/:id/roles'); ApiOperation({ summary: 'Ubah role milik seorang user' }) | this.accessService.updateUserRoles |
| [apps/api/src/access/access.controller.ts:323](<D:/acca-new/apps/api/src/access/access.controller.ts:323>) — saveRolePages | Post('role-pages'); ApiOperation({ summary: 'Simpan halaman dan flat groups untuk sebuah role' }) | this.accessService.setRolePages, this.accessService.setRoleFlatGroups |

## apps/api/src/agenda/agenda.controller.ts

Dekorator kelas: `Controller('agenda')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/agenda/agenda.controller.ts:21](<D:/acca-new/apps/api/src/agenda/agenda.controller.ts:21>) — getPublicAgendas | Get('public') | this.agendaService.getPublicAgendas |
| [apps/api/src/agenda/agenda.controller.ts:32](<D:/acca-new/apps/api/src/agenda/agenda.controller.ts:32>) — getIzinSaya | Get('izin-saya'); UseGuards(JwtAuthGuard) | this.agendaService.getIzinAgenda |
| [apps/api/src/agenda/agenda.controller.ts:39](<D:/acca-new/apps/api/src/agenda/agenda.controller.ts:39>) — getAgendas | Get(); UseGuards(JwtAuthGuard) | this.agendaService.getAgendas |
| [apps/api/src/agenda/agenda.controller.ts:46](<D:/acca-new/apps/api/src/agenda/agenda.controller.ts:46>) — createAgenda | Post(); UseGuards(JwtAuthGuard, FeatureAccessGuard); FeatureAccess(AGENDA_KELOLA_KEY) | this.agendaService.createAgenda |
| [apps/api/src/agenda/agenda.controller.ts:54](<D:/acca-new/apps/api/src/agenda/agenda.controller.ts:54>) — updateAgenda | Put(); UseGuards(JwtAuthGuard, FeatureAccessGuard); FeatureAccess(AGENDA_KELOLA_KEY) | this.agendaService.updateAgenda |
| [apps/api/src/agenda/agenda.controller.ts:62](<D:/acca-new/apps/api/src/agenda/agenda.controller.ts:62>) — deleteAgenda | Delete(); UseGuards(JwtAuthGuard, FeatureAccessGuard); FeatureAccess(AGENDA_KELOLA_KEY) | this.agendaService.deleteAgenda |
| [apps/api/src/agenda/agenda.controller.ts:72](<D:/acca-new/apps/api/src/agenda/agenda.controller.ts:72>) — getKategori | Get('kategori'); UseGuards(JwtAuthGuard) | this.agendaService.getKategori |
| [apps/api/src/agenda/agenda.controller.ts:79](<D:/acca-new/apps/api/src/agenda/agenda.controller.ts:79>) — createKategori | Post('kategori'); UseGuards(JwtAuthGuard, FeatureAccessGuard); FeatureAccess(AGENDA_KELOLA_KEY) | this.agendaService.createKategori |
| [apps/api/src/agenda/agenda.controller.ts:87](<D:/acca-new/apps/api/src/agenda/agenda.controller.ts:87>) — updateKategori | Put('kategori'); UseGuards(JwtAuthGuard, FeatureAccessGuard); FeatureAccess(AGENDA_KELOLA_KEY) | this.agendaService.updateKategori |
| [apps/api/src/agenda/agenda.controller.ts:95](<D:/acca-new/apps/api/src/agenda/agenda.controller.ts:95>) — deleteKategori | Delete('kategori'); UseGuards(JwtAuthGuard, FeatureAccessGuard); FeatureAccess(AGENDA_KELOLA_KEY) | this.agendaService.deleteKategori |
| [apps/api/src/agenda/agenda.controller.ts:105](<D:/acca-new/apps/api/src/agenda/agenda.controller.ts:105>) — uploadFoto | Post('foto'); UseGuards(JwtAuthGuard, FeatureAccessGuard); FeatureAccess(AGENDA_KELOLA_KEY); UseInterceptors(AnyFilesInterceptor()) | this.agendaService.uploadFoto |
| [apps/api/src/agenda/agenda.controller.ts:127](<D:/acca-new/apps/api/src/agenda/agenda.controller.ts:127>) — updateFoto | Put('foto'); UseGuards(JwtAuthGuard, FeatureAccessGuard); FeatureAccess(AGENDA_KELOLA_KEY) | this.agendaService.updateFotoUrutan |
| [apps/api/src/agenda/agenda.controller.ts:135](<D:/acca-new/apps/api/src/agenda/agenda.controller.ts:135>) — deleteFoto | Delete('foto'); UseGuards(JwtAuthGuard, FeatureAccessGuard); FeatureAccess(AGENDA_KELOLA_KEY) | this.agendaService.deleteFoto |

## apps/api/src/analisis-beban/analisis-beban.controller.ts

Dekorator kelas: `ApiTags('Analisis Beban Kerja'); ApiBearerAuth(); UseGuards(JwtAuthGuard, PageAccessGuard); RequiresPage('analisis-beban'); Controller('analisis-beban')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/analisis-beban/analisis-beban.controller.ts:20](<D:/acca-new/apps/api/src/analisis-beban/analisis-beban.controller.ts:20>) — getAll | Get(); ApiOperation({ summary: 'Daftar Ploting Beban Kerja Guru' }) | this.analisisBebanService.getAll |
| [apps/api/src/analisis-beban/analisis-beban.controller.ts:31](<D:/acca-new/apps/api/src/analisis-beban/analisis-beban.controller.ts:31>) — upsert | Post(); ApiOperation({ summary: 'Tambah atau Update Ploting Beban Kerja Guru' }) | this.analisisBebanService.upsert |
| [apps/api/src/analisis-beban/analisis-beban.controller.ts:38](<D:/acca-new/apps/api/src/analisis-beban/analisis-beban.controller.ts:38>) — delete | Delete(); ApiOperation({ summary: 'Hapus Ploting Beban Kerja Guru' }) | this.analisisBebanService.delete |

## apps/api/src/auth/auth.controller.ts

Dekorator kelas: `ApiTags('Authentication'); Controller('auth')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/auth/auth.controller.ts:29](<D:/acca-new/apps/api/src/auth/auth.controller.ts:29>) — login | Post('login'); HttpCode(HttpStatus.OK); ApiOperation({ summary: 'Login pengguna (Mirip Supabase Auth)' }); ApiResponse({ status: 200, description: 'Login berhasil, mengembalikan JWT token' }); ApiResponse({ status: 401, description: 'Email/Username atau password salah' }) | this.authService.login |
| [apps/api/src/auth/auth.controller.ts:51](<D:/acca-new/apps/api/src/auth/auth.controller.ts:51>) — register | Post('register'); HttpCode(HttpStatus.CREATED); UseGuards(JwtAuthGuard, RolesGuard); Roles('ADMIN', 'ADMINISTRATOR'); ApiBearerAuth(); ApiOperation({ summary: 'Buat akun pengguna baru (khusus Admin)' }); ApiResponse({ status: 201, description: 'Akun berhasil dibuat' }); ApiResponse({ status: 400, description: 'Email atau Username sudah terdaftar' }); ApiResponse({ status: 403, description: 'Hanya Admin yang dapat membuat akun' }) | this.authService.register |
| [apps/api/src/auth/auth.controller.ts:64](<D:/acca-new/apps/api/src/auth/auth.controller.ts:64>) — getProfile | Get('me'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Mendapatkan profil pengguna yang sedang login' }); ApiResponse({ status: 200, description: 'Profil pengguna berhasil didapatkan' }); ApiResponse({ status: 401, description: 'Token tidak valid atau tidak ditemukan' }) | this.authService.getProfile |
| [apps/api/src/auth/auth.controller.ts:74](<D:/acca-new/apps/api/src/auth/auth.controller.ts:74>) — adminResetPassword | Post('admin/reset-password'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Reset password user oleh Admin (PostgreSQL VPS)' }) | this.authService.adminResetPassword |

## apps/api/src/bank-data/bank-data.controller.ts

Dekorator kelas: `ApiTags('Bank Data'); Controller('bank-data')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/bank-data/bank-data.controller.ts:11](<D:/acca-new/apps/api/src/bank-data/bank-data.controller.ts:11>) — getCatalog | Get(); UseGuards(JwtAuthGuard); ApiOperation({ summary: 'Katalog Bank Data' }) | this.service.getCatalog |
| [apps/api/src/bank-data/bank-data.controller.ts:18](<D:/acca-new/apps/api/src/bank-data/bank-data.controller.ts:18>) — handlePost | Post(); UseGuards(JwtAuthGuard); ApiOperation({ summary: 'Preview & Export Bank Data' }) | this.service.handlePost |
| [apps/api/src/bank-data/bank-data.controller.ts:35](<D:/acca-new/apps/api/src/bank-data/bank-data.controller.ts:35>) — getConfig | Get('config'); UseGuards(JwtAuthGuard); ApiOperation({ summary: 'Konfigurasi dataset Bank Data' }) | this.service.getConfig |
| [apps/api/src/bank-data/bank-data.controller.ts:42](<D:/acca-new/apps/api/src/bank-data/bank-data.controller.ts:42>) — updateConfig | Put('config'); UseGuards(JwtAuthGuard); ApiOperation({ summary: 'Update konfigurasi dataset Bank Data' }) | this.service.updateConfig |
| [apps/api/src/bank-data/bank-data.controller.ts:49](<D:/acca-new/apps/api/src/bank-data/bank-data.controller.ts:49>) — getLogs | Get('log'); UseGuards(JwtAuthGuard); ApiOperation({ summary: 'Riwayat ekspor Bank Data' }) | this.service.getLogs |

## apps/api/src/catatan-siswa/catatan-siswa.controller.ts

Dekorator kelas: `Controller('catatan-siswa'); UseGuards(JwtAuthGuard)`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/catatan-siswa/catatan-siswa.controller.ts:19](<D:/acca-new/apps/api/src/catatan-siswa/catatan-siswa.controller.ts:19>) — getCatatanSiswa | Get() | this.catatanSiswaService.getCatatan |
| [apps/api/src/catatan-siswa/catatan-siswa.controller.ts:31](<D:/acca-new/apps/api/src/catatan-siswa/catatan-siswa.controller.ts:31>) — createCatatanSiswa | Post() | this.catatanSiswaService.createCatatan |
| [apps/api/src/catatan-siswa/catatan-siswa.controller.ts:50](<D:/acca-new/apps/api/src/catatan-siswa/catatan-siswa.controller.ts:50>) — updateCatatanSiswa | Patch(':id'); Put(':id') | this.catatanSiswaService.updateCatatan |
| [apps/api/src/catatan-siswa/catatan-siswa.controller.ts:67](<D:/acca-new/apps/api/src/catatan-siswa/catatan-siswa.controller.ts:67>) — deleteCatatanSiswa | Delete(':id') | this.catatanSiswaService.deleteCatatan |
| [apps/api/src/catatan-siswa/catatan-siswa.controller.ts:74](<D:/acca-new/apps/api/src/catatan-siswa/catatan-siswa.controller.ts:74>) — tindakLanjut | Post(':id/tindak-lanjut') | this.catatanSiswaService.tindakLanjut |

## apps/api/src/dashboard/dashboard.controller.ts

Dekorator kelas: `ApiTags('Dashboard'); ApiBearerAuth(); UseGuards(JwtAuthGuard); Controller('dashboard')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/dashboard/dashboard.controller.ts:13](<D:/acca-new/apps/api/src/dashboard/dashboard.controller.ts:13>) — getSummary | Get('summary') | this.dashboardService.getDashboardSummary |
| [apps/api/src/dashboard/dashboard.controller.ts:19](<D:/acca-new/apps/api/src/dashboard/dashboard.controller.ts:19>) — getStats | Get('stats') | this.dashboardService.getDashboardStats |
| [apps/api/src/dashboard/dashboard.controller.ts:25](<D:/acca-new/apps/api/src/dashboard/dashboard.controller.ts:25>) — getCharts | Get('charts') | this.dashboardService.getDashboardCharts |

## apps/api/src/dokumen/dokumen.controller.ts

Dekorator kelas: `ApiTags('Dokumen'); ApiBearerAuth(); UseGuards(JwtAuthGuard, FeatureAccessGuard); Controller('dokumen')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/dokumen/dokumen.controller.ts:27](<D:/acca-new/apps/api/src/dokumen/dokumen.controller.ts:27>) — bulkUpload | Post('bulk-upload'); FeatureAccess(DOKUMEN_KELOLA_KEY); UseInterceptors(AnyFilesInterceptor()) | this.dokumenService.bulkUpload |
| [apps/api/src/dokumen/dokumen.controller.ts:37](<D:/acca-new/apps/api/src/dokumen/dokumen.controller.ts:37>) — bulkDelete | Post('bulk-delete'); FeatureAccess(DOKUMEN_KELOLA_KEY) | this.dokumenService.bulkDelete |
| [apps/api/src/dokumen/dokumen.controller.ts:43](<D:/acca-new/apps/api/src/dokumen/dokumen.controller.ts:43>) — getUploadedDocuments | Get('uploaded-documents') | this.dokumenService.getUploadedDocuments |
| [apps/api/src/dokumen/dokumen.controller.ts:53](<D:/acca-new/apps/api/src/dokumen/dokumen.controller.ts:53>) — createUploadedDocument | Post('uploaded-documents') | this.dokumenService.createUploadedDocument |
| [apps/api/src/dokumen/dokumen.controller.ts:58](<D:/acca-new/apps/api/src/dokumen/dokumen.controller.ts:58>) — deleteUploadedDocument | Delete('uploaded-documents/:id'); FeatureAccess(DOKUMEN_KELOLA_KEY) | this.dokumenService.deleteUploadedDocument |
| [apps/api/src/dokumen/dokumen.controller.ts:65](<D:/acca-new/apps/api/src/dokumen/dokumen.controller.ts:65>) — getCategories | Get('categories') | this.dokumenService.getCategories |
| [apps/api/src/dokumen/dokumen.controller.ts:74](<D:/acca-new/apps/api/src/dokumen/dokumen.controller.ts:74>) — createCategory | Post('categories'); FeatureAccess(DOKUMEN_KELOLA_KEY) | this.dokumenService.createCategory |
| [apps/api/src/dokumen/dokumen.controller.ts:81](<D:/acca-new/apps/api/src/dokumen/dokumen.controller.ts:81>) — updateCategory | Put('categories/:id'); FeatureAccess(DOKUMEN_KELOLA_KEY) | this.dokumenService.updateCategory |
| [apps/api/src/dokumen/dokumen.controller.ts:88](<D:/acca-new/apps/api/src/dokumen/dokumen.controller.ts:88>) — deleteCategory | Delete('categories/:id'); FeatureAccess(DOKUMEN_KELOLA_KEY) | this.dokumenService.deleteCategory |
| [apps/api/src/dokumen/dokumen.controller.ts:95](<D:/acca-new/apps/api/src/dokumen/dokumen.controller.ts:95>) — createDokumenSiswa | Post('dokumen-siswa'); FeatureAccess(DOKUMEN_KELOLA_KEY) | this.dokumenService.createDokumenSiswa |
| [apps/api/src/dokumen/dokumen.controller.ts:102](<D:/acca-new/apps/api/src/dokumen/dokumen.controller.ts:102>) — searchUploader | Get('uploader-search'); FeatureAccess(DOKUMEN_KELOLA_KEY) | this.dokumenService.searchUploader |

## apps/api/src/e-supervisi/e-supervisi.controller.ts

Dekorator kelas: `Controller('e-supervisi'); UseGuards(JwtAuthGuard, PageAccessGuard); RequiresPage('e-supervisi')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/e-supervisi/e-supervisi.controller.ts:20](<D:/acca-new/apps/api/src/e-supervisi/e-supervisi.controller.ts:20>) — getDokumen | Get('dokumen') | this.eSupervisiService.getDokumen |
| [apps/api/src/e-supervisi/e-supervisi.controller.ts:25](<D:/acca-new/apps/api/src/e-supervisi/e-supervisi.controller.ts:25>) — upsertDokumen | Post('dokumen') | this.eSupervisiService.upsertDokumen |
| [apps/api/src/e-supervisi/e-supervisi.controller.ts:30](<D:/acca-new/apps/api/src/e-supervisi/e-supervisi.controller.ts:30>) — deleteDokumen | Delete('dokumen') | this.eSupervisiService.deleteDokumen |
| [apps/api/src/e-supervisi/e-supervisi.controller.ts:35](<D:/acca-new/apps/api/src/e-supervisi/e-supervisi.controller.ts:35>) — getNilai | Get('nilai') | this.eSupervisiService.getNilai |
| [apps/api/src/e-supervisi/e-supervisi.controller.ts:40](<D:/acca-new/apps/api/src/e-supervisi/e-supervisi.controller.ts:40>) — upsertNilai | Post('nilai') | this.eSupervisiService.upsertNilai |
| [apps/api/src/e-supervisi/e-supervisi.controller.ts:45](<D:/acca-new/apps/api/src/e-supervisi/e-supervisi.controller.ts:45>) — getPenugasan | Get('penugasan') | this.eSupervisiService.getPenugasan |
| [apps/api/src/e-supervisi/e-supervisi.controller.ts:54](<D:/acca-new/apps/api/src/e-supervisi/e-supervisi.controller.ts:54>) — upsertPenugasan | Post('penugasan') | this.eSupervisiService.upsertPenugasan |
| [apps/api/src/e-supervisi/e-supervisi.controller.ts:59](<D:/acca-new/apps/api/src/e-supervisi/e-supervisi.controller.ts:59>) — deletePenugasan | Delete('penugasan') | this.eSupervisiService.deletePenugasan |
| [apps/api/src/e-supervisi/e-supervisi.controller.ts:64](<D:/acca-new/apps/api/src/e-supervisi/e-supervisi.controller.ts:64>) — updateStatusPenugasan | Patch('penugasan') | this.eSupervisiService.updateStatusPenugasan |
| [apps/api/src/e-supervisi/e-supervisi.controller.ts:69](<D:/acca-new/apps/api/src/e-supervisi/e-supervisi.controller.ts:69>) — getRekap | Get('rekap') | this.eSupervisiService.getRekap |
| [apps/api/src/e-supervisi/e-supervisi.controller.ts:74](<D:/acca-new/apps/api/src/e-supervisi/e-supervisi.controller.ts:74>) — getSupervisorList | Get('supervisor-list') | this.eSupervisiService.getSupervisorList |
| [apps/api/src/e-supervisi/e-supervisi.controller.ts:79](<D:/acca-new/apps/api/src/e-supervisi/e-supervisi.controller.ts:79>) — getUnggahan | Get('unggahan') | this.eSupervisiService.getUnggahan |
| [apps/api/src/e-supervisi/e-supervisi.controller.ts:84](<D:/acca-new/apps/api/src/e-supervisi/e-supervisi.controller.ts:84>) — upsertUnggahanRecord | Post('unggahan/record') | this.eSupervisiService.upsertUnggahanRecord |
| [apps/api/src/e-supervisi/e-supervisi.controller.ts:89](<D:/acca-new/apps/api/src/e-supervisi/e-supervisi.controller.ts:89>) — deleteUnggahan | Delete('unggahan') | this.eSupervisiService.deleteUnggahan |
| [apps/api/src/e-supervisi/e-supervisi.controller.ts:94](<D:/acca-new/apps/api/src/e-supervisi/e-supervisi.controller.ts:94>) — getTahunAjaranList | Get('tahun-ajaran') | this.eSupervisiService.getTahunAjaranList |

## apps/api/src/ekskul/ekskul-submission.controller.ts

Dekorator kelas: `ApiTags('Ekskul Submission'); ApiBearerAuth(); UseGuards(JwtAuthGuard); Controller('ekskul/submission')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/ekskul/ekskul-submission.controller.ts:13](<D:/acca-new/apps/api/src/ekskul/ekskul-submission.controller.ts:13>) — getSubmissions | Get() | this.service.getSubmissions |
| [apps/api/src/ekskul/ekskul-submission.controller.ts:18](<D:/acca-new/apps/api/src/ekskul/ekskul-submission.controller.ts:18>) — postSubmission | Post() | this.service.postSubmission |
| [apps/api/src/ekskul/ekskul-submission.controller.ts:23](<D:/acca-new/apps/api/src/ekskul/ekskul-submission.controller.ts:23>) — deleteSubmission | Delete() | this.service.deleteSubmission |
| [apps/api/src/ekskul/ekskul-submission.controller.ts:28](<D:/acca-new/apps/api/src/ekskul/ekskul-submission.controller.ts:28>) — postPembayaran | Post('pembayaran') | this.service.postPembayaran |

## apps/api/src/ekskul/ekskul.controller.ts

Dekorator kelas: `ApiTags('Ekskul'); ApiBearerAuth(); UseGuards(JwtAuthGuard); Controller('ekskul')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/ekskul/ekskul.controller.ts:36](<D:/acca-new/apps/api/src/ekskul/ekskul.controller.ts:36>) — getEkskul | Get(); ApiOperation({ summary: 'Daftar master ekskul' }) | this.ekskulService.getEkskulList |
| [apps/api/src/ekskul/ekskul.controller.ts:42](<D:/acca-new/apps/api/src/ekskul/ekskul.controller.ts:42>) — upsertEkskul | Post(); ApiOperation({ summary: 'Tambah atau ubah master ekskul' }) | this.ekskulService.isManager, this.ekskulService.upsertEkskul |
| [apps/api/src/ekskul/ekskul.controller.ts:52](<D:/acca-new/apps/api/src/ekskul/ekskul.controller.ts:52>) — deleteEkskul | Delete(); ApiOperation({ summary: 'Hapus master ekskul' }) | this.ekskulService.isManager, this.ekskulService.deleteEkskul |
| [apps/api/src/ekskul/ekskul.controller.ts:64](<D:/acca-new/apps/api/src/ekskul/ekskul.controller.ts:64>) — getEkskulSiswa | Get('siswa'); ApiOperation({ summary: 'Daftar relasi siswa ekskul' }) | this.ekskulService.getEkskulSiswaList |
| [apps/api/src/ekskul/ekskul.controller.ts:94](<D:/acca-new/apps/api/src/ekskul/ekskul.controller.ts:94>) — upsertEkskulSiswa | Post('siswa'); ApiOperation({ summary: 'Tambah atau ubah data siswa ekskul' }) | this.ekskulService.upsertEkskulSiswa |
| [apps/api/src/ekskul/ekskul.controller.ts:110](<D:/acca-new/apps/api/src/ekskul/ekskul.controller.ts:110>) — deleteEkskulSiswa | Delete('siswa'); ApiOperation({ summary: 'Hapus relasi siswa ekskul' }) | this.ekskulService.deleteEkskulSiswa |
| [apps/api/src/ekskul/ekskul.controller.ts:122](<D:/acca-new/apps/api/src/ekskul/ekskul.controller.ts:122>) — getPembina | Get('pembina'); ApiOperation({ summary: 'Daftar pembina ekskul' }) | this.ekskulService.getPembinaList |
| [apps/api/src/ekskul/ekskul.controller.ts:138](<D:/acca-new/apps/api/src/ekskul/ekskul.controller.ts:138>) — upsertPembina | Post('pembina'); ApiOperation({ summary: 'Tambah atau ubah pembina ekskul' }) | this.ekskulService.upsertPembina |
| [apps/api/src/ekskul/ekskul.controller.ts:150](<D:/acca-new/apps/api/src/ekskul/ekskul.controller.ts:150>) — deletePembina | Delete('pembina'); ApiOperation({ summary: 'Hapus pembina ekskul' }) | this.ekskulService.deletePembina |
| [apps/api/src/ekskul/ekskul.controller.ts:159](<D:/acca-new/apps/api/src/ekskul/ekskul.controller.ts:159>) — getPertemuan | Get('pertemuan'); ApiOperation({ summary: 'Daftar pertemuan ekskul' }) | this.ekskulService.getPertemuanList |
| [apps/api/src/ekskul/ekskul.controller.ts:177](<D:/acca-new/apps/api/src/ekskul/ekskul.controller.ts:177>) — upsertPertemuan | Post('pertemuan'); ApiOperation({ summary: 'Simpan / update pertemuan ekskul' }) | this.ekskulService.upsertPertemuan |
| [apps/api/src/ekskul/ekskul.controller.ts:184](<D:/acca-new/apps/api/src/ekskul/ekskul.controller.ts:184>) — deletePertemuan | Delete('pertemuan'); ApiOperation({ summary: 'Hapus pertemuan ekskul' }) | this.ekskulService.deletePertemuan |
| [apps/api/src/ekskul/ekskul.controller.ts:190](<D:/acca-new/apps/api/src/ekskul/ekskul.controller.ts:190>) — getAbsensi | Get('absensi'); ApiOperation({ summary: 'Ambil absensi pertemuan ekskul' }) | this.ekskulService.getAbsensiPertemuan |
| [apps/api/src/ekskul/ekskul.controller.ts:196](<D:/acca-new/apps/api/src/ekskul/ekskul.controller.ts:196>) — saveAbsensi | Post('absensi'); ApiOperation({ summary: 'Simpan absensi pertemuan ekskul' }) | this.ekskulService.saveAbsensiPertemuan |
| [apps/api/src/ekskul/ekskul.controller.ts:205](<D:/acca-new/apps/api/src/ekskul/ekskul.controller.ts:205>) — approveSubmission | Post('approval'); ApiOperation({ summary: 'Approve atau revisi laporan ekskul' }) | this.ekskulService.approveSubmission |
| [apps/api/src/ekskul/ekskul.controller.ts:211](<D:/acca-new/apps/api/src/ekskul/ekskul.controller.ts:211>) — getReportData | Post('report-data'); ApiOperation({ summary: 'Ambil data lengkap untuk laporan PDF ekskul' }) | this.ekskulService.getReportData |
| [apps/api/src/ekskul/ekskul.controller.ts:217](<D:/acca-new/apps/api/src/ekskul/ekskul.controller.ts:217>) — updatePdfUrl | Post('update-pdf'); ApiOperation({ summary: 'Update URL PDF laporan ekskul' }) | this.ekskulService.updatePdfUrl |

## apps/api/src/forms/forms.controller.ts

Dekorator kelas: `ApiTags('Forms'); Controller('forms')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/forms/forms.controller.ts:24](<D:/acca-new/apps/api/src/forms/forms.controller.ts:24>) — getPengembanganDiri | Get('pengembangan-diri'); UseGuards(JwtAuthGuard); ApiBearerAuth() | this.formsService.getPengembanganDiriSurvey |
| [apps/api/src/forms/forms.controller.ts:43](<D:/acca-new/apps/api/src/forms/forms.controller.ts:43>) — deletePengembanganDiri | Delete('pengembangan-diri'); UseGuards(JwtAuthGuard); ApiBearerAuth() | this.formsService.deletePengembanganDiriSurvey |
| [apps/api/src/forms/forms.controller.ts:53](<D:/acca-new/apps/api/src/forms/forms.controller.ts:53>) — submitPengembanganDiri | Post('pengembangan-diri/submit') | this.formsService.submitPengembanganDiriSurvey |
| [apps/api/src/forms/forms.controller.ts:58](<D:/acca-new/apps/api/src/forms/forms.controller.ts:58>) — getPublicForms | Get('public'); ApiOperation({ summary: 'Daftar form publik aktif' }) | this.formsService.getPublicForms |
| [apps/api/src/forms/forms.controller.ts:64](<D:/acca-new/apps/api/src/forms/forms.controller.ts:64>) — getDynamicOptions | Get('dynamic-options'); ApiOperation({ summary: 'Ambil opsi dinamis untuk form' }) | this.formsService.getDynamicOptions |
| [apps/api/src/forms/forms.controller.ts:70](<D:/acca-new/apps/api/src/forms/forms.controller.ts:70>) — submitResponse | Post('submit'); UseGuards(OptionalJwtAuthGuard); ApiOperation({ summary: 'Kirim respon form (publik/privat)' }) | this.formsService.submitResponse |
| [apps/api/src/forms/forms.controller.ts:77](<D:/acca-new/apps/api/src/forms/forms.controller.ts:77>) — getForms | Get(); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Ambil semua form untuk dashboard' }) | this.formsService.getForms |
| [apps/api/src/forms/forms.controller.ts:85](<D:/acca-new/apps/api/src/forms/forms.controller.ts:85>) — createForm | Post(); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Buat formulir baru' }) | this.formsService.createForm |
| [apps/api/src/forms/forms.controller.ts:93](<D:/acca-new/apps/api/src/forms/forms.controller.ts:93>) — getFormById | Get(':id'); UseGuards(OptionalJwtAuthGuard); ApiOperation({ summary: 'Ambil detail formulir berdasarkan ID atau slug' }) | this.formsService.getFormById |
| [apps/api/src/forms/forms.controller.ts:100](<D:/acca-new/apps/api/src/forms/forms.controller.ts:100>) — updateForm | Put(':id'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Ubah formulir' }) | this.formsService.updateForm |
| [apps/api/src/forms/forms.controller.ts:112](<D:/acca-new/apps/api/src/forms/forms.controller.ts:112>) — deleteForm | Delete(':id'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Hapus formulir' }) | this.formsService.deleteForm |
| [apps/api/src/forms/forms.controller.ts:120](<D:/acca-new/apps/api/src/forms/forms.controller.ts:120>) — getResponses | Get(':id/responses'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Ambil daftar respon formulir' }) | this.formsService.getResponses |
| [apps/api/src/forms/forms.controller.ts:132](<D:/acca-new/apps/api/src/forms/forms.controller.ts:132>) — deleteResponses | Delete(':id/responses'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Hapus respon formulir (satu atau banyak)' }) | this.formsService.deleteResponses |
| [apps/api/src/forms/forms.controller.ts:151](<D:/acca-new/apps/api/src/forms/forms.controller.ts:151>) — deleteResponse | Delete(':id/responses/:responseId'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Hapus respon formulir by ID' }) | this.formsService.deleteResponses |
| [apps/api/src/forms/forms.controller.ts:163](<D:/acca-new/apps/api/src/forms/forms.controller.ts:163>) — allocate | Post(':id/allocate'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Jalankan seleksi kuota respon formulir' }) | this.formsService.allocate |
| [apps/api/src/forms/forms.controller.ts:175](<D:/acca-new/apps/api/src/forms/forms.controller.ts:175>) — recalculateScores | Patch(':id/allocate'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Hitung ulang skor tanggapan formulir' }) | this.formsService.recalculateScores |

## apps/api/src/guru-asuh/guru-asuh.controller.ts

Dekorator kelas: `ApiTags('Guru Asuh'); Controller('guru-asuh')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/guru-asuh/guru-asuh.controller.ts:20](<D:/acca-new/apps/api/src/guru-asuh/guru-asuh.controller.ts:20>) — getAbsensiAkumulasi | Get('absensi-akumulasi'); ApiBearerAuth(); UseGuards(JwtAuthGuard); ApiOperation({ summary: 'Ambil daftar mapel/kelas atau rekap akumulasi absensi anak asuh' }) | this.service.getAbsensiAkumulasi |
| [apps/api/src/guru-asuh/guru-asuh.controller.ts:28](<D:/acca-new/apps/api/src/guru-asuh/guru-asuh.controller.ts:28>) — getEkskul | Get('ekskul'); ApiBearerAuth(); UseGuards(JwtAuthGuard); ApiOperation({ summary: 'Daftar ekstrakurikuler anak asuh' }) | this.service.getEkskul |
| [apps/api/src/guru-asuh/guru-asuh.controller.ts:36](<D:/acca-new/apps/api/src/guru-asuh/guru-asuh.controller.ts:36>) — getKokurikuler | Get('kokurikuler'); ApiBearerAuth(); UseGuards(JwtAuthGuard); ApiOperation({ summary: 'Daftar anak asuh aktif guru' }) | this.service.getKokurikuler |
| [apps/api/src/guru-asuh/guru-asuh.controller.ts:44](<D:/acca-new/apps/api/src/guru-asuh/guru-asuh.controller.ts:44>) — getLaporan | Get('laporan'); ApiBearerAuth(); UseGuards(JwtAuthGuard); ApiOperation({ summary: 'Daftar log kegiatan pembinaan guru asuh' }) | this.service.getLaporan |
| [apps/api/src/guru-asuh/guru-asuh.controller.ts:52](<D:/acca-new/apps/api/src/guru-asuh/guru-asuh.controller.ts:52>) — saveLaporan | Post('laporan'); ApiBearerAuth(); UseGuards(JwtAuthGuard); ApiOperation({ summary: 'Simpan / perbarui log kegiatan pembinaan guru asuh' }) | this.service.saveLaporan |
| [apps/api/src/guru-asuh/guru-asuh.controller.ts:60](<D:/acca-new/apps/api/src/guru-asuh/guru-asuh.controller.ts:60>) — deleteLaporan | Delete('laporan'); ApiBearerAuth(); UseGuards(JwtAuthGuard); ApiOperation({ summary: 'Hapus log kegiatan pembinaan guru asuh' }) | this.service.deleteLaporan |
| [apps/api/src/guru-asuh/guru-asuh.controller.ts:68](<D:/acca-new/apps/api/src/guru-asuh/guru-asuh.controller.ts:68>) — getSubmissions | Get('laporan-submission'); ApiBearerAuth(); UseGuards(JwtAuthGuard); ApiOperation({ summary: 'Daftar pengajuan laporan bulanan guru asuh' }) | this.service.getSubmissions |
| [apps/api/src/guru-asuh/guru-asuh.controller.ts:76](<D:/acca-new/apps/api/src/guru-asuh/guru-asuh.controller.ts:76>) — postSubmission | Post('laporan-submission'); ApiBearerAuth(); UseGuards(JwtAuthGuard); ApiOperation({ summary: 'Ajukan laporan bulanan guru asuh' }) | this.service.postSubmission |
| [apps/api/src/guru-asuh/guru-asuh.controller.ts:84](<D:/acca-new/apps/api/src/guru-asuh/guru-asuh.controller.ts:84>) — deleteSubmission | Delete('laporan-submission'); ApiBearerAuth(); UseGuards(JwtAuthGuard); ApiOperation({ summary: 'Batalkan pengajuan laporan bulanan guru asuh' }) | this.service.deleteSubmission |
| [apps/api/src/guru-asuh/guru-asuh.controller.ts:92](<D:/acca-new/apps/api/src/guru-asuh/guru-asuh.controller.ts:92>) — approveSubmission | Post('laporan-submission/approve'); ApiBearerAuth(); UseGuards(JwtAuthGuard); ApiOperation({ summary: 'Persetujuan / revisi pengajuan laporan bulanan guru asuh' }) | this.service.approveSubmission |
| [apps/api/src/guru-asuh/guru-asuh.controller.ts:100](<D:/acca-new/apps/api/src/guru-asuh/guru-asuh.controller.ts:100>) — verifySubmission | Get('laporan-submission/verify'); ApiOperation({ summary: 'Verifikasi publik dokumen laporan bulanan via QR' }) | this.service.verifySubmission |
| [apps/api/src/guru-asuh/guru-asuh.controller.ts:106](<D:/acca-new/apps/api/src/guru-asuh/guru-asuh.controller.ts:106>) — postPembayaran | Post('laporan-submission/pembayaran'); ApiBearerAuth(); UseGuards(JwtAuthGuard); ApiOperation({ summary: 'Tandai status pembayaran komite' }) | this.service.postPembayaran |
| [apps/api/src/guru-asuh/guru-asuh.controller.ts:114](<D:/acca-new/apps/api/src/guru-asuh/guru-asuh.controller.ts:114>) — getReportData | Get('laporan-submission/report-data'); ApiBearerAuth(); UseGuards(JwtAuthGuard); ApiOperation({ summary: 'Data lengkap untuk laporan PDF & preview' }) | this.service.getReportData |
| [apps/api/src/guru-asuh/guru-asuh.controller.ts:122](<D:/acca-new/apps/api/src/guru-asuh/guru-asuh.controller.ts:122>) — updatePdfUrl | Post('laporan-submission/pdf-url'); ApiBearerAuth(); UseGuards(JwtAuthGuard); ApiOperation({ summary: 'Perbarui URL PDF submission laporan' }) | this.service.updatePdfUrl |
| [apps/api/src/guru-asuh/guru-asuh.controller.ts:130](<D:/acca-new/apps/api/src/guru-asuh/guru-asuh.controller.ts:130>) — bulkCopy | Post('bulk-copy'); ApiBearerAuth(); UseGuards(JwtAuthGuard); ApiOperation({ summary: 'Bulk copy siswa asuh dari tahun ajaran sebelumnya' }) | this.service.bulkCopy |

## apps/api/src/health/health.controller.ts

Dekorator kelas: `ApiTags('Health Check'); Controller('health')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/health/health.controller.ts:12](<D:/acca-new/apps/api/src/health/health.controller.ts:12>) — check | Get(); ApiOperation({ summary: 'Check server health and Prisma PostgreSQL status' }); ApiResponse({ status: 200, description: 'Server and Database services status' }) |  |

## apps/api/src/informasi/informasi.controller.ts

Dekorator kelas: `Controller('informasi'); UseGuards(JwtAuthGuard, FeatureAccessGuard)`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/informasi/informasi.controller.ts:23](<D:/acca-new/apps/api/src/informasi/informasi.controller.ts:23>) — getInformasi | Get() | this.informasiService.getInformasiUntuk |
| [apps/api/src/informasi/informasi.controller.ts:36](<D:/acca-new/apps/api/src/informasi/informasi.controller.ts:36>) — getIzinSaya | Get('izin-saya') | this.informasiService.getIzinInformasi |
| [apps/api/src/informasi/informasi.controller.ts:41](<D:/acca-new/apps/api/src/informasi/informasi.controller.ts:41>) — createInformasi | Post(); FeatureAccess(INFORMASI_KELOLA_KEY, ...WKM_INFORMASI) | this.informasiService.createInformasi |
| [apps/api/src/informasi/informasi.controller.ts:47](<D:/acca-new/apps/api/src/informasi/informasi.controller.ts:47>) — updateInformasi | Patch(); FeatureAccess(INFORMASI_KELOLA_KEY, ...WKM_INFORMASI) | this.informasiService.updateInformasi |
| [apps/api/src/informasi/informasi.controller.ts:53](<D:/acca-new/apps/api/src/informasi/informasi.controller.ts:53>) — deleteInformasi | Delete(); FeatureAccess(INFORMASI_KELOLA_KEY, ...WKM_INFORMASI) | this.informasiService.deleteInformasi |
| [apps/api/src/informasi/informasi.controller.ts:63](<D:/acca-new/apps/api/src/informasi/informasi.controller.ts:63>) — getShareLink | Get('share') | this.informasiService.getShareLink |
| [apps/api/src/informasi/informasi.controller.ts:68](<D:/acca-new/apps/api/src/informasi/informasi.controller.ts:68>) — createShareLink | Post('share'); FeatureAccess(INFORMASI_KELOLA_KEY, ...WKM_INFORMASI) | this.informasiService.createShareLink |
| [apps/api/src/informasi/informasi.controller.ts:74](<D:/acca-new/apps/api/src/informasi/informasi.controller.ts:74>) — deleteShareLink | Delete('share'); FeatureAccess(INFORMASI_KELOLA_KEY, ...WKM_INFORMASI) | this.informasiService.deleteShareLink |

## apps/api/src/izin-guru/izin-guru.controller.ts

Dekorator kelas: `Controller('izin-guru'); UseGuards(JwtAuthGuard)`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/izin-guru/izin-guru.controller.ts:25](<D:/acca-new/apps/api/src/izin-guru/izin-guru.controller.ts:25>) — getIzinGuru | Get() | this.izinGuruService.getIzin |
| [apps/api/src/izin-guru/izin-guru.controller.ts:32](<D:/acca-new/apps/api/src/izin-guru/izin-guru.controller.ts:32>) — createIzinGuru | Post() | this.izinGuruService.createIzin |
| [apps/api/src/izin-guru/izin-guru.controller.ts:39](<D:/acca-new/apps/api/src/izin-guru/izin-guru.controller.ts:39>) — updateIzinGuru | Patch(':id') | this.izinGuruService.updateIzin |
| [apps/api/src/izin-guru/izin-guru.controller.ts:46](<D:/acca-new/apps/api/src/izin-guru/izin-guru.controller.ts:46>) — deleteIzinGuru | Delete(':id') | this.izinGuruService.deleteIzin |

## apps/api/src/jadwal/jadwal.controller.ts

Dekorator kelas: `ApiTags('Jadwal'); ApiBearerAuth(); UseGuards(JwtAuthGuard, RolesGuard, FeatureAccessGuard); Controller('jadwal')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/jadwal/jadwal.controller.ts:28](<D:/acca-new/apps/api/src/jadwal/jadwal.controller.ts:28>) — generate | Post('generate'); FeatureAccess(JADWAL_GENERATE_KEY) | this.writer.generate |
| [apps/api/src/jadwal/jadwal.controller.ts:32](<D:/acca-new/apps/api/src/jadwal/jadwal.controller.ts:32>) — save | Post('save'); FeatureAccess(JADWAL_GENERATE_KEY) | this.writer.save |
| [apps/api/src/jadwal/jadwal.controller.ts:36](<D:/acca-new/apps/api/src/jadwal/jadwal.controller.ts:36>) — deleteDates | Post('delete-dates'); FeatureAccess(JADWAL_GENERATE_KEY) | this.writer.deleteDates |
| [apps/api/src/jadwal/jadwal.controller.ts:40](<D:/acca-new/apps/api/src/jadwal/jadwal.controller.ts:40>) — deleteRows | Post('delete-rows'); FeatureAccess(JADWAL_GENERATE_KEY) | this.writer.deleteRows |
| [apps/api/src/jadwal/jadwal.controller.ts:44](<D:/acca-new/apps/api/src/jadwal/jadwal.controller.ts:44>) — moveDate | Post('move-date'); FeatureAccess(JADWAL_GENERATE_KEY) | this.writer.moveDate |
| [apps/api/src/jadwal/jadwal.controller.ts:52](<D:/acca-new/apps/api/src/jadwal/jadwal.controller.ts:52>) — getJadwal | Get(); ApiOperation({ summary: 'Ambil daftar jadwal pelajaran guru' }) | this.jadwalService.getJadwal |
| [apps/api/src/jadwal/jadwal.controller.ts:58](<D:/acca-new/apps/api/src/jadwal/jadwal.controller.ts:58>) — bulkCreateJadwal | Post(); ApiOperation({ summary: 'Bulk insert jadwal pelajaran guru' }); FeatureAccess(JADWAL_GENERATE_KEY) | this.jadwalService.bulkCreateJadwal |
| [apps/api/src/jadwal/jadwal.controller.ts:65](<D:/acca-new/apps/api/src/jadwal/jadwal.controller.ts:65>) — getIzinSaya | Get('izin-saya'); ApiOperation({ summary: 'Hak pengguna saat ini atas halaman jadwal' }) | this.jadwalService.getIzinJadwal |
| [apps/api/src/jadwal/jadwal.controller.ts:75](<D:/acca-new/apps/api/src/jadwal/jadwal.controller.ts:75>) — getTukarSlots | Get('tukar/slots'); ApiOperation({ summary: 'Ambil slot jadwal guru yang dapat diajukan untuk ditukar' }) | this.jadwalService.getTukarSlots |
| [apps/api/src/jadwal/jadwal.controller.ts:85](<D:/acca-new/apps/api/src/jadwal/jadwal.controller.ts:85>) — getTukarGuru | Get('tukar/guru'); ApiOperation({ summary: 'Ambil daftar rekan guru yang memiliki jadwal aktif untuk diajak bertukar' }) | this.jadwalService.getTukarGuru |
| [apps/api/src/jadwal/jadwal.controller.ts:91](<D:/acca-new/apps/api/src/jadwal/jadwal.controller.ts:91>) — getTukarList | Get('tukar'); ApiOperation({ summary: 'Riwayat pengajuan tukar jadwal' }) | this.jadwalService.getTukarList |
| [apps/api/src/jadwal/jadwal.controller.ts:102](<D:/acca-new/apps/api/src/jadwal/jadwal.controller.ts:102>) — createTukar | Post('tukar'); ApiOperation({ summary: 'Ajukan permohonan tukar jadwal baru' }) | this.jadwalService.createTukar |
| [apps/api/src/jadwal/jadwal.controller.ts:108](<D:/acca-new/apps/api/src/jadwal/jadwal.controller.ts:108>) — getTukarDetail | Get('tukar/:id'); ApiOperation({ summary: 'Ambil detail 1 request tukar jadwal' }) | this.jadwalService.getTukarDetail |
| [apps/api/src/jadwal/jadwal.controller.ts:114](<D:/acca-new/apps/api/src/jadwal/jadwal.controller.ts:114>) — respondTukarPut | Put('tukar/:id'); ApiOperation({ summary: 'Tanggapi pengajuan tukar jadwal (terima/tolak/setujui)' }) | this.jadwalService.respondTukar |
| [apps/api/src/jadwal/jadwal.controller.ts:124](<D:/acca-new/apps/api/src/jadwal/jadwal.controller.ts:124>) — respondTukarPatch | Patch('tukar/:id'); ApiOperation({ summary: 'Tanggapi pengajuan tukar jadwal (patch method)' }) | this.jadwalService.respondTukar |
| [apps/api/src/jadwal/jadwal.controller.ts:134](<D:/acca-new/apps/api/src/jadwal/jadwal.controller.ts:134>) — cancelTukar | Delete('tukar/:id'); ApiOperation({ summary: 'Batalkan pengajuan tukar jadwal' }) | this.jadwalService.cancelTukar |
| [apps/api/src/jadwal/jadwal.controller.ts:140](<D:/acca-new/apps/api/src/jadwal/jadwal.controller.ts:140>) — getScopes | Get('scopes'); ApiOperation({ summary: 'Ambil scope kelas/mapel/jam guru untuk dropdown absensi' }) | this.jadwalService.getScopes |

## apps/api/src/jurnal/jurnal.controller.ts

Dekorator kelas: `Controller('jurnal'); UseGuards(JwtAuthGuard)`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/jurnal/jurnal.controller.ts:25](<D:/acca-new/apps/api/src/jurnal/jurnal.controller.ts:25>) — getSettings | Get('pengaturan') | this.jurnalService.getSettings |
| [apps/api/src/jurnal/jurnal.controller.ts:31](<D:/acca-new/apps/api/src/jurnal/jurnal.controller.ts:31>) — updateSettings | Post('pengaturan') | this.jurnalService.updateSettings |
| [apps/api/src/jurnal/jurnal.controller.ts:37](<D:/acca-new/apps/api/src/jurnal/jurnal.controller.ts:37>) — generateMassal | Post('pengaturan/generate-massal'); UseGuards(FeatureAccessGuard); FeatureAccess('jurnal_access_config') | this.jurnalService.generateMassal |
| [apps/api/src/jurnal/jurnal.controller.ts:60](<D:/acca-new/apps/api/src/jurnal/jurnal.controller.ts:60>) — deleteByDate | Delete('pengaturan/delete-by-date'); UseGuards(FeatureAccessGuard); FeatureAccess('jurnal_access_config') | this.jurnalService.deleteByDate |
| [apps/api/src/jurnal/jurnal.controller.ts:82](<D:/acca-new/apps/api/src/jurnal/jurnal.controller.ts:82>) — checkSlot | Get('check-slot') | this.jurnalService.checkSlot |
| [apps/api/src/jurnal/jurnal.controller.ts:87](<D:/acca-new/apps/api/src/jurnal/jurnal.controller.ts:87>) — getRekap | Get('rekap') | this.jurnalService.getRekap |
| [apps/api/src/jurnal/jurnal.controller.ts:93](<D:/acca-new/apps/api/src/jurnal/jurnal.controller.ts:93>) — getBanding | Get('banding') | this.jurnalService.getBanding |
| [apps/api/src/jurnal/jurnal.controller.ts:98](<D:/acca-new/apps/api/src/jurnal/jurnal.controller.ts:98>) — createBanding | Post('banding') | this.jurnalService.createBanding |
| [apps/api/src/jurnal/jurnal.controller.ts:103](<D:/acca-new/apps/api/src/jurnal/jurnal.controller.ts:103>) — getBandingById | Get('banding/:id') | this.jurnalService.getBandingById |
| [apps/api/src/jurnal/jurnal.controller.ts:108](<D:/acca-new/apps/api/src/jurnal/jurnal.controller.ts:108>) — updateBanding | Patch('banding/:id') | this.jurnalService.updateBanding |
| [apps/api/src/jurnal/jurnal.controller.ts:114](<D:/acca-new/apps/api/src/jurnal/jurnal.controller.ts:114>) — getJurnalMaster | Get('jurnal-master') | this.jurnalService.getJurnalMaster |
| [apps/api/src/jurnal/jurnal.controller.ts:119](<D:/acca-new/apps/api/src/jurnal/jurnal.controller.ts:119>) — findById | Get(':id') | this.jurnalService.findById |
| [apps/api/src/jurnal/jurnal.controller.ts:124](<D:/acca-new/apps/api/src/jurnal/jurnal.controller.ts:124>) — update | Patch(':id') | this.jurnalService.update |
| [apps/api/src/jurnal/jurnal.controller.ts:129](<D:/acca-new/apps/api/src/jurnal/jurnal.controller.ts:129>) — remove | Delete(':id') | this.jurnalService.remove |
| [apps/api/src/jurnal/jurnal.controller.ts:134](<D:/acca-new/apps/api/src/jurnal/jurnal.controller.ts:134>) — findAll | Get() | this.jurnalService.findAll |
| [apps/api/src/jurnal/jurnal.controller.ts:139](<D:/acca-new/apps/api/src/jurnal/jurnal.controller.ts:139>) — create | Post() | this.jurnalService.create |

## apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts

Dekorator kelas: `Controller('ketidakhadiran'); UseGuards(JwtAuthGuard, PageAccessGuard)`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:61](<D:/acca-new/apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:61>) — getLog | Get('log') | this.ketidakhadiranService.getLog |
| [apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:67](<D:/acca-new/apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:67>) — getLogGuruAsuh | Get('log/guru-asuh') | this.ketidakhadiranService.getLogGuruAsuh |
| [apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:76](<D:/acca-new/apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:76>) — getLogWaliKelas | Get('log/wali-kelas') | this.ketidakhadiranService.getLogWaliKelas |
| [apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:90](<D:/acca-new/apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:90>) — getLogSiswa | Get('log/siswa/:nisn') | this.ketidakhadiranService.getLogSiswa |
| [apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:96](<D:/acca-new/apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:96>) — getAbsensi | Get('absensi'); RequiresPage(...PAGE_KELOLA, 'absensi') | this.ketidakhadiranService.getAbsensi |
| [apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:107](<D:/acca-new/apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:107>) — getRekap | Get('rekap'); RequiresPage(...PAGE_KELOLA) | this.ketidakhadiranService.getRekap |
| [apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:118](<D:/acca-new/apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:118>) — getRekamMedisSiswa | Get('rekam-medis-siswa'); RequiresPage('rekam-medis') | this.ketidakhadiranService.getRekamMedisSiswa |
| [apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:124](<D:/acca-new/apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:124>) — createRekamMedisSiswa | Post('rekam-medis-siswa'); RequiresPage('rekam-medis') | this.ketidakhadiranService.createRekamMedisSiswa |
| [apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:131](<D:/acca-new/apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:131>) — updateRekamMedisSiswa | Put('rekam-medis-siswa/:id'); RequiresPage('rekam-medis') | this.ketidakhadiranService.updateRekamMedisSiswa |
| [apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:142](<D:/acca-new/apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:142>) — updateRekamMedisSiswaByBody | Put('rekam-medis-siswa'); RequiresPage('rekam-medis') | this.ketidakhadiranService.updateRekamMedisSiswa |
| [apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:154](<D:/acca-new/apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:154>) — deleteRekamMedisSiswa | Delete('rekam-medis-siswa/:id'); RequiresPage('rekam-medis') | this.ketidakhadiranService.deleteRekamMedisSiswa |
| [apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:160](<D:/acca-new/apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:160>) — deleteRekamMedisSiswaByQuery | Delete('rekam-medis-siswa'); RequiresPage('rekam-medis') | this.ketidakhadiranService.deleteRekamMedisSiswa |
| [apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:167](<D:/acca-new/apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:167>) — verifyAccaLetter | Get('acca-letter/verify') | this.ketidakhadiranService.verifyAccaLetter |
| [apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:172](<D:/acca-new/apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:172>) — getAccaLetters | Get('acca-letter'); RequiresPage(...PAGE_KELOLA) | this.ketidakhadiranService.getAccaLetters |
| [apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:178](<D:/acca-new/apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:178>) — createAccaLetter | Post('acca-letter'); RequiresPage(...PAGE_KELOLA) | this.ketidakhadiranService.createAccaLetter |
| [apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:185](<D:/acca-new/apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:185>) — deleteAccaLetter | Delete('acca-letter/:id'); RequiresPage(...PAGE_KELOLA) | this.ketidakhadiranService.deleteAccaLetter |
| [apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:192](<D:/acca-new/apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:192>) — saveAccaLetter | Post('save-letter'); RequiresPage(...PAGE_KELOLA) | this.ketidakhadiranService.saveAccaLetter |
| [apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:199](<D:/acca-new/apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:199>) — list | Get(); RequiresPage(...PAGE_KELOLA, 'absensi') | this.ketidakhadiranService.findAll |
| [apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:219](<D:/acca-new/apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:219>) — createBulk | Post('bulk'); RequiresPage(...PAGE_KELOLA) | this.ketidakhadiranService.createBulk |
| [apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:227](<D:/acca-new/apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:227>) — getOne | Get(':id'); RequiresPage(...PAGE_KELOLA) | this.ketidakhadiranService.findById |
| [apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:234](<D:/acca-new/apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:234>) — update | Patch(':id'); RequiresPage(...PAGE_KELOLA) | this.ketidakhadiranService.update |
| [apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:241](<D:/acca-new/apps/api/src/ketidakhadiran/ketidakhadiran.controller.ts:241>) — remove | Delete(':id'); RequiresPage(...PAGE_KELOLA) | this.ketidakhadiranService.remove |

## apps/api/src/keuangan/keuangan.controller.ts

Dekorator kelas: `Controller('keuangan'); UseGuards(JwtAuthGuard)`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/keuangan/keuangan.controller.ts:11](<D:/acca-new/apps/api/src/keuangan/keuangan.controller.ts:11>) — getCatatanKeuangan | Get('catatan-keuangan') | this.keuanganService.getCatatanKeuangan |
| [apps/api/src/keuangan/keuangan.controller.ts:16](<D:/acca-new/apps/api/src/keuangan/keuangan.controller.ts:16>) — postCatatanKeuangan | Post('catatan-keuangan') | this.keuanganService.postCatatanKeuangan |
| [apps/api/src/keuangan/keuangan.controller.ts:21](<D:/acca-new/apps/api/src/keuangan/keuangan.controller.ts:21>) — putCatatanKeuangan | Put('catatan-keuangan') | this.keuanganService.putCatatanKeuangan |
| [apps/api/src/keuangan/keuangan.controller.ts:26](<D:/acca-new/apps/api/src/keuangan/keuangan.controller.ts:26>) — deleteCatatanKeuangan | Delete('catatan-keuangan') | this.keuanganService.deleteCatatanKeuangan |
| [apps/api/src/keuangan/keuangan.controller.ts:31](<D:/acca-new/apps/api/src/keuangan/keuangan.controller.ts:31>) — getTarifHonor | Get('tarif-honor') | this.keuanganService.getTarifHonor |
| [apps/api/src/keuangan/keuangan.controller.ts:36](<D:/acca-new/apps/api/src/keuangan/keuangan.controller.ts:36>) — putTarifHonor | Put('tarif-honor') | this.keuanganService.putTarifHonor |
| [apps/api/src/keuangan/keuangan.controller.ts:41](<D:/acca-new/apps/api/src/keuangan/keuangan.controller.ts:41>) — getKeuangan | Get('utama') | this.keuanganService.getKeuangan |
| [apps/api/src/keuangan/keuangan.controller.ts:46](<D:/acca-new/apps/api/src/keuangan/keuangan.controller.ts:46>) — postKeuangan | Post('utama') | this.keuanganService.postKeuangan |
| [apps/api/src/keuangan/keuangan.controller.ts:51](<D:/acca-new/apps/api/src/keuangan/keuangan.controller.ts:51>) — getKeuanganRoot | Get() | this.keuanganService.getKeuangan |
| [apps/api/src/keuangan/keuangan.controller.ts:56](<D:/acca-new/apps/api/src/keuangan/keuangan.controller.ts:56>) — postKeuanganRoot | Post() | this.keuanganService.postKeuangan |

## apps/api/src/kinerja-guru/kinerja-guru.controller.ts

Dekorator kelas: `ApiTags('Kinerja Guru'); ApiBearerAuth(); UseGuards(JwtAuthGuard, PageAccessGuard); RequiresPage('kinerja-guru'); Controller('kinerja-guru')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/kinerja-guru/kinerja-guru.controller.ts:18](<D:/acca-new/apps/api/src/kinerja-guru/kinerja-guru.controller.ts:18>) — getStats | Get(); ApiOperation({ summary: 'Statistik dan Metrik Kinerja Guru' }) | this.kinerjaGuruService.getStats |

## apps/api/src/klinik/klinik.controller.ts

Dekorator kelas: `UseGuards(JwtAuthGuard); Controller('klinik')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/klinik/klinik.controller.ts:10](<D:/acca-new/apps/api/src/klinik/klinik.controller.ts:10>) — get | Get() | this.klinikService.handleGet |
| [apps/api/src/klinik/klinik.controller.ts:16](<D:/acca-new/apps/api/src/klinik/klinik.controller.ts:16>) — post | Post() | this.klinikService.handlePost |
| [apps/api/src/klinik/klinik.controller.ts:22](<D:/acca-new/apps/api/src/klinik/klinik.controller.ts:22>) — patch | Patch() | this.klinikService.handlePatch |

## apps/api/src/kokurikuler/kokurikuler.controller.ts

Dekorator kelas: `ApiTags('Kokurikuler'); ApiBearerAuth(); UseGuards(JwtAuthGuard); Controller('kokurikuler')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/kokurikuler/kokurikuler.controller.ts:15](<D:/acca-new/apps/api/src/kokurikuler/kokurikuler.controller.ts:15>) — getMaster | Get('master'); ApiOperation({ summary: 'Daftar master kegiatan kokurikuler' }) | this.kokurikulerService.getMaster |
| [apps/api/src/kokurikuler/kokurikuler.controller.ts:22](<D:/acca-new/apps/api/src/kokurikuler/kokurikuler.controller.ts:22>) — createMaster | Post('master'); ApiOperation({ summary: 'Tambah kegiatan kokurikuler baru' }) | this.kokurikulerService.createMaster |
| [apps/api/src/kokurikuler/kokurikuler.controller.ts:29](<D:/acca-new/apps/api/src/kokurikuler/kokurikuler.controller.ts:29>) — updateMaster | Put('master/:id'); ApiOperation({ summary: 'Update master kegiatan kokurikuler' }) | this.kokurikulerService.updateMaster |
| [apps/api/src/kokurikuler/kokurikuler.controller.ts:36](<D:/acca-new/apps/api/src/kokurikuler/kokurikuler.controller.ts:36>) — deleteMaster | Delete('master/:id'); ApiOperation({ summary: 'Hapus master kegiatan kokurikuler' }) | this.kokurikulerService.deleteMaster |
| [apps/api/src/kokurikuler/kokurikuler.controller.ts:44](<D:/acca-new/apps/api/src/kokurikuler/kokurikuler.controller.ts:44>) — getSiswaLogs | Get('siswa'); ApiOperation({ summary: 'Ambil log kegiatan harian siswa' }) | this.kokurikulerService.getSiswaLogs |
| [apps/api/src/kokurikuler/kokurikuler.controller.ts:51](<D:/acca-new/apps/api/src/kokurikuler/kokurikuler.controller.ts:51>) — saveSiswaLogs | Post('siswa'); ApiOperation({ summary: 'Simpan log kegiatan harian siswa' }) | this.kokurikulerService.saveSiswaLogs |
| [apps/api/src/kokurikuler/kokurikuler.controller.ts:59](<D:/acca-new/apps/api/src/kokurikuler/kokurikuler.controller.ts:59>) — getVerifikasiList | Get('verifikasi'); ApiOperation({ summary: 'Daftar kegiatan siswa untuk verifikasi' }) | this.kokurikulerService.getVerifikasiList |
| [apps/api/src/kokurikuler/kokurikuler.controller.ts:65](<D:/acca-new/apps/api/src/kokurikuler/kokurikuler.controller.ts:65>) — verifyLogs | Post('verifikasi'); ApiOperation({ summary: 'Verifikasi kegiatan siswa' }) | this.kokurikulerService.verifyLogs |
| [apps/api/src/kokurikuler/kokurikuler.controller.ts:73](<D:/acca-new/apps/api/src/kokurikuler/kokurikuler.controller.ts:73>) — getLaporan | Get('laporan'); ApiOperation({ summary: 'Rekapitulasi dan laporan kegiatan kokurikuler' }) | this.kokurikulerService.getLaporan |

## apps/api/src/laporan-piket/laporan-piket.controller.ts

Dekorator kelas: `Controller('laporan-piket'); UseGuards(JwtAuthGuard)`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/laporan-piket/laporan-piket.controller.ts:20](<D:/acca-new/apps/api/src/laporan-piket/laporan-piket.controller.ts:20>) — getLaporan | Get() | this.laporanPiketService.getLaporan |
| [apps/api/src/laporan-piket/laporan-piket.controller.ts:27](<D:/acca-new/apps/api/src/laporan-piket/laporan-piket.controller.ts:27>) — createLaporan | Post() | this.laporanPiketService.createLaporan |
| [apps/api/src/laporan-piket/laporan-piket.controller.ts:38](<D:/acca-new/apps/api/src/laporan-piket/laporan-piket.controller.ts:38>) — updateLaporan | Patch() | this.laporanPiketService.updateLaporan |
| [apps/api/src/laporan-piket/laporan-piket.controller.ts:49](<D:/acca-new/apps/api/src/laporan-piket/laporan-piket.controller.ts:49>) — deleteLaporan | Delete() | this.laporanPiketService.deleteLaporan |

## apps/api/src/lckh/lckh.controller.ts

Dekorator kelas: `Controller('lckh'); UseGuards(JwtAuthGuard)`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/lckh/lckh.controller.ts:33](<D:/acca-new/apps/api/src/lckh/lckh.controller.ts:33>) — getNilaiDetail | Get('nilai-detail') | this.lckhService.getNilaiDetail |
| [apps/api/src/lckh/lckh.controller.ts:38](<D:/acca-new/apps/api/src/lckh/lckh.controller.ts:38>) — getPrintData | Get('print/data') | this.lckhService.getPrintData |
| [apps/api/src/lckh/lckh.controller.ts:43](<D:/acca-new/apps/api/src/lckh/lckh.controller.ts:43>) — getLembarPengesahanData | Get('print/lembar-pengesahan') | this.lckhService.getPrintData |
| [apps/api/src/lckh/lckh.controller.ts:48](<D:/acca-new/apps/api/src/lckh/lckh.controller.ts:48>) — getPeriods | Get('periods') | this.lckhService.getPeriods |
| [apps/api/src/lckh/lckh.controller.ts:54](<D:/acca-new/apps/api/src/lckh/lckh.controller.ts:54>) — getSubmissions | Get('submissions') | this.lckhService.getSubmissions |
| [apps/api/src/lckh/lckh.controller.ts:61](<D:/acca-new/apps/api/src/lckh/lckh.controller.ts:61>) — getSummary | Get('summary') | this.lckhService.getSummary |
| [apps/api/src/lckh/lckh.controller.ts:68](<D:/acca-new/apps/api/src/lckh/lckh.controller.ts:68>) — getSubmissionById | Get('submissions/:id') | this.lckhService.getSubmissionById |
| [apps/api/src/lckh/lckh.controller.ts:74](<D:/acca-new/apps/api/src/lckh/lckh.controller.ts:74>) — saveSubmission | Post('submissions') | this.lckhService.saveSubmission |
| [apps/api/src/lckh/lckh.controller.ts:81](<D:/acca-new/apps/api/src/lckh/lckh.controller.ts:81>) — deleteSubmission | Delete('submissions/:id') | this.lckhService.deleteSubmission |
| [apps/api/src/lckh/lckh.controller.ts:88](<D:/acca-new/apps/api/src/lckh/lckh.controller.ts:88>) — getApprovals | Get('approvals/:submissionId') | this.lckhService.getApprovals |
| [apps/api/src/lckh/lckh.controller.ts:94](<D:/acca-new/apps/api/src/lckh/lckh.controller.ts:94>) — approveSubmission | Post('approvals/:submissionId') | this.lckhService.approveSubmission |

## apps/api/src/libur/libur.controller.ts

Dekorator kelas: `ApiTags('Libur'); ApiBearerAuth(); UseGuards(JwtAuthGuard); Controller('libur')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/libur/libur.controller.ts:65](<D:/acca-new/apps/api/src/libur/libur.controller.ts:65>) — getLibur | Get(); ApiOperation({ summary: 'Daftar hari libur madrasah' }) | this.liburService.getLibur |
| [apps/api/src/libur/libur.controller.ts:78](<D:/acca-new/apps/api/src/libur/libur.controller.ts:78>) — createLibur | Post(); ApiOperation({ summary: 'Tambah data hari libur' }) | this.liburService.createLibur |
| [apps/api/src/libur/libur.controller.ts:85](<D:/acca-new/apps/api/src/libur/libur.controller.ts:85>) — updateLiburParam | Put(':id'); ApiOperation({ summary: 'Update data hari libur per id di URL' }) | this.liburService.updateLibur |
| [apps/api/src/libur/libur.controller.ts:92](<D:/acca-new/apps/api/src/libur/libur.controller.ts:92>) — updateLiburBody | Put(); ApiOperation({ summary: 'Update data hari libur per id di body' }) | this.liburService.updateLibur |
| [apps/api/src/libur/libur.controller.ts:99](<D:/acca-new/apps/api/src/libur/libur.controller.ts:99>) — deleteLiburParam | Delete(':id'); ApiOperation({ summary: 'Hapus data hari libur per id di URL' }) | this.liburService.deleteLibur |
| [apps/api/src/libur/libur.controller.ts:106](<D:/acca-new/apps/api/src/libur/libur.controller.ts:106>) — deleteLiburQuery | Delete(); ApiOperation({ summary: 'Hapus data hari libur per query id atau ids' }) | this.liburService.deleteLibur |

## apps/api/src/master/master.controller.ts

Dekorator kelas: `ApiTags('Master Data'); ApiBearerAuth(); UseGuards(JwtAuthGuard); Controller('master')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/master/master.controller.ts:62](<D:/acca-new/apps/api/src/master/master.controller.ts:62>) — getDropdown | Get('dropdown'); ApiOperation({ summary: 'Ambil opsi dropdown master data (ketidakhadiran, pangkat, dll)' }) | this.masterService.getDropdowns |
| [apps/api/src/master/master.controller.ts:68](<D:/acca-new/apps/api/src/master/master.controller.ts:68>) — bulkJpMapel | Post('jp-mapel/bulk'); ApiOperation({ summary: 'Bulk insert atau upsert jp-mapel' }) | this.masterService.bulkCreateJpMapel |
| [apps/api/src/master/master.controller.ts:75](<D:/acca-new/apps/api/src/master/master.controller.ts:75>) — getMapelKelas | Get('mapel-kelas/mappings'); ApiOperation({ summary: 'Daftar pemetaan mapel ke kelas dan guru' }) | this.masterService.getMapelKelas |
| [apps/api/src/master/master.controller.ts:84](<D:/acca-new/apps/api/src/master/master.controller.ts:84>) — saveMapelKelas | Post('mapel-kelas/mappings'); ApiOperation({ summary: 'Simpan pemetaan mapel ke kelas dan guru' }) | this.masterService.saveMapelKelas |
| [apps/api/src/master/master.controller.ts:91](<D:/acca-new/apps/api/src/master/master.controller.ts:91>) — getGuruRekening | Get('guru/rekening'); ApiOperation({ summary: 'Ambil daftar rekening guru (pemegang halaman master)' }) | this.masterService.getGuruRekening |
| [apps/api/src/master/master.controller.ts:98](<D:/acca-new/apps/api/src/master/master.controller.ts:98>) — getPindah | Get('guru/pindah'); ApiOperation({ summary: 'Ringkasan dampak penugasan sebelum mutasi guru/tendik' }) | this.masterService.getPindahPreview |
| [apps/api/src/master/master.controller.ts:105](<D:/acca-new/apps/api/src/master/master.controller.ts:105>) — postPindah | Post('guru/pindah'); ApiOperation({ summary: 'Eksekusi mutasi jenis pegawai guru <-> tendik' }) | this.masterService.executePindah |
| [apps/api/src/master/master.controller.ts:117](<D:/acca-new/apps/api/src/master/master.controller.ts:117>) — checkImport | Post('check-import'); ApiOperation({ summary: 'Cek konflik data impor sebelum simpan' }) | this.masterService.checkImport |
| [apps/api/src/master/master.controller.ts:130](<D:/acca-new/apps/api/src/master/master.controller.ts:130>) — list | Get(':entity'); ApiOperation({ summary: 'Daftar data master (pencarian, filter, paginasi)' }) | this.masterService.list |
| [apps/api/src/master/master.controller.ts:137](<D:/acca-new/apps/api/src/master/master.controller.ts:137>) — create | Post(':entity'); ApiOperation({ summary: 'Tambah data master (atau perbarui bila ?upsert=true)' }) | this.masterService.create |
| [apps/api/src/master/master.controller.ts:149](<D:/acca-new/apps/api/src/master/master.controller.ts:149>) — update | Put(':entity'); ApiOperation({ summary: 'Perbarui data master' }) | this.masterService.update |
| [apps/api/src/master/master.controller.ts:160](<D:/acca-new/apps/api/src/master/master.controller.ts:160>) — remove | Delete(':entity'); ApiOperation({ summary: 'Nonaktifkan satu data, atau kosongkan tabel (?scope=all, Admin)' }) | this.masterService.remove |

## apps/api/src/monitoring/monitoring.controller.ts

Dekorator kelas: `Controller('monitoring'); UseGuards(JwtAuthGuard)`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/monitoring/monitoring.controller.ts:29](<D:/acca-new/apps/api/src/monitoring/monitoring.controller.ts:29>) — getActivityLogs | Get('activity') | this.monitoringService.getActivityLogs |
| [apps/api/src/monitoring/monitoring.controller.ts:48](<D:/acca-new/apps/api/src/monitoring/monitoring.controller.ts:48>) — getUsers | Get('users') | this.monitoringService.getUsers |

## apps/api/src/nilai/nilai.controller.ts

Dekorator kelas: `Controller('nilai'); UseGuards(JwtAuthGuard)`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/nilai/nilai.controller.ts:20](<D:/acca-new/apps/api/src/nilai/nilai.controller.ts:20>) — getNilai | Get() | this.nilaiService.getNilai |
| [apps/api/src/nilai/nilai.controller.ts:25](<D:/acca-new/apps/api/src/nilai/nilai.controller.ts:25>) — saveNilai | Post() | this.nilaiService.saveNilai |
| [apps/api/src/nilai/nilai.controller.ts:30](<D:/acca-new/apps/api/src/nilai/nilai.controller.ts:30>) — getAdminNilai | Get('admin') | this.nilaiService.getAdminNilai |
| [apps/api/src/nilai/nilai.controller.ts:35](<D:/acca-new/apps/api/src/nilai/nilai.controller.ts:35>) — getFilters | Get('filters') | this.nilaiService.getFilters |
| [apps/api/src/nilai/nilai.controller.ts:40](<D:/acca-new/apps/api/src/nilai/nilai.controller.ts:40>) — getGuruList | Get('guru-list') | this.nilaiService.getGuruList |
| [apps/api/src/nilai/nilai.controller.ts:45](<D:/acca-new/apps/api/src/nilai/nilai.controller.ts:45>) — saveBobot | Post('bobot') | this.nilaiService.saveBobot |
| [apps/api/src/nilai/nilai.controller.ts:50](<D:/acca-new/apps/api/src/nilai/nilai.controller.ts:50>) — getSiswaPhotos | Get('siswa/photos') | this.nilaiService.getSiswaPhotos |
| [apps/api/src/nilai/nilai.controller.ts:55](<D:/acca-new/apps/api/src/nilai/nilai.controller.ts:55>) — getSiswaNilai | Get('siswa') | this.nilaiService.getSiswaNilai |
| [apps/api/src/nilai/nilai.controller.ts:60](<D:/acca-new/apps/api/src/nilai/nilai.controller.ts:60>) — getSiswaApresiasi | Get('siswa/apresiasi') | this.nilaiService.getSiswaApresiasi |
| [apps/api/src/nilai/nilai.controller.ts:65](<D:/acca-new/apps/api/src/nilai/nilai.controller.ts:65>) — getSiswaStudents | Get('siswa/students') | this.nilaiService.getSiswaStudents |
| [apps/api/src/nilai/nilai.controller.ts:70](<D:/acca-new/apps/api/src/nilai/nilai.controller.ts:70>) — getTagihan | Get('tagihan') | this.nilaiService.getTagihan |
| [apps/api/src/nilai/nilai.controller.ts:75](<D:/acca-new/apps/api/src/nilai/nilai.controller.ts:75>) — saveTagihan | Post('tagihan') | this.nilaiService.saveTagihan |
| [apps/api/src/nilai/nilai.controller.ts:80](<D:/acca-new/apps/api/src/nilai/nilai.controller.ts:80>) — deleteTagihan | Delete('tagihan/:id') | this.nilaiService.deleteTagihan |
| [apps/api/src/nilai/nilai.controller.ts:85](<D:/acca-new/apps/api/src/nilai/nilai.controller.ts:85>) — getApresiasi | Get('apresiasi') | this.nilaiService.getApresiasi |
| [apps/api/src/nilai/nilai.controller.ts:90](<D:/acca-new/apps/api/src/nilai/nilai.controller.ts:90>) — saveApresiasi | Post('apresiasi') | this.nilaiService.saveApresiasi |
| [apps/api/src/nilai/nilai.controller.ts:95](<D:/acca-new/apps/api/src/nilai/nilai.controller.ts:95>) — deleteApresiasi | Delete('apresiasi/:id') | this.nilaiService.deleteApresiasi |

## apps/api/src/notifications/notifications.controller.ts

Dekorator kelas: `ApiTags('Notifications'); UseGuards(JwtAuthGuard); Controller('notifications')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/notifications/notifications.controller.ts:12](<D:/acca-new/apps/api/src/notifications/notifications.controller.ts:12>) — getNotifications | Get(); ApiOperation({ summary: 'Ambil notifikasi aktif sesuai role user' }) | this.service.getNotifications |
| [apps/api/src/notifications/notifications.controller.ts:20](<D:/acca-new/apps/api/src/notifications/notifications.controller.ts:20>) — createNotification | Post(); ApiOperation({ summary: 'Buat notifikasi baru' }) | this.service.createNotification |

## apps/api/src/observasi-kelas/observasi-kelas.controller.ts

Dekorator kelas: `ApiTags('Observasi Kelas'); ApiBearerAuth(); UseGuards(JwtAuthGuard, PageAccessGuard); RequiresPage('observasi-kelas'); Controller('observasi-kelas')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/observasi-kelas/observasi-kelas.controller.ts:29](<D:/acca-new/apps/api/src/observasi-kelas/observasi-kelas.controller.ts:29>) — findAll | Get() | this.observasiKelasService.findAll |
| [apps/api/src/observasi-kelas/observasi-kelas.controller.ts:34](<D:/acca-new/apps/api/src/observasi-kelas/observasi-kelas.controller.ts:34>) — findOne | Get(':id') | this.observasiKelasService.findOne |
| [apps/api/src/observasi-kelas/observasi-kelas.controller.ts:39](<D:/acca-new/apps/api/src/observasi-kelas/observasi-kelas.controller.ts:39>) — create | Post() | this.observasiKelasService.create |
| [apps/api/src/observasi-kelas/observasi-kelas.controller.ts:44](<D:/acca-new/apps/api/src/observasi-kelas/observasi-kelas.controller.ts:44>) — update | Put(':id') | this.observasiKelasService.update |
| [apps/api/src/observasi-kelas/observasi-kelas.controller.ts:49](<D:/acca-new/apps/api/src/observasi-kelas/observasi-kelas.controller.ts:49>) — delete | Delete(':id') | this.observasiKelasService.delete |

## apps/api/src/orangtua/orangtua.controller.ts

Dekorator kelas: `ApiTags('Orang Tua & Siswa'); ApiBearerAuth(); UseGuards(JwtAuthGuard); Controller('orangtua')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/orangtua/orangtua.controller.ts:43](<D:/acca-new/apps/api/src/orangtua/orangtua.controller.ts:43>) — listAnak | Get('anak'); ApiOperation({ summary: 'Daftar anak yang diklaim orang tua yang login' }) | this.orangtuaService.listAnak |
| [apps/api/src/orangtua/orangtua.controller.ts:49](<D:/acca-new/apps/api/src/orangtua/orangtua.controller.ts:49>) — detailAnak | Get('anak/:nisn'); ApiOperation({ summary: 'Detail satu anak (hanya untuk orang tua yang mengklaimnya)' }) | this.orangtuaService.getAnakDetail |
| [apps/api/src/orangtua/orangtua.controller.ts:55](<D:/acca-new/apps/api/src/orangtua/orangtua.controller.ts:55>) — claimAnak | Post('anak'); ApiOperation({ summary: 'Klaim anak tambahan dari dashboard orang tua' }) | this.orangtuaService.claimAnak |
| [apps/api/src/orangtua/orangtua.controller.ts:64](<D:/acca-new/apps/api/src/orangtua/orangtua.controller.ts:64>) — listRelasi | Get('relasi'); ApiOperation({ summary: 'Seluruh relasi orang tua–siswa, atau cari siswa (?siswa=)' }) | this.orangtuaService.searchSiswa, this.orangtuaService.listRelasi |
| [apps/api/src/orangtua/orangtua.controller.ts:79](<D:/acca-new/apps/api/src/orangtua/orangtua.controller.ts:79>) — addRelasi | Post('relasi'); ApiOperation({ summary: 'Admin menautkan siswa ke akun orang tua' }) | this.orangtuaService.addRelasi |
| [apps/api/src/orangtua/orangtua.controller.ts:89](<D:/acca-new/apps/api/src/orangtua/orangtua.controller.ts:89>) — updateRelasi | Patch('relasi'); ApiOperation({ summary: 'Ubah status keluarga sebuah relasi' }) | this.orangtuaService.updateRelasi |
| [apps/api/src/orangtua/orangtua.controller.ts:102](<D:/acca-new/apps/api/src/orangtua/orangtua.controller.ts:102>) — deleteRelasi | Delete('relasi'); ApiOperation({ summary: 'Hapus relasi (akun orang tuanya tetap ada)' }) | this.orangtuaService.deleteRelasi |

## apps/api/src/pengumuman/pengumuman.controller.ts

Dekorator kelas: `Controller('pengumuman'); UseGuards(JwtAuthGuard)`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/pengumuman/pengumuman.controller.ts:10](<D:/acca-new/apps/api/src/pengumuman/pengumuman.controller.ts:10>) — getPengumuman | Get() | this.pengumumanService.getPengumuman, this.pengumumanService.getPengumumanMultipleRoles |
| [apps/api/src/pengumuman/pengumuman.controller.ts:40](<D:/acca-new/apps/api/src/pengumuman/pengumuman.controller.ts:40>) — createPengumuman | Post() | this.pengumumanService.createPengumuman |
| [apps/api/src/pengumuman/pengumuman.controller.ts:56](<D:/acca-new/apps/api/src/pengumuman/pengumuman.controller.ts:56>) — updatePengumuman | Put(':id') | this.pengumumanService.updatePengumuman |
| [apps/api/src/pengumuman/pengumuman.controller.ts:70](<D:/acca-new/apps/api/src/pengumuman/pengumuman.controller.ts:70>) — deletePengumuman | Delete(':id') | this.pengumumanService.deletePengumuman |

## apps/api/src/personal-docs/personal-docs.controller.ts

Dekorator kelas: `ApiTags('Personal Docs'); ApiBearerAuth(); UseGuards(JwtAuthGuard); Controller('personal')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/personal-docs/personal-docs.controller.ts:21](<D:/acca-new/apps/api/src/personal-docs/personal-docs.controller.ts:21>) — getFolders | Get('folders') | this.service.getFolders |
| [apps/api/src/personal-docs/personal-docs.controller.ts:31](<D:/acca-new/apps/api/src/personal-docs/personal-docs.controller.ts:31>) — createFolder | Post('folders') | this.service.createFolder |
| [apps/api/src/personal-docs/personal-docs.controller.ts:38](<D:/acca-new/apps/api/src/personal-docs/personal-docs.controller.ts:38>) — deleteFolder | Delete('folders/delete') | this.service.deleteFolder |
| [apps/api/src/personal-docs/personal-docs.controller.ts:48](<D:/acca-new/apps/api/src/personal-docs/personal-docs.controller.ts:48>) — shareFolder | Post('folders/share') | this.service.shareFolder |
| [apps/api/src/personal-docs/personal-docs.controller.ts:54](<D:/acca-new/apps/api/src/personal-docs/personal-docs.controller.ts:54>) — revokeFolderShare | Delete('folders/share/revoke') | this.service.revokeFolderShare |
| [apps/api/src/personal-docs/personal-docs.controller.ts:61](<D:/acca-new/apps/api/src/personal-docs/personal-docs.controller.ts:61>) — getDocuments | Get('documents') | this.service.getDocuments |
| [apps/api/src/personal-docs/personal-docs.controller.ts:77](<D:/acca-new/apps/api/src/personal-docs/personal-docs.controller.ts:77>) — createDocument | Post('documents') | this.service.createDocument |
| [apps/api/src/personal-docs/personal-docs.controller.ts:83](<D:/acca-new/apps/api/src/personal-docs/personal-docs.controller.ts:83>) — moveDocuments | Post('documents/move') | this.service.moveDocuments |
| [apps/api/src/personal-docs/personal-docs.controller.ts:91](<D:/acca-new/apps/api/src/personal-docs/personal-docs.controller.ts:91>) — deleteDocuments | Delete('documents/delete') | this.service.deleteDocuments |
| [apps/api/src/personal-docs/personal-docs.controller.ts:98](<D:/acca-new/apps/api/src/personal-docs/personal-docs.controller.ts:98>) — shareDocument | Post('documents/share') | this.service.shareDocument |
| [apps/api/src/personal-docs/personal-docs.controller.ts:104](<D:/acca-new/apps/api/src/personal-docs/personal-docs.controller.ts:104>) — revokeDocumentShare | Delete('documents/share/revoke') | this.service.revokeDocumentShare |
| [apps/api/src/personal-docs/personal-docs.controller.ts:110](<D:/acca-new/apps/api/src/personal-docs/personal-docs.controller.ts:110>) — getDocumentFile | Get('documents/:id/file') | this.service.getDocumentFile |
| [apps/api/src/personal-docs/personal-docs.controller.ts:121](<D:/acca-new/apps/api/src/personal-docs/personal-docs.controller.ts:121>) — searchUsers | Get('users/search') | this.service.searchUsers |

## apps/api/src/prestasi/prestasi.controller.ts

Dekorator kelas: `ApiTags('Prestasi'); ApiBearerAuth(); UseGuards(JwtAuthGuard, PageAccessGuard); RequiresPage('prestasi'); Controller('prestasi')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/prestasi/prestasi.controller.ts:30](<D:/acca-new/apps/api/src/prestasi/prestasi.controller.ts:30>) — findAll | Get() | this.prestasiService.findAll |
| [apps/api/src/prestasi/prestasi.controller.ts:35](<D:/acca-new/apps/api/src/prestasi/prestasi.controller.ts:35>) — findOne | Get(':id') | this.prestasiService.findOne |
| [apps/api/src/prestasi/prestasi.controller.ts:40](<D:/acca-new/apps/api/src/prestasi/prestasi.controller.ts:40>) — create | Post() | this.prestasiService.create |
| [apps/api/src/prestasi/prestasi.controller.ts:45](<D:/acca-new/apps/api/src/prestasi/prestasi.controller.ts:45>) — update | Put(':id') | this.prestasiService.update |
| [apps/api/src/prestasi/prestasi.controller.ts:50](<D:/acca-new/apps/api/src/prestasi/prestasi.controller.ts:50>) — delete | Delete(':id') | this.prestasiService.delete |

## apps/api/src/ptsp/ptsp.controller.ts

Dekorator kelas: `ApiTags('PTSP'); ApiBearerAuth(); UseGuards(JwtAuthGuard); Controller('ptsp')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/ptsp/ptsp.controller.ts:13](<D:/acca-new/apps/api/src/ptsp/ptsp.controller.ts:13>) — getTable | Get(); ApiOperation({ summary: 'Ambil data tabel PTSP dengan paginasi dan filter pencarian' }) | this.ptspService.getTableData |
| [apps/api/src/ptsp/ptsp.controller.ts:34](<D:/acca-new/apps/api/src/ptsp/ptsp.controller.ts:34>) — updateTable | Post(); ApiOperation({ summary: 'Update data status dan catatan admin PTSP' }) | this.ptspService.updateTableData |
| [apps/api/src/ptsp/ptsp.controller.ts:41](<D:/acca-new/apps/api/src/ptsp/ptsp.controller.ts:41>) — deleteTable | Delete(); ApiOperation({ summary: 'Hapus data PTSP' }) | this.ptspService.deleteTableData |
| [apps/api/src/ptsp/ptsp.controller.ts:51](<D:/acca-new/apps/api/src/ptsp/ptsp.controller.ts:51>) — notifyWa | Get('notify-wa'); ApiOperation({ summary: 'Cron process ptsp_wa_log queue' }) | this.ptspService.notifyWa |

## apps/api/src/sanggar/sanggar.controller.ts

Dekorator kelas: `ApiTags('Sanggar'); Controller('sanggar'); UseGuards(JwtAuthGuard, PageAccessGuard); RequiresPage('sanggar-kurikulum')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/sanggar/sanggar.controller.ts:37](<D:/acca-new/apps/api/src/sanggar/sanggar.controller.ts:37>) — findAll | Get() | this.sanggarService.findAll |
| [apps/api/src/sanggar/sanggar.controller.ts:42](<D:/acca-new/apps/api/src/sanggar/sanggar.controller.ts:42>) — check | Get('check') | this.sanggarService.check |
| [apps/api/src/sanggar/sanggar.controller.ts:47](<D:/acca-new/apps/api/src/sanggar/sanggar.controller.ts:47>) — getKuota | Get('kuota') | this.sanggarService.getKuota |
| [apps/api/src/sanggar/sanggar.controller.ts:52](<D:/acca-new/apps/api/src/sanggar/sanggar.controller.ts:52>) — findOne | Get(':id') | this.sanggarService.findOne |
| [apps/api/src/sanggar/sanggar.controller.ts:57](<D:/acca-new/apps/api/src/sanggar/sanggar.controller.ts:57>) — create | Post() | this.sanggarService.create |
| [apps/api/src/sanggar/sanggar.controller.ts:62](<D:/acca-new/apps/api/src/sanggar/sanggar.controller.ts:62>) — update | Put(':id'); UseGuards(JwtAuthGuard); ApiBearerAuth() | this.sanggarService.update |
| [apps/api/src/sanggar/sanggar.controller.ts:69](<D:/acca-new/apps/api/src/sanggar/sanggar.controller.ts:69>) — delete | Delete(':id'); UseGuards(JwtAuthGuard); ApiBearerAuth() | this.sanggarService.delete |
| [apps/api/src/sanggar/sanggar.controller.ts:76](<D:/acca-new/apps/api/src/sanggar/sanggar.controller.ts:76>) — getBroadcastConfig | Get('broadcast/config'); UseGuards(JwtAuthGuard); ApiBearerAuth() | this.sanggarService.getBroadcastConfig |
| [apps/api/src/sanggar/sanggar.controller.ts:83](<D:/acca-new/apps/api/src/sanggar/sanggar.controller.ts:83>) — postBroadcast | Post('broadcast'); UseGuards(JwtAuthGuard); ApiBearerAuth() | this.sanggarService.postBroadcast |

## apps/api/src/settings/settings.controller.ts

Dekorator kelas: `UseGuards(JwtAuthGuard, RolesGuard, FeatureAccessGuard); Controller('settings')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/settings/settings.controller.ts:20](<D:/acca-new/apps/api/src/settings/settings.controller.ts:20>) — getJadwalPiket | Get('jadwal-piket') | this.settingsService.getJadwalPiket |
| [apps/api/src/settings/settings.controller.ts:41](<D:/acca-new/apps/api/src/settings/settings.controller.ts:41>) — createJadwalPiket | Post('jadwal-piket'); FeatureAccess(JADWAL_GENERATE_KEY) | this.settingsService.createJadwalPiket |
| [apps/api/src/settings/settings.controller.ts:47](<D:/acca-new/apps/api/src/settings/settings.controller.ts:47>) — updateJadwalPiket | Put('jadwal-piket'); FeatureAccess(JADWAL_GENERATE_KEY) | this.settingsService.updateJadwalPiketDates, this.settingsService.updateJadwalPiket |
| [apps/api/src/settings/settings.controller.ts:60](<D:/acca-new/apps/api/src/settings/settings.controller.ts:60>) — deleteJadwalPiket | Delete('jadwal-piket'); FeatureAccess(JADWAL_GENERATE_KEY) | this.settingsService.deleteJadwalPiket |
| [apps/api/src/settings/settings.controller.ts:77](<D:/acca-new/apps/api/src/settings/settings.controller.ts:77>) — getJadwalGuru | Get('jadwal-guru') | this.settingsService.getJadwalGuru |
| [apps/api/src/settings/settings.controller.ts:96](<D:/acca-new/apps/api/src/settings/settings.controller.ts:96>) — createJadwalGuru | Post('jadwal-guru'); FeatureAccess(JADWAL_GENERATE_KEY) | this.settingsService.createJadwalGuru |
| [apps/api/src/settings/settings.controller.ts:102](<D:/acca-new/apps/api/src/settings/settings.controller.ts:102>) — updateJadwalGuru | Put('jadwal-guru'); FeatureAccess(JADWAL_GENERATE_KEY) | this.settingsService.updateJadwalGuru |
| [apps/api/src/settings/settings.controller.ts:108](<D:/acca-new/apps/api/src/settings/settings.controller.ts:108>) — deleteJadwalGuru | Delete('jadwal-guru'); FeatureAccess(JADWAL_GENERATE_KEY) | this.settingsService.deleteJadwalGuru |
| [apps/api/src/settings/settings.controller.ts:123](<D:/acca-new/apps/api/src/settings/settings.controller.ts:123>) — getSiswaKelas | Get('siswa-kelas') | this.settingsService.getSiswaKelas |
| [apps/api/src/settings/settings.controller.ts:134](<D:/acca-new/apps/api/src/settings/settings.controller.ts:134>) — createSiswaKelas | Post('siswa-kelas'); Roles('ADMIN', 'ADMINISTRATOR', 'KURIKULUM', 'WKM_AKADEMIK') | this.settingsService.createSiswaKelas |
| [apps/api/src/settings/settings.controller.ts:140](<D:/acca-new/apps/api/src/settings/settings.controller.ts:140>) — updateSiswaKelas | Put('siswa-kelas'); Roles('ADMIN', 'ADMINISTRATOR', 'KURIKULUM', 'WKM_AKADEMIK') | this.settingsService.updateSiswaKelas |
| [apps/api/src/settings/settings.controller.ts:146](<D:/acca-new/apps/api/src/settings/settings.controller.ts:146>) — deleteSiswaKelas | Delete('siswa-kelas'); Roles('ADMIN', 'ADMINISTRATOR', 'KURIKULUM', 'WKM_AKADEMIK') | this.settingsService.deleteSiswaKelas |
| [apps/api/src/settings/settings.controller.ts:165](<D:/acca-new/apps/api/src/settings/settings.controller.ts:165>) — getGuruMapel | Get('guru-mapel') | this.settingsService.getGuruMapel |
| [apps/api/src/settings/settings.controller.ts:174](<D:/acca-new/apps/api/src/settings/settings.controller.ts:174>) — createGuruMapel | Post('guru-mapel'); Roles('ADMIN', 'ADMINISTRATOR', 'KURIKULUM', 'WKM_AKADEMIK') | this.settingsService.createGuruMapel |
| [apps/api/src/settings/settings.controller.ts:180](<D:/acca-new/apps/api/src/settings/settings.controller.ts:180>) — updateGuruMapel | Put('guru-mapel'); Roles('ADMIN', 'ADMINISTRATOR', 'KURIKULUM', 'WKM_AKADEMIK') | this.settingsService.updateGuruMapel |
| [apps/api/src/settings/settings.controller.ts:186](<D:/acca-new/apps/api/src/settings/settings.controller.ts:186>) — deleteGuruMapel | Delete('guru-mapel'); Roles('ADMIN', 'ADMINISTRATOR', 'KURIKULUM', 'WKM_AKADEMIK') | this.settingsService.deleteGuruMapel |
| [apps/api/src/settings/settings.controller.ts:205](<D:/acca-new/apps/api/src/settings/settings.controller.ts:205>) — getWaliKelas | Get('wali-kelas') | this.settingsService.getWaliKelas |
| [apps/api/src/settings/settings.controller.ts:217](<D:/acca-new/apps/api/src/settings/settings.controller.ts:217>) — createWaliKelas | Post('wali-kelas'); Roles('ADMIN', 'ADMINISTRATOR', 'KURIKULUM', 'WKM_AKADEMIK') | this.settingsService.createWaliKelas |
| [apps/api/src/settings/settings.controller.ts:223](<D:/acca-new/apps/api/src/settings/settings.controller.ts:223>) — updateWaliKelas | Put('wali-kelas'); Roles('ADMIN', 'ADMINISTRATOR', 'KURIKULUM', 'WKM_AKADEMIK') | this.settingsService.updateWaliKelas |
| [apps/api/src/settings/settings.controller.ts:229](<D:/acca-new/apps/api/src/settings/settings.controller.ts:229>) — deleteWaliKelas | Delete('wali-kelas'); Roles('ADMIN', 'ADMINISTRATOR', 'KURIKULUM', 'WKM_AKADEMIK') | this.settingsService.deleteWaliKelas |
| [apps/api/src/settings/settings.controller.ts:248](<D:/acca-new/apps/api/src/settings/settings.controller.ts:248>) — getGuruAsuh | Get('guru-asuh') | this.settingsService.getGuruAsuh |
| [apps/api/src/settings/settings.controller.ts:259](<D:/acca-new/apps/api/src/settings/settings.controller.ts:259>) — createGuruAsuh | UseGuards(JwtAuthGuard); Post('guru-asuh') | this.settingsService.createGuruAsuh |
| [apps/api/src/settings/settings.controller.ts:265](<D:/acca-new/apps/api/src/settings/settings.controller.ts:265>) — updateGuruAsuh | UseGuards(JwtAuthGuard); Put('guru-asuh') | this.settingsService.updateGuruAsuh |
| [apps/api/src/settings/settings.controller.ts:271](<D:/acca-new/apps/api/src/settings/settings.controller.ts:271>) — deleteGuruAsuh | UseGuards(JwtAuthGuard); Delete('guru-asuh') | this.settingsService.deleteGuruAsuh |
| [apps/api/src/settings/settings.controller.ts:288](<D:/acca-new/apps/api/src/settings/settings.controller.ts:288>) — checkGuruMapel | Get('guru-mapel/check') | this.settingsService.checkGuruMapel |
| [apps/api/src/settings/settings.controller.ts:297](<D:/acca-new/apps/api/src/settings/settings.controller.ts:297>) — importJadwalGuru | Post('jadwal-guru/import'); FeatureAccess(JADWAL_GENERATE_KEY) | this.settingsService.importJadwalGuru |
| [apps/api/src/settings/settings.controller.ts:303](<D:/acca-new/apps/api/src/settings/settings.controller.ts:303>) — importJadwalPiket | Post('jadwal-piket/import'); FeatureAccess(JADWAL_GENERATE_KEY) | this.settingsService.importJadwalPiket |
| [apps/api/src/settings/settings.controller.ts:309](<D:/acca-new/apps/api/src/settings/settings.controller.ts:309>) — getUmLockDebug | Get('um-lock/debug') | this.settingsService.getUmLockDebug |
| [apps/api/src/settings/settings.controller.ts:314](<D:/acca-new/apps/api/src/settings/settings.controller.ts:314>) — updateUmLockDebug | Post('um-lock/debug'); Roles('ADMIN', 'ADMINISTRATOR') | this.settingsService.updateUmLockDebug |

## apps/api/src/siswa/siswa.controller.ts

Dekorator kelas: `ApiTags('Data Siswa'); Controller('siswa'); UseGuards(JwtAuthGuard); ApiBearerAuth()`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/siswa/siswa.controller.ts:57](<D:/acca-new/apps/api/src/siswa/siswa.controller.ts:57>) — findAll | Get(); ApiOperation({ summary: 'Mendapatkan daftar siswa dari PostgreSQL VPS (dengan pencarian & paginasi)' }); ApiQuery({ name: 'search', required: false, description: 'Cari berdasarkan Nama/NISN/NIK' }); ApiQuery({ name: 'page', required: false, example: 1 }); ApiQuery({ name: 'limit', required: false, example: 20 }); ApiResponse({ status: 200, description: 'Daftar siswa berhasil didapatkan' }) | this.siswaService.findAll |
| [apps/api/src/siswa/siswa.controller.ts:72](<D:/acca-new/apps/api/src/siswa/siswa.controller.ts:72>) — getStudentClasses | Get(':nisn/kelas'); ApiOperation({ summary: 'Mendapatkan daftar kelas siswa berdasarkan NISN' }) | this.siswaService.getStudentClasses |
| [apps/api/src/siswa/siswa.controller.ts:78](<D:/acca-new/apps/api/src/siswa/siswa.controller.ts:78>) — findByNisn | Get(':nisn'); ApiOperation({ summary: 'Mendapatkan detail siswa berdasarkan NISN' }); ApiResponse({ status: 200, description: 'Detail siswa ditemukan' }); ApiResponse({ status: 404, description: 'Siswa tidak ditemukan' }) | this.siswaService.findByNisn |
| [apps/api/src/siswa/siswa.controller.ts:86](<D:/acca-new/apps/api/src/siswa/siswa.controller.ts:86>) — getSiswaByKelas | Get('by-kelas/:kelas'); ApiOperation({ summary: 'Mendapatkan daftar siswa berdasarkan kelas' }) | this.siswaService.getSiswaByKelas |

## apps/api/src/site-settings/site-settings.controller.ts

Dekorator kelas: `Controller()`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/site-settings/site-settings.controller.ts:18](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:18>) — getSiteSettings | UseGuards(OptionalJwtAuthGuard); Get('site-settings') | this.siteSettingsService.getSetting, this.siteSettingsService.getAllSettings |
| [apps/api/src/site-settings/site-settings.controller.ts:32](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:32>) — getApiLogs | UseGuards(JwtAuthGuard); Get('site-settings/api-logs') | this.siteSettingsService.getApiLogs |
| [apps/api/src/site-settings/site-settings.controller.ts:42](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:42>) — updateSiteSettings | UseGuards(JwtAuthGuard); Put('site-settings') | this.siteSettingsService.updateSetting |
| [apps/api/src/site-settings/site-settings.controller.ts:56](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:56>) — getPages | Get('pages') | this.pagesService.getPages |
| [apps/api/src/site-settings/site-settings.controller.ts:62](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:62>) — getMenuLayout | UseGuards(OptionalJwtAuthGuard); Get('menu-layout') | this.menuLayoutService.getMenuLayout, this.accessService.getRoleFlatGroupsMap |
| [apps/api/src/site-settings/site-settings.controller.ts:76](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:76>) — updateMenuLayout | UseGuards(JwtAuthGuard); Put('menu-layout') | this.menuLayoutService.setMenuLayout |
| [apps/api/src/site-settings/site-settings.controller.ts:88](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:88>) — getProfilSekolah | Get('profil-sekolah') | this.siteSettingsService.getProfilSekolah |
| [apps/api/src/site-settings/site-settings.controller.ts:94](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:94>) — createProfilSekolah | UseGuards(JwtAuthGuard); Post('profil-sekolah') | this.siteSettingsService.createProfilSekolah |
| [apps/api/src/site-settings/site-settings.controller.ts:104](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:104>) — updateProfilSekolah | UseGuards(JwtAuthGuard); Put('profil-sekolah') | this.siteSettingsService.updateProfilSekolah |
| [apps/api/src/site-settings/site-settings.controller.ts:117](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:117>) — getFiturAkademik | Get('fitur-akademik') | this.siteSettingsService.getFiturAkademik |
| [apps/api/src/site-settings/site-settings.controller.ts:123](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:123>) — createFiturAkademik | UseGuards(JwtAuthGuard); Post('fitur-akademik') | this.siteSettingsService.createFiturAkademik |
| [apps/api/src/site-settings/site-settings.controller.ts:133](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:133>) — updateFiturAkademik | UseGuards(JwtAuthGuard); Put('fitur-akademik') | this.siteSettingsService.updateFiturAkademik |
| [apps/api/src/site-settings/site-settings.controller.ts:145](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:145>) — deleteFiturAkademik | UseGuards(JwtAuthGuard); Delete('fitur-akademik') | this.siteSettingsService.deleteFiturAkademik |
| [apps/api/src/site-settings/site-settings.controller.ts:157](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:157>) — getMasterDropdown | Get('master-dropdown') | this.siteSettingsService.getMasterDropdownByColumnNull, this.siteSettingsService.getMasterDropdown |
| [apps/api/src/site-settings/site-settings.controller.ts:168](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:168>) — createMasterDropdown | UseGuards(JwtAuthGuard); Post('master-dropdown') | this.siteSettingsService.createMasterDropdown |
| [apps/api/src/site-settings/site-settings.controller.ts:178](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:178>) — updateMasterDropdown | UseGuards(JwtAuthGuard); Put('master-dropdown') | this.siteSettingsService.updateMasterDropdown |
| [apps/api/src/site-settings/site-settings.controller.ts:190](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:190>) — deleteMasterDropdown | UseGuards(JwtAuthGuard); Delete('master-dropdown') | this.siteSettingsService.deleteMasterDropdown |
| [apps/api/src/site-settings/site-settings.controller.ts:201](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:201>) — addMasterDropdownColumn | UseGuards(JwtAuthGuard); Post('master-dropdown/column') |  |
| [apps/api/src/site-settings/site-settings.controller.ts:208](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:208>) — dropMasterDropdownColumn | UseGuards(JwtAuthGuard); Delete('master-dropdown/column') |  |
| [apps/api/src/site-settings/site-settings.controller.ts:215](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:215>) — getFileStorageConfig | UseGuards(OptionalJwtAuthGuard); Get('site-settings/file-storage-config') | this.siteSettingsService.getFileStorageConfig |
| [apps/api/src/site-settings/site-settings.controller.ts:226](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:226>) — switchFileStorageConfig | UseGuards(JwtAuthGuard); Post('site-settings/file-storage-config/switch') | this.siteSettingsService.switchFileStorageConfig |
| [apps/api/src/site-settings/site-settings.controller.ts:233](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:233>) — updateFileStorageConfig | UseGuards(JwtAuthGuard); Put('site-settings/file-storage-config/:id') | this.siteSettingsService.updateFileStorageConfig |
| [apps/api/src/site-settings/site-settings.controller.ts:240](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:240>) — getSystemConfig | Get('config') | this.siteSettingsService.getSystemConfig |
| [apps/api/src/site-settings/site-settings.controller.ts:245](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:245>) — updateSystemConfig | Put('config'); UseGuards(JwtAuthGuard) | this.siteSettingsService.updateSystemConfig |
| [apps/api/src/site-settings/site-settings.controller.ts:254](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:254>) — getTestimonials | Get('testimonials') | this.siteSettingsService.getTestimonials |
| [apps/api/src/site-settings/site-settings.controller.ts:259](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:259>) — createTestimonial | Post('testimonials') | this.siteSettingsService.createTestimonial |
| [apps/api/src/site-settings/site-settings.controller.ts:264](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:264>) — getStorageUsage | Get('storage-usage') | this.siteSettingsService.getStorageUsage |
| [apps/api/src/site-settings/site-settings.controller.ts:269](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:269>) — registerUpload | UseGuards(OptionalJwtAuthGuard); Post('site-settings/file-registry/register') | this.siteSettingsService.registerUpload |
| [apps/api/src/site-settings/site-settings.controller.ts:279](<D:/acca-new/apps/api/src/site-settings/site-settings.controller.ts:279>) — unregisterUpload | UseGuards(OptionalJwtAuthGuard); Post('site-settings/file-registry/unregister') | this.siteSettingsService.unregisterUpload |

## apps/api/src/students/students.controller.ts

Dekorator kelas: `ApiTags('Students'); ApiBearerAuth(); UseGuards(JwtAuthGuard); Controller('students')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/students/students.controller.ts:42](<D:/acca-new/apps/api/src/students/students.controller.ts:42>) — getCard | Get('card'); ApiOperation({ summary: 'Ambil atau buat kartu siswa (batch atau single)' }) | this.studentsService.getOrCreateCards, this.studentsService.getOrCreateCards |
| [apps/api/src/students/students.controller.ts:76](<D:/acca-new/apps/api/src/students/students.controller.ts:76>) — getBulkStatus | Get('bulk-status'); ApiOperation({ summary: 'Audit status massal siswa (hanya Admin)' }) | this.studentsService.auditBulkStatus |
| [apps/api/src/students/students.controller.ts:97](<D:/acca-new/apps/api/src/students/students.controller.ts:97>) — postBulkStatus | Post('bulk-status'); ApiOperation({ summary: 'Terapkan status massal siswa (hanya Admin)' }) | this.studentsService.applyBulkStatus |
| [apps/api/src/students/students.controller.ts:130](<D:/acca-new/apps/api/src/students/students.controller.ts:130>) — verifyStudent | Get('verify'); ApiOperation({ summary: 'Verifikasi identitas siswa lewat kartu atau NISN' }) | this.studentsService.verifyStudent |

## apps/api/src/surat/surat.controller.ts

Dekorator kelas: `ApiTags('Surat Templates'); Controller('surat/templates'); UseGuards(JwtAuthGuard); ApiBearerAuth()`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/surat/surat.controller.ts:29](<D:/acca-new/apps/api/src/surat/surat.controller.ts:29>) — getTemplates | Get() | this.suratService.getTemplates |
| [apps/api/src/surat/surat.controller.ts:35](<D:/acca-new/apps/api/src/surat/surat.controller.ts:35>) — getTemplateUrls | Get('urls') | this.suratService.getTemplateUrls |
| [apps/api/src/surat/surat.controller.ts:40](<D:/acca-new/apps/api/src/surat/surat.controller.ts:40>) — getTemplateById | Get(':id') | this.suratService.getTemplateById |
| [apps/api/src/surat/surat.controller.ts:49](<D:/acca-new/apps/api/src/surat/surat.controller.ts:49>) — createTemplate | Post() | this.accessService.resolveUserAccess, this.suratService.createOrUpdateTemplate |
| [apps/api/src/surat/surat.controller.ts:76](<D:/acca-new/apps/api/src/surat/surat.controller.ts:76>) — updateTemplate | Put(':id') | this.accessService.resolveUserAccess, this.suratService.updateTemplate |
| [apps/api/src/surat/surat.controller.ts:106](<D:/acca-new/apps/api/src/surat/surat.controller.ts:106>) — deleteTemplate | Delete(':id') | this.accessService.resolveUserAccess, this.suratService.softDeleteTemplate |

## apps/api/src/surat/surat.controller.ts

Dekorator kelas: `ApiTags('Surat Records'); Controller('surat')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/surat/surat.controller.ts:127](<D:/acca-new/apps/api/src/surat/surat.controller.ts:127>) — getJenisSuratDropdown | Get('dropdown/jenis-surat'); ApiOperation({ summary: 'Dropdown pilihan jenis surat' }) | this.suratService.getJenisSuratDropdown |
| [apps/api/src/surat/surat.controller.ts:133](<D:/acca-new/apps/api/src/surat/surat.controller.ts:133>) — verifySurat | Get('verify'); ApiOperation({ summary: 'Verifikasi publik keabsahan QR code surat' }) | this.suratService.verifySurat |
| [apps/api/src/surat/surat.controller.ts:139](<D:/acca-new/apps/api/src/surat/surat.controller.ts:139>) — getSuratByNomor | Get('by-nomor'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Cari surat berdasarkan nomor surat' }) | this.suratService.getSuratByNomor |
| [apps/api/src/surat/surat.controller.ts:147](<D:/acca-new/apps/api/src/surat/surat.controller.ts:147>) — searchSurat | Get('search'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Cari surat (dropdown/autocomplete)' }) | this.suratService.searchSurat |
| [apps/api/src/surat/surat.controller.ts:155](<D:/acca-new/apps/api/src/surat/surat.controller.ts:155>) — generateNumber | Get('generate-number'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Generate nomor surat baru' }) | this.suratService.generateNumber |
| [apps/api/src/surat/surat.controller.ts:163](<D:/acca-new/apps/api/src/surat/surat.controller.ts:163>) — generateNumberPost | Post('generate-number'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Generate / reserve nomor surat baru' }) | this.suratService.generateNumber |
| [apps/api/src/surat/surat.controller.ts:171](<D:/acca-new/apps/api/src/surat/surat.controller.ts:171>) — getGuru | Get('guru'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Daftar surat terkait guru atau list guru' }) | this.suratService.getGuru |
| [apps/api/src/surat/surat.controller.ts:179](<D:/acca-new/apps/api/src/surat/surat.controller.ts:179>) — getSiswa | Get('siswa'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Daftar siswa untuk persuratan' }) | this.suratService.getSiswa |
| [apps/api/src/surat/surat.controller.ts:187](<D:/acca-new/apps/api/src/surat/surat.controller.ts:187>) — getAllSurat | Get('items'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Daftar semua arsip surat' }) | this.suratService.getAllSurat |
| [apps/api/src/surat/surat.controller.ts:195](<D:/acca-new/apps/api/src/surat/surat.controller.ts:195>) — getSuratById | Get('items/:id'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Detail arsip surat' }) | this.suratService.getSuratById |
| [apps/api/src/surat/surat.controller.ts:203](<D:/acca-new/apps/api/src/surat/surat.controller.ts:203>) — createSurat | Post('items'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Buat arsip surat baru (Draft/Final)' }) | this.suratService.createSurat |
| [apps/api/src/surat/surat.controller.ts:211](<D:/acca-new/apps/api/src/surat/surat.controller.ts:211>) — updateSurat | Put('items/:id'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Perbarui arsip surat' }) | this.suratService.updateSurat |
| [apps/api/src/surat/surat.controller.ts:223](<D:/acca-new/apps/api/src/surat/surat.controller.ts:223>) — deleteSurat | Delete('items/:id'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Hapus arsip surat' }) | this.suratService.deleteSurat |
| [apps/api/src/surat/surat.controller.ts:233](<D:/acca-new/apps/api/src/surat/surat.controller.ts:233>) — getPermintaanList | Get('permintaan'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Daftar permohonan surat' }) | this.suratService.getPermintaanList |
| [apps/api/src/surat/surat.controller.ts:241](<D:/acca-new/apps/api/src/surat/surat.controller.ts:241>) — getPermintaanById | Get('permintaan/:id'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Detail permohonan surat' }) | this.suratService.getPermintaanById |
| [apps/api/src/surat/surat.controller.ts:249](<D:/acca-new/apps/api/src/surat/surat.controller.ts:249>) — createPermintaan | Post('permintaan'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Ajukan permohonan surat baru' }) | this.suratService.createPermintaan |
| [apps/api/src/surat/surat.controller.ts:257](<D:/acca-new/apps/api/src/surat/surat.controller.ts:257>) — updatePermintaan | Put('permintaan/:id'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Ubah / tinjau permohonan surat' }) | this.suratService.updatePermintaan |
| [apps/api/src/surat/surat.controller.ts:269](<D:/acca-new/apps/api/src/surat/surat.controller.ts:269>) — deletePermintaan | Delete('permintaan/:id'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Batalkan permohonan surat' }) | this.suratService.deletePermintaan |
| [apps/api/src/surat/surat.controller.ts:279](<D:/acca-new/apps/api/src/surat/surat.controller.ts:279>) — getConfigSurat | Get('config'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Ambil konfigurasi surat' }) | this.suratService.getConfigSurat |
| [apps/api/src/surat/surat.controller.ts:287](<D:/acca-new/apps/api/src/surat/surat.controller.ts:287>) — saveConfigSurat | Post('config'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Simpan konfigurasi surat' }) | this.suratService.saveConfigSurat |
| [apps/api/src/surat/surat.controller.ts:295](<D:/acca-new/apps/api/src/surat/surat.controller.ts:295>) — updateConfigSurat | Put('config'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Update konfigurasi surat' }) | this.suratService.saveConfigSurat |
| [apps/api/src/surat/surat.controller.ts:303](<D:/acca-new/apps/api/src/surat/surat.controller.ts:303>) — getSuratForPdf | Post('generate-pdf-data'); UseGuards(JwtAuthGuard); ApiBearerAuth(); ApiOperation({ summary: 'Data pendukung untuk pdf generation' }) | this.suratService.getSuratForPdf |

## apps/api/src/tugas-siswa/tugas-siswa.controller.ts

Dekorator kelas: `Controller('tugas-siswa'); UseGuards(JwtAuthGuard)`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/tugas-siswa/tugas-siswa.controller.ts:35](<D:/acca-new/apps/api/src/tugas-siswa/tugas-siswa.controller.ts:35>) — getMaster | Get('master') | this.tugasSiswaService.getMasterData |
| [apps/api/src/tugas-siswa/tugas-siswa.controller.ts:40](<D:/acca-new/apps/api/src/tugas-siswa/tugas-siswa.controller.ts:40>) — getStats | Get('action') | this.tugasSiswaService.getStats |
| [apps/api/src/tugas-siswa/tugas-siswa.controller.ts:46](<D:/acca-new/apps/api/src/tugas-siswa/tugas-siswa.controller.ts:46>) — setChecklist | Post('action') | this.tugasSiswaService.toggleChecklist |
| [apps/api/src/tugas-siswa/tugas-siswa.controller.ts:58](<D:/acca-new/apps/api/src/tugas-siswa/tugas-siswa.controller.ts:58>) — findAll | Get() | this.tugasSiswaService.findAll |
| [apps/api/src/tugas-siswa/tugas-siswa.controller.ts:64](<D:/acca-new/apps/api/src/tugas-siswa/tugas-siswa.controller.ts:64>) — findById | Get(':id') | this.tugasSiswaService.findById |
| [apps/api/src/tugas-siswa/tugas-siswa.controller.ts:70](<D:/acca-new/apps/api/src/tugas-siswa/tugas-siswa.controller.ts:70>) — create | Post() | this.tugasSiswaService.create |
| [apps/api/src/tugas-siswa/tugas-siswa.controller.ts:77](<D:/acca-new/apps/api/src/tugas-siswa/tugas-siswa.controller.ts:77>) — update | Put(':id') | this.tugasSiswaService.update |
| [apps/api/src/tugas-siswa/tugas-siswa.controller.ts:88](<D:/acca-new/apps/api/src/tugas-siswa/tugas-siswa.controller.ts:88>) — remove | Delete(':id') | this.tugasSiswaService.remove |

## apps/api/src/tugas-tambahan/tugas-tambahan.controller.ts

Dekorator kelas: `ApiTags('Tugas Tambahan'); ApiBearerAuth(); UseGuards(JwtAuthGuard, PageAccessGuard); Controller('tugas-tambahan')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/tugas-tambahan/tugas-tambahan.controller.ts:23](<D:/acca-new/apps/api/src/tugas-tambahan/tugas-tambahan.controller.ts:23>) — getTugasTambahan | Get(); ApiOperation({ summary: 'Daftar Tugas Tambahan' }) | this.tugasTambahanService.getTugasTambahan |
| [apps/api/src/tugas-tambahan/tugas-tambahan.controller.ts:39](<D:/acca-new/apps/api/src/tugas-tambahan/tugas-tambahan.controller.ts:39>) — upsertTugasTambahan | Post(); RequiresPage('tugas-tambahan', 'pengaturan-tugas'); ApiOperation({ summary: 'Tambah atau Ubah Tugas Tambahan' }) | this.tugasTambahanService.upsertTugasTambahan |
| [apps/api/src/tugas-tambahan/tugas-tambahan.controller.ts:51](<D:/acca-new/apps/api/src/tugas-tambahan/tugas-tambahan.controller.ts:51>) — deleteTugasTambahan | Delete(); RequiresPage('tugas-tambahan', 'pengaturan-tugas'); ApiOperation({ summary: 'Hapus Tugas Tambahan' }) | this.tugasTambahanService.deleteTugasTambahan |
| [apps/api/src/tugas-tambahan/tugas-tambahan.controller.ts:60](<D:/acca-new/apps/api/src/tugas-tambahan/tugas-tambahan.controller.ts:60>) — getJurnal | Get('jurnal'); ApiOperation({ summary: 'Daftar Jurnal Tugas Tambahan' }) | this.tugasTambahanService.getJurnalTugas |
| [apps/api/src/tugas-tambahan/tugas-tambahan.controller.ts:76](<D:/acca-new/apps/api/src/tugas-tambahan/tugas-tambahan.controller.ts:76>) — upsertJurnal | Post('jurnal'); RequiresPage('tugas-tambahan', 'pengaturan-tugas'); ApiOperation({ summary: 'Tambah atau Ubah Jurnal Tugas Tambahan' }) | this.tugasTambahanService.upsertJurnalTugas |
| [apps/api/src/tugas-tambahan/tugas-tambahan.controller.ts:88](<D:/acca-new/apps/api/src/tugas-tambahan/tugas-tambahan.controller.ts:88>) — deleteJurnal | Delete('jurnal'); RequiresPage('tugas-tambahan', 'pengaturan-tugas'); ApiOperation({ summary: 'Hapus Jurnal Tugas Tambahan' }) | this.tugasTambahanService.deleteJurnalTugas |

## apps/api/src/um-kelulusan/um-kelulusan.controller.ts

Dekorator kelas: `UseGuards(JwtAuthGuard); Controller()`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/um-kelulusan/um-kelulusan.controller.ts:10](<D:/acca-new/apps/api/src/um-kelulusan/um-kelulusan.controller.ts:10>) — getKelulusan | Get('kelulusan') | this.umKelulusanService.getKelulusan |
| [apps/api/src/um-kelulusan/um-kelulusan.controller.ts:20](<D:/acca-new/apps/api/src/um-kelulusan/um-kelulusan.controller.ts:20>) — postKelulusan | Post('kelulusan') | this.umKelulusanService.postKelulusan |
| [apps/api/src/um-kelulusan/um-kelulusan.controller.ts:26](<D:/acca-new/apps/api/src/um-kelulusan/um-kelulusan.controller.ts:26>) — patchKelulusan | Patch('kelulusan') | this.umKelulusanService.patchKelulusan |
| [apps/api/src/um-kelulusan/um-kelulusan.controller.ts:32](<D:/acca-new/apps/api/src/um-kelulusan/um-kelulusan.controller.ts:32>) — getUjianMadrasah | Get('ujian-madrasah') | this.umKelulusanService.getUjianMadrasah |
| [apps/api/src/um-kelulusan/um-kelulusan.controller.ts:37](<D:/acca-new/apps/api/src/um-kelulusan/um-kelulusan.controller.ts:37>) — postUjianMadrasah | Post('ujian-madrasah') | this.umKelulusanService.postUjianMadrasah |
| [apps/api/src/um-kelulusan/um-kelulusan.controller.ts:43](<D:/acca-new/apps/api/src/um-kelulusan/um-kelulusan.controller.ts:43>) — getKelasXii | Get('ujian-madrasah/kelas-xii') | this.umKelulusanService.getKelasXii |
| [apps/api/src/um-kelulusan/um-kelulusan.controller.ts:48](<D:/acca-new/apps/api/src/um-kelulusan/um-kelulusan.controller.ts:48>) — postUmConfig | Post('ujian-madrasah/config') | this.umKelulusanService.postUmConfig |
| [apps/api/src/um-kelulusan/um-kelulusan.controller.ts:54](<D:/acca-new/apps/api/src/um-kelulusan/um-kelulusan.controller.ts:54>) — postUmRaport | Post('ujian-madrasah/import-raport') | this.umKelulusanService.postUmRaport |
| [apps/api/src/um-kelulusan/um-kelulusan.controller.ts:60](<D:/acca-new/apps/api/src/um-kelulusan/um-kelulusan.controller.ts:60>) — getUmLock | Get('settings/um-lock') | this.umKelulusanService.getUmLock |
| [apps/api/src/um-kelulusan/um-kelulusan.controller.ts:65](<D:/acca-new/apps/api/src/um-kelulusan/um-kelulusan.controller.ts:65>) — postUmLock | Post('settings/um-lock') | this.umKelulusanService.postUmLock |

## apps/api/src/users/register.controller.ts

Dekorator kelas: `ApiTags('Registration'); Controller('register')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/users/register.controller.ts:15](<D:/acca-new/apps/api/src/users/register.controller.ts:15>) — registerParent | Post('parent'); ApiOperation({ summary: 'Daftar akun orang tua sekaligus klaim anak' }) | this.usersService.registerParent |

## apps/api/src/users/users.controller.ts

Dekorator kelas: `ApiTags('User Management'); ApiBearerAuth(); UseGuards(JwtAuthGuard); Controller('users')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/users/users.controller.ts:43](<D:/acca-new/apps/api/src/users/users.controller.ts:43>) — list | Get(); ApiOperation({ summary: 'Daftar pengguna beserta akses efektifnya' }) | this.usersService.list, this.accessService.resolveManyUserAccess |
| [apps/api/src/users/users.controller.ts:66](<D:/acca-new/apps/api/src/users/users.controller.ts:66>) — create | Post(); ApiOperation({ summary: 'Buat pengguna baru beserta kredensialnya di VPS' }) | this.usersService.create |
| [apps/api/src/users/users.controller.ts:73](<D:/acca-new/apps/api/src/users/users.controller.ts:73>) — bulk | Post('bulk'); ApiOperation({ summary: 'Impor massal pengguna (upsert berdasarkan username)' }) | this.usersService.bulkUpsert |
| [apps/api/src/users/users.controller.ts:80](<D:/acca-new/apps/api/src/users/users.controller.ts:80>) — updateMe | Put('me'); ApiOperation({ summary: 'Perbarui profil sendiri (termasuk ganti password)' }) | this.usersService.update, this.usersService.changeOwnPassword |
| [apps/api/src/users/users.controller.ts:97](<D:/acca-new/apps/api/src/users/users.controller.ts:97>) — getPinnedPages | Get('pinned-pages') | this.usersService.getPinnedPages |
| [apps/api/src/users/users.controller.ts:102](<D:/acca-new/apps/api/src/users/users.controller.ts:102>) — updatePinnedPages | Put('pinned-pages') | this.usersService.updatePinnedPages |
| [apps/api/src/users/users.controller.ts:107](<D:/acca-new/apps/api/src/users/users.controller.ts:107>) — getProfileGuru | Get('profile-guru') | this.usersService.getProfileGuru |
| [apps/api/src/users/users.controller.ts:113](<D:/acca-new/apps/api/src/users/users.controller.ts:113>) — getProfileSiswa | Get('profile-siswa') | this.usersService.getProfileSiswa |
| [apps/api/src/users/users.controller.ts:118](<D:/acca-new/apps/api/src/users/users.controller.ts:118>) — heartbeat | Post('heartbeat') | this.usersService.heartbeat |
| [apps/api/src/users/users.controller.ts:123](<D:/acca-new/apps/api/src/users/users.controller.ts:123>) — bulkReplace | Post('bulk-replace'); ApiOperation({ summary: 'Bulk replace data across database' }) | this.usersService.bulkReplace |
| [apps/api/src/users/users.controller.ts:131](<D:/acca-new/apps/api/src/users/users.controller.ts:131>) — linkAuth | Post('link-auth'); ApiOperation({ summary: 'Link current auth session to a user in users table' }) | this.usersService.linkAuth |
| [apps/api/src/users/users.controller.ts:138](<D:/acca-new/apps/api/src/users/users.controller.ts:138>) — findOne | Get(':id'); ApiOperation({ summary: 'Satu pengguna beserta akses efektifnya' }) | this.usersService.findById, this.accessService.resolveUserAccess |
| [apps/api/src/users/users.controller.ts:153](<D:/acca-new/apps/api/src/users/users.controller.ts:153>) — update | Put(':id'); ApiOperation({ summary: 'Perbarui pengguna (admin)' }) | this.usersService.update |
| [apps/api/src/users/users.controller.ts:160](<D:/acca-new/apps/api/src/users/users.controller.ts:160>) — updateStatus | Put(':id/status'); ApiOperation({ summary: 'Ubah status aktif pengguna' }) | this.usersService.updateStatus |
| [apps/api/src/users/users.controller.ts:182](<D:/acca-new/apps/api/src/users/users.controller.ts:182>) — remove | Delete(':id'); ApiOperation({ summary: 'Hapus pengguna beserta kredensialnya' }) | this.usersService.remove |

## apps/api/src/wali-kelas/wali-kelas.controller.ts

Dekorator kelas: `ApiTags('Wali Kelas'); ApiBearerAuth(); UseGuards(JwtAuthGuard); Controller('wali-kelas')`.

| Method handler | Dekorator method | Service yang dipanggil |
|---|---|---|
| [apps/api/src/wali-kelas/wali-kelas.controller.ts:21](<D:/acca-new/apps/api/src/wali-kelas/wali-kelas.controller.ts:21>) — getAbsensiAkumulasi | Get('absensi-akumulasi'); ApiOperation({ summary: 'Ambil daftar kelas atau rekap absensi akumulasi wali kelas' }) | this.waliKelasService.getAbsensiAkumulasi |
| [apps/api/src/wali-kelas/wali-kelas.controller.ts:27](<D:/acca-new/apps/api/src/wali-kelas/wali-kelas.controller.ts:27>) — lockAbsensi | Post('absensi-akumulasi/lock'); ApiOperation({ summary: 'Kunci/bekukan rekap absensi akumulasi bulanan kelas' }) | this.waliKelasService.lockAbsensi |
| [apps/api/src/wali-kelas/wali-kelas.controller.ts:33](<D:/acca-new/apps/api/src/wali-kelas/wali-kelas.controller.ts:33>) — unlockAbsensi | Post('absensi-akumulasi/unlock'); ApiOperation({ summary: 'Buka kunci rekap absensi akumulasi bulanan kelas' }) | this.waliKelasService.unlockAbsensi |
| [apps/api/src/wali-kelas/wali-kelas.controller.ts:39](<D:/acca-new/apps/api/src/wali-kelas/wali-kelas.controller.ts:39>) — getEkskul | Get('ekskul'); ApiOperation({ summary: 'Daftar ekstrakurikuler siswa dalam kelas' }) | this.waliKelasService.getEkskul |

## Route API Next.js

Indikator berikut berasal dari pencarian pola; fungsi autentikasi dengan nama lain tidak selalu terdeteksi. Jangan menandai endpoint aman/rentan hanya dari tabel ini.

| Sumber | Pola auth/proxy | Kunci internal | Prisma langsung | Fetch langsung |
|---|---|---|---|---|
| [apps/web/app/api/absensi/classes/route.ts](<D:/acca-new/apps/web/app/api/absensi/classes/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/absensi/detail/route.ts](<D:/acca-new/apps/web/app/api/absensi/detail/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/absensi/export/route.ts](<D:/acca-new/apps/web/app/api/absensi/export/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/absensi/sesi/route.ts](<D:/acca-new/apps/web/app/api/absensi/sesi/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/admin/bulk-upload-dokumen/delete/route.ts](<D:/acca-new/apps/web/app/api/admin/bulk-upload-dokumen/delete/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/admin/bulk-upload-dokumen/route.ts](<D:/acca-new/apps/web/app/api/admin/bulk-upload-dokumen/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/admin/capabilities/route.ts](<D:/acca-new/apps/web/app/api/admin/capabilities/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/admin/dashboard-charts/route.ts](<D:/acca-new/apps/web/app/api/admin/dashboard-charts/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/admin/dashboard-stats/route.ts](<D:/acca-new/apps/web/app/api/admin/dashboard-stats/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/admin/inspect/route.ts](<D:/acca-new/apps/web/app/api/admin/inspect/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/admin/migration-pengumuman/route.ts](<D:/acca-new/apps/web/app/api/admin/migration-pengumuman/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/admin/role-pages/route.ts](<D:/acca-new/apps/web/app/api/admin/role-pages/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/admin/role-theme/route.ts](<D:/acca-new/apps/web/app/api/admin/role-theme/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/admin/roles/route.ts](<D:/acca-new/apps/web/app/api/admin/roles/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/admin/roles/[id]/route.ts](<D:/acca-new/apps/web/app/api/admin/roles/[id]/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/admin/system/pages/route.ts](<D:/acca-new/apps/web/app/api/admin/system/pages/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/admin/tahun-ajaran/route.ts](<D:/acca-new/apps/web/app/api/admin/tahun-ajaran/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/admin/users/bulk/route.ts](<D:/acca-new/apps/web/app/api/admin/users/bulk/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/admin/users/bulk-replace/route.ts](<D:/acca-new/apps/web/app/api/admin/users/bulk-replace/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/admin/users/link-auth/route.ts](<D:/acca-new/apps/web/app/api/admin/users/link-auth/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/admin/users/route.ts](<D:/acca-new/apps/web/app/api/admin/users/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/admin/users/[id]/roles/route.ts](<D:/acca-new/apps/web/app/api/admin/users/[id]/roles/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/admin/users/[id]/route.ts](<D:/acca-new/apps/web/app/api/admin/users/[id]/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/admin/users/[id]/status/route.ts](<D:/acca-new/apps/web/app/api/admin/users/[id]/status/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/agenda-madrasah/foto/route.ts](<D:/acca-new/apps/web/app/api/agenda-madrasah/foto/route.ts>) | terdeteksi | — | — | ya |
| [apps/web/app/api/agenda-madrasah/izin-saya/route.ts](<D:/acca-new/apps/web/app/api/agenda-madrasah/izin-saya/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/agenda-madrasah/kategori/route.ts](<D:/acca-new/apps/web/app/api/agenda-madrasah/kategori/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/agenda-madrasah/public/route.ts](<D:/acca-new/apps/web/app/api/agenda-madrasah/public/route.ts>) | cek helper/body | ya | — | — |
| [apps/web/app/api/agenda-madrasah/route.ts](<D:/acca-new/apps/web/app/api/agenda-madrasah/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/analisis-beban/route.ts](<D:/acca-new/apps/web/app/api/analisis-beban/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/api-logs/route.ts](<D:/acca-new/apps/web/app/api/api-logs/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/auth/login/route.ts](<D:/acca-new/apps/web/app/api/auth/login/route.ts>) | cek helper/body | — | — | ya |
| [apps/web/app/api/auth/logout/route.ts](<D:/acca-new/apps/web/app/api/auth/logout/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/auth/me/route.ts](<D:/acca-new/apps/web/app/api/auth/me/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/auth/register-parent/route.ts](<D:/acca-new/apps/web/app/api/auth/register-parent/route.ts>) | cek helper/body | — | — | ya |
| [apps/web/app/api/auth/reset-password/route.ts](<D:/acca-new/apps/web/app/api/auth/reset-password/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/auth/update-password/route.ts](<D:/acca-new/apps/web/app/api/auth/update-password/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/bank-data/config/route.ts](<D:/acca-new/apps/web/app/api/bank-data/config/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/bank-data/log/route.ts](<D:/acca-new/apps/web/app/api/bank-data/log/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/bank-data/route.ts](<D:/acca-new/apps/web/app/api/bank-data/route.ts>) | terdeteksi | — | — | ya |
| [apps/web/app/api/catatan-keuangan/route.ts](<D:/acca-new/apps/web/app/api/catatan-keuangan/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/catatan-siswa/route.ts](<D:/acca-new/apps/web/app/api/catatan-siswa/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/catatan-siswa/[id]/route.ts](<D:/acca-new/apps/web/app/api/catatan-siswa/[id]/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/catatan-siswa/[id]/tindak-lanjut/route.ts](<D:/acca-new/apps/web/app/api/catatan-siswa/[id]/tindak-lanjut/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/config/route.ts](<D:/acca-new/apps/web/app/api/config/route.ts>) | terdeteksi | ya | — | — |
| [apps/web/app/api/config-surat/route.ts](<D:/acca-new/apps/web/app/api/config-surat/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/cron/generate-jurnal/route.ts](<D:/acca-new/apps/web/app/api/cron/generate-jurnal/route.ts>) | cek helper/body | ya | — | — |
| [apps/web/app/api/dashboard/summary/route.ts](<D:/acca-new/apps/web/app/api/dashboard/summary/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/dropdown/jenis-surat/route.ts](<D:/acca-new/apps/web/app/api/dropdown/jenis-surat/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/e-supervisi/dokumen/route.ts](<D:/acca-new/apps/web/app/api/e-supervisi/dokumen/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/e-supervisi/nilai/route.ts](<D:/acca-new/apps/web/app/api/e-supervisi/nilai/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/e-supervisi/penugasan/route.ts](<D:/acca-new/apps/web/app/api/e-supervisi/penugasan/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/e-supervisi/rekap/route.ts](<D:/acca-new/apps/web/app/api/e-supervisi/rekap/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/e-supervisi/route.ts](<D:/acca-new/apps/web/app/api/e-supervisi/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/e-supervisi/run-migration-supervisi/route.ts](<D:/acca-new/apps/web/app/api/e-supervisi/run-migration-supervisi/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/e-supervisi/supervisor-list/route.ts](<D:/acca-new/apps/web/app/api/e-supervisi/supervisor-list/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/e-supervisi/tahun-ajaran/route.ts](<D:/acca-new/apps/web/app/api/e-supervisi/tahun-ajaran/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/e-supervisi/unggahan/route.ts](<D:/acca-new/apps/web/app/api/e-supervisi/unggahan/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/e-supervisi/upload/route.ts](<D:/acca-new/apps/web/app/api/e-supervisi/upload/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ekskul/absensi/route.ts](<D:/acca-new/apps/web/app/api/ekskul/absensi/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ekskul/approval/route.ts](<D:/acca-new/apps/web/app/api/ekskul/approval/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ekskul/pembina/route.ts](<D:/acca-new/apps/web/app/api/ekskul/pembina/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ekskul/pertemuan/route.ts](<D:/acca-new/apps/web/app/api/ekskul/pertemuan/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ekskul/route.ts](<D:/acca-new/apps/web/app/api/ekskul/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ekskul/siswa/route.ts](<D:/acca-new/apps/web/app/api/ekskul/siswa/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ekskul/submission/pdf/route.ts](<D:/acca-new/apps/web/app/api/ekskul/submission/pdf/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ekskul/submission/pembayaran/route.ts](<D:/acca-new/apps/web/app/api/ekskul/submission/pembayaran/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ekskul/submission/route.ts](<D:/acca-new/apps/web/app/api/ekskul/submission/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/fitur-akademik/route.ts](<D:/acca-new/apps/web/app/api/fitur-akademik/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/forms/dynamic-options/route.ts](<D:/acca-new/apps/web/app/api/forms/dynamic-options/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/forms/public/route.ts](<D:/acca-new/apps/web/app/api/forms/public/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/forms/route.ts](<D:/acca-new/apps/web/app/api/forms/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/forms/submit/route.ts](<D:/acca-new/apps/web/app/api/forms/submit/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/forms/[id]/allocate/route.ts](<D:/acca-new/apps/web/app/api/forms/[id]/allocate/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/forms/[id]/responses/route.ts](<D:/acca-new/apps/web/app/api/forms/[id]/responses/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/forms/[id]/route.ts](<D:/acca-new/apps/web/app/api/forms/[id]/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/guru-asuh/absensi-akumulasi/route.ts](<D:/acca-new/apps/web/app/api/guru-asuh/absensi-akumulasi/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/guru-asuh/ekskul/route.ts](<D:/acca-new/apps/web/app/api/guru-asuh/ekskul/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/guru-asuh/kokurikuler/route.ts](<D:/acca-new/apps/web/app/api/guru-asuh/kokurikuler/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/guru-asuh/laporan/route.ts](<D:/acca-new/apps/web/app/api/guru-asuh/laporan/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/guru-asuh/laporan-submission/approve/route.ts](<D:/acca-new/apps/web/app/api/guru-asuh/laporan-submission/approve/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/guru-asuh/laporan-submission/pdf/route.ts](<D:/acca-new/apps/web/app/api/guru-asuh/laporan-submission/pdf/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/guru-asuh/laporan-submission/pembayaran/route.ts](<D:/acca-new/apps/web/app/api/guru-asuh/laporan-submission/pembayaran/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/guru-asuh/laporan-submission/preview/route.ts](<D:/acca-new/apps/web/app/api/guru-asuh/laporan-submission/preview/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/guru-asuh/laporan-submission/route.ts](<D:/acca-new/apps/web/app/api/guru-asuh/laporan-submission/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/guru-asuh/laporan-submission/verify/route.ts](<D:/acca-new/apps/web/app/api/guru-asuh/laporan-submission/verify/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/informasi-akademik/izin-saya/route.ts](<D:/acca-new/apps/web/app/api/informasi-akademik/izin-saya/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/informasi-akademik/route.ts](<D:/acca-new/apps/web/app/api/informasi-akademik/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/informasi-akademik/share/file/[token]/[...path]/route.ts](<D:/acca-new/apps/web/app/api/informasi-akademik/share/file/[token]/[...path]/route.ts>) | cek helper/body | — | — | ya |
| [apps/web/app/api/informasi-akademik/share/route.ts](<D:/acca-new/apps/web/app/api/informasi-akademik/share/route.ts>) | terdeteksi | ya | — | — |
| [apps/web/app/api/izin-guru/route.ts](<D:/acca-new/apps/web/app/api/izin-guru/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/izin-guru/[id]/route.ts](<D:/acca-new/apps/web/app/api/izin-guru/[id]/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/jadwal/delete-dates/route.ts](<D:/acca-new/apps/web/app/api/jadwal/delete-dates/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/jadwal/delete-rows/route.ts](<D:/acca-new/apps/web/app/api/jadwal/delete-rows/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/jadwal/generate/route.ts](<D:/acca-new/apps/web/app/api/jadwal/generate/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/jadwal/izin-saya/route.ts](<D:/acca-new/apps/web/app/api/jadwal/izin-saya/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/jadwal/move-date/route.ts](<D:/acca-new/apps/web/app/api/jadwal/move-date/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/jadwal/route.ts](<D:/acca-new/apps/web/app/api/jadwal/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/jadwal/save/route.ts](<D:/acca-new/apps/web/app/api/jadwal/save/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/jadwal/wa-preview/route.ts](<D:/acca-new/apps/web/app/api/jadwal/wa-preview/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/jurnal/banding/route.ts](<D:/acca-new/apps/web/app/api/jurnal/banding/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/jurnal/banding/[id]/route.ts](<D:/acca-new/apps/web/app/api/jurnal/banding/[id]/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/jurnal/check-slot/route.ts](<D:/acca-new/apps/web/app/api/jurnal/check-slot/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/jurnal/import/route.ts](<D:/acca-new/apps/web/app/api/jurnal/import/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/jurnal/pengaturan/delete-by-date/route.ts](<D:/acca-new/apps/web/app/api/jurnal/pengaturan/delete-by-date/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/jurnal/pengaturan/generate-massal/route.ts](<D:/acca-new/apps/web/app/api/jurnal/pengaturan/generate-massal/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/jurnal/pengaturan/route.ts](<D:/acca-new/apps/web/app/api/jurnal/pengaturan/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/jurnal/rekap/route.ts](<D:/acca-new/apps/web/app/api/jurnal/rekap/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/jurnal/route.ts](<D:/acca-new/apps/web/app/api/jurnal/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/jurnal/submit/route.ts](<D:/acca-new/apps/web/app/api/jurnal/submit/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/jurnal/[id]/route.ts](<D:/acca-new/apps/web/app/api/jurnal/[id]/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/kelulusan/route.ts](<D:/acca-new/apps/web/app/api/kelulusan/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ketidakhadiran/absensi/route.ts](<D:/acca-new/apps/web/app/api/ketidakhadiran/absensi/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ketidakhadiran/acca-letter/route.ts](<D:/acca-new/apps/web/app/api/ketidakhadiran/acca-letter/route.ts>) | terdeteksi | ya | — | — |
| [apps/web/app/api/ketidakhadiran/acca-letter/verify/route.ts](<D:/acca-new/apps/web/app/api/ketidakhadiran/acca-letter/verify/route.ts>) | cek helper/body | ya | — | — |
| [apps/web/app/api/ketidakhadiran/acca-letter/[id]/route.ts](<D:/acca-new/apps/web/app/api/ketidakhadiran/acca-letter/[id]/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ketidakhadiran/bulk/route.ts](<D:/acca-new/apps/web/app/api/ketidakhadiran/bulk/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ketidakhadiran/generate-letter/route.ts](<D:/acca-new/apps/web/app/api/ketidakhadiran/generate-letter/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ketidakhadiran/import/route.ts](<D:/acca-new/apps/web/app/api/ketidakhadiran/import/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ketidakhadiran/log/guru-asuh/route.ts](<D:/acca-new/apps/web/app/api/ketidakhadiran/log/guru-asuh/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ketidakhadiran/log/route.ts](<D:/acca-new/apps/web/app/api/ketidakhadiran/log/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ketidakhadiran/log/siswa/[nisn]/route.ts](<D:/acca-new/apps/web/app/api/ketidakhadiran/log/siswa/[nisn]/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ketidakhadiran/log/wali-kelas/route.ts](<D:/acca-new/apps/web/app/api/ketidakhadiran/log/wali-kelas/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ketidakhadiran/notify-wa/route.ts](<D:/acca-new/apps/web/app/api/ketidakhadiran/notify-wa/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/ketidakhadiran/pdf-preview/route.ts](<D:/acca-new/apps/web/app/api/ketidakhadiran/pdf-preview/route.ts>) | cek helper/body | ya | — | ya |
| [apps/web/app/api/ketidakhadiran/rekam-medis/route.ts](<D:/acca-new/apps/web/app/api/ketidakhadiran/rekam-medis/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ketidakhadiran/rekam-medis-siswa/route.ts](<D:/acca-new/apps/web/app/api/ketidakhadiran/rekam-medis-siswa/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ketidakhadiran/rekap/route.ts](<D:/acca-new/apps/web/app/api/ketidakhadiran/rekap/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ketidakhadiran/route.ts](<D:/acca-new/apps/web/app/api/ketidakhadiran/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ketidakhadiran/save-letter/route.ts](<D:/acca-new/apps/web/app/api/ketidakhadiran/save-letter/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ketidakhadiran/[id]/route.ts](<D:/acca-new/apps/web/app/api/ketidakhadiran/[id]/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/keuangan/route.ts](<D:/acca-new/apps/web/app/api/keuangan/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/kinerja-guru/route.ts](<D:/acca-new/apps/web/app/api/kinerja-guru/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/klinik/laporan/pdf/route.ts](<D:/acca-new/apps/web/app/api/klinik/laporan/pdf/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/klinik/laporan/preview/route.ts](<D:/acca-new/apps/web/app/api/klinik/laporan/preview/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/klinik/laporan/rekap/pdf/route.ts](<D:/acca-new/apps/web/app/api/klinik/laporan/rekap/pdf/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/klinik/laporan/rekap/preview/route.ts](<D:/acca-new/apps/web/app/api/klinik/laporan/rekap/preview/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/klinik/route.ts](<D:/acca-new/apps/web/app/api/klinik/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/kokurikuler/laporan/route.ts](<D:/acca-new/apps/web/app/api/kokurikuler/laporan/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/kokurikuler/master/route.ts](<D:/acca-new/apps/web/app/api/kokurikuler/master/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/kokurikuler/siswa/route.ts](<D:/acca-new/apps/web/app/api/kokurikuler/siswa/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/kokurikuler/verifikasi/route.ts](<D:/acca-new/apps/web/app/api/kokurikuler/verifikasi/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/laporan/jurnal-master/route.ts](<D:/acca-new/apps/web/app/api/laporan/jurnal-master/route.ts>) | terdeteksi | ya | — | — |
| [apps/web/app/api/laporan/piket/route.ts](<D:/acca-new/apps/web/app/api/laporan/piket/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/laporan/piket/upload/route.ts](<D:/acca-new/apps/web/app/api/laporan/piket/upload/route.ts>) | cek helper/body | — | — | ya |
| [apps/web/app/api/lckh/approvals/[id]/route.ts](<D:/acca-new/apps/web/app/api/lckh/approvals/[id]/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/lckh/nilai-detail/route.ts](<D:/acca-new/apps/web/app/api/lckh/nilai-detail/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/lckh/periods/route.ts](<D:/acca-new/apps/web/app/api/lckh/periods/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/lckh/print/data/route.ts](<D:/acca-new/apps/web/app/api/lckh/print/data/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/lckh/print/lembar-pengesahan/route.ts](<D:/acca-new/apps/web/app/api/lckh/print/lembar-pengesahan/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/lckh/submissions/route.ts](<D:/acca-new/apps/web/app/api/lckh/submissions/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/lckh/summary/route.ts](<D:/acca-new/apps/web/app/api/lckh/summary/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/master/check-import/route.ts](<D:/acca-new/apps/web/app/api/master/check-import/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/master/dropdown/route.ts](<D:/acca-new/apps/web/app/api/master/dropdown/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/master/guru/pindah/route.ts](<D:/acca-new/apps/web/app/api/master/guru/pindah/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/master/guru/rekening/route.ts](<D:/acca-new/apps/web/app/api/master/guru/rekening/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/master/guru/route.ts](<D:/acca-new/apps/web/app/api/master/guru/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/master/jp-mapel/route.ts](<D:/acca-new/apps/web/app/api/master/jp-mapel/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/master/kelas/route.ts](<D:/acca-new/apps/web/app/api/master/kelas/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/master/kode-guru/route.ts](<D:/acca-new/apps/web/app/api/master/kode-guru/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/master/mapel/route.ts](<D:/acca-new/apps/web/app/api/master/mapel/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/master/mapel-kelas/route.ts](<D:/acca-new/apps/web/app/api/master/mapel-kelas/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/master/students/bulk-status/route.ts](<D:/acca-new/apps/web/app/api/master/students/bulk-status/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/master/students/card/route.ts](<D:/acca-new/apps/web/app/api/master/students/card/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/master/students/route.ts](<D:/acca-new/apps/web/app/api/master/students/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/master/students/verify/route.ts](<D:/acca-new/apps/web/app/api/master/students/verify/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/master/waktu/route.ts](<D:/acca-new/apps/web/app/api/master/waktu/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/master-dropdown/column/route.ts](<D:/acca-new/apps/web/app/api/master-dropdown/column/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/master-dropdown/route.ts](<D:/acca-new/apps/web/app/api/master-dropdown/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/me/capabilities/route.ts](<D:/acca-new/apps/web/app/api/me/capabilities/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/menu-layout/route.ts](<D:/acca-new/apps/web/app/api/menu-layout/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/monitoring/activity/route.ts](<D:/acca-new/apps/web/app/api/monitoring/activity/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/monitoring/users/route.ts](<D:/acca-new/apps/web/app/api/monitoring/users/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/nilai/admin/route.ts](<D:/acca-new/apps/web/app/api/nilai/admin/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/nilai/apresiasi/route.ts](<D:/acca-new/apps/web/app/api/nilai/apresiasi/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/nilai/bobot/route.ts](<D:/acca-new/apps/web/app/api/nilai/bobot/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/nilai/filters/route.ts](<D:/acca-new/apps/web/app/api/nilai/filters/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/nilai/guru-list/route.ts](<D:/acca-new/apps/web/app/api/nilai/guru-list/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/nilai/route.ts](<D:/acca-new/apps/web/app/api/nilai/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/nilai/siswa/apresiasi/route.ts](<D:/acca-new/apps/web/app/api/nilai/siswa/apresiasi/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/nilai/siswa/photos/route.ts](<D:/acca-new/apps/web/app/api/nilai/siswa/photos/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/nilai/siswa/route.ts](<D:/acca-new/apps/web/app/api/nilai/siswa/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/nilai/siswa/students/route.ts](<D:/acca-new/apps/web/app/api/nilai/siswa/students/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/nilai/tagihan/route.ts](<D:/acca-new/apps/web/app/api/nilai/tagihan/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/notifications/route.ts](<D:/acca-new/apps/web/app/api/notifications/route.ts>) | terdeteksi | ya | — | — |
| [apps/web/app/api/observasi-kelas/route.ts](<D:/acca-new/apps/web/app/api/observasi-kelas/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/observasi-kelas/[id]/route.ts](<D:/acca-new/apps/web/app/api/observasi-kelas/[id]/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/orangtua/anak/route.ts](<D:/acca-new/apps/web/app/api/orangtua/anak/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/orangtua-siswa/route.ts](<D:/acca-new/apps/web/app/api/orangtua-siswa/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/pages/route.ts](<D:/acca-new/apps/web/app/api/pages/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/pdf-proxy/route.ts](<D:/acca-new/apps/web/app/api/pdf-proxy/route.ts>) | cek helper/body | — | — | ya |
| [apps/web/app/api/pengumuman/route.ts](<D:/acca-new/apps/web/app/api/pengumuman/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/pengumuman/[id]/route.ts](<D:/acca-new/apps/web/app/api/pengumuman/[id]/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/permintaan-surat/route.ts](<D:/acca-new/apps/web/app/api/permintaan-surat/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/permintaan-surat/[id]/route.ts](<D:/acca-new/apps/web/app/api/permintaan-surat/[id]/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/personal/documents/delete/route.ts](<D:/acca-new/apps/web/app/api/personal/documents/delete/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/personal/documents/download/batch/route.ts](<D:/acca-new/apps/web/app/api/personal/documents/download/batch/route.ts>) | terdeteksi | — | — | ya |
| [apps/web/app/api/personal/documents/download/folder/route.ts](<D:/acca-new/apps/web/app/api/personal/documents/download/folder/route.ts>) | terdeteksi | — | — | ya |
| [apps/web/app/api/personal/documents/move/route.ts](<D:/acca-new/apps/web/app/api/personal/documents/move/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/personal/documents/route.ts](<D:/acca-new/apps/web/app/api/personal/documents/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/personal/documents/share/revoke/route.ts](<D:/acca-new/apps/web/app/api/personal/documents/share/revoke/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/personal/documents/share/route.ts](<D:/acca-new/apps/web/app/api/personal/documents/share/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/personal/documents/upload/prepare/route.ts](<D:/acca-new/apps/web/app/api/personal/documents/upload/prepare/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/personal/documents/upload/route.ts](<D:/acca-new/apps/web/app/api/personal/documents/upload/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/personal/documents/[id]/file/route.ts](<D:/acca-new/apps/web/app/api/personal/documents/[id]/file/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/personal/folders/delete/route.ts](<D:/acca-new/apps/web/app/api/personal/folders/delete/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/personal/folders/route.ts](<D:/acca-new/apps/web/app/api/personal/folders/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/personal/folders/share/revoke/route.ts](<D:/acca-new/apps/web/app/api/personal/folders/share/revoke/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/personal/folders/share/route.ts](<D:/acca-new/apps/web/app/api/personal/folders/share/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/personal/users/search/route.ts](<D:/acca-new/apps/web/app/api/personal/users/search/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/prestasi/route.ts](<D:/acca-new/apps/web/app/api/prestasi/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/prestasi/[id]/route.ts](<D:/acca-new/apps/web/app/api/prestasi/[id]/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/profil-sekolah/route.ts](<D:/acca-new/apps/web/app/api/profil-sekolah/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/profile-guru/route.ts](<D:/acca-new/apps/web/app/api/profile-guru/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/profile-siswa/route.ts](<D:/acca-new/apps/web/app/api/profile-siswa/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/proxy/image/route.ts](<D:/acca-new/apps/web/app/api/proxy/image/route.ts>) | cek helper/body | — | — | ya |
| [apps/web/app/api/proxy/upload/route.ts](<D:/acca-new/apps/web/app/api/proxy/upload/route.ts>) | cek helper/body | — | — | ya |
| [apps/web/app/api/proxy-docx/route.ts](<D:/acca-new/apps/web/app/api/proxy-docx/route.ts>) | cek helper/body | — | — | ya |
| [apps/web/app/api/proxy-image/route.ts](<D:/acca-new/apps/web/app/api/proxy-image/route.ts>) | cek helper/body | — | — | ya |
| [apps/web/app/api/ptsp/notify-wa/route.ts](<D:/acca-new/apps/web/app/api/ptsp/notify-wa/route.ts>) | terdeteksi | ya | — | — |
| [apps/web/app/api/ptsp/route.ts](<D:/acca-new/apps/web/app/api/ptsp/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/qrcode/route.ts](<D:/acca-new/apps/web/app/api/qrcode/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/rekap-jurnal/route.ts](<D:/acca-new/apps/web/app/api/rekap-jurnal/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/reset-data/replace/route.ts](<D:/acca-new/apps/web/app/api/reset-data/replace/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/reset-data/search/route.ts](<D:/acca-new/apps/web/app/api/reset-data/search/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/sanggar/route.ts](<D:/acca-new/apps/web/app/api/sanggar/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/sanggar/[id]/route.ts](<D:/acca-new/apps/web/app/api/sanggar/[id]/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/sanggar-kurikulum/broadcast/route.ts](<D:/acca-new/apps/web/app/api/sanggar-kurikulum/broadcast/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/sanggar-kurikulum/check/route.ts](<D:/acca-new/apps/web/app/api/sanggar-kurikulum/check/route.ts>) | terdeteksi | ya | — | — |
| [apps/web/app/api/sanggar-kurikulum/kuota/route.ts](<D:/acca-new/apps/web/app/api/sanggar-kurikulum/kuota/route.ts>) | cek helper/body | ya | — | — |
| [apps/web/app/api/scopes/my-scopes/route.ts](<D:/acca-new/apps/web/app/api/scopes/my-scopes/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/scopes/route.ts](<D:/acca-new/apps/web/app/api/scopes/route.ts>) | cek helper/body | ya | — | — |
| [apps/web/app/api/settings/guru-asuh/bulk-copy/route.ts](<D:/acca-new/apps/web/app/api/settings/guru-asuh/bulk-copy/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/settings/guru-asuh/route.ts](<D:/acca-new/apps/web/app/api/settings/guru-asuh/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/settings/guru-mapel/check/route.ts](<D:/acca-new/apps/web/app/api/settings/guru-mapel/check/route.ts>) | terdeteksi | ya | — | — |
| [apps/web/app/api/settings/guru-mapel/route.ts](<D:/acca-new/apps/web/app/api/settings/guru-mapel/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/settings/jadwal-guru/import/route.ts](<D:/acca-new/apps/web/app/api/settings/jadwal-guru/import/route.ts>) | terdeteksi | ya | — | — |
| [apps/web/app/api/settings/jadwal-guru/route.ts](<D:/acca-new/apps/web/app/api/settings/jadwal-guru/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/settings/jadwal-piket/import/route.ts](<D:/acca-new/apps/web/app/api/settings/jadwal-piket/import/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/settings/jadwal-piket/route.ts](<D:/acca-new/apps/web/app/api/settings/jadwal-piket/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/settings/libur/route.ts](<D:/acca-new/apps/web/app/api/settings/libur/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/settings/siswa-kelas/route.ts](<D:/acca-new/apps/web/app/api/settings/siswa-kelas/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/settings/um-lock/debug/route.ts](<D:/acca-new/apps/web/app/api/settings/um-lock/debug/route.ts>) | cek helper/body | ya | — | — |
| [apps/web/app/api/settings/um-lock/route.ts](<D:/acca-new/apps/web/app/api/settings/um-lock/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/settings/wali-kelas/route.ts](<D:/acca-new/apps/web/app/api/settings/wali-kelas/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/sidebar-badges/route.ts](<D:/acca-new/apps/web/app/api/sidebar-badges/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/sidebar-badges/seen/route.ts](<D:/acca-new/apps/web/app/api/sidebar-badges/seen/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/siswa/[identifier]/kelas/route.ts](<D:/acca-new/apps/web/app/api/siswa/[identifier]/kelas/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/siswa/[identifier]/route.ts](<D:/acca-new/apps/web/app/api/siswa/[identifier]/route.ts>) | terdeteksi | ya | — | — |
| [apps/web/app/api/site-settings/route.ts](<D:/acca-new/apps/web/app/api/site-settings/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/sso/cbt/route.ts](<D:/acca-new/apps/web/app/api/sso/cbt/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/sso/tools/route.ts](<D:/acca-new/apps/web/app/api/sso/tools/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/storage/upload/route.ts](<D:/acca-new/apps/web/app/api/storage/upload/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/surat/by-id/route.ts](<D:/acca-new/apps/web/app/api/surat/by-id/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/surat/by-nomor/route.ts](<D:/acca-new/apps/web/app/api/surat/by-nomor/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/surat/download/route.ts](<D:/acca-new/apps/web/app/api/surat/download/route.ts>) | terdeteksi | — | — | ya |
| [apps/web/app/api/surat/generate-docx/route.ts](<D:/acca-new/apps/web/app/api/surat/generate-docx/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/surat/generate-docx-v2/route.ts](<D:/acca-new/apps/web/app/api/surat/generate-docx-v2/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/surat/generate-number/route.ts](<D:/acca-new/apps/web/app/api/surat/generate-number/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/surat/generate-pdf/route.ts](<D:/acca-new/apps/web/app/api/surat/generate-pdf/route.ts>) | terdeteksi | — | — | ya |
| [apps/web/app/api/surat/guru/route.ts](<D:/acca-new/apps/web/app/api/surat/guru/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/surat/search/route.ts](<D:/acca-new/apps/web/app/api/surat/search/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/surat/sign-pdf/route.ts](<D:/acca-new/apps/web/app/api/surat/sign-pdf/route.ts>) | terdeteksi | — | — | ya |
| [apps/web/app/api/surat/siswa/route.ts](<D:/acca-new/apps/web/app/api/surat/siswa/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/surat/templates/route.ts](<D:/acca-new/apps/web/app/api/surat/templates/route.ts>) | terdeteksi | — | — | ya |
| [apps/web/app/api/surat/templates/urls/route.ts](<D:/acca-new/apps/web/app/api/surat/templates/urls/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/surat/templates/[id]/route.ts](<D:/acca-new/apps/web/app/api/surat/templates/[id]/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/surat/upload/route.ts](<D:/acca-new/apps/web/app/api/surat/upload/route.ts>) | cek helper/body | — | — | ya |
| [apps/web/app/api/surat/verify/route.ts](<D:/acca-new/apps/web/app/api/surat/verify/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/surat/[id]/route.ts](<D:/acca-new/apps/web/app/api/surat/[id]/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/tarif-honor/route.ts](<D:/acca-new/apps/web/app/api/tarif-honor/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/test-simple/route.ts](<D:/acca-new/apps/web/app/api/test-simple/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/testimonials/route.ts](<D:/acca-new/apps/web/app/api/testimonials/route.ts>) | terdeteksi | ya | — | — |
| [apps/web/app/api/tugas-siswa/action/route.ts](<D:/acca-new/apps/web/app/api/tugas-siswa/action/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/tugas-siswa/master/route.ts](<D:/acca-new/apps/web/app/api/tugas-siswa/master/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/tugas-siswa/route.ts](<D:/acca-new/apps/web/app/api/tugas-siswa/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/tugas-siswa/upload/route.ts](<D:/acca-new/apps/web/app/api/tugas-siswa/upload/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/tugas-siswa/[id]/route.ts](<D:/acca-new/apps/web/app/api/tugas-siswa/[id]/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/tugas-tambahan/jurnal/route.ts](<D:/acca-new/apps/web/app/api/tugas-tambahan/jurnal/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/tugas-tambahan/route.ts](<D:/acca-new/apps/web/app/api/tugas-tambahan/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/tukar-jadwal/guru/route.ts](<D:/acca-new/apps/web/app/api/tukar-jadwal/guru/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/tukar-jadwal/route.ts](<D:/acca-new/apps/web/app/api/tukar-jadwal/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/tukar-jadwal/slots/route.ts](<D:/acca-new/apps/web/app/api/tukar-jadwal/slots/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/tukar-jadwal/[id]/route.ts](<D:/acca-new/apps/web/app/api/tukar-jadwal/[id]/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ujian-madrasah/config/route.ts](<D:/acca-new/apps/web/app/api/ujian-madrasah/config/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ujian-madrasah/import-raport/route.ts](<D:/acca-new/apps/web/app/api/ujian-madrasah/import-raport/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ujian-madrasah/kelas-xii/route.ts](<D:/acca-new/apps/web/app/api/ujian-madrasah/kelas-xii/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/ujian-madrasah/route.ts](<D:/acca-new/apps/web/app/api/ujian-madrasah/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/upload/route.ts](<D:/acca-new/apps/web/app/api/upload/route.ts>) | terdeteksi | ya | — | ya |
| [apps/web/app/api/upload-categories/route.ts](<D:/acca-new/apps/web/app/api/upload-categories/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/upload-categories/[id]/route.ts](<D:/acca-new/apps/web/app/api/upload-categories/[id]/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/uploaded-documents/route.ts](<D:/acca-new/apps/web/app/api/uploaded-documents/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/uploaded-documents/[id]/route.ts](<D:/acca-new/apps/web/app/api/uploaded-documents/[id]/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/uploader-search/route.ts](<D:/acca-new/apps/web/app/api/uploader-search/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/user/heartbeat/route.ts](<D:/acca-new/apps/web/app/api/user/heartbeat/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/user/log/route.ts](<D:/acca-new/apps/web/app/api/user/log/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/user/pinned-pages/route.ts](<D:/acca-new/apps/web/app/api/user/pinned-pages/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/user/profile/route.ts](<D:/acca-new/apps/web/app/api/user/profile/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/version/route.ts](<D:/acca-new/apps/web/app/api/version/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/wali-kelas/absensi-akumulasi/lock/route.ts](<D:/acca-new/apps/web/app/api/wali-kelas/absensi-akumulasi/lock/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/wali-kelas/absensi-akumulasi/route.ts](<D:/acca-new/apps/web/app/api/wali-kelas/absensi-akumulasi/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/wali-kelas/absensi-akumulasi/unlock/route.ts](<D:/acca-new/apps/web/app/api/wali-kelas/absensi-akumulasi/unlock/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/wali-kelas/ekskul/route.ts](<D:/acca-new/apps/web/app/api/wali-kelas/ekskul/route.ts>) | terdeteksi | — | — | — |
| [apps/web/app/api/whatsapp/baileys/logout/route.ts](<D:/acca-new/apps/web/app/api/whatsapp/baileys/logout/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/whatsapp/baileys/status/route.ts](<D:/acca-new/apps/web/app/api/whatsapp/baileys/status/route.ts>) | cek helper/body | — | — | — |
| [apps/web/app/api/whatsapp/send/route.ts](<D:/acca-new/apps/web/app/api/whatsapp/send/route.ts>) | cek helper/body | ya | — | ya |
| [apps/web/app/api/whatsapp/test-image/route.ts](<D:/acca-new/apps/web/app/api/whatsapp/test-image/route.ts>) | cek helper/body | — | — | ya |
| [apps/web/app/api/whatsapp/test-text/route.ts](<D:/acca-new/apps/web/app/api/whatsapp/test-text/route.ts>) | cek helper/body | — | — | ya |
