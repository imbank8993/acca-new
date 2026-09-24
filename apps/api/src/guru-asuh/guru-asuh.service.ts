import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  resolveTahunAjaranSemester,
  calcDailyAttendanceMinutes,
  dominantStatus,
} from '../wali-kelas/attendance-calc';
import {
  GURU_ASUH_APPROVAL_KEY,
  aksesDiizinkan,
  parseKonfigurasiAkses,
} from '../auth/feature-access.guard';

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
export class GuruAsuhService {
  constructor(private readonly prisma: PrismaService) {}

  private async isApprover(user: any): Promise<boolean> {
    const row = await this.prisma.site_settings.findUnique({
      where: { key: GURU_ASUH_APPROVAL_KEY },
      select: { value: true },
    });
    return aksesDiizinkan(user, parseKonfigurasiAkses(row?.value ?? null), ['WKM_KEASRAMAAN']);
  }

  async getSubmissions(user: any, query: any) {
    const { nip, status, bulan, tahun } = query;
    const where: any = {};

    const isApproverUser = await this.isApprover(user);
    const canViewAll =
      isApproverUser ||
      user?.roles?.includes('BENDAHARA_KOMITE') ||
      user?.role === 'ADMIN';

    if (canViewAll) {
      if (nip) where.nip = nip;
    } else {
      if (!user?.nip) {
        throw new ForbiddenException('Akses ditolak: profil guru tidak ditemukan.');
      }
      where.nip = user.nip;
    }

    if (status) where.status = status;
    if (bulan) where.bulan = parseInt(bulan, 10);
    if (tahun) where.tahun = parseInt(tahun, 10);

    const data = await this.prisma.laporan_guru_asuh_submissions.findMany({
      where,
      orderBy: { submitted_at: 'desc' },
    });

    return { ok: true, data: serializeBigInt(data) };
  }

  async postSubmission(user: any, body: any) {
    const { nip, bulan, tahun, nama_guru } = body;

    if (!nip || !bulan || !tahun) {
      throw new BadRequestException('nip, bulan, dan tahun wajib diisi');
    }
    if (user.nip !== nip && !user.roles?.includes('ADMIN')) {
      throw new ForbiddenException('Anda hanya dapat mengajukan laporan milik sendiri.');
    }

    const m = Number(bulan);
    const y = Number(tahun);
    const startDate = new Date(y, m - 1, 1);
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = new Date(y, m - 1, lastDay, 23, 59, 59, 999);

    const entries = await this.prisma.laporan_guru_asuh.findMany({
      where: {
        nip,
        tanggal: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: { id: true, tanggal: true, kegiatan: true },
    });

    if (!entries || entries.length === 0) {
      throw new BadRequestException('Tidak ada laporan pada bulan ini untuk diajukan.');
    }

    const uniqueKegiatan = new Set(
      entries.map((e) => `${e.tanggal.toISOString().split('T')[0]}|${e.kegiatan}`),
    ).size;

    const existing = await this.prisma.laporan_guru_asuh_submissions.findUnique({
      where: {
        nip_bulan_tahun: {
          nip,
          bulan: m,
          tahun: y,
        },
      },
      select: { id: true, status: true },
    });

    if (existing && existing.status === 'Approved') {
      throw new ConflictException(
        'Laporan bulan ini sudah disahkan dan tidak dapat diajukan ulang.',
      );
    }

    const payload = {
      nip,
      nama_guru_snap: nama_guru || null,
      bulan: m,
      tahun: y,
      status: 'Submitted',
      total_laporan: uniqueKegiatan,
      catatan_reviewer: null as string | null,
      submitted_at: new Date(),
      updated_at: new Date(),
    };

    const submission = await this.prisma.laporan_guru_asuh_submissions.upsert({
      where: {
        nip_bulan_tahun: {
          nip,
          bulan: m,
          tahun: y,
        },
      },
      update: payload,
      create: payload,
    });

    await this.prisma.laporan_guru_asuh.updateMany({
      where: { id: { in: entries.map((e) => e.id) } },
      data: { submission_id: submission.id },
    });

    return { ok: true, data: serializeBigInt(submission) };
  }

  async deleteSubmission(user: any, id: string) {
    if (!id) throw new BadRequestException('ID ajuan wajib diisi');

    const submission = await this.prisma.laporan_guru_asuh_submissions.findUnique({
      where: { id },
      select: { id: true, nip: true, status: true },
    });

    if (!submission) {
      throw new NotFoundException('Ajuan tidak ditemukan');
    }

    if (user.nip !== submission.nip && !user.roles?.includes('ADMIN')) {
      throw new ForbiddenException('Anda hanya dapat membatalkan laporan milik sendiri.');
    }

    if (submission.status === 'Approved') {
      throw new BadRequestException('Laporan sudah disahkan dan tidak dapat dibatalkan.');
    }

    await this.prisma.laporan_guru_asuh.updateMany({
      where: { submission_id: id },
      data: { submission_id: null },
    });

    await this.prisma.laporan_guru_asuh_submissions.delete({
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

    const submission = await this.prisma.laporan_guru_asuh_submissions.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!submission) {
      throw new NotFoundException('Ajuan tidak ditemukan.');
    }
    if (submission.status !== 'Approved') {
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

    const updated = await this.prisma.laporan_guru_asuh_submissions.update({
      where: { id },
      data: updatePayload,
    });

    return { ok: true, data: serializeBigInt(updated) };
  }

  async approveSubmission(user: any, body: any) {
    const isReviewer = await this.isApprover(user);
    if (!isReviewer) {
      throw new ForbiddenException(
        'Hanya Admin atau pengguna yang memiliki Hak Akses Fitur Approval yang dapat memproses persetujuan ini.',
      );
    }

    const { id, action, catatan } = body;
    if (!id || !['approve', 'revisi'].includes(action)) {
      throw new BadRequestException('id dan action (approve|revisi) wajib diisi');
    }
    if (action === 'revisi' && !catatan?.trim()) {
      throw new BadRequestException('Catatan wajib diisi saat mengembalikan laporan.');
    }

    const submission = await this.prisma.laporan_guru_asuh_submissions.findUnique({
      where: { id },
    });
    if (!submission) {
      throw new NotFoundException('Ajuan tidak ditemukan.');
    }

    const isRevokingApproval = action === 'revisi' && submission.status === 'Approved';
    const validTransition =
      action === 'approve'
        ? submission.status === 'Submitted'
        : submission.status === 'Submitted' || submission.status === 'Approved';
    if (!validTransition) {
      throw new ConflictException(
        `Status ajuan (${submission.status}) tidak dapat diproses.`,
      );
    }

    const reviewer = await this.prisma.public_users.findFirst({
      where: { auth_id: user.authId },
      select: { nama: true },
    });
    const reviewerName = reviewer?.nama || user.nama || 'Approver';

    const updatePayload: any = {
      catatan_reviewer: catatan || null,
      updated_at: new Date(),
    };

    if (action === 'approve') {
      updatePayload.status = 'Approved';
      updatePayload.approved_by = user.authId;
      updatePayload.approved_by_name = reviewerName;
      updatePayload.approved_at = new Date();
    } else {
      updatePayload.status = 'Revisi';
      if (isRevokingApproval) {
        updatePayload.approved_by = null;
        updatePayload.approved_by_name = null;
        updatePayload.approved_at = null;
        updatePayload.pdf_url = null;
      }
      await this.prisma.laporan_guru_asuh.updateMany({
        where: { submission_id: id },
        data: { submission_id: null },
      });
    }

    const updated = await this.prisma.laporan_guru_asuh_submissions.update({
      where: { id },
      data: updatePayload,
    });

    return { ok: true, data: serializeBigInt(updated) };
  }

  async verifySubmission(id: string) {
    if (!id) throw new BadRequestException('id wajib diisi');

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUuid) {
      return { ok: false, verified: false, error: 'Dokumen tidak ditemukan atau kode tidak valid.' };
    }

    const submission = await this.prisma.laporan_guru_asuh_submissions.findUnique({
      where: { id },
      select: {
        id: true,
        nip: true,
        nama_guru_snap: true,
        bulan: true,
        tahun: true,
        status: true,
        total_laporan: true,
        submitted_at: true,
        approved_at: true,
        approved_by_name: true,
        pdf_url: true,
      },
    });

    if (!submission || submission.status !== 'Approved') {
      return { ok: false, verified: false, error: 'Dokumen belum disahkan atau tidak ditemukan.' };
    }

    return { ok: true, verified: true, data: serializeBigInt(submission) };
  }

  async getAbsensiAkumulasi(query: any, user: any) {
    const isApproverUser = await this.isApprover(user);
    const isAdmin =
      isApproverUser ||
      user?.roles?.includes('WKM_KURIKULUM') ||
      user?.role === 'ADMIN';
    const nip = isAdmin ? (query.nip || user?.nip) : user?.nip;
    const mapel = query.mapel;
    const kelas = query.kelas;
    const tanggal = query.tanggal;
    const bulanParam = query.bulan;
    const mode = query.mode || 'default';

    if (!nip) throw new BadRequestException('NIP wajib diisi');

    const now = new Date();
    let targetYear = now.getFullYear();
    let targetMonth = now.getMonth() + 1;

    if (bulanParam && bulanParam.includes('-')) {
      const [y, m] = bulanParam.split('-');
      targetYear = parseInt(y, 10);
      targetMonth = parseInt(m, 10);
    } else if (tanggal && tanggal.includes('-')) {
      const [y, m] = tanggal.split('-');
      targetYear = parseInt(y, 10);
      targetMonth = parseInt(m, 10);
    }

    // Mode: mapel_list
    if (mode === 'mapel_list') {
      const jadwal = await this.prisma.jadwal_guru.findMany({
        where: { nip, aktif: true },
        select: { mata_pelajaran: true, kelas: true },
      });

      const mapelSet = new Set<string>();
      const kelasSet = new Set<string>();
      jadwal.forEach((j) => {
        if (j.mata_pelajaran) mapelSet.add(j.mata_pelajaran);
        if (j.kelas) kelasSet.add(j.kelas);
      });

      return {
        ok: true,
        mapel_list: Array.from(mapelSet).sort(),
        kelas_list: Array.from(kelasSet).sort(),
      };
    }

    const { tahunAjaran, semester, semesterStr } = resolveTahunAjaranSemester(
      `${targetYear}-${String(targetMonth).padStart(2, '0')}`,
    );

    let startDate: string;
    let endDate: string;

    if (tanggal) {
      startDate = tanggal;
      endDate = tanggal;
    } else if (bulanParam) {
      startDate = `${bulanParam}-01`;
      const [y, m] = bulanParam.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      endDate = `${bulanParam}-${String(lastDay).padStart(2, '0')}`;
    } else {
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      endDate = startDate;
    }

    const startD = new Date(startDate);
    const endD = new Date(endDate);

    const [guru, holidays] = await Promise.all([
      this.prisma.master_guru.findUnique({
        where: { nip },
        select: { nip: true, nama_lengkap: true },
      }),
      this.prisma.libur.findMany({
        where: { tanggal: { gte: startD, lte: endD } },
      }),
    ]);

    let siswaList: any[] = [];
    if (kelas) {
      siswaList = await this.prisma.siswa_kelas.findMany({
        where: {
          kelas,
          tahun_ajaran: tahunAjaran,
          semester: semesterStr,
          aktif: true,
        },
        select: { nisn: true, nama_siswa: true, kelas: true },
      });
      siswaList = siswaList.filter(
        (v, i, a) => a.findIndex((t) => t.nisn === v.nisn) === i,
      );
    }

    if (siswaList.length === 0) {
      return {
        ok: true,
        guru_info: guru ? { nip: guru.nip, nama: guru.nama_lengkap } : null,
        periode: { start: startDate, end: endDate, type: tanggal ? 'harian' : 'bulanan' },
        siswa: [] as any[],
        holidays: serializeBigInt(holidays),
        summary: { total: 0, hadir: 0, izin: 0, sakit: 0, alpha: 0 },
      };
    }

    const nisnList = siswaList.map((s) => s.nisn);

    const [ketidakhadiranList, sesiList] = await Promise.all([
      this.prisma.ketidakhadiran.findMany({
        where: {
          kelas: { in: [kelas] },
          aktif: true,
          tgl_mulai: { lte: endD },
          tgl_selesai: { gte: startD },
        },
      }),
      this.prisma.absensi_sesi.findMany({
        where: {
          kelas,
          status_sesi: 'FINAL',
          tanggal: { gte: startD, lte: endD },
          ...(mapel ? { mata_pelajaran: mapel } : {}),
        },
      }),
    ]);

    const sesiIds = sesiList.map((s) => s.sesi_id);
    let detailList: any[] = [];
    if (sesiIds.length > 0) {
      detailList = await this.prisma.absensi_detail.findMany({
        where: {
          sesi_id: { in: sesiIds },
          nisn: { in: nisnList },
        },
      });
    }

    const daysInRange: string[] = [];
    const curr = new Date(startD);
    while (curr <= endD) {
      daysInRange.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const holidayDates = new Set(
      holidays
        .filter((h) => {
          const jam = String(h.jam_ke || '').trim().toLowerCase();
          return jam === 'semua' || jam === '';
        })
        .map((h) => h.tanggal.toISOString().split('T')[0]),
    );

    const studentData = siswaList.map((siswa) => {
      const nisn = siswa.nisn;
      let countHadir = 0;
      let countIzin = 0;
      let countSakit = 0;
      let countAlpha = 0;
      const dailyStatus: Record<string, string> = {};

      daysInRange.forEach((dateStr) => {
        let status = '';
        if (dateStr > todayStr) {
          status = '';
        } else {
          const isHoliday = holidayDates.has(dateStr);
          const isWeekend = [0, 6].includes(new Date(dateStr).getDay());

          if (isHoliday || isWeekend) {
            status = isHoliday ? 'L' : 'W';
          } else {
            const khHariIni = ketidakhadiranList.filter(
              (k) =>
                k.nisn === nisn &&
                k.tgl_mulai.toISOString().split('T')[0] <= dateStr &&
                k.tgl_selesai.toISOString().split('T')[0] >= dateStr,
            );
            const daySessions = sesiList.filter(
              (s) => s.tanggal.toISOString().split('T')[0] === dateStr,
            );
            const dayDetails = detailList.filter(
              (d) =>
                d.nisn === nisn &&
                daySessions.some((s) => s.sesi_id === d.sesi_id),
            );

            const absensiDetailHariIni = dayDetails.map((d) => ({
              jamKe: daySessions.find((s) => s.sesi_id === d.sesi_id)?.jam_ke,
              status: d.status || 'HADIR',
            }));

            const minutes = calcDailyAttendanceMinutes(
              khHariIni.map((k) => ({
                ...k,
                tgl_mulai: k.tgl_mulai.toISOString().split('T')[0],
                tgl_selesai: k.tgl_selesai.toISOString().split('T')[0],
              })),
              absensiDetailHariIni,
              dateStr,
            );
            status = dominantStatus(minutes).charAt(0);

            switch (status) {
              case 'H': countHadir++; break;
              case 'I': countIzin++; break;
              case 'S': countSakit++; break;
              case 'A': countAlpha++; break;
            }
          }
        }
        dailyStatus[dateStr] = status;
      });

      return {
        nisn,
        nama: siswa.nama_siswa,
        kelas: siswa.kelas,
        hadir: countHadir,
        izin: countIzin,
        sakit: countSakit,
        alpha: countAlpha,
        total: countHadir + countIzin + countSakit + countAlpha,
        daily: dailyStatus,
      };
    });

    studentData.sort((a, b) => a.nama.localeCompare(b.nama));

    const summary = {
      total: studentData.length,
      hadir: studentData.filter((s) => s.hadir > 0 && s.alpha === 0 && s.sakit === 0 && s.izin === 0).length,
      izin_count: studentData.filter((s) => s.izin > 0).length,
      sakit_count: studentData.filter((s) => s.sakit > 0).length,
      alpha_count: studentData.filter((s) => s.alpha > 0).length,
    };

    return {
      ok: true,
      guru_info: guru ? { nip: guru.nip, nama: guru.nama_lengkap } : null,
      periode: { start: startDate, end: endDate, type: tanggal ? 'harian' : 'bulanan' },
      siswa: studentData,
      holidays: serializeBigInt(holidays),
      summary,
    };
  }

  async getEkskul(query: any, user: any) {
    const isAdmin = user.roles?.includes('ADMIN') || user.role === 'ADMIN';
    const nip = isAdmin ? (query.nip || user.nip) : user.nip;
    const { tahun_ajaran, semester } = query;

    if (!nip && !isAdmin) {
      throw new BadRequestException('NIP wajib diisi atau harus sebagai Admin');
    }
    if (!tahun_ajaran) {
      throw new BadRequestException('Parameter tahun_ajaran wajib diisi');
    }

    const isSemua = !semester || semester === 'Semua' || String(semester).toLowerCase() === 'all';
    let semNum: number | undefined = undefined;
    if (!isSemua) {
      semNum = (semester === '2' || String(semester).toLowerCase() === 'genap') ? 2 : 1;
    }

    let siswaList: any[] = [];
    if (isAdmin && !query.nip) {
      const data = await this.prisma.master_siswa.findMany({
        where: { aktif: true },
        select: { id: true, nisn: true, nama_lengkap: true },
        orderBy: { nama_lengkap: 'asc' },
      });
      siswaList = data.map((d) => ({
        id: d.id.toString(),
        nisn: d.nisn || '',
        nama_lengkap: d.nama_lengkap || '',
        kelas: '-',
      }));
    } else {
      const data = await this.prisma.guru_asuh.findMany({
        where: { nip, tahun_ajaran, aktif: true },
        select: { nisn_siswa: true, nama_siswa: true, kelas: true },
        orderBy: { nama_siswa: 'asc' },
      });

      if (data && data.length > 0) {
        const nisns = data.map((d) => d.nisn_siswa);
        const msData = await this.prisma.master_siswa.findMany({
          where: { nisn: { in: nisns } },
          select: { id: true, nisn: true },
        });
        const nisnToId: Record<string, string> = {};
        msData.forEach((m) => {
          if (m.nisn) nisnToId[m.nisn] = m.id.toString();
        });

        siswaList = data
          .map((d) => ({
            id: d.nisn_siswa ? nisnToId[d.nisn_siswa] : null,
            nisn: d.nisn_siswa,
            nama_lengkap: d.nama_siswa,
            kelas: d.kelas,
          }))
          .filter((s) => s.id);
      }
    }

    if (siswaList.length === 0) {
      return { ok: true, data: [] };
    }

    const idList = siswaList.map((s) => BigInt(s.id));
    const ekskulMap: Record<string, any[]> = {};

    if (idList.length > 0) {
      const ekskulWhere: any = {
        siswa_id: { in: idList },
        tahun_ajaran,
      };
      if (semNum !== undefined) {
        ekskulWhere.semester = semNum;
      }

      const ekskulData = await this.prisma.ekskul_siswa.findMany({
        where: ekskulWhere,
        include: {
          ekskul: { select: { nama_ekskul: true } },
        },
      });

      ekskulData.forEach((row) => {
        const sId = row.siswa_id.toString();
        const namaEkskul = row.ekskul?.nama_ekskul || 'Ekskul';
        if (sId) {
          if (!ekskulMap[sId]) ekskulMap[sId] = [];
          ekskulMap[sId].push({ nama_ekskul: namaEkskul });
        }
      });
    }

    const resultData = siswaList.map((siswa) => ({
      nisn: siswa.nisn,
      nama: siswa.nama_lengkap,
      kelas: siswa.kelas || '-',
      ekskul: ekskulMap[siswa.id] || [],
    }));

    return { ok: true, data: resultData };
  }

  async getKokurikuler(query: any, user: any) {
    const isAdmin = user.roles?.includes('ADMIN') || user.role === 'ADMIN';
    const nip = isAdmin ? (query.nip || user.nip) : user.nip;
    if (!nip) throw new BadRequestException('NIP wajib diisi');

    const where: any = { nip, aktif: true };
    if (query.tahun_ajaran && query.tahun_ajaran !== 'Semua') {
      where.tahun_ajaran = query.tahun_ajaran;
    }

    const siswaList = await this.prisma.guru_asuh.findMany({
      where,
      select: { nisn_siswa: true, nama_siswa: true, kelas: true },
    });

    const formattedSiswa = siswaList.map((s) => ({
      nisn: s.nisn_siswa,
      nama: s.nama_siswa,
      kelas: s.kelas,
    }));

    const uniqueSiswa = formattedSiswa.filter(
      (v, i, a) => a.findIndex((t) => t.nisn === v.nisn) === i,
    );
    uniqueSiswa.sort((a, b) => a.nama.localeCompare(b.nama));

    return { ok: true, nip, siswa: uniqueSiswa };
  }

  async getLaporan(user: any, query: any) {
    const { guru_asuh_id, nip, startDate, endDate } = query;
    const where: any = {};

    const isApproverUser = await this.isApprover(user);
    const canViewAll =
      isApproverUser ||
      user?.role === 'ADMIN';

    if (canViewAll) {
      if (nip) where.nip = nip;
    } else {
      if (!user?.nip) {
        throw new ForbiddenException('Akses ditolak: profil guru tidak ditemukan.');
      }
      where.nip = user.nip;
    }

    if (guru_asuh_id) where.guru_asuh_id = BigInt(guru_asuh_id);
    if (startDate || endDate) {
      where.tanggal = {};
      if (startDate) where.tanggal.gte = new Date(startDate);
      if (endDate) {
        const endD = new Date(endDate);
        if (typeof endDate === 'string' && endDate.length <= 10) {
          endD.setHours(23, 59, 59, 999);
        }
        where.tanggal.lte = endD;
      }
    }

    const data = await this.prisma.laporan_guru_asuh.findMany({
      where,
      include: { guru_asuh: true },
      orderBy: { tanggal: 'desc' },
    });

    return { ok: true, data: serializeBigInt(data) };
  }

  async saveLaporan(user: any, body: any) {
    const { id, guru_asuh_id, nip, tanggal, kegiatan, hasil, foto_url } = body;
    if (!guru_asuh_id || !nip || !kegiatan) {
      throw new BadRequestException('Missing required fields');
    }

    const isAdmin = user.roles?.includes('ADMIN') || user.role === 'ADMIN';
    if (!isAdmin && user.nip !== nip) {
      throw new ForbiddenException('Anda hanya dapat menyimpan log kegiatan milik sendiri.');
    }

    const gaRecord = await this.prisma.guru_asuh.findUnique({
      where: { id: BigInt(guru_asuh_id) },
    });
    if (!gaRecord) {
      throw new NotFoundException('Data siswa asuh tidak ditemukan.');
    }
    if (!isAdmin && gaRecord.nip !== user.nip) {
      throw new ForbiddenException('Siswa asuh ini bukan milik Anda.');
    }
    if (!id && !gaRecord.aktif) {
      throw new BadRequestException('Siswa asuh ini sudah tidak aktif.');
    }

    if (id) {
      const existing = await this.prisma.laporan_guru_asuh.findUnique({
        where: { id },
        include: { laporan_guru_asuh_submissions: true },
      });
      if (!existing) {
        throw new NotFoundException('Laporan tidak ditemukan');
      }
      if (!isAdmin && existing.nip !== user.nip) {
        throw new ForbiddenException('Anda tidak memiliki akses ke laporan ini.');
      }
      if (existing.laporan_guru_asuh_submissions) {
        const subStatus = existing.laporan_guru_asuh_submissions.status;
        if (subStatus === 'Approved' || subStatus === 'Submitted') {
          throw new ConflictException(`Laporan sudah ${subStatus === 'Approved' ? 'disahkan' : 'diajukan'} dan tidak dapat diedit.`);
        }
      }
    }

    if (typeof kegiatan !== 'string' || kegiatan.trim().length === 0) {
      throw new BadRequestException('Uraian kegiatan wajib diisi.');
    }
    if (kegiatan.length > 5000) {
      throw new BadRequestException('Uraian kegiatan maksimal 5.000 karakter.');
    }
    if (hasil && typeof hasil === 'string' && hasil.length > 5000) {
      throw new BadRequestException('Uraian hasil kegiatan maksimal 5.000 karakter.');
    }

    let parsedTanggal = new Date();
    if (tanggal) {
      parsedTanggal = new Date(tanggal);
      if (isNaN(parsedTanggal.getTime())) {
        throw new BadRequestException('Format tanggal tidak valid.');
      }
      const maxFutureDate = new Date();
      maxFutureDate.setDate(maxFutureDate.getDate() + 7);
      if (parsedTanggal > maxFutureDate) {
        throw new BadRequestException('Tanggal kegiatan tidak boleh lebih dari 7 hari ke depan.');
      }
      const minDate = new Date('2020-01-01');
      if (parsedTanggal < minDate) {
        throw new BadRequestException('Tanggal kegiatan tidak valid.');
      }
    }

    let safeFotoUrl: string | null = null;
    if (foto_url && typeof foto_url === 'string') {
      const trimmed = foto_url.trim();
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
        if (!trimmed.includes('169.254.169.254')) {
          safeFotoUrl = trimmed;
        }
      }
    }

    const payload: any = {
      guru_asuh_id: BigInt(guru_asuh_id),
      nip,
      tanggal: parsedTanggal,
      kegiatan: kegiatan.trim(),
      hasil: hasil ? String(hasil).trim() : null,
      foto_url: safeFotoUrl,
      updated_at: new Date(),
    };

    let result;
    if (id) {
      result = await this.prisma.laporan_guru_asuh.update({
        where: { id },
        data: payload,
      });
    } else {
      payload.created_at = new Date();
      result = await this.prisma.laporan_guru_asuh.create({
        data: payload,
      });
    }

    return { ok: true, data: serializeBigInt(result) };
  }

  async deleteLaporan(user: any, id: string) {
    if (!id) throw new BadRequestException('ID is required');

    const existing = await this.prisma.laporan_guru_asuh.findUnique({
      where: { id },
      include: { laporan_guru_asuh_submissions: true },
    });
    if (!existing) {
      throw new NotFoundException('Laporan tidak ditemukan');
    }

    const isAdmin = user.roles?.includes('ADMIN') || user.role === 'ADMIN';
    if (!isAdmin && existing.nip !== user.nip) {
      throw new ForbiddenException('Anda hanya dapat menghapus log kegiatan milik sendiri.');
    }

    if (existing.laporan_guru_asuh_submissions) {
      const subStatus = existing.laporan_guru_asuh_submissions.status;
      if (subStatus === 'Approved' || subStatus === 'Submitted') {
        throw new ConflictException(`Laporan sudah ${subStatus === 'Approved' ? 'disahkan' : 'diajukan'} dan tidak dapat dihapus.`);
      }
    }

    await this.prisma.laporan_guru_asuh.delete({
      where: { id },
    });

    return { ok: true };
  }

  async getReportData(user: any, query: any) {
    const { submissionId, nip, bulan, tahun } = query;
    let submission: any = null;

    if (submissionId) {
      submission = await this.prisma.laporan_guru_asuh_submissions.findUnique({
        where: { id: submissionId },
      });
    } else if (nip && bulan && tahun) {
      submission = await this.prisma.laporan_guru_asuh_submissions.findUnique({
        where: {
          nip_bulan_tahun: {
            nip,
            bulan: parseInt(bulan, 10),
            tahun: parseInt(tahun, 10),
          },
        },
      });
    }

    const targetNip = submission?.nip || nip;
    const targetBulan = submission?.bulan || (bulan ? parseInt(bulan, 10) : undefined);
    const targetTahun = submission?.tahun || (tahun ? parseInt(tahun, 10) : undefined);

    const isApproverUser = await this.isApprover(user);
    const canViewAll =
      isApproverUser ||
      user?.roles?.includes('BENDAHARA_KOMITE') ||
      user?.role === 'ADMIN';

    if (!canViewAll && (!targetNip || user?.nip !== targetNip)) {
      throw new ForbiddenException('Anda hanya berhak melihat data laporan milik sendiri.');
    }
    if (!targetNip && !submission) {
      throw new BadRequestException('Parameter submissionId atau nip tidak valid.');
    }

    let entries: any[] = [];
    if (submission?.id) {
      entries = await this.prisma.laporan_guru_asuh.findMany({
        where: { submission_id: submission.id },
        include: { guru_asuh: true },
        orderBy: { tanggal: 'asc' },
      });
    } else if (targetNip && targetBulan && targetTahun) {
      const startDate = new Date(targetTahun, targetBulan - 1, 1);
      const lastDay = new Date(targetTahun, targetBulan, 0).getDate();
      const endDate = new Date(targetTahun, targetBulan - 1, lastDay, 23, 59, 59, 999);
      entries = await this.prisma.laporan_guru_asuh.findMany({
        where: {
          nip: targetNip,
          tanggal: { gte: startDate, lte: endDate },
        },
        include: { guru_asuh: true },
        orderBy: { tanggal: 'asc' },
      });
    }

    const [guru, fosterStudents, profil, approverUser] = await Promise.all([
      targetNip
        ? this.prisma.master_guru.findUnique({
            where: { nip: targetNip },
            select: { nip: true, nama_lengkap: true, jenis_pegawai: true },
          })
        : null,
      targetNip
        ? this.prisma.guru_asuh.findMany({
            where: { nip: targetNip, aktif: true },
            select: { nisn_siswa: true, nama_siswa: true, kelas: true },
            orderBy: { nama_siswa: 'asc' },
          })
        : [],
      this.prisma.profil_sekolah.findFirst(),
      submission?.approved_by
        ? this.prisma.public_users.findFirst({
            where: { auth_id: submission.approved_by },
            select: { nip: true, nama: true },
          })
        : null,
    ]);

    return {
      ok: true,
      data: {
        submission: serializeBigInt(submission),
        entries: serializeBigInt(entries),
        guru: serializeBigInt(guru),
        fosterStudents: serializeBigInt(fosterStudents),
        profil: serializeBigInt(profil),
        approverNip: approverUser?.nip || '-',
      },
    };
  }

  async updatePdfUrl(user: any, id: string, pdf_url: string) {
    if (!id || !pdf_url) throw new BadRequestException('id dan pdf_url wajib diisi');

    const trimmedUrl = String(pdf_url).trim();
    if (!trimmedUrl.startsWith('https://') && !trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('/')) {
      throw new BadRequestException('Format URL dokumen tidak valid.');
    }
    if (trimmedUrl.includes('169.254.169.254') || trimmedUrl.includes('metadata.google.internal')) {
      throw new BadRequestException('URL dokumen tidak diizinkan.');
    }

    const submission = await this.prisma.laporan_guru_asuh_submissions.findUnique({
      where: { id },
      select: { id: true, nip: true },
    });
    if (!submission) throw new NotFoundException('Ajuan laporan tidak ditemukan');

    const isApproverUser = await this.isApprover(user);
    const isAuthorized =
      isApproverUser ||
      user.role === 'ADMIN' ||
      user.nip === submission.nip;
    if (!isAuthorized) {
      throw new ForbiddenException('Anda tidak berwenang memperbarui tautan dokumen ini.');
    }

    const updated = await this.prisma.laporan_guru_asuh_submissions.update({
      where: { id },
      data: { pdf_url, updated_at: new Date() },
    });
    return { ok: true, data: serializeBigInt(updated) };
  }

  async bulkCopy(body: any, user: any) {
    const { nip, from_tahun_ajaran, to_tahun_ajaran } = body;
    if (!nip || !from_tahun_ajaran || !to_tahun_ajaran) {
      throw new BadRequestException('NIP, Tahun Ajaran Asal, dan Tahun Ajaran Tujuan wajib diisi.');
    }
    if (from_tahun_ajaran === to_tahun_ajaran) {
      throw new BadRequestException('Tahun ajaran asal dan tujuan tidak boleh sama.');
    }

    const isAdmin = user.isAdmin || user.roles?.includes('ADMIN') || user.roles?.includes('ADMINISTRATOR');
    if (!isAdmin && user.nip !== String(nip).trim()) {
      throw new ForbiddenException('Anda hanya bisa menyalin data siswa asuh Anda sendiri.');
    }

    const guru = await this.prisma.master_guru.findFirst({
      where: { nip: String(nip).trim() },
      select: { nip: true, nama_lengkap: true },
    });
    if (!guru) throw new BadRequestException(`NIP ${nip} tidak ditemukan di Master Guru.`);

    const oldClaims = await this.prisma.guru_asuh.findMany({
      where: { nip, tahun_ajaran: from_tahun_ajaran, aktif: true },
      select: { nisn_siswa: true, nama_siswa: true },
    });
    if (!oldClaims || oldClaims.length === 0) {
      throw new NotFoundException(`Tidak ada data siswa asuh aktif di Tahun Ajaran ${from_tahun_ajaran}.`);
    }

    const oldNisns = oldClaims.map((c) => c.nisn_siswa).filter(Boolean) as string[];

    const masterKelasData = await this.prisma.master_kelas.findMany({
      select: { nama: true, kode: true, program: true },
    });

    const isRegularClass = (clsName: string) => {
      if (!masterKelasData) return true;
      const mk = masterKelasData.find((k) => k.nama === clsName);
      return !!mk && !mk.kode && (!mk.program || mk.program === 'Reguler');
    };

    const newClasses = await this.prisma.siswa_kelas.findMany({
      where: { tahun_ajaran: to_tahun_ajaran, nisn: { in: oldNisns } },
      select: { nisn: true, nama_siswa: true, kelas: true },
    });
    if (!newClasses || newClasses.length === 0) {
      throw new NotFoundException(`Siswa asuh dari tahun lalu belum terdaftar/diplot kelasnya di Tahun Ajaran ${to_tahun_ajaran}.`);
    }

    const newClassMap = new Map();
    newClasses.forEach((nc) => {
      if (isRegularClass(nc.kelas)) {
        newClassMap.set(nc.nisn, nc);
      }
    });

    const existingClaims = await this.prisma.guru_asuh.findMany({
      where: { tahun_ajaran: to_tahun_ajaran, aktif: true, nisn_siswa: { in: oldNisns } },
      select: { nisn_siswa: true },
    });

    const alreadyClaimedNisns = new Set(existingClaims.map((c) => c.nisn_siswa));

    const payloads: any[] = [];
    let skippedGraduated = 0;
    let skippedAlreadyClaimed = 0;

    for (const oldClaim of oldClaims) {
      const nc = newClassMap.get(oldClaim.nisn_siswa);
      if (!nc) {
        skippedGraduated++;
        continue;
      }
      if (alreadyClaimedNisns.has(oldClaim.nisn_siswa)) {
        skippedAlreadyClaimed++;
        continue;
      }

      payloads.push({
        nip: guru.nip,
        nama_guru: guru.nama_lengkap,
        nisn_siswa: nc.nisn,
        nama_siswa: nc.nama_siswa,
        kelas: nc.kelas,
        tahun_ajaran: to_tahun_ajaran,
        aktif: true,
      });
    }

    if (payloads.length === 0) {
      throw new BadRequestException(`Tidak ada siswa yang bisa disalin. ${skippedGraduated} tidak terdaftar di tahun ajaran baru, ${skippedAlreadyClaimed} sudah diklaim.`);
    }

    if (!isAdmin) {
      const currentClaimCount = await this.prisma.guru_asuh.count({
        where: { nip: guru.nip, tahun_ajaran: to_tahun_ajaran, aktif: true },
      });
      const MAX_SISWA_ASUH = 50;
      if (currentClaimCount + payloads.length > MAX_SISWA_ASUH) {
        throw new BadRequestException(
          `Batas maksimal kuota siswa asuh (${MAX_SISWA_ASUH} siswa) akan terlampaui. Saat ini Anda memiliki ${currentClaimCount} siswa aktif di TA ${to_tahun_ajaran}, dan mencoba menyalin ${payloads.length} siswa lagi. Hubungi Admin jika memerlukan penambahan kuota.`,
        );
      }
    }

    await this.prisma.guru_asuh.createMany({
      data: payloads,
    });

    let msg = `Berhasil menyalin ${payloads.length} siswa asuh dengan kelas terbaru!`;
    if (skippedGraduated > 0 || skippedAlreadyClaimed > 0) {
      msg += ` (${skippedGraduated} tidak terdaftar di tahun baru, ${skippedAlreadyClaimed} dilewati karena sudah diklaim).`;
    }

    return { ok: true, message: msg, copiedCount: payloads.length };
  }
}

