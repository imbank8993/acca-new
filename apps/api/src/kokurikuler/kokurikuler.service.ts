import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { resolveStudentNisn } from '../common/student-identity';

function dateOnly(value: unknown): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Tanggal tidak valid');
  const date = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new BadRequestException('Tanggal tidak valid');
  return date;
}

@Injectable()
export class KokurikulerService {
  constructor(private readonly prisma: PrismaService) {}

  private canManage(roles: string[] = []): boolean {
    const upper = roles.map((r) => r.toUpperCase());
    return upper.some((r) =>
      ['GURU', 'KAMAD', 'ADMIN', 'ADMINISTRATOR', 'SUPERADMIN', 'TATA_USAHA', 'TU'].includes(r),
    );
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
    if (typeof body.nama_kegiatan !== 'string' || !body.nama_kegiatan.trim()) {
      throw new BadRequestException('nama_kegiatan diperlukan');
    }

    return this.prisma.master_kokurikuler.update({
      where: { id },
      data: {
        nama_kegiatan: body.nama_kegiatan.trim(),
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

    const usedCount = await this.prisma.log_kokurikuler_siswa.count({
      where: { kegiatan_id: id },
    });
    if (usedCount > 0) {
      throw new BadRequestException(
        'Kegiatan ini tidak dapat dihapus karena sudah memiliki riwayat catatan siswa. Silakan nonaktifkan status kegiatan sebagai gantinya.',
      );
    }

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

    const roles: string[] = (user.roles || []).map((r: any) => String(r).toUpperCase());
    const isStudent = roles.includes('SISWA');
    const isOrangTua = roles.includes('ORANG_TUA') || roles.includes('ORANGTUA') || user.role === 'ORANG_TUA';
    const isAdmin = roles.some((r) => ['ADMIN', 'ADMINISTRATOR', 'SUPERADMIN'].includes(r));

    if (!isStudent && !isOrangTua && !isAdmin) {
      throw new ForbiddenException('Akses ditolak.');
    }

    const dateObj = dateOnly(tanggal);
    const setting = await this.prisma.site_settings.findUnique({ where: { key: 'timezone' }, select: { value: true } });
    const timeZone = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'].includes(setting?.value || '') ? setting!.value! : 'Asia/Makassar';
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone });
    if (isStudent && !isAdmin && tanggal > todayStr) {
      throw new BadRequestException('Tidak dapat mencatat kegiatan untuk tanggal yang akan datang.');
    }

    if (isStudent && !isAdmin && String(nisn) !== await resolveStudentNisn(this.prisma, user)) {
      throw new ForbiddenException('Anda hanya dapat mencatat kegiatan untuk akun sendiri.');
    }

    if (isOrangTua && !isAdmin) {
      if (!user.id) {
        throw new ForbiddenException('Akses ditolak.');
      }
      const anakLink = await this.prisma.orangtua_siswa.findFirst({
        where: { user_id: BigInt(user.id), nisn: String(nisn) },
      });
      if (!anakLink) {
        throw new ForbiddenException('Anda tidak memiliki akses untuk mencatat kegiatan siswa ini.');
      }
    }

    if ((checklist !== undefined && !Array.isArray(checklist)) || (customs !== undefined && !Array.isArray(customs))) {
      throw new BadRequestException('Daftar kegiatan tidak valid');
    }
    if ([...(checklist || []), ...(customs || [])].some(item => !item || typeof item.nama_kegiatan !== 'string')) {
      throw new BadRequestException('Nama kegiatan tidak valid');
    }
    await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'kokurikuler:' + nisn + ':' + tanggal}))`;
      await tx.$queryRaw`SELECT id FROM public.log_kokurikuler_siswa WHERE nisn = ${nisn} AND tanggal = ${dateObj} FOR UPDATE`;

      // 1. Ambil log hari ini yang SUDAH diverifikasi (bukan Pending)
      const existingNonPending = await tx.log_kokurikuler_siswa.findMany({
        where: {
          nisn,
          tanggal: dateObj,
          status: { not: 'Pending' },
        },
      });

      const existingKkIds = new Set(existingNonPending.map((l) => l.kegiatan_id).filter(Boolean));
      const existingCustomNames = new Set(
        existingNonPending
          .filter((l) => l.is_custom)
          .map((l) => (l.nama_kegiatan || '').trim().toLowerCase()),
      );

      // 2. Hapus log hari ini yang statusnya masih Pending (draft)
      await tx.log_kokurikuler_siswa.deleteMany({
        where: {
          nisn,
          tanggal: dateObj,
          status: 'Pending',
        },
      });

      const inserts: any[] = [];

      // 3. Masukkan checklist yang belum pernah disetujui/ditolak agar tidak duplikat
      if (Array.isArray(checklist)) {
        for (const item of checklist) {
          if (item && item.nama_kegiatan) {
            if (item.kegiatan_id && existingKkIds.has(item.kegiatan_id)) {
              continue;
            }
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
            const normName = c.nama_kegiatan.trim().toLowerCase();
            if (existingCustomNames.has(normName)) {
              continue;
            }
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
        await tx.log_kokurikuler_siswa.createMany({
          data: inserts,
        });
      }

    });

    return { ok: true };
  }

  // --- Verifikasi Pembina ---

  async getVerifikasiList(query: any) {
    const { tanggal, gender, kelas, bulan, tahun_ajaran } = query;

    const where: any = {};
    if (bulan && bulan !== '0' && bulan !== 'semua') {
      const monthNum = parseInt(bulan, 10);
      let yearNum = new Date().getFullYear();
      if (tahun_ajaran) {
        const parts = tahun_ajaran.split('/');
        if (parts.length === 2) {
          yearNum = monthNum >= 7 ? parseInt(parts[0], 10) : parseInt(parts[1], 10);
        }
      }
      const lastDay = new Date(yearNum, monthNum, 0).getDate();
      const mm = String(monthNum).padStart(2, '0');
      const startIso = new Date(`${yearNum}-${mm}-01T00:00:00.000Z`);
      const endIso = new Date(`${yearNum}-${mm}-${String(lastDay).padStart(2, '0')}T00:00:00.000Z`);
      where.tanggal = { gte: startIso, lte: endIso };
    } else if (tanggal) {
      where.tanggal = new Date(tanggal);
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
      if (!tglStr) continue;
      if (tanggal && tglStr === tanggal) continue;
      if (where.tanggal?.gte && where.tanggal?.lte && row.tanggal) {
        if (row.tanggal >= where.tanggal.gte && row.tanggal <= where.tanggal.lte) continue;
      }
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

    const verifierNip = user.nip || user.username || '';

    if (body.action === 'approve_all_for_nisn') {
      const whereClause: any = {
        nisn: body.nisn,
        status: 'Pending',
      };
      if (typeof body.nisn !== 'string' || !body.nisn.trim()) throw new BadRequestException('NISN wajib diisi');
      if (body.bulan && body.bulan !== '0') {
        const monthNum = Number(body.bulan);
        if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) throw new BadRequestException('Bulan tidak valid');
        if (body.tahun_ajaran && !/^\d{4}\/\d{4}$/.test(body.tahun_ajaran)) throw new BadRequestException('Tahun ajaran tidak valid');
        let yearNum = new Date().getFullYear();
        if (body.tahun_ajaran) {
          const parts = body.tahun_ajaran.split('/');
          if (parts.length === 2) {
            yearNum = monthNum >= 7 ? parseInt(parts[0], 10) : parseInt(parts[1], 10);
          }
        }
        const lastDay = new Date(yearNum, monthNum, 0).getDate();
        const mm = String(monthNum).padStart(2, '0');
        const startIso = new Date(`${yearNum}-${mm}-01T00:00:00.000Z`);
        const endIso = new Date(`${yearNum}-${mm}-${String(lastDay).padStart(2, '0')}T00:00:00.000Z`);
        whereClause.tanggal = { gte: startIso, lte: endIso };
      } else if (body.tanggal) {
        whereClause.tanggal = dateOnly(body.tanggal);
      } else {
        throw new BadRequestException('Pilih tanggal atau bulan sebelum menyetujui kegiatan');
      }

      await this.prisma.log_kokurikuler_siswa.updateMany({
        where: whereClause,
        data: {
          status: 'Disetujui',
          verifier_nip: verifierNip,
          updated_at: new Date(),
        },
      });
      return { ok: true };
    } else if (body.action === 'update_status') {
      if (!body.log_id || !['Disetujui', 'Ditolak'].includes(body.status)) throw new BadRequestException('Status verifikasi tidak valid');
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

    if (kelas && kelas !== 'semua' && kelas !== '') {
      const siswaKelasRows = await this.prisma.siswa_kelas.findMany({
        where: {
          kelas: { contains: kelas, mode: 'insensitive' },
          aktif: true,
        },
        select: { nisn: true },
      });
      const nisnList = Array.from(new Set(siswaKelasRows.map((r) => r.nisn))).filter(Boolean);
      where.nisn = { in: nisnList };
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
      // Hanya kegiatan yang telah disetujui pembina yang masuk laporan resmi
      if (row.status === 'Disetujui') {
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
