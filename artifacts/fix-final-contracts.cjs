const fs=require('fs');function edit(p,f){fs.writeFileSync(p,f(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')))}const root='apps/api/src/';
edit(root+'lckh/lckh.service.ts',s=>s.replace('async getNilaiDetail(query: any)', 'async getNilaiDetail(query: any, user: any)').replace('    const studentsRaw = await this.prisma.siswa_kelas.findMany({','    this.scopeNip(user, metadata.nip);\n    const studentsRaw = await this.prisma.siswa_kelas.findMany({'));
edit(root+'lckh/lckh.controller.ts',s=>s.replace('async getNilaiDetail(@Query()', 'async getNilaiDetail(@Req() req: any, @Query()').replace('this.lckhService.getNilaiDetail(query)','this.lckhService.getNilaiDetail(query, this.getApiUser(req.user))'));
edit(root+'site-settings/site-settings.service.ts',s=>s.replace('async getSetting(key: string, isPublic: boolean)', 'async getSetting(key: string, isPublic: boolean, authenticated = false)').replace("if (isPublic && !key.startsWith('maintenance_'))", "if (isPublic && !key.startsWith('maintenance_') && !(authenticated && ['timezone','sanggar_config','absensi_access_config','dokumen_access_config','jurnal_access_config','jadwal_generate_access_config','agenda_access_config','informasi_access_config'].includes(key)))"));
edit(root+'site-settings/site-settings.controller.ts',s=>s.replace('this.siteSettingsService.getSetting(key, isPublic)', 'this.siteSettingsService.getSetting(key, isPublic, !!req.user)'));
edit(root+'site-settings/site-settings.service.ts',s=>s.replace(/  async updateFileStorageConfig\(id: string, data: any\) \{[\s\S]*?\n  }/,`  async updateFileStorageConfig(id: string, data: any) {
    const allowed = ['hosting_url','php_upload_path','php_delete_path','supabase_bucket','google_drive_folder_id','cloudflare_account_id','cloudflare_access_key_id','cloudflare_secret_access_key','cloudflare_bucket_name','cloudflare_public_url','cloudflare_cdn_domain','max_file_size_mb','allowed_extensions'];
    const patch: any = Object.fromEntries(allowed.filter(k => data[k] !== undefined).map(k => [k,data[k]]));
    for (const key of ['cloudflare_access_key_id','cloudflare_secret_access_key']) if (!patch[key]) delete patch[key];
    const result = await this.prisma.file_storage_config.update({ where: { id }, data: { ...patch, updated_at: new Date() } });
    const { cloudflare_access_key_id, cloudflare_secret_access_key, ...safe } = result;
    return safe;
  }`));
edit(root+'keuangan/keuangan.service.ts',s=>s.replace('let globalSupabase: any;','let globalSupabase: any;\nlet globalPrisma: PrismaService;').replace('private readonly prisma: PrismaService,\n  ) {}','private readonly prisma: PrismaService,\n  ) { globalPrisma = prisma; }').replace(/async function replaceRegisters\(requestId: string, registers: any\): Promise<void> \{[\s\S]*?\n}/,`async function replaceRegisters(requestId: string, registers: any): Promise<void> {
    const cleaned = cleanRegisters(registers);
    await globalPrisma.$transaction(async tx => {
        await tx.budget_request_registers.deleteMany({ where: { budget_request_id: requestId } });
        if (cleaned.length) await tx.budget_request_registers.createMany({ data: cleaned.map(register_number => ({ budget_request_id: requestId, register_number })) });
    });
}`));
edit(root+'jurnal/jurnal.service.ts',s=>s.replace("import { PrismaService }", "import { aksesDiizinkan, parseKonfigurasiAkses } from '../auth/feature-access.guard';\nimport { PrismaService }").replace('  // --- Settings ---',`  private validRange(startDate: string, endDate: string) {
    const a = new Date(startDate), b = new Date(endDate);
    if (!Number.isFinite(+a) || !Number.isFinite(+b) || b < a || +b - +a > 366 * 86400000) throw new BadRequestException('Rentang tanggal tidak valid atau melebihi satu tahun');
  }
  // --- Settings ---`).replace(/    const roles = apiUser\?\.roles \|\| \[\];\n    if \(!roles.includes\('ADMIN'\)\) \{[\s\S]*?    }/,`    const config = await this.prisma.site_settings.findUnique({ where: { key: 'jurnal_access_config' }, select: { value: true } });
    if (!aksesDiizinkan(apiUser, parseKonfigurasiAkses(config?.value))) throw new ForbiddenException('Izin pengelola jurnal diperlukan');
    this.validRange(startDate,endDate);`).replace('    const start = new Date(startDate);','    this.validRange(startDate,endDate);\n    const start = new Date(startDate);'));
edit(root+'um-kelulusan/um-kelulusan.controller.ts',s=>s.replace("return role.includes('ADMIN') || role.includes('KURIKULUM');", "return (req.user?.roles || role.split(/[,|]/).map((r: string) => r.trim())).some((r: string) => ['ADMIN','ADMINISTRATOR','KURIKULUM','WKM_AKADEMIK','WAKAMAD_KURIKULUM'].includes(r));"));
edit(root+'nilai/nilai.service.ts',s=>s.replace('async getSiswaStudents(query: any)', 'async getSiswaStudents(query: any, user: any)').replace('data: serializeBigInt(students) }',"data: serializeBigInt(this.isPrivileged(user) ? students : (await Promise.all(students.map(async student => await this.checkSiswaAccess(user, student.nisn || '') ? student : null))).filter(Boolean)) }"));
edit(root+'nilai/nilai.controller.ts',s=>s.replace('async getSiswaStudents(@Query()', 'async getSiswaStudents(@Req() req: any, @Query()').replace('this.nilaiService.getSiswaStudents(query)','this.nilaiService.getSiswaStudents(query, req.user)'));
