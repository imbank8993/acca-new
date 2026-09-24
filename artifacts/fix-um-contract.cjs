const fs=require('fs');const p='apps/api/src/um-kelulusan/um-kelulusan.service.ts';let s=fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
s=s.replace('  async postUjianMadrasah(body: any) {\n    const { kelas, tahun_ajaran, nip, updates } = body;',`  async postUjianMadrasah(body: any, user: any) {
    if (!user?.id) throw new ForbiddenException('Identitas diperlukan');
    const roles = user.roles || String(user.role || '').split(/[,|]/).map((r: string) => r.trim().toUpperCase());
    const manager = roles.some((r: string) => ['ADMIN','ADMINISTRATOR','KURIKULUM','WKM_AKADEMIK','WAKAMAD_KURIKULUM'].includes(r));
    const { kelas, tahun_ajaran, updates } = body;
    const nip = user.nip;
    if (!tahun_ajaran) throw new BadRequestException('Tahun ajaran wajib diisi');
    if (!manager && (!nip || !roles.includes('GURU'))) throw new ForbiddenException('Hak pengajar diperlukan');
    if (!Array.isArray(updates) || !updates.length) throw new BadRequestException('Tidak ada data');
    for (const row of updates) {
      if (!row.nisn || !row.mapel || (row.nilai != null && row.nilai !== '' && (!Number.isFinite(Number(row.nilai)) || Number(row.nilai)<0 || Number(row.nilai)>100))) throw new BadRequestException('Identitas atau nilai tidak valid');
      if (!manager) {
        if (row.guru_nip && row.guru_nip !== nip) throw new ForbiddenException('Guru tidak sesuai sesi');
        const assigned = await this.prisma.master_mapel_kelas.findFirst({ where: { guru_nip: nip, kelas_nama: kelas, tahun_ajaran, OR: [{ mapel_kode: row.mapel }, { master_mapel: { nama: row.mapel } }] } });
        if (!assigned) throw new ForbiddenException('Bukan pengajar kelas/mapel ini');
        row.guru_nip = nip;
      }
    }`);
const a=s.indexOf('  async postUjianMadrasah'),b=s.indexOf('  async getKelasXii',a);let part=s.slice(a,b);part=part.replace('    for (const u of updates) {','    await this.prisma.$transaction(async tx => {\n    for (const u of updates) {').replace('await this.prisma.ujian_madrasah.upsert','await tx.ujian_madrasah.upsert').replace('    return { ok: true, count: updates.length };','    });\n    return { ok: true, count: updates.length };');s=s.slice(0,a)+part+s.slice(b);
s=s.replace("const publishAt = publish_at === null ? null : new Date(publish_at);", "const publishAt = publish_at === null ? null : new Date(publish_at);\n      if (publishAt && !Number.isFinite(+publishAt)) throw new BadRequestException('Tanggal publish tidak valid');");
const k=s.indexOf('  async postKelulusan'),l=s.indexOf('  async patchKelulusan',k);let kel=s.slice(k,l);kel=kel.replace('    const ta = tahun_ajaran.trim();',`    for (const row of updates) {
      if (!row.nisn || !['LULUS','TIDAK_LULUS','MENUNGGU'].includes(row.status || 'MENUNGGU')) throw new BadRequestException('NISN/status tidak valid');
      for (const key of ['rata_um','rata_ijazah']) if (row[key] != null && row[key] !== '' && (!Number.isFinite(Number(row[key])) || Number(row[key]) < 0 || Number(row[key]) > 100)) throw new BadRequestException('Nilai harus antara 0–100');
    }
    const ta = tahun_ajaran.trim();`);s=s.slice(0,k)+kel+s.slice(l);fs.writeFileSync(p,s);
const c='apps/api/src/um-kelulusan/um-kelulusan.controller.ts';s=fs.readFileSync(c,'utf8').replace(/\r\n/g,'\n');s=s.replace("    if (!this.isAdminKurikulum(req)) throw new (require('@nestjs/common').ForbiddenException)('Akses ditolak');\n    return this.umKelulusanService.postUjianMadrasah(body);",'    return this.umKelulusanService.postUjianMadrasah(body, req.user);');fs.writeFileSync(c,s);
