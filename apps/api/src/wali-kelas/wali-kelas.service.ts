import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  resolveTahunAjaranSemester,
  calcDailyAttendanceMinutes,
  dominantStatus,
} from './attendance-calc';

function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (obj && typeof obj.toJSON === 'function') return obj.toJSON();
  if (typeof obj === 'bigint') return obj.toString();
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

export function toLocalDateStr(d: any): string {
  if (!d) return '';
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return '';
  return dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
}

@Injectable()
export class WaliKelasService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveUser(user: any) {
    const roles: string[] = Array.isArray(user?.roles)
      ? user.roles.map((r: string) => String(r).toUpperCase())
      : user?.role
        ? String(user.role).split(/[,|]/).map((r: string) => r.trim().toUpperCase()).filter(Boolean)
        : [];
    const isAdmin = roles.includes('ADMIN') || roles.includes('ADMINISTRATOR');
    const nip = user?.nip || user?.username || '';
    return { roles, isAdmin, nip };
  }

  async getAbsensiAkumulasi(query: any, user: any) {
    const { isAdmin, nip: userNip } = this.resolveUser(user);
    const userNips = [user?.nip, user?.username, userNip].map((s) => String(s || '').trim()).filter(Boolean);
    const nip = isAdmin && query.nip ? query.nip : userNip;
    const kelas = query.kelas;
    const tanggal = query.tanggal;
    const bulanParam = query.bulan; // YYYY-MM
    const mode = query.mode || 'default';
    const tahunAjaranParam = query.tahun_ajaran;

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

    const { tahunAjaran: computedTahunAjaran, semester, semesterStr } =
      resolveTahunAjaranSemester(`${targetYear}-${String(targetMonth).padStart(2, '0')}`);
    const tahunAjaran = tahunAjaranParam || computedTahunAjaran;

    // Mode: kelas_list
    if (mode === 'kelas_list') {
      if (!nip && !isAdmin) {
        throw new BadRequestException('NIP wajib diisi untuk mode kelas_list');
      }

      if (isAdmin) {
        const waliClasses = await this.prisma.wali_kelas.findMany({
          where: { tahun_ajaran: tahunAjaran, aktif: true },
          select: { nama_kelas: true },
        });

        const activeClassNames = waliClasses.map((w) => w.nama_kelas);
        if (activeClassNames.length > 0) {
          const mk = await this.prisma.master_kelas.findMany({
            where: {
              aktif: true,
              program: 'Reguler',
              nama: { in: activeClassNames },
            },
            select: { nama: true },
            orderBy: { nama: 'asc' },
          });
          return { ok: true, kelas_list: mk.map((k) => k.nama) };
        }
        return { ok: true, kelas_list: [] };
      } else {
        const waliKelas = await this.prisma.wali_kelas.findMany({
          where: { nip: { in: userNips }, tahun_ajaran: tahunAjaran, aktif: true },
          select: { nama_kelas: true },
          orderBy: { nama_kelas: 'asc' },
        });

        const kelasNames = waliKelas.map((w) => w.nama_kelas);
        if (kelasNames.length > 0) {
          const mk = await this.prisma.master_kelas.findMany({
            where: {
              program: 'Reguler',
              nama: { in: kelasNames },
            },
            select: { nama: true },
          });
          const regulerNames = new Set(mk.map((k) => k.nama));
          return { ok: true, kelas_list: kelasNames.filter((k) => regulerNames.has(k)) };
        }
        return { ok: true, kelas_list: [] };
      }
    }

    // Default mode: hitung akumulasi
    if (!nip && !isAdmin) {
      throw new BadRequestException('NIP wajib diisi');
    }
    if (!kelas) {
      throw new BadRequestException('Kelas wajib dipilih');
    }

    // Validasi otorisasi: non-admin hanya dapat melihat rekap kelas perwaliannya
    if (!isAdmin) {
      const waliRow = await this.prisma.wali_kelas.findFirst({
        where: {
          nip: { in: userNips },
          nama_kelas: kelas,
          tahun_ajaran: tahunAjaran,
          aktif: true,
        },
      });
      if (!waliRow) {
        throw new ForbiddenException(`Anda bukan wali kelas untuk kelas ${kelas}`);
      }
    }

    let startDate: string;
    let endDate: string;
    const isDaily = !!tanggal;

    if (tanggal) {
      startDate = tanggal;
      endDate = tanggal;
    } else if (bulanParam) {
      startDate = `${bulanParam}-01`;
      const [y, m] = bulanParam.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      endDate = `${bulanParam}-${String(lastDay).padStart(2, '0')}`;
    } else {
      // Default ke bulan berjalan penuh jika bulan dan tanggal tidak disertakan
      const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      startDate = `${nowStr}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      endDate = `${nowStr}-${String(lastDay).padStart(2, '0')}`;
    }

    // Cek snapshot yang terkunci
    if (!isDaily && bulanParam) {
      const lockRow = await this.prisma.absensi_rekap_lock.findFirst({
        where: { kelas, bulan: bulanParam },
      });

      if (lockRow) {
        return {
          ok: true,
          ...((lockRow.snapshot as any) || {}),
          locked: true,
          locked_at: lockRow.locked_at,
          locked_by_nama: lockRow.locked_by_nama,
        };
      }
    }

    // Hitung live
    const result = await this.computeRekapKelas({
      kelas,
      tahunAjaran,
      semesterStr,
      semester,
      startDate,
      endDate,
      isDaily,
    });

    return { ok: true, ...result, locked: false };
  }

  async computeRekapKelas(params: {
    kelas: string;
    tahunAjaran: string;
    semesterStr: string;
    semester: number;
    startDate: string;
    endDate: string;
    isDaily: boolean;
  }) {
    const { kelas, tahunAjaran, semesterStr, semester, startDate, endDate, isDaily } = params;

    const startD = new Date(`${startDate}T00:00:00+08:00`);
    const endD = new Date(`${endDate}T23:59:59.999+08:00`);

    const [liburRows, kelasInfo, siswaList] = await Promise.all([
      this.prisma.libur.findMany({
        where: {
          tanggal: {
            gte: startD,
            lte: endD,
          },
        },
      }),
      this.prisma.master_kelas.findFirst({
        where: { nama: kelas },
        select: { tingkat: true },
      }),
      this.prisma.siswa_kelas.findMany({
        where: {
          kelas,
          tahun_ajaran: tahunAjaran,
          semester: semesterStr,
          aktif: true,
        },
        select: { nisn: true, nama_siswa: true },
      }),
    ]);

    const holidays = liburRows.filter((h) => {
      const jam = String(h.jam_ke || '').trim().toLowerCase();
      return jam === 'semua' || jam === '';
    });

    const finalSiswaList = (siswaList || []).filter(
      (v, i, a) => a.findIndex((t) => t.nisn === v.nisn) === i,
    );

    if (finalSiswaList.length === 0) {
      return {
        kelas,
        tahun_ajaran: tahunAjaran,
        semester,
        periode: { start: startDate, end: endDate, type: isDaily ? 'harian' : 'bulanan' },
        siswa: [],
        holidays: serializeBigInt(holidays),
        summary: {
          total: 0,
          hadir_count: 0,
          izin_count: 0,
          sakit_count: 0,
          alpha_count: 0,
          total_hari_hadir: 0,
          total_hari_izin: 0,
          total_hari_sakit: 0,
          total_hari_alpha: 0,
        },
      };
    }

    const nisnList = finalSiswaList.map((s) => s.nisn);

    const [ketidakhadiranList, sesiList] = await Promise.all([
      this.prisma.ketidakhadiran.findMany({
        where: {
          kelas,
          aktif: true,
          tgl_mulai: { lte: endD },
          tgl_selesai: { gte: startD },
        },
      }),
      this.prisma.absensi_sesi.findMany({
        where: {
          kelas,
          status_sesi: 'FINAL',
          tanggal: {
            gte: startD,
            lte: endD,
          },
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

    // Buat daftar tanggal rentang (YYYY-MM-DD lokal)
    const daysInRange: string[] = [];
    const curr = new Date(`${startDate}T12:00:00+08:00`);
    const endLimit = new Date(`${endDate}T12:00:00+08:00`);
    while (curr <= endLimit) {
      daysInRange.push(toLocalDateStr(curr));
      curr.setDate(curr.getDate() + 1);
    }

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
    const holidayDates = new Set(
      holidays.map((h) => toLocalDateStr(h.tanggal)),
    );

    const studentData = finalSiswaList.map((siswa) => {
      const nisn = siswa.nisn;
      let countHadir = 0;
      let countIzin = 0;
      let countSakit = 0;
      let countAlpha = 0;
      const dailyStatus: Record<string, string> = {};
      const ketidakhadiranDetail: Record<
        string,
        { jenis: string; keterangan: string; tgl_mulai: string; tgl_selesai: string }
      > = {};

      daysInRange.forEach((dateStr) => {
        let status = '';
        if (dateStr > todayStr) {
          status = '';
        } else {
          const isHoliday = holidayDates.has(dateStr);
          const isWeekend = [0, 6].includes(new Date(`${dateStr}T12:00:00+08:00`).getDay());

          if (isHoliday || isWeekend) {
            status = isHoliday ? 'L' : 'W';
          } else {
            const khHariIni = ketidakhadiranList.filter((k) => {
              if (k.nisn !== nisn) return false;
              const kStart = toLocalDateStr(k.tgl_mulai);
              const kEnd = toLocalDateStr(k.tgl_selesai);
              return kStart <= dateStr && kEnd >= dateStr;
            });
            const daySessions = sesiList.filter(
              (s) => toLocalDateStr(s.tanggal) === dateStr,
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
                tgl_mulai: toLocalDateStr(k.tgl_mulai),
                tgl_selesai: toLocalDateStr(k.tgl_selesai),
              })),
              absensiDetailHariIni,
              dateStr,
            );
            status = dominantStatus(minutes).charAt(0);

            if (status === 'I' || status === 'S' || status === 'A') {
              const kt = khHariIni[0];
              ketidakhadiranDetail[dateStr] = kt
                ? {
                    jenis: kt.jenis || status,
                    keterangan: kt.keterangan || '',
                    tgl_mulai: toLocalDateStr(kt.tgl_mulai),
                    tgl_selesai: toLocalDateStr(kt.tgl_selesai),
                  }
                : {
                    jenis: status === 'I' ? 'Izin' : status === 'S' ? 'Sakit' : 'Alpha',
                    keterangan: 'Dicatat oleh guru di jurnal kelas',
                    tgl_mulai: dateStr,
                    tgl_selesai: dateStr,
                  };
            }

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
        kelas,
        hadir: countHadir,
        izin: countIzin,
        sakit: countSakit,
        alpha: countAlpha,
        total: countHadir + countIzin + countSakit + countAlpha,
        daily: dailyStatus,
        ktDetail: Object.keys(ketidakhadiranDetail).length > 0 ? ketidakhadiranDetail : null,
      };
    });

    studentData.sort((a, b) => a.nama.localeCompare(b.nama));

    const summary = {
      total: studentData.length,
      hadir_count: studentData.filter(
        (s) => s.hadir > 0 && s.alpha === 0 && s.sakit === 0 && s.izin === 0,
      ).length,
      izin_count: studentData.filter((s) => s.izin > 0).length,
      sakit_count: studentData.filter((s) => s.sakit > 0).length,
      alpha_count: studentData.filter((s) => s.alpha > 0).length,
      total_hari_hadir: studentData.reduce((acc, s) => acc + s.hadir, 0),
      total_hari_izin: studentData.reduce((acc, s) => acc + s.izin, 0),
      total_hari_sakit: studentData.reduce((acc, s) => acc + s.sakit, 0),
      total_hari_alpha: studentData.reduce((acc, s) => acc + s.alpha, 0),
    };

    return {
      kelas,
      tahun_ajaran: tahunAjaran,
      semester,
      periode: {
        start: startDate,
        end: endDate,
        type: isDaily ? 'harian' : 'bulanan',
      },
      siswa: studentData,
      holidays: serializeBigInt(holidays),
      summary,
    };
  }

  async lockAbsensi(body: any, user: any) {
    const { kelas, bulan } = body;
    if (!kelas || !bulan || !/^\d{4}-\d{2}$/.test(bulan)) {
      throw new BadRequestException('kelas dan bulan (YYYY-MM) wajib diisi');
    }

    const { tahunAjaran, semester, semesterStr } = resolveTahunAjaranSemester(bulan);
    const { isAdmin, nip: userNip } = this.resolveUser(user);

    if (!isAdmin) {
      const waliRow = await this.prisma.wali_kelas.findFirst({
        where: {
          nip: userNip,
          nama_kelas: kelas,
          tahun_ajaran: tahunAjaran,
          aktif: true,
        },
      });
      if (!waliRow) {
        throw new ForbiddenException('Anda bukan wali kelas untuk kelas ini');
      }
    }

    const now = new Date();
    const currentBulan = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (bulan >= currentBulan) {
      throw new BadRequestException('Hanya bulan yang sudah selesai yang bisa dikunci');
    }

    const startDate = `${bulan}-01`;
    const [y, m] = bulan.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${bulan}-${String(lastDay).padStart(2, '0')}`;

    const snapshot = await this.computeRekapKelas({
      kelas,
      tahunAjaran,
      semesterStr,
      semester,
      startDate,
      endDate,
      isDaily: false,
    });

    const reviewer = await this.prisma.public_users.findFirst({
      where: { nip: user.nip },
      select: { nama: true },
    });
    const lockedByNama = reviewer?.nama || user.nama || user.nip;

    const existingLock = await this.prisma.absensi_rekap_lock.findFirst({
      where: { kelas, bulan },
    });

    const nowIso = new Date();
    if (existingLock) {
      await this.prisma.absensi_rekap_lock.update({
        where: { id: existingLock.id },
        data: {
          tahun_ajaran: tahunAjaran,
          snapshot: snapshot as any,
          locked_by_nip: user.nip,
          locked_by_nama: lockedByNama,
          locked_at: nowIso,
        },
      });
    } else {
      await this.prisma.absensi_rekap_lock.create({
        data: {
          kelas,
          bulan,
          tahun_ajaran: tahunAjaran,
          snapshot: snapshot as any,
          locked_by_nip: user.nip,
          locked_by_nama: lockedByNama,
          locked_at: nowIso,
        },
      });
    }

    return {
      ok: true,
      locked_at: nowIso.toISOString(),
      locked_by_nama: lockedByNama,
    };
  }

  async unlockAbsensi(body: any, user: any) {
    const { kelas, bulan } = body;
    if (!kelas || !bulan || !/^\d{4}-\d{2}$/.test(bulan)) {
      throw new BadRequestException('kelas dan bulan (YYYY-MM) wajib diisi');
    }

    const { tahunAjaran } = resolveTahunAjaranSemester(bulan);
    const { isAdmin, nip: userNip } = this.resolveUser(user);

    if (!isAdmin) {
      const waliRow = await this.prisma.wali_kelas.findFirst({
        where: {
          nip: userNip,
          nama_kelas: kelas,
          tahun_ajaran: tahunAjaran,
          aktif: true,
        },
      });
      if (!waliRow) {
        throw new ForbiddenException('Anda bukan wali kelas untuk kelas ini');
      }
    }

    await this.prisma.absensi_rekap_lock.deleteMany({
      where: { kelas, bulan },
    });

    return { ok: true };
  }

  async getEkskul(query: any, user: any) {
    const { kelas, tahun_ajaran, semester } = query;
    if (!kelas || !tahun_ajaran || !semester) {
      throw new BadRequestException('Parameter kelas, tahun_ajaran, dan semester wajib diisi');
    }

    const { isAdmin, nip: userNip } = this.resolveUser(user);

    if (!isAdmin) {
      const waliRow = await this.prisma.wali_kelas.findFirst({
        where: {
          nip: userNip,
          nama_kelas: kelas,
          tahun_ajaran,
          aktif: true,
        },
      });
      if (!waliRow) {
        throw new ForbiddenException(`Anda bukan wali kelas untuk kelas ${kelas}`);
      }
    }

    const isSemua = semester === 'Semua';
    let semNum = 1;
    let semText = 'Ganjil';
    if (semester === '2' || String(semester).toLowerCase() === 'genap') {
      semNum = 2;
      semText = 'Genap';
    }

    const siswaKelasQuery: any = {
      kelas,
      tahun_ajaran,
      aktif: true,
    };
    if (!isSemua) {
      siswaKelasQuery.semester = semText;
    }

    const siswaList = await this.prisma.siswa_kelas.findMany({
      where: siswaKelasQuery,
      select: { nisn: true, nama_siswa: true },
      orderBy: { nama_siswa: 'asc' },
    });

    const finalSiswaList = (siswaList || []).filter(
      (v, i, a) => a.findIndex((t) => t.nisn === v.nisn) === i,
    );

    if (finalSiswaList.length === 0) {
      return { ok: true, data: [] };
    }

    const nisnList = finalSiswaList.map((s) => s.nisn);
    const masterSiswa = await this.prisma.master_siswa.findMany({
      where: { nisn: { in: nisnList } },
      select: { id: true, nisn: true },
    });

    const idToNisnMap: Record<string, string> = {};
    masterSiswa.forEach((m) => {
      if (m.nisn) idToNisnMap[m.id.toString()] = m.nisn;
    });

    const idList = Object.keys(idToNisnMap).map((id) => BigInt(id));
    const ekskulMap: Record<string, any[]> = {};

    if (idList.length > 0) {
      const ekskulWhere: any = {
        siswa_id: { in: idList },
        tahun_ajaran,
      };
      if (!isSemua) {
        ekskulWhere.semester = semNum;
      }

      const ekskulData = await this.prisma.ekskul_siswa.findMany({
        where: ekskulWhere,
        include: {
          ekskul: { select: { nama_ekskul: true } },
        },
      });

      ekskulData.forEach((row) => {
        const nisn = idToNisnMap[row.siswa_id.toString()];
        const namaEkskul = row.ekskul?.nama_ekskul || 'Ekskul';
        if (nisn) {
          if (!ekskulMap[nisn]) ekskulMap[nisn] = [];
          if (!ekskulMap[nisn].some((e) => e.nama_ekskul === namaEkskul)) {
            ekskulMap[nisn].push({ nama_ekskul: namaEkskul });
          }
        }
      });
    }

    const resultData = finalSiswaList.map((siswa) => ({
      nisn: siswa.nisn,
      nama: siswa.nama_siswa,
      kelas,
      ekskul: ekskulMap[siswa.nisn] || [],
    }));

    return { ok: true, data: resultData };
  }
}
