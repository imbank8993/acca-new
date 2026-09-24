const fs=require('fs'); const root='apps/api/src/';
function edit(p,f){fs.writeFileSync(p,f(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')))}
edit(root+'bank-data/bank-data.module.ts',s=>s.replace("import { Module }", "import { AccessModule } from '../access/access.module';\nimport { Module }").replace('imports: [PrismaModule]','imports: [PrismaModule, AccessModule]'));
edit(root+'bank-data/bank-data.controller.ts',s=>s.replace('async getConfig()', 'async getConfig(@Request() req: any)').replace('this.service.getConfig()', 'this.service.getConfig(req.user)').replace('async getLogs(\n','async getLogs(\n    @Request() req: any,\n').replace('this.service.getLogs(page, 50, dataset)', 'this.service.getLogs(req.user, page, 50, dataset)'));
edit(root+'lckh/lckh.service.ts',s=>s.replace("...(period?.tahun_ajaran ? { tahun_ajaran: period.tahun_ajaran } : {})", "...(period ? { tahun_ajaran: period.tgl_awal.getUTCMonth() >= 6 ? `${period.tgl_awal.getUTCFullYear()}/${period.tgl_awal.getUTCFullYear()+1}` : `${period.tgl_awal.getUTCFullYear()-1}/${period.tgl_awal.getUTCFullYear()}`, semester: period.tgl_awal.getUTCMonth() >= 6 ? 1 : 2 } : {})"));
edit(root+'nilai/nilai.service.ts',s=>{
const a=s.indexOf('  async checkSiswaAccess('),b=s.indexOf('  async getSiswaNilai(',a);
return s.slice(0,a)+`  async checkSiswaAccess(user: any, nisn: string): Promise<boolean> {
    if (!user?.id || !nisn) return false;
    if (this.isPrivileged(user)) return true;
    const roles = user.roles || String(user.role || '').split(/[,|]/).map((r: string) => r.trim().toUpperCase());
    if (roles.includes('SISWA')) return String(user.nip || user.username || '') === nisn;
    if (roles.some((r: string) => ['ORANG_TUA','ORANGTUA'].includes(r))) return !!await this.prisma.orangtua_siswa.findFirst({ where: { user_id: BigInt(user.id), nisn } });
    if (!user.nip) return false;
    const rows = await this.prisma.siswa_kelas.findMany({ where: { nisn, aktif: true }, select: { kelas: true } });
    const kelas = rows.map(r => r.kelas).filter(Boolean) as string[];
    if (!kelas.length) return false;
    return !!(await this.prisma.jadwal_guru.findFirst({ where: { nip: user.nip, kelas: { in: kelas }, aktif: true } }) || await this.prisma.wali_kelas.findFirst({ where: { nip: user.nip, nama_kelas: { in: kelas }, aktif: true } }));
  }

`+s.slice(b);
});
edit(root+'tugas-siswa/tugas-siswa.service.ts',s=>{
s=s.replace('NotFoundException }','NotFoundException, ForbiddenException }');
s=s.replace('  async findAll(',`  private assertOwner(row: any, user: any) {
    const admin = user?.roles?.some((r: string) => ['ADMIN','ADMINISTRATOR'].includes(r));
    const owner = (user?.id && String(row.created_by || '') === String(user.id)) || (user?.nip && [row.created_by_nip,row.nisn_pembuat,row.guru_id].includes(user.nip));
    if (!admin && !owner) throw new ForbiddenException('Hanya pemilik yang dapat mengubah tugas');
  }
  private async scope(user: any) {
    if (!user?.id) throw new ForbiddenException('Sesi diperlukan');
    if (!user.roles?.includes('SISWA')) return {};
    const kelas = await this.prisma.siswa_kelas.findMany({ where: { nisn: user.nip || '', aktif: true }, select: { kelas: true } });
    const names = kelas.map(k => k.kelas).filter(Boolean) as string[];
    return { OR: [{ kelas: { in: names } }, { kelas_list: { hasSome: names } }] };
  }
  async findAll(`);
const a=s.indexOf('    // Siswa scope filter'),b=s.indexOf('    const [total',a);
s=s.slice(0,a)+`    const scope = await this.scope(apiUser);
    where.AND = [...(where.AND || []), scope];
    filter = { ...filter, userId: String(apiUser.id) };

`+s.slice(b);
s=s.replace('async findById(id: number)', 'async findById(id: number, apiUser: any)').replace("    const record = await this.prisma.tugas_siswa.findUnique({\n      where: { id: BigInt(id) },", "    const record = await this.prisma.tugas_siswa.findFirst({\n      where: { id: BigInt(id), ...(await this.scope(apiUser)) },");
s=s.replace('tugas_siswa_checklist: true,','tugas_siswa_checklist: { where: { siswa_id: BigInt(apiUser.id) } },');
s=s.replace(/    const isAdmin = apiUser\?\.roles\?\.includes\('ADMIN'\);[\s\S]*?    }\n/g,'    this.assertOwner(existing, apiUser);\n');
s=s.replace('  async create(data: any, apiUser: any) {',`  async create(data: any, apiUser: any) {
    if (!apiUser?.id || !apiUser.nip) throw new ForbiddenException('Identitas pengguna diperlukan');`);
for(const key of ['nisn_pembuat','created_by_nip']) s=s.replace(`${key}: data.${key} || apiUser?.nip || null`,`${key}: apiUser.nip`);
s=s.replace("created_by: data.created_by || (apiUser?.id ? String(apiUser.id) : null)","created_by: String(apiUser.id)");
s=s.replace("nama_pembuat: data.nama_pembuat || apiUser?.nama || apiUser?.nama_lengkap || null", "nama_pembuat: apiUser?.nama || apiUser?.nama_lengkap || null");
s=s.replace(/    await this.prisma.tugas_siswa_checklist.deleteMany\([\s\S]*?    await this.prisma.tugas_siswa.delete\([\s\S]*?    \}\);/,`    await this.prisma.$transaction(async tx => {
      await tx.tugas_siswa_checklist.deleteMany({ where: { tugas_id: BigInt(id) } });
      await tx.tugas_siswa.delete({ where: { id: BigInt(id) } });
    });`);
s=s.replace("    if (filter.kelas) where.kelas = filter.kelas;", "    if (filter.kelas) where.kelas = filter.kelas;\n    where.AND = [await this.scope(apiUser)];\n    filter = { ...filter, userId: String(apiUser.id) };");
s=s.replace("    if (isSiswa && apiUser.id !== Number(siswaId))", "    await this.findById(tugasId, apiUser);\n    if (String(apiUser?.id) !== String(siswaId))");
return s;
});
edit(root+'tugas-siswa/tugas-siswa.controller.ts',s=>s.replace("async findById(@Param", "async findById(@Req() req: any, @Param").replace('this.tugasSiswaService.findById(id)', 'this.tugasSiswaService.findById(id, this.getApiUser(req.user))'));
// No body can select another task owner via guru_id when the author is a student.
edit(root+'tugas-siswa/tugas-siswa.service.ts',s=>s.replace('guru_id: data.guru_id || null,',"guru_id: apiUser.roles?.includes('SISWA') ? null : apiUser.nip,").replace('    if (data.guru_id !== undefined) updatePayload.guru_id = data.guru_id;',''));
