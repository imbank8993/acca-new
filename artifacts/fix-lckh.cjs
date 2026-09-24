const fs=require('fs'); const p='apps/api/src/lckh/lckh.service.ts'; let s=fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
s=s.replace('BadRequestException }','BadRequestException, ForbiddenException, ConflictException }');
s=s.replace("import { PrismaService }", "import { randomUUID } from 'crypto';\nimport { PrismaService }");
s=s.replace('  async getPeriods()',`  private isAdmin(user: any) { return user?.roles?.some((r: string) => ['ADMIN','ADMINISTRATOR'].includes(r)); }
  private isHead(user: any) { return user?.roles?.some((r: string) => ['KAMAD','KEPALA','KEPALA_MADRASAH'].includes(r)); }
  private isReviewer(user: any) { return this.isAdmin(user) || this.isHead(user) || user?.roles?.some((r: string) => ['WKM_AKADEMIK','WKM_KESISWAAN','WAKA_AKADEMIK','WAKA_KESISWAAN','WAKAMAD_KURIKULUM'].includes(r)); }
  private scopeNip(user: any, nip?: string) {
    if (!user?.id) throw new ForbiddenException('Sesi tidak dikenali');
    if (this.isReviewer(user)) return nip;
    if (!user.nip || (nip && nip !== user.nip)) throw new ForbiddenException('Laporan di luar kepemilikan Anda');
    return user.nip;
  }
  private async readable(id: string, user: any) {
    const row = await this.prisma.lckh_submissions.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Laporan tidak ditemukan');
    this.scopeNip(user, row.nip || '');
    return row;
  }
  async getPeriods()`);
s=s.replace('const nip = query.nip || apiUser?.nip;', 'const nip = this.scopeNip(apiUser, query.nip) || apiUser.nip;');
const a=s.indexOf('    // Visibility:'); const b=s.indexOf('    const items =',a); s=s.slice(0,a)+`    const scopedNip = this.scopeNip(apiUser, nip);
    if (scopedNip) where.nip = scopedNip;

`+s.slice(b);
const start=s.indexOf('  async getSubmissionById'); const end=s.indexOf('  async getNilaiDetail',start);
s=s.slice(0,start)+`  async getSubmissionById(id: string, user: any) {
    return serializeBigInt(await this.readable(id, user));
  }

  async saveSubmission(user: any, payload: any) {
    if (!user?.id || !user.nip || user.roles?.includes('SISWA')) throw new ForbiddenException('Akun guru diperlukan');
    const editable = ['Draft','Returned','Ditolak'];
    const existing = payload.id ? await this.readable(payload.id, user) : null;
    if (existing && (existing.nip !== user.nip || !editable.includes(existing.status || 'Draft'))) throw new ForbiddenException('Hanya draft milik sendiri yang dapat diubah');
    if (payload.nip && payload.nip !== user.nip) throw new ForbiddenException('NIP tidak sesuai sesi');
    const status = payload.status || existing?.status || 'Draft';
    if (![...editable,'Submitted'].includes(status)) throw new BadRequestException('Status tidak sah untuk penulis');
    const allowed = ['periode_kode','bulan','tahun','snap_total_hari_masuk','snap_total_jam_mengajar','snap_rekap_kehadiran','snap_ringkasan_umum','snap_ada_jurnal','snap_ada_absensi','snap_ada_nilai','snap_ada_tugas','lampiran_jurnal','lampiran_absensi','lampiran_nilai','lampiran_tugas','catatan_guru','detail_jurnal'];
    const data: any = Object.fromEntries(allowed.filter(k => payload[k] !== undefined).map(k => [k,payload[k]]));
    Object.assign(data, { nip: user.nip, nama_guru_snap: user.nama_lengkap || user.nama, status, updated_at: new Date(), ...(status === 'Submitted' ? { submitted_at: new Date() } : {}) });
    if (existing) {
      const changed = await this.prisma.lckh_submissions.updateMany({ where: { id: existing.id, nip: user.nip, status: existing.status }, data });
      if (!changed.count) throw new ConflictException('Laporan telah berubah; muat ulang');
      return this.getSubmissionById(existing.id, user);
    }
    return serializeBigInt(await this.prisma.lckh_submissions.create({ data }));
  }

  async deleteSubmission(id: string, user: any) {
    const row = await this.readable(id, user);
    if (row.nip !== user.nip || !['Draft','Returned','Ditolak'].includes(row.status || 'Draft')) throw new ForbiddenException('Hanya draft milik sendiri yang dapat dihapus');
    const result = await this.prisma.lckh_submissions.deleteMany({ where: { id, nip: user.nip, status: row.status } });
    if (!result.count) throw new ConflictException('Laporan telah berubah; muat ulang');
    return { success: true };
  }

  async getApprovals(lckh_submission_id: string, user: any) {
    await this.readable(lckh_submission_id, user);
    return serializeBigInt(await this.prisma.lckh_approvals.findMany({ where: { lckh_submission_id }, orderBy: { created_at: 'asc' } }));
  }

  async approveSubmission(user: any, submissionId: string, payload: any) {
    if (!this.isReviewer(user)) throw new ForbiddenException('Tidak memiliki hak persetujuan');
    if (!['Disetujui','Ditolak'].includes(payload.status_approval)) throw new BadRequestException('Keputusan tidak valid');
    return this.prisma.$transaction(async tx => {
      const row = await tx.lckh_submissions.findUnique({ where: { id: submissionId } });
      if (!row) throw new NotFoundException('Laporan tidak ditemukan');
      if (!['Submitted','Approved_Waka'].includes(row.status || '')) throw new ConflictException('Laporan belum diajukan atau sudah disahkan');
      if (row.nip === user.nip && !this.isAdmin(user)) throw new ForbiddenException('Tidak dapat menyetujui laporan sendiri');
      const period = row.periode_kode ? await tx.lckh_periods.findFirst({ where: { periode_kode: row.periode_kode } }) : null;
      const duties = await tx.tugas_tambahan.findMany({ where: { nip: row.nip || '', ...(period?.tahun_ajaran ? { tahun_ajaran: period.tahun_ajaran } : {}) }, select: { approver_role: true } });
      const targets = duties.map(d => d.approver_role || 'SEMUA_WKM');
      const direct = targets.length > 0 && targets.every(r => r === 'KEPALA_MADRASAH');
      const final = row.status === 'Approved_Waka' || direct;
      if (final && !this.isHead(user) && !this.isAdmin(user)) throw new ForbiddenException('Pengesahan akhir oleh Kepala Madrasah');
      if (!this.isAdmin(user) && !this.isHead(user) && targets.length && !targets.includes('SEMUA_WKM') && !targets.some(r => user.roles.includes(r))) throw new ForbiddenException('Bukan penyetuju tugas guru ini');
      const rejected = payload.status_approval === 'Ditolak';
      if (rejected && !String(payload.catatan || '').trim()) throw new BadRequestException('Alasan pengembalian wajib diisi');
      const level = final ? 'KAMAD' : (user.roles.includes('WKM_KESISWAAN') ? 'WKM_KESISWAAN' : 'WKM_AKADEMIK');
      const status = rejected ? 'Returned' : final ? 'Approved_Kamad' : 'Approved_Waka';
      const result = await tx.lckh_submissions.updateMany({ where: { id: submissionId, status: row.status }, data: {
        status, catatan_reviewer: payload.catatan || null, updated_at: new Date(),
        ...(!rejected && final ? { approval_code: randomUUID(), approved_by_kamad: String(user.id), full_approved_at: new Date() } : {}),
        ...(!rejected && !final ? { approved_by_waka: String(user.id) } : {}),
      } });
      if (!result.count) throw new ConflictException('Laporan telah berubah; muat ulang');
      return serializeBigInt(await tx.lckh_approvals.create({ data: { lckh_submission_id: submissionId, level, status_approval: payload.status_approval, approver_id: String(user.id), approver_name: user.nama_lengkap || user.nama || '', approved_at: new Date(), catatan: payload.catatan || null } }));
    });
  }

`+s.slice(end);
s=s.replace('async getPrintData(submissionId: string)', 'async getPrintData(submissionId: string, user: any)').replace("    if (!submissionId) throw", "    await this.readable(submissionId, user);\n    if (!submissionId) throw");
fs.writeFileSync(p,s);
const c='apps/api/src/lckh/lckh.controller.ts';let t=fs.readFileSync(c,'utf8');
for(const method of ['getPrintData','getLembarPengesahanData','getSubmissionById','getApprovals'])t=t.replace(`async ${method}(`,`async ${method}(@Req() req: any, `);
t=t.replaceAll('this.lckhService.getPrintData(id)', 'this.lckhService.getPrintData(id, this.getApiUser(req.user))').replace('this.lckhService.getSubmissionById(id)','this.lckhService.getSubmissionById(id, this.getApiUser(req.user))').replace('this.lckhService.getApprovals(submissionId)','this.lckhService.getApprovals(submissionId, this.getApiUser(req.user))');fs.writeFileSync(c,t);
