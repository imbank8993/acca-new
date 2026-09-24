const fs = require('fs');
function edit(p, fn) {const old = fs.readFileSync(p,'utf8'); fs.writeFileSync(p,fn(old));}
const api='apps/api/src/';
for(const dir of ['prestasi','observasi-kelas','nilai','lckh','wali-kelas']) {
 edit(`${api}${dir}/${dir}.service.ts`,s=>s.replace("if (typeof obj === 'bigint')", "if (obj instanceof Date) return obj.toISOString();\n  if (obj && typeof obj.toJSON === 'function') return obj.toJSON();\n  if (typeof obj === 'bigint')"));
}
edit(api+'auth/jwt.strategy.ts',s=>s.replace('user.aktif === false','user.aktif !== true'));
edit(api+'site-settings/site-settings.controller.ts',s=>s.replace(/@UseGuards\(JwtAuthGuard\)(\s+@(?:Post|Put|Get)\('(?:site-settings\/file-storage-config[^']*|storage-usage)'\))\s+@UseGuards\(RolesGuard\)/g,'@UseGuards(JwtAuthGuard, RolesGuard)$1'));
edit(api+'site-settings/site-settings.service.ts',s=>s.replace(/async switchFileStorageConfig\(id: string\) \{[\s\S]*?\n  }/,`async switchFileStorageConfig(id: string) {
    return this.prisma.$transaction(async tx => {
      await tx.file_storage_config.findUniqueOrThrow({ where: { id } });
      await tx.file_storage_config.updateMany({ where: { is_active: true }, data: { is_active: false } });
      const result = await tx.file_storage_config.update({ where: { id }, data: { is_active: true, updated_at: new Date() } });
      const { cloudflare_secret_access_key, cloudflare_access_key_id, ...safe } = result;
      return safe;
    }, { isolationLevel: 'Serializable' });
  }`).replace('results.push({ ...cfg, usage, tableLabels: TABLE_LABELS });', 'const { cloudflare_secret_access_key, cloudflare_access_key_id, ...safe } = cfg;\n      results.push({ ...safe, usage, tableLabels: TABLE_LABELS });'));
edit(api+'pengumuman/pengumuman.service.ts',s=>s.replace('// Sort logic', "data = data.map(p => ({ ...p, content: this.sanitize(p.content || '') }));\n\n    // Sort logic"));
edit('apps/web/lib/api-auth.ts',s=>s.replace("const isAdmin = roles.includes('ADMIN');", "const isAdmin = roles.includes('ADMIN') || roles.includes('ADMINISTRATOR');"));
edit(api+'ptsp/ptsp.controller.ts',s=>s.replace("roles.includes('PTSP');", "roles.includes('PTSP') || roles.includes('OP_LAYANAN');"));
edit(api+'e-supervisi/e-supervisi.service.ts',s=>s.replace('const { penugasan_id, scores, scored_by } = body;', "const { penugasan_id, scores } = body;\n    const scored_by = apiUser?.nip || String(apiUser?.id || '');"));
edit(api+'nilai/nilai.service.ts',s=>s.replace(/    const roles = apiUser\?\.roles[^\n]*\n    const isSiswaOrOrtu[\s\S]*?    return true;\n  }/,`    const roles = apiUser?.roles || String(apiUser?.role || '').split(/[,|]/).map((r: string) => r.trim().toUpperCase());
    if (!nisn || !apiUser?.id) return false;
    if (roles.includes('SISWA')) return String(apiUser.nip || apiUser.username || '') === nisn;
    if (roles.some((r: string) => ['ORANG_TUA','ORANGTUA'].includes(r))) {
      return !!await this.prisma.orangtua_siswa.findFirst({ where: { user_id: BigInt(apiUser.id), nisn } });
    }
    if (!apiUser.nip) return false;
    const classes = await this.prisma.siswa_kelas.findMany({ where: { nisn, aktif: true }, select: { kelas: true } });
    const kelas = classes.map(c => c.kelas).filter(Boolean) as string[];
    if (!kelas.length) return false;
    return !!(await this.prisma.guru_mapel.findFirst({ where: { nip: apiUser.nip, kelas: { in: kelas } } }) ||
      await this.prisma.wali_kelas.findFirst({ where: { nip: apiUser.nip, kelas: { in: kelas } } }));
  }`));
