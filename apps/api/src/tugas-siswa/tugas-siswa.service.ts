import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TugasSiswaFilter {
  page?: number;
  limit?: number;
  kelas?: string;
  guru?: string;
  mapel?: string;
  search?: string;
  tanggalAwal?: string;
  tanggalAkhir?: string;
  siswaRole?: string;
  siswaKelas?: string;
  jenis?: string;
  tahunAjaran?: string;
  userId?: string;
}

@Injectable()
export class TugasSiswaService {
  private readonly logger = new Logger(TugasSiswaService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async assertWriter(user: any, data?: any) {
    if (!user?.id || !user.nip) throw new ForbiddenException('Identitas diperlukan');
    if (user.roles?.some((r: string) => ['ADMIN','ADMINISTRATOR','GURU'].includes(r))) return;
    const enrollment = await this.prisma.siswa_kelas.findMany({ where: { nisn: user.nip, aktif: true, is_pengurus: true }, select: { kelas: true } });
    const classes = Array.isArray(data?.kelas_list) ? data.kelas_list : data?.kelas ? [data.kelas] : [];
    if (!enrollment.length || classes.some((kelas: string) => !enrollment.some(e => e.kelas === kelas))) throw new ForbiddenException('Hanya guru atau pengurus kelas terkait yang dapat mengelola tugas');
  }

  private assertOwner(row: any, user: any) {
    const admin = user?.roles?.some((r: string) => ['ADMIN','ADMINISTRATOR'].includes(r));
    const owner = (user?.id && String(row.created_by || '') === String(user.id)) || (user?.nip && [row.created_by_nip,row.nisn_pembuat,row.guru_id].includes(user.nip));
    if (!admin && !owner) throw new ForbiddenException('Hanya pemilik yang dapat mengubah tugas');
  }
  private async scope(user: any) {
    if (!user?.id) throw new ForbiddenException('Sesi diperlukan');
    if (!user.roles?.some((r: string) => ['SISWA','PENGURUS_KELAS'].includes(r))) return {};
    const kelas = await this.prisma.siswa_kelas.findMany({ where: { nisn: user.nip || '', aktif: true }, select: { kelas: true } });
    const names = kelas.map(k => k.kelas).filter(Boolean) as string[];
    return { OR: [{ kelas: { in: names } }, ...names.map(name => ({ kelas_list: { array_contains: [name] } }))] };
  }
  async findAll(filter: TugasSiswaFilter, apiUser?: any) {
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filter.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filter.jenis) {
      where.jenis = filter.jenis;
    }

    if (filter.tahunAjaran) {
      const taList = filter.tahunAjaran.split(',').map((t) => t.trim()).filter(Boolean);
      if (taList.length === 1) {
        where.tahun_ajaran = taList[0];
      } else if (taList.length > 1) {
        where.tahun_ajaran = { in: taList };
      }
    }

    if (filter.guru) {
      where.OR = [
        { nama_guru: { contains: filter.guru, mode: 'insensitive' } },
        { guru_id: filter.guru },
        { created_by_nip: filter.guru },
      ];
    }

    if (filter.mapel) {
      where.nama_mapel = { contains: filter.mapel, mode: 'insensitive' };
    }

    if (filter.tanggalAwal) {
      where.tanggal_mulai = { gte: new Date(filter.tanggalAwal) };
    }

    if (filter.tanggalAkhir) {
      where.tanggal_selesai = { lte: new Date(filter.tanggalAkhir) };
    }

    if (filter.search) {
      const searchOr = [
        { judul_tugas: { contains: filter.search, mode: 'insensitive' } },
        { deskripsi: { contains: filter.search, mode: 'insensitive' } },
        { nama_mapel: { contains: filter.search, mode: 'insensitive' } },
        { nama_guru: { contains: filter.search, mode: 'insensitive' } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchOr }];
        delete where.OR;
      } else {
        where.OR = searchOr;
      }
    }

    // Specific class filter
    if (filter.kelas) {
      where.kelas = filter.kelas;
    }

    const scope = await this.scope(apiUser);
    where.AND = [...(where.AND || []), scope];
    filter = { ...filter, userId: String(apiUser.id) };

    const [total, rawRows] = await Promise.all([
      this.prisma.tugas_siswa.count({ where }),
      this.prisma.tugas_siswa.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: filter.userId
          ? {
              tugas_siswa_checklist: {
                where: {
                  siswa_id: BigInt(filter.userId),
                },
                select: {
                  is_done: true,
                },
              },
            }
          : undefined,
      }),
    ]);

    // Serialize BigInt to number/string for JSON response
    const rows = rawRows.map((r: any) => {
      const checklist = r.tugas_siswa_checklist;
      const isDone = checklist && checklist.length > 0 ? checklist[0].is_done : false;

      return {
        ...r,
        id: Number(r.id),
        file_size: r.file_size ? Number(r.file_size) : null,
        checklist: checklist || [],
        is_done: isDone,
        tanggal_mulai: r.tanggal_mulai ? r.tanggal_mulai.toISOString().split('T')[0] : null,
        tanggal_selesai: r.tanggal_selesai ? r.tanggal_selesai.toISOString().split('T')[0] : null,
      };
    });

    return {
      ok: true,
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: number, apiUser: any) {
    const record = await this.prisma.tugas_siswa.findFirst({
      where: { id: BigInt(id), ...(await this.scope(apiUser)) },
      include: {
        tugas_siswa_checklist: { where: { siswa_id: BigInt(apiUser.id) } },
      },
    });

    if (!record) {
      throw new NotFoundException(`Tugas dengan ID ${id} tidak ditemukan`);
    }

    return {
      ...record,
      id: Number(record.id),
      file_size: record.file_size ? Number(record.file_size) : null,
      tanggal_mulai: record.tanggal_mulai ? record.tanggal_mulai.toISOString().split('T')[0] : null,
      tanggal_selesai: record.tanggal_selesai ? record.tanggal_selesai.toISOString().split('T')[0] : null,
      tugas_siswa_checklist: (record.tugas_siswa_checklist || []).map((c) => ({
        ...c,
        tugas_id: Number(c.tugas_id),
        siswa_id: Number(c.siswa_id),
      })),
    };
  }

  async create(data: any, apiUser: any) {
    await this.assertWriter(apiUser, data);
    if (!apiUser?.id || !apiUser.nip) throw new ForbiddenException('Identitas pengguna diperlukan');
    const kelasList = Array.isArray(data.kelas_list)
      ? data.kelas_list
      : typeof data.kelas === 'string'
      ? [data.kelas]
      : [];

    const mainKelas = data.kelas || (kelasList.length > 0 ? kelasList[0] : '');

    const created = await this.prisma.tugas_siswa.create({
      data: {
        guru_id: apiUser.roles?.includes('SISWA') ? null : apiUser.nip,
        nama_guru: data.nama_guru || apiUser?.nama || apiUser?.nama_lengkap || 'Guru',
        mapel_id: data.mapel_id ? parseInt(data.mapel_id) : null,
        nama_mapel: data.nama_mapel || '',
        kelas: mainKelas,
        judul_tugas: data.judul_tugas || '',
        deskripsi: data.deskripsi || null,
        tanggal_mulai: data.tanggal_mulai ? new Date(data.tanggal_mulai) : null,
        tanggal_selesai: data.tanggal_selesai ? new Date(data.tanggal_selesai) : null,
        is_range: !!data.is_range,
        file_url: data.file_url || null,
        file_name: data.file_name || null,
        nisn_pembuat: apiUser.nip,
        nama_pembuat: apiUser?.nama || apiUser?.nama_lengkap || null,
        tahun_ajaran: data.tahun_ajaran || null,
        semester: data.semester ? parseInt(data.semester) : null,
        created_by: String(apiUser.id),
        created_by_nip: apiUser.nip,
        kelas_list: kelasList,
        jenis: data.jenis || 'tugas',
        ruangan: data.ruangan || null,
        durasi: data.durasi || null,
        sifat_ujian: data.sifat_ujian || null,
        file_size: data.file_size ? BigInt(data.file_size) : null,
        storage_type: data.storage_type || 'supabase',
        target_siswa: data.target_siswa || null,
      },
    });

    return {
      ...created,
      id: Number(created.id),
      file_size: created.file_size ? Number(created.file_size) : null,
    };
  }

  async update(id: number, data: any, apiUser: any) {
    await this.assertWriter(apiUser, data);
    const existing = await this.prisma.tugas_siswa.findUnique({
      where: { id: BigInt(id) },
    });
    if (!existing) {
      throw new NotFoundException(`Tugas dengan ID ${id} tidak ditemukan`);
    }

    this.assertOwner(existing, apiUser);

    const updatePayload: any = {
      updated_at: new Date(),
    };


    if (data.nama_guru !== undefined) updatePayload.nama_guru = data.nama_guru;
    if (data.mapel_id !== undefined) updatePayload.mapel_id = data.mapel_id ? parseInt(data.mapel_id) : null;
    if (data.nama_mapel !== undefined) updatePayload.nama_mapel = data.nama_mapel;
    if (data.kelas !== undefined) updatePayload.kelas = data.kelas;
    if (data.judul_tugas !== undefined) updatePayload.judul_tugas = data.judul_tugas;
    if (data.deskripsi !== undefined) updatePayload.deskripsi = data.deskripsi;
    if (data.tanggal_mulai !== undefined) updatePayload.tanggal_mulai = data.tanggal_mulai ? new Date(data.tanggal_mulai) : null;
    if (data.tanggal_selesai !== undefined) updatePayload.tanggal_selesai = data.tanggal_selesai ? new Date(data.tanggal_selesai) : null;
    if (data.is_range !== undefined) updatePayload.is_range = !!data.is_range;
    if (data.file_url !== undefined) updatePayload.file_url = data.file_url;
    if (data.file_name !== undefined) updatePayload.file_name = data.file_name;
    if (data.tahun_ajaran !== undefined) updatePayload.tahun_ajaran = data.tahun_ajaran;
    if (data.semester !== undefined) updatePayload.semester = data.semester ? parseInt(data.semester) : null;
    if (data.kelas_list !== undefined) updatePayload.kelas_list = data.kelas_list;
    if (data.jenis !== undefined) updatePayload.jenis = data.jenis;
    if (data.ruangan !== undefined) updatePayload.ruangan = data.ruangan;
    if (data.durasi !== undefined) updatePayload.durasi = data.durasi;
    if (data.sifat_ujian !== undefined) updatePayload.sifat_ujian = data.sifat_ujian;
    if (data.file_size !== undefined) updatePayload.file_size = data.file_size ? BigInt(data.file_size) : null;
    if (data.storage_type !== undefined) updatePayload.storage_type = data.storage_type;
    if (data.target_siswa !== undefined) updatePayload.target_siswa = data.target_siswa;

    const updated = await this.prisma.tugas_siswa.update({
      where: { id: BigInt(id) },
      data: updatePayload,
    });

    return {
      ...updated,
      id: Number(updated.id),
      file_size: updated.file_size ? Number(updated.file_size) : null,
    };
  }

  async remove(id: number, apiUser: any) {
    await this.assertWriter(apiUser);
    const existing = await this.prisma.tugas_siswa.findUnique({
      where: { id: BigInt(id) },
    });
    if (!existing) {
      throw new NotFoundException(`Tugas dengan ID ${id} tidak ditemukan`);
    }

    this.assertOwner(existing, apiUser);

    await this.prisma.$transaction(async tx => {
      await tx.tugas_siswa_checklist.deleteMany({ where: { tugas_id: BigInt(id) } });
      await tx.tugas_siswa.delete({ where: { id: BigInt(id) } });
    });

    return { ok: true };
  }

  async getStats(filter: TugasSiswaFilter, apiUser: any) {
    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date(todayStr);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const where: any = {};
    if (filter.jenis) where.jenis = filter.jenis;
    if (filter.tahunAjaran) {
      const taList = filter.tahunAjaran.split(',').map((t) => t.trim()).filter(Boolean);
      if (taList.length === 1) where.tahun_ajaran = taList[0];
      else if (taList.length > 1) where.tahun_ajaran = { in: taList };
    }

    if (filter.kelas) where.kelas = filter.kelas;
    where.AND = [await this.scope(apiUser)];
    filter = { ...filter, userId: String(apiUser.id) };

    const tasks = await this.prisma.tugas_siswa.findMany({
      where,
      select: {
        id: true,
        tanggal_mulai: true,
        tanggal_selesai: true,
      },
    });

    const processed = tasks.map((t) => {
      const deadline = t.tanggal_selesai || t.tanggal_mulai || today;
      return { id: Number(t.id), deadline };
    });

    const totalActive = processed.filter((t) => t.deadline >= today).length;
    const upcoming = processed.filter((t) => t.deadline >= today && t.deadline <= tomorrow).length;

    let done = 0;
    if (filter.userId && processed.length > 0) {
      const doneRows = await this.prisma.tugas_siswa_checklist.findMany({
        where: {
          siswa_id: BigInt(filter.userId),
          is_done: true,
        },
        select: {
          tugas_id: true,
        },
      });
      const scopedIds = new Set(processed.map((t) => t.id));
      done = doneRows.filter((r) => r.tugas_id && scopedIds.has(Number(r.tugas_id))).length;
    }

    return {
      ok: true,
      stats: {
        totalActive,
        upcoming,
        done,
      },
    };
  }

  async toggleChecklist(tugasId: number, siswaId: number, isDone: boolean, apiUser: any) {
    const tId = BigInt(tugasId);
    const sId = BigInt(siswaId);

    const roles = apiUser?.roles || [];
    const isSiswa = roles.includes('SISWA');

    await this.findById(tugasId, apiUser);
    if (String(apiUser?.id) !== String(siswaId)) {
      throw new (require('@nestjs/common').ForbiddenException)('Anda tidak dapat mengubah status tugas siswa lain.');
    }

    if (isDone) {
      await this.prisma.tugas_siswa_checklist.upsert({
        where: {
          tugas_id_siswa_id: {
            tugas_id: tId,
            siswa_id: sId,
          },
        },
        update: {
          is_done: true,
        },
        create: {
          tugas_id: tId,
          siswa_id: sId,
          is_done: true,
        },
      });
    } else {
      await this.prisma.tugas_siswa_checklist.deleteMany({
        where: {
          tugas_id: tId,
          siswa_id: sId,
        },
      });
    }

    return { ok: true };
  }

  async getMasterData(tahunAjaran?: string) {
    const [guruRaw, mapelRaw, kelasRaw] = await Promise.all([
      this.prisma.master_guru.findMany({
        where: { aktif: true },
        orderBy: { nama_lengkap: 'asc' },
        select: {
          nip: true,
          nama_lengkap: true,
        },
      }),
      this.prisma.master_mapel.findMany({
        where: { aktif: true },
        orderBy: { nama: 'asc' },
        select: {
          id: true,
          kode: true,
          nama: true,
        },
      }),
      this.prisma.master_kelas.findMany({
        where: { aktif: true },
        orderBy: { nama: 'asc' },
        select: {
          id: true,
          nama: true,
          tingkat: true,
          program: true,
        },
      }),
    ]);

    const guru = guruRaw.map((g) => ({
      guru_id: g.nip,
      nama_lengkap: g.nama_lengkap,
    }));

    const mapel = mapelRaw.map((m) => ({
      id: m.id,
      kode: m.kode,
      nama: m.nama,
    }));

    const kelas = kelasRaw.map((k) => ({
      id: Number(k.id),
      nama: k.nama,
      tingkat: k.tingkat || 10,
      program: k.program || 'Reguler',
    }));

    return {
      ok: true,
      guru,
      mapel,
      kelas,
    };
  }
}
