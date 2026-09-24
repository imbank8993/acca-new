import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object') {
    if (obj instanceof Date) return obj.toISOString();
    const res: any = {};
    for (const [k, v] of Object.entries(obj)) {
      res[k] = serializeBigInt(v);
    }
    return res;
  }
  return obj;
}

@Injectable()
export class EkskulSubmissionService {
  constructor(private readonly prisma: PrismaService) {}

  async getSubmissions(user: any, query: any) {
    const { nip, ekskul_id, status, bulan, tahun } = query;
    const where: any = {};

    const canViewAll =
      user?.roles?.includes('ADMIN') ||
      user?.roles?.includes('WKM_KESISWAAN') ||
      user?.roles?.includes('BENDAHARA_KOMITE') ||
      user?.role === 'ADMIN';

    if (canViewAll) {
      if (nip) where.pembina_nip = nip;
    } else {
      if (!user?.nip) {
        throw new ForbiddenException('Akses ditolak: profil pembina tidak ditemukan.');
      }
      where.pembina_nip = user.nip;
    }
    if (ekskul_id) where.ekskul_id = ekskul_id;
    if (status) where.status = status;
    if (bulan) where.bulan = parseInt(bulan, 10);
    if (tahun) where.tahun = parseInt(tahun, 10);

    const items = await this.prisma.laporan_ekskul_submissions.findMany({
      where,
      orderBy: { submitted_at: 'desc' },
      include: {
        ekskul: {
          select: { nama_ekskul: true },
        },
      },
    });

    const dataWithCounts = await Promise.all(
      items.map(async (item) => {
        const pertRows = await this.prisma.ekskul_pertemuan.findMany({
          where: { submission_id: item.id },
          select: { status_pelatih: true },
        });

        let internal = 0;
        let eksternal = 0;
        pertRows.forEach((r) => {
          if (r.status_pelatih === 'Eksternal') eksternal++;
          else internal++;
        });

        return {
          ...item,
          jml_internal: internal,
          jml_eksternal: eksternal,
        };
      }),
    );

    return { ok: true, data: serializeBigInt(dataWithCounts) };
  }

  async postSubmission(user: any, body: any) {
    const { ekskul_id, nip, bulan, tahun, nama_guru } = body;

    if (!ekskul_id || !nip || !bulan || !tahun) {
      throw new BadRequestException('ekskul_id, nip, bulan, dan tahun wajib diisi');
    }
    if (
      user.nip !== nip &&
      !user.roles?.includes('ADMIN') &&
      !user.roles?.includes('WKM_KESISWAAN')
    ) {
      throw new ForbiddenException('Anda hanya dapat mengajukan laporan milik sendiri.');
    }

    const m = Number(bulan);
    const y = Number(tahun);
    const startDate = new Date(y, m - 1, 1);
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = new Date(y, m - 1, lastDay);

    const entries = await this.prisma.ekskul_pertemuan.findMany({
      where: {
        ekskul_id,
        nip,
        tanggal: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: { id: true },
    });

    if (!entries || entries.length === 0) {
      throw new BadRequestException(
        'Tidak ada pertemuan ekskul pada bulan ini untuk diajukan.',
      );
    }

    const existing = await this.prisma.laporan_ekskul_submissions.findUnique({
      where: {
        ekskul_id_pembina_nip_bulan_tahun: {
          ekskul_id,
          pembina_nip: nip,
          bulan: m,
          tahun: y,
        },
      },
      select: { id: true, status: true },
    });

    if (existing && existing.status === 'Disahkan') {
      throw new ConflictException(
        'Laporan bulan ini sudah disahkan dan tidak dapat diajukan ulang.',
      );
    }

    const payload = {
      ekskul_id,
      pembina_nip: nip,
      pembina_nama: nama_guru || null,
      bulan: m,
      tahun: y,
      status: 'Menunggu',
      total_pertemuan: entries.length,
      catatan_reviewer: null as string | null,
      submitted_at: new Date(),
      updated_at: new Date(),
    };

    const submission = await this.prisma.laporan_ekskul_submissions.upsert({
      where: {
        ekskul_id_pembina_nip_bulan_tahun: {
          ekskul_id,
          pembina_nip: nip,
          bulan: m,
          tahun: y,
        },
      },
      update: payload,
      create: payload,
    });

    await this.prisma.ekskul_pertemuan.updateMany({
      where: { id: { in: entries.map((e) => e.id) } },
      data: { submission_id: submission.id },
    });

    return { ok: true, data: serializeBigInt(submission) };
  }

  async deleteSubmission(user: any, id: string) {
    if (!id) throw new BadRequestException('ID ajuan wajib diisi');

    const submission = await this.prisma.laporan_ekskul_submissions.findUnique({
      where: { id },
      select: { id: true, pembina_nip: true, status: true },
    });

    if (!submission) {
      throw new NotFoundException('Ajuan tidak ditemukan');
    }

    if (
      user.nip !== submission.pembina_nip &&
      !user.roles?.includes('ADMIN') &&
      !user.roles?.includes('WKM_KESISWAAN')
    ) {
      throw new ForbiddenException('Anda hanya dapat membatalkan laporan milik sendiri.');
    }

    if (submission.status === 'Disahkan') {
      throw new BadRequestException('Laporan sudah disahkan dan tidak dapat dibatalkan.');
    }

    await this.prisma.ekskul_pertemuan.updateMany({
      where: { submission_id: id },
      data: { submission_id: null },
    });

    await this.prisma.laporan_ekskul_submissions.delete({
      where: { id },
    });

    return { ok: true };
  }

  async postPembayaran(user: any, body: any) {
    const isBendahara =
      user.roles?.includes('ADMIN') || user.roles?.includes('BENDAHARA_KOMITE');
    if (!isBendahara) {
      throw new ForbiddenException(
        'Hanya Bendahara Komite / Admin yang dapat menandai pembayaran.',
      );
    }

    const { id, dibayarkan, catatan } = body;
    if (catatan && typeof catatan === 'string' && catatan.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(catatan);
        if (parsed.url && typeof parsed.url === 'string') {
          const u = parsed.url.trim().toLowerCase();
          if (!u.startsWith('https://') && !u.startsWith('http://') && !u.startsWith('/')) {
            throw new BadRequestException('Format URL bukti pembayaran tidak valid.');
          }
        }
      } catch (err: any) {
        if (err instanceof BadRequestException) throw err;
      }
    }

    if (!id || typeof dibayarkan !== 'boolean') {
      throw new BadRequestException('id dan dibayarkan (boolean) wajib diisi');
    }

    const submission = await this.prisma.laporan_ekskul_submissions.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!submission) {
      throw new NotFoundException('Ajuan tidak ditemukan.');
    }
    if (submission.status !== 'Disahkan') {
      throw new ConflictException(
        'Hanya laporan berstatus Disahkan yang dapat ditandai pembayaran.',
      );
    }

    const reviewer = await this.prisma.public_users.findFirst({
      where: { auth_id: user.authId },
      select: { nama: true },
    });
    const reviewerName = reviewer?.nama || 'Bendahara Komite';

    const updatePayload: any = {
      dibayarkan,
      catatan_pembayaran: catatan || null,
      updated_at: new Date(),
    };
    if (dibayarkan) {
      updatePayload.dibayarkan_at = new Date();
      updatePayload.dibayarkan_by = user.authId;
      updatePayload.dibayarkan_by_name = reviewerName;
    } else {
      updatePayload.dibayarkan_at = null;
      updatePayload.dibayarkan_by = null;
      updatePayload.dibayarkan_by_name = null;
    }

    const updated = await this.prisma.laporan_ekskul_submissions.update({
      where: { id },
      data: updatePayload,
    });

    return { ok: true, data: serializeBigInt(updated) };
  }
}
