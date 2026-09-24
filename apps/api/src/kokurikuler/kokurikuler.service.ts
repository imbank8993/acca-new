import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class KokurikulerService {
  constructor(private readonly prisma: PrismaService) {}

  private canManage(roles: string[] = []): boolean {
    const upper = roles.map((r) => r.toUpperCase());
    return upper.some((r) => ['GURU', 'KAMAD', 'ADMIN', 'ADMINISTRATOR'].includes(r));
  }

  // --- Master Kegiatan ---

  async getMaster(aktifOnly?: boolean) {
    const where: any = {};
    if (aktifOnly) where.aktif = true;
    return this.prisma.master_kokurikuler.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
  }

  async createMaster(user: any, body: any) {
    if (!this.canManage(user.roles)) {
      throw new ForbiddenException('Akses ditolak.');
    }
    if (!body.nama_kegiatan) {
      throw new BadRequestException('nama_kegiatan diperlukan');
    }
    return this.prisma.master_kokurikuler.create({
      data: {
        nama_kegiatan: body.nama_kegiatan,
        kategori: body.kategori || 'Umum',
        aktif: body.aktif ?? true,
      },
    });
  }

  async updateMaster(user: any, id: string, body: any) {
    if (!this.canManage(user.roles)) {
      throw new ForbiddenException('Akses ditolak.');
    }
    if (!id) throw new BadRequestException('ID diperlukan');

    return this.prisma.master_kokurikuler.update({
      where: { id },
      data: {
        nama_kegiatan: body.nama_kegiatan,
        kategori: body.kategori,
        aktif: body.aktif,
      },
    });
  }

  async deleteMaster(user: any, id: string) {
    if (!this.canManage(user.roles)) {
      throw new ForbiddenException('Akses ditolak.');
    }
    if (!id) throw new BadRequestException('ID diperlukan');

    await this.prisma.master_kokurikuler.delete({
      where: { id },
    });
    return { ok: true };
  }

  // --- Log Kegiatan Siswa ---

  async getSiswaLogs(nisn: string, tanggal: string) {
    if (!nisn || !tanggal) {
      throw new BadRequestException('NISN dan Tanggal wajib diisi');
    }

    const dateObj = new Date(tanggal);
    const logs = await this.prisma.log_kokurikuler_siswa.findMany({
      where: {
        nisn,
        tanggal: dateObj,
      },
      orderBy: { created_at: 'asc' },
    });

    return logs.map((l) => ({
      ...l,
      tanggal: l.tanggal ? l.tanggal.toISOString().split('T')[0] : null,
    }));
  }

  async saveSiswaLogs(user: any, body: any) {
    const { nisn, tanggal, checklist, customs } = body;
    if (!nisn || !tanggal) {
      throw new BadRequestException('NISN dan Tanggal wajib diisi');
    }

    const roles: string[] = user.roles || [];
    const isStudent = roles.includes('SISWA');
    const isAdmin = roles.includes('ADMIN') || roles.includes('ADMINISTRATOR');

    if (isStudent && !isAdmin && String(nisn) !== String(user.nisn || user.username)) {
      throw new ForbiddenException('Anda hanya dapat mencatat kegiatan untuk akun sendiri.');
    }

    const dateObj = new Date(tanggal);

    // Hapus log hari ini yang statusnya masih Pending
    await this.prisma.log_kokurikuler_siswa.deleteMany({
      where: {
        nisn,
        tanggal: dateObj,
        status: 'Pending',
      },
    });

    const inserts: any[] = [];

    if (Array.isArray(checklist)) {
      for (const item of checklist) {
        if (item && item.nama_kegiatan) {
          inserts.push({
            nisn,
            tanggal: dateObj,
            kegiatan_id: item.kegiatan_id || null,
            nama_kegiatan: item.nama_kegiatan,
            is_custom: false,
            status: 'Pending',
          });
        }
      }
    }

    if (Array.isArray(customs)) {
      for (const c of customs) {
        if (c && c.nama_kegiatan && c.nama_kegiatan.trim()) {
          inserts.push({
            nisn,
            tanggal: dateObj,
            kegiatan_id: null,
            nama_kegiatan: c.nama_kegiatan.trim(),
            is_custom: true,
            status: 'Pending',
          });
        }
      }
    }

    if (inserts.length > 0) {
      await this.prisma.log_kokurikuler_siswa.createMany({
        data: inserts,
      });
    }

    return { ok: true };
  }

  // --- Verifikasi Pembina ---

  async getVerifikasiList(query: any) {
    const { tanggal, gender, kelas, bulan, tahun_ajaran } = query;

    const where: any = {};
    if (tanggal) {
      where.tanggal = new Date(tanggal);
    } else if (bulan && bulan !== '0' && bulan !== 'semua') {
      const monthNum = parseInt(bulan, 10);
      let yearNum = new Date().getFullYear();
      if (tahun_ajaran) {
        const parts = tahun_ajaran.split('/');
        if (parts.length === 2) {
          yearNum = monthNum >= 7 ? parseInt(parts[0], 10) : parseInt(parts[1], 10);
        }
      }
      const startIso = new Date(yearNum, monthNum - 1, 1);
      const endIso = new Date(yearNum, monthNum, 0);
      where.tanggal = { gte: startIso, lte: endIso };
    }

    const logs = await this.prisma.log_kokurikuler_siswa.findMany({
      where,
      orderBy: { tanggal: 'desc' },
    });

    // Antrean pending di luar tanggal yang sedang dibuka
    const pendingRows = await this.prisma.log_kokurikuler_siswa.findMany({
      where: { status: 'Pending' },
      select: { nisn: true, tanggal: true },
    });

    const nisnList = Array.from(
      new Set([
        ...logs.map((l) => l.nisn),
        ...pendingRows.map((r) => r.nisn),
      ]),
    ).filter(Boolean);

    if (nisnList.length === 0) {
      return { ok: true, data: [], pendingLain: [] };
    }

    const students = await this.prisma.master_siswa.findMany({
      where: {
        nisn: { in: nisnList },
        aktif: true,
      },
      select: { nisn: true, nama_lengkap: true, gender: true },
      orderBy: { nama_lengkap: 'asc' },
    });

    const kelasByNisn: Record<string, string> = {};
    if (students.length > 0) {
      const kelasWhere: any = {
        nisn: { in: students.map((s) => s.nisn) },
        aktif: true,
      };
      if (tahun_ajaran) kelasWhere.tahun_ajaran = tahun_ajaran;

      const enrol = await this.prisma.siswa_kelas.findMany({
        where: kelasWhere,
        select: { nisn: true, kelas: true },
      });

      const KELAS_REGULER = /^(X|XI|XII)\s+[A-Z]$/i;
      for (const row of enrol || []) {
        if (!row.kelas) continue;
        if (!kelasByNisn[row.nisn] || KELAS_REGULER.test(row.kelas)) {
          kelasByNisn[row.nisn] = row.kelas;
        }
      }
    }

    const lolosFilter = (s: any) => {
      if (gender && s.gender !== gender) return false;
      if (kelas && kelas !== 'semua' && kelas !== '' && kelasByNisn[s.nisn] !== kelas) return false;
      return true;
    };

    const siswaTampil = students.filter(lolosFilter);
    const nisnTampil = new Set(siswaTampil.map((s) => s.nisn));

    const logsByNisn: Record<string, any[]> = {};
    for (const log of logs) {
      if (!nisnTampil.has(log.nisn)) continue;
      if (!logsByNisn[log.nisn]) logsByNisn[log.nisn] = [];
      logsByNisn[log.nisn].push({
        ...log,
        tanggal: log.tanggal ? log.tanggal.toISOString().split('T')[0] : null,
      });
    }

    const result = siswaTampil
      .map((s) => ({
        ...s,
        kelas: s.nisn ? kelasByNisn[s.nisn] || '-' : '-',
        logs: s.nisn ? logsByNisn[s.nisn] || [] : [],
      }))
      .filter((s) => s.logs.length > 0);

    const perTanggal: Record<string, number> = {};
    for (const row of pendingRows) {
      if (!nisnTampil.has(row.nisn)) continue;
      const tglStr = row.tanggal ? row.tanggal.toISOString().split('T')[0] : '';
      if (tanggal && tglStr === tanggal) continue;
      perTanggal[tglStr] = (perTanggal[tglStr] || 0) + 1;
    }

    const pendingLain = Object.entries(perTanggal)
      .map(([tgl, jumlah]) => ({ tanggal: tgl, jumlah }))
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal));

    return { ok: true, data: result, pendingLain };
  }

  async verifyLogs(user: any, body: any) {
    if (!this.canManage(user.roles)) {
      throw new ForbiddenException('Hanya Pembina Asrama / Admin yang dapat memverifikasi kegiatan.');
    }

    const verifierNip = user.nip || '';

    if (body.action === 'approve_all_for_nisn') {
      const dateObj = new Date(body.tanggal);
      await this.prisma.log_kokurikuler_siswa.updateMany({
        where: {
          nisn: body.nisn,
          tanggal: dateObj,
          status: 'Pending',
        },
        data: {
          status: 'Disetujui',
          verifier_nip: verifierNip,
          updated_at: new Date(),
        },
      });
      return { ok: true };
    } else if (body.action === 'update_status') {
      await this.prisma.log_kokurikuler_siswa.update({
        where: { id: body.log_id },
        data: {
          status: body.status,
          catatan: body.catatan || null,
          verifier_nip: verifierNip,
          updated_at: new Date(),
        },
      });
      return { ok: true };
    }

    throw new BadRequestException('Invalid action');
  }

  // --- Laporan Rekap ---

  async getLaporan(query: any) {
    const { start_date, end_date, kelas } = query;
    const where: any = {};

    if (start_date || end_date) {
      where.tanggal = {};
      if (start_date) where.tanggal.gte = new Date(start_date);
      if (end_date) where.tanggal.lte = new Date(end_date);
    }

    const logs = await this.prisma.log_kokurikuler_siswa.findMany({
      where,
      include: {
        master_siswa: {
          select: { nisn: true, nama_lengkap: true },
        },
      },
    });

    const summary: Record<string, number> = {};
    for (const row of logs) {
      if (row.status !== 'Ditolak') {
        const name = row.nama_kegiatan;
        summary[name] = (summary[name] || 0) + 1;
      }
    }

    const summaryArray = Object.entries(summary)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const serializedLogs = logs.map((l) => ({
      ...l,
      tanggal: l.tanggal ? l.tanggal.toISOString().split('T')[0] : null,
    }));

    return { ok: true, summary: summaryArray, raw: serializedLogs };
  }
}
