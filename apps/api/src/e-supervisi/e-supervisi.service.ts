import { rolesUser } from '../auth/feature-access.guard';
import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JadwalService } from '../jadwal/jadwal.service';
import { StorageService } from '../common/storage.service';

@Injectable()
export class ESupervisiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jadwalService: JadwalService,
    private readonly storageService: StorageService,
  ) {}

  private getTodayTz(): string {
    const today = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
    const d = new Date(today);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  async getDokumen(tahap?: string, tahun_ajaran_id?: number) {
    const where: any = { aktif: true };
    if (tahap) where.tahap = tahap;
    if (tahun_ajaran_id) where.tahun_ajaran_id = tahun_ajaran_id;

    const data = await this.prisma.sv_master_dokumen.findMany({
      where,
      include: {
        sv_indikator: {
          where: { aktif: true },
          orderBy: { urutan: 'asc' },
        },
      },
      orderBy: { urutan: 'asc' },
    });

    // Transform flat indikators to nested
    const transformedData = data.map((doc: any) => {
      const indikators = doc.sv_indikator || [];
      const parents = indikators.filter((ind: any) => {
        const config = typeof ind.skala_config === 'string' ? JSON.parse(ind.skala_config) : ind.skala_config;
        return !config?.parent_id;
      }).sort((a: any, b: any) => (a.urutan || 0) - (b.urutan || 0));

      const subs = indikators.filter((ind: any) => {
        const config = typeof ind.skala_config === 'string' ? JSON.parse(ind.skala_config) : ind.skala_config;
        return config?.parent_id;
      }).sort((a: any, b: any) => (a.urutan || 0) - (b.urutan || 0));

      parents.forEach((p: any) => {
        p.sub_indikators = subs.filter((s: any) => {
          const config = typeof s.skala_config === 'string' ? JSON.parse(s.skala_config) : s.skala_config;
          return config.parent_id === p.id;
        });
      });

      // rename sv_indikator to indikators for frontend compatibility
      const { sv_indikator, ...rest } = doc;
      return { ...rest, indikators: parents };
    });

    return { ok: true, data: transformedData };
  }

  async upsertDokumen(body: any) {
    const { id, tahap, nama_dokumen, deskripsi, urutan, indikators, butuh_dokumen, tahun_ajaran_id } = body;
    if (!tahun_ajaran_id) throw new BadRequestException('tahun_ajaran_id required');

    const docData = {
      tahap,
      nama_dokumen,
      deskripsi,
      urutan,
      aktif: true,
      butuh_dokumen: butuh_dokumen !== undefined ? butuh_dokumen : true,
      tahun_ajaran_id,
    };

    let docId = id;

    if (id) {
      await this.prisma.sv_master_dokumen.update({ where: { id: parseInt(id) }, data: docData });
    } else {
      const inserted = await this.prisma.sv_master_dokumen.create({ data: docData });
      docId = inserted.id;
    }

    if (indikators && Array.isArray(indikators)) {
      for (const ind of indikators) {
        const indData = {
          dokumen_id: docId,
          nama_indikator: ind.nama_indikator,
          deskripsi: ind.deskripsi,
          skala_config: ind.skala_config || { tipe: 'angka', min: 1, max: 4 },
          urutan: ind.urutan || 0,
          aktif: true,
        };

        let parentId = ind.id;
        if (ind.id) {
          await this.prisma.sv_indikator.update({ where: { id: parseInt(ind.id) }, data: indData });
        } else {
          const inserted = await this.prisma.sv_indikator.create({ data: indData });
          parentId = inserted.id;
        }

        if (ind.sub_indikators && Array.isArray(ind.sub_indikators) && parentId) {
          for (const sub of ind.sub_indikators) {
            const subData = {
              dokumen_id: docId,
              nama_indikator: sub.nama_indikator,
              deskripsi: sub.deskripsi,
              skala_config: { ...(sub.skala_config || {}), parent_id: parentId },
              urutan: sub.urutan || 0,
              aktif: true,
            };
            if (sub.id) {
              await this.prisma.sv_indikator.update({ where: { id: parseInt(sub.id) }, data: subData });
            } else {
              await this.prisma.sv_indikator.create({ data: subData });
            }
          }
        }
      }
    }

    return { ok: true, message: 'Dokumen tersimpan' };
  }

  async deleteDokumen(id: number) {
    await this.prisma.sv_master_dokumen.update({ where: { id }, data: { aktif: false } });
    return { ok: true };
  }

  async getNilai(penugasan_id?: number) {
    const where: any = {};
    if (penugasan_id) where.penugasan_id = penugasan_id;

    const data = await this.prisma.sv_rekam_nilai.findMany({
      where,
      include: {
        sv_indikator: {
          select: { nama_indikator: true },
        },
      },
    });

    const mapped = data.map(d => {
      const { sv_indikator, ...rest } = d;
      return { ...rest, indikator: sv_indikator };
    });

    return { ok: true, data: mapped };
  }

  async upsertNilai(apiUser: any, body: any) {
    const { penugasan_id, scores } = body;
    const scored_by = apiUser?.nip || String(apiUser?.id || '');
    if (!penugasan_id || !scores || !Array.isArray(scores)) {
      throw new BadRequestException('Invalid payload');
    }

    const penugasan = await this.prisma.sv_penugasan.findUnique({
      where: { id: parseInt(penugasan_id) },
    });
    
    if (!penugasan) throw new (require('@nestjs/common').NotFoundException)('Penugasan tidak ditemukan');

    const role = (apiUser?.role || '').toUpperCase();
    const isAdmin = rolesUser(apiUser).some(r => ['ADMIN','ADMINISTRATOR'].includes(r));
    if (!isAdmin && (!apiUser?.nip || penugasan.supervisor_nip !== apiUser.nip || penugasan.guru_nip === apiUser.nip)) {
      throw new (require('@nestjs/common').ForbiddenException)('Anda tidak berhak mengubah nilai untuk penugasan ini');
    }

    const indikatorIds = [...new Set(scores.map((s: any) => s.indikator_id).filter((id: any) => id != null))];
    const indikatorRows = await this.prisma.sv_indikator.findMany({
      where: { id: { in: indikatorIds.length ? indikatorIds : [-1] } },
      select: { id: true, skala_config: true },
    });

    const configMap: Record<number, any> = {};
    indikatorRows.forEach((r: any) => {
      configMap[r.id] = typeof r.skala_config === 'string' ? JSON.parse(r.skala_config) : r.skala_config;
    });

    const rowsToUpsert: any[] = [];
    for (const score of scores) {
      const { indikator_id, nilai_mentah, catatan } = score;
      const config = configMap[indikator_id];
      if (config === undefined) continue;

      let nilai_konversi = 0;
      if (config?.tipe === 'angka') {
        const val = parseFloat(nilai_mentah);
        const min = config.min ?? 1;
        const max = config.max ?? 4;
        const range = max - min;
        nilai_konversi = range > 0 ? ((val - min) / range) * 100 : 0;
      } else if (config?.tipe === 'huruf') {
        nilai_konversi = config.opsi ? (config.opsi[nilai_mentah] ?? 0) : 0;
      } else if (config?.tipe === 'yatidak') {
        nilai_konversi = config.opsi ? (config.opsi[nilai_mentah] ?? parseFloat(nilai_mentah)) : parseFloat(nilai_mentah);
      } else {
        nilai_konversi = parseFloat(nilai_mentah);
      }

      nilai_konversi = Math.max(0, Math.min(100, nilai_konversi || 0));

      rowsToUpsert.push({
        penugasan_id: parseInt(penugasan_id),
        indikator_id: parseInt(indikator_id),
        nilai_mentah: String(nilai_mentah),
        nilai_konversi,
        catatan,
        scored_by,
        scored_at: new Date(),
      });
    }

    if (rowsToUpsert.length > 0) {
      for (const r of rowsToUpsert) {
        await this.prisma.sv_rekam_nilai.upsert({
          where: {
            penugasan_id_indikator_id: {
              penugasan_id: r.penugasan_id,
              indikator_id: r.indikator_id,
            },
          },
          update: r,
          create: r,
        });
      }
    }

    return { ok: true, message: 'Nilai tersimpan' };
  }

  async getPenugasan(tahun_ajaran_id?: number, supervisor_nip?: string, guru_nip?: string) {
    const where: any = {};
    if (tahun_ajaran_id) where.tahun_ajaran_id = tahun_ajaran_id;
    if (supervisor_nip) where.supervisor_nip = supervisor_nip;
    if (guru_nip) where.guru_nip = guru_nip;

    const penugasan = await this.prisma.sv_penugasan.findMany({ where });

    const nips = [...new Set([...penugasan.map(p => p.guru_nip), ...penugasan.map(p => p.supervisor_nip)])];
    const nipFilter = nips.length ? nips : [''];
    const penugasanIds = penugasan.map(p => p.id);

    const [gurus, docs, allScores] = await Promise.all([
      this.prisma.master_guru.findMany({
        where: { nip: { in: nipFilter } },
        select: { nip: true, nama_lengkap: true },
      }),
      tahun_ajaran_id
        ? this.prisma.sv_master_dokumen.findMany({
            where: { tahun_ajaran_id },
            select: { id: true, butuh_dokumen: true, sv_indikator: { select: { id: true, skala_config: true } } },
          })
        : Promise.resolve([] as Array<{ id: number; butuh_dokumen: boolean; sv_indikator: Array<{ id: number; skala_config: any }> }>),
      this.prisma.sv_rekam_nilai.findMany({
        where: { penugasan_id: { in: penugasanIds.length ? penugasanIds : [-1] } },
        select: { penugasan_id: true },
      }),
    ]);

    const { data: jadwalRows } = await this.jadwalService.getJadwal({ valid_date: this.getTodayTz() });

    const guruMap: Record<string, string> = {};
    gurus.forEach(g => { if (g.nip) guruMap[g.nip] = g.nama_lengkap || g.nip; });

    const jadwalMap: Record<string, { mapel: Set<string>; kelas: Set<string> }> = {};
    (jadwalRows || []).forEach((j: any) => {
      if (nipFilter.includes(String(j.nip || ''))) {
        if (!jadwalMap[j.nip]) jadwalMap[j.nip] = { mapel: new Set(), kelas: new Set() };
        if (j.mata_pelajaran) jadwalMap[j.nip].mapel.add(j.mata_pelajaran.trim());
        if (j.kelas) jadwalMap[j.nip].kelas.add(j.kelas.trim());
      }
    });

    let totalItems = 0;
    docs.forEach(d => {
      const indikators = d.sv_indikator || [];
      const parentIds = new Set(indikators.filter((i: any) => {
        const c = typeof i.skala_config === 'string' ? JSON.parse(i.skala_config) : i.skala_config;
        return c?.parent_id;
      }).map((i: any) => {
        const c = typeof i.skala_config === 'string' ? JSON.parse(i.skala_config) : i.skala_config;
        return c.parent_id;
      }));

      const scorable = indikators.filter((i: any) => {
        const c = typeof i.skala_config === 'string' ? JSON.parse(i.skala_config) : i.skala_config;
        const isGroup = c?.tipe === 'group';
        return !isGroup && !parentIds.has(i.id);
      });
      totalItems += scorable.length;
    });

    const enrichedData = penugasan.map(p => {
      const j = jadwalMap[p.guru_nip];
      const pScores = allScores.filter(s => s.penugasan_id === p.id).length;
      let progres = totalItems > 0 ? Math.round((pScores / totalItems) * 100) : 0;
      if (progres > 100) progres = 100;

      return {
        ...p,
        guru_nama: guruMap[p.guru_nip] || p.guru_nip,
        supervisor_nama: guruMap[p.supervisor_nip] || p.supervisor_nip,
        guru_mapel: j && j.mapel.size > 0 ? Array.from(j.mapel).join(', ') : '-',
        guru_kelas: j && j.kelas.size > 0 ? Array.from(j.kelas).sort().join(', ') : '-',
        progres,
      };
    });

    return { ok: true, data: enrichedData };
  }

  async upsertPenugasan(body: any) {
    const { guru_nip, supervisor_nip, tahun_ajaran_id } = body;

    const existing = await this.prisma.sv_penugasan.findFirst({
      where: { guru_nip, tahun_ajaran_id },
    });

    if (existing) {
      const data = await this.prisma.sv_penugasan.update({
        where: { id: existing.id },
        data: { supervisor_nip },
      });
      return { ok: true, data };
    } else {
      const data = await this.prisma.sv_penugasan.create({
        data: { guru_nip, supervisor_nip, tahun_ajaran_id, status: 'aktif' },
      });
      return { ok: true, data };
    }
  }

  async deletePenugasan(id: number) {
    await this.prisma.sv_penugasan.delete({ where: { id } });
    return { ok: true };
  }

  async updateStatusPenugasan(apiUser: any, body: any) {
    const { id, status } = body;
    if (!id || !status) throw new (require('@nestjs/common').BadRequestException)('ID and status required');
    
    const penugasan = await this.prisma.sv_penugasan.findUnique({
      where: { id: parseInt(id) },
    });
    if (!penugasan) throw new (require('@nestjs/common').NotFoundException)('Penugasan tidak ditemukan');

    const role = (apiUser?.role || '').toUpperCase();
    const isAdmin = rolesUser(apiUser).some(r => ['ADMIN','ADMINISTRATOR'].includes(r));
    if (!isAdmin && (!apiUser?.nip || penugasan.supervisor_nip !== apiUser.nip || penugasan.guru_nip === apiUser.nip)) {
      throw new (require('@nestjs/common').ForbiddenException)('Anda tidak berhak mengubah status penugasan ini');
    }

    await this.prisma.sv_penugasan.update({
      where: { id: parseInt(id) },
      data: { status },
    });
    return { ok: true, message: 'Status updated' };
  }

  async getRekap(tahun_ajaran_id: number) {
    if (!tahun_ajaran_id) throw new BadRequestException('tahun_ajaran_id required');

    const penugasans = await this.prisma.sv_penugasan.findMany({
      where: { tahun_ajaran_id },
    });

    const penugasanIds = penugasans.map(p => p.id);
    const nips = [...new Set([...penugasans.map(p => p.guru_nip), ...penugasans.map(p => p.supervisor_nip)])];
    const nipFilter = nips.length ? nips : [''];

    const [dokumens, nilais, profil_sekolah, gurus] = await Promise.all([
      this.prisma.sv_master_dokumen.findMany({
        where: { tahun_ajaran_id },
        select: { id: true, tahap: true, sv_indikator: { select: { id: true } } },
      }),
      this.prisma.sv_rekam_nilai.findMany({
        where: { penugasan_id: { in: penugasanIds.length ? penugasanIds : [-1] } },
        select: { penugasan_id: true, indikator_id: true, nilai_konversi: true },
      }),
      this.prisma.profil_sekolah.findFirst(),
      this.prisma.master_guru.findMany({
        where: { nip: { in: nipFilter } },
        select: { nip: true, nama_lengkap: true },
      }),
    ]);

    const { data: jadwalRows } = await this.jadwalService.getJadwal({ valid_date: this.getTodayTz() });

    const indikatorToTahap: Record<number, string> = {};
    dokumens.forEach(d => {
      d.sv_indikator.forEach((ind: any) => {
        indikatorToTahap[ind.id] = d.tahap;
      });
    });

    const allTahap = Array.from(new Set(Object.values(indikatorToTahap)));

    const guruMap: Record<string, string> = {};
    gurus.forEach(g => { if (g.nip) guruMap[g.nip] = g.nama_lengkap || g.nip; });

    const jadwalMap: Record<string, { mapel: Set<string>; kelas: Set<string> }> = {};
    (jadwalRows || []).forEach((j: any) => {
      if (nipFilter.includes(String(j.nip || ''))) {
        if (!jadwalMap[j.nip]) jadwalMap[j.nip] = { mapel: new Set(), kelas: new Set() };
        if (j.mata_pelajaran) jadwalMap[j.nip].mapel.add(j.mata_pelajaran.trim());
        if (j.kelas) jadwalMap[j.nip].kelas.add(j.kelas.trim());
      }
    });

    const recap = penugasans.map(p => {
      const pNilais = nilais.filter(n => n.penugasan_id === p.id);
      const scoresByTahap: Record<string, number[]> = {};
      allTahap.forEach(t => (scoresByTahap[t] = []));

      pNilais.forEach(n => {
        const tahap = indikatorToTahap[n.indikator_id];
        if (tahap && scoresByTahap[tahap]) {
          scoresByTahap[tahap].push(Number(n.nilai_konversi) || 0);
        }
      });

      const getAvg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

      const dynamicScores: Record<string, string> = {};
      let totalAvg = 0;
      let count = 0;

      allTahap.forEach(tahap => {
        const avg = getAvg(scoresByTahap[tahap]);
        dynamicScores[tahap] = avg.toFixed(2);
        if (scoresByTahap[tahap].length > 0) {
          totalAvg += avg;
          count++;
        }
      });

      const rata_rata = count > 0 ? totalAvg / count : 0;

      let predikat = '-';
      if (rata_rata >= 91) predikat = 'Sangat Baik';
      else if (rata_rata >= 76) predikat = 'Baik';
      else if (rata_rata >= 61) predikat = 'Cukup';
      else if (rata_rata > 0) predikat = 'Kurang';

      const mapel = jadwalMap[p.guru_nip]?.mapel ? Array.from(jadwalMap[p.guru_nip].mapel).join(', ') : '';
      const kelas = jadwalMap[p.guru_nip]?.kelas ? Array.from(jadwalMap[p.guru_nip].kelas).join(', ') : '';

      return {
        ...p,
        guru_nama: guruMap[p.guru_nip] || '-',
        supervisor_nama: guruMap[p.supervisor_nip] || '-',
        guru_mapel: mapel,
        guru_kelas: kelas,
        nilai: {
          ...dynamicScores,
          rata_rata: rata_rata.toFixed(2),
          predikat,
        },
      };
    });

    return { ok: true, data: recap, stages: allTahap, profil_sekolah };
  }

  async getSupervisorList() {
    const data = await this.prisma.public_users.findMany({
      where: { aktif: true },
      select: { id: true, nip: true, nama: true, nama_lengkap: true, role: true },
    });

    const supervisors = data
      .filter((u: any) => {
        const roles = (u.role || '').toUpperCase().split(/[,|]/).map((r: string) => r.trim());
        return roles.includes('SUPERVISOR') || roles.includes('PENGAWAS MADRASAH') || roles.includes('PENGAWAS_MADRASAH') || roles.includes('GURU');
      })
      .map((u: any) => ({
        id: Number(u.id),
        nip: u.nip,
        nama_lengkap: u.nama_lengkap || u.nama || 'Tanpa Nama',
      }));

    return { ok: true, data: supervisors };
  }

  async getUnggahan(guru_nip: string, tahun_ajaran_id: number) {
    if (!guru_nip || !tahun_ajaran_id) throw new BadRequestException('guru_nip and tahun_ajaran_id required');
    const data = await this.prisma.sv_unggahan_guru.findMany({
      where: { guru_nip, tahun_ajaran_id },
    });
    return { ok: true, data };
  }

  async deleteUnggahan(id: number, user: any) {
    if (!id) throw new BadRequestException('ID required');

    const unggahan = await this.prisma.sv_unggahan_guru.findUnique({
      where: { id },
    });

    if (!unggahan) return { ok: true };
    if (!user?.nip || unggahan.guru_nip !== user.nip) throw new (require('@nestjs/common').ForbiddenException)('Hanya pemilik unggahan yang dapat menghapus');

    if (unggahan.file_url) {
      // Diarahkan berdasarkan bentuk URL berkasnya, bukan driver yang sedang
      // aktif. Pemotongan `split('/documents/')` sebelumnya hanya cocok dengan
      // URL Supabase, jadi begitu STORAGE_DRIVER pindah ke R2, berkas e-supervisi
      // tidak pernah ikut terhapus dan menumpuk sebagai berkas yatim.
      const { error } = await this.storageService.removeByUrl(unggahan.file_url);
      if (error) {
        console.error(`Gagal menghapus berkas e-supervisi ${unggahan.file_url}:`, error.message);
      }
      
      try {
        await this.prisma.file_uploads.deleteMany({ where: { file_url: unggahan.file_url } });
      } catch (e) {
        console.error('Failed to unregister upload:', e);
      }
    }

    await this.prisma.sv_unggahan_guru.delete({ where: { id } });
    return { ok: true };
  }

  async getTahunAjaranList() {
    const [allTa, docs, assignments] = await Promise.all([
      this.prisma.master_tahun_ajaran.findMany({
        where: { is_active: true },
        orderBy: { tahun_ajaran: 'desc' },
      }),
      this.prisma.sv_master_dokumen.findMany({
        select: { tahun_ajaran_id: true },
      }),
      this.prisma.sv_penugasan.findMany({
        select: { tahun_ajaran_id: true },
      }),
    ]);
    return { ok: true, data: { allTa, docs, assignments } };
  }

  async upsertUnggahanRecord(body: { guru_nip: string; tahun_ajaran_id: number; dokumen_id: number; file_url: string; file_name: string; size_bytes?: number }, user: any) {
    if (!user?.nip || body.guru_nip !== user.nip) throw new (require('@nestjs/common').ForbiddenException)('NIP unggahan tidak sesuai sesi');
    const record = await this.prisma.sv_unggahan_guru.upsert({
      where: {
        guru_nip_tahun_ajaran_id_dokumen_id: {
          guru_nip: body.guru_nip,
          tahun_ajaran_id: Number(body.tahun_ajaran_id),
          dokumen_id: Number(body.dokumen_id),
        }
      },
      create: {
        guru_nip: body.guru_nip,
        tahun_ajaran_id: Number(body.tahun_ajaran_id),
        dokumen_id: Number(body.dokumen_id),
        file_url: body.file_url,
        file_name: body.file_name,
      },
      update: {
        file_url: body.file_url,
        file_name: body.file_name,
      }
    });

    if (body.file_url) {
      await this.prisma.file_uploads.upsert({
        where: { file_url: body.file_url },
        create: {
          file_url: body.file_url,
          file_name: body.file_name,
          folder: 'e-supervisi',
          size_bytes: BigInt(body.size_bytes || 0),
          storage_type: 'supabase',
        },
        update: {
          file_name: body.file_name,
          folder: 'e-supervisi',
          size_bytes: BigInt(body.size_bytes || 0),
          storage_type: 'supabase',
        }
      });
    }

    return { ok: true, data: record };
  }
}
