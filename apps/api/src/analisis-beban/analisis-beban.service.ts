import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalisisBebanService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(query: { q?: string; tahun_ajaran?: string; semester?: string }) {
    const where: any = {};

    if (query.tahun_ajaran && query.tahun_ajaran !== 'Semua') {
      where.tahun_ajaran = query.tahun_ajaran;
    }
    if (query.semester && query.semester !== 'Semua') {
      where.semester = query.semester;
    }
    if (query.q) {
      where.OR = [
        { nama_guru: { contains: query.q, mode: 'insensitive' } },
        { nip: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    return await this.prisma.ploting_beban_kerja.findMany({
      where,
      orderBy: { nama_guru: 'asc' },
    });
  }

  async upsert(body: any) {
    let existingId = body.id;

    if (!existingId && body.nip && body.tahun_ajaran && body.semester) {
      const existing = await this.prisma.ploting_beban_kerja.findFirst({
        where: {
          nip: body.nip,
          tahun_ajaran: body.tahun_ajaran,
          semester: body.semester,
        },
        select: { id: true },
      });
      if (existing) {
        existingId = existing.id;
      }
    }

    const totalMapel = (body.rincian_mapel || []).reduce(
      (acc: number, cur: any) => acc + (parseInt(cur.jumlah_jp, 10) || 0),
      0,
    );
    const totalTugas = (body.rincian_tugas || []).reduce(
      (acc: number, cur: any) => acc + (parseInt(cur.jumlah_jp, 10) || 0),
      0,
    );
    const totalJp = totalMapel + totalTugas;

    const dataPayload: any = {
      nip: body.nip,
      nama_guru: body.nama_guru,
      tahun_ajaran: body.tahun_ajaran,
      semester: body.semester,
      total_jp_mapel: totalMapel,
      total_jp_tugas: totalTugas,
      total_jp: totalJp,
      rincian_mapel: body.rincian_mapel || [],
      rincian_tugas: body.rincian_tugas || [],
      status_memenuhi: totalJp >= 24,
      updated_at: new Date(),
    };

    if (existingId) {
      return await this.prisma.ploting_beban_kerja.update({
        where: { id: existingId },
        data: dataPayload,
      });
    }

    return await this.prisma.ploting_beban_kerja.create({
      data: dataPayload,
    });
  }

  async delete(id: string) {
    if (!id) throw new BadRequestException('ID required');
    await this.prisma.ploting_beban_kerja.delete({
      where: { id },
    });
    return { ok: true };
  }
}
