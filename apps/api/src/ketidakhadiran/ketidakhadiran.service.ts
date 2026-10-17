import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { randomUUID, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { resolveStudentNisn } from '../common/student-identity';
import { uksRecommendationSigner } from '@acca/shared/medical-letter-signer.cjs';
import { absenceJp, boundedInt, canManageJenis, medicalStatus, validDate, validatePeriod, validateQuery, validateStatus, validateText } from './ketidakhadiran-validation';

export interface KetidakhadiranFilter {
  kelas?: string;
  jenis?: string;
  status?: string;
  from?: string;
  to?: string;
  q?: string;
  months?: string;
  page?: number;
  limit?: number;
  asramaQueue?: boolean;
}

const ASRAMA_STATUS = ['Sedang', 'Berat', 'Kontrol'];

function toDateString(d: Date | string | null): string | null {
  if (!d) return null;
  if (typeof d === 'string') return d.split('T')[0];
  if (d instanceof Date) {
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  }
  return null;
}

function toTimeString(d: Date | string | null): string | null {
  if (!d) return null;
  if (typeof d === 'string') {
    if (d.includes('T')) return d.split('T')[1].slice(0, 5);
    return d.slice(0, 5);
  }
  if (d instanceof Date) {
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[1].slice(0, 5);
  }
  return null;
}

function parseTimeToDate(t: string | Date | null | undefined): Date | null {
  if (!t) return null;
  if (t instanceof Date) {
    if (isNaN(t.getTime())) return null;
    return t;
  }
  const str = String(t).trim();
  const timeOnly = str.includes('T') ? str.split('T')[1].slice(0, 8) : str.slice(0, 8);
  const formatted = timeOnly.length === 5 ? `${timeOnly}:00` : timeOnly;
  const d = new Date(`1970-01-01T${formatted}Z`);
  return isNaN(d.getTime()) ? null : d;
}

function calcHariKalender(tglMulai: string | Date, tglSelesai: string | Date | null): number {
  if (!tglMulai) return 0;
  const d1 = new Date(tglMulai);
  const d2 = tglSelesai ? new Date(tglSelesai) : d1;
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

@Injectable()
export class KetidakhadiranService {
  private readonly logger = new Logger(KetidakhadiranService.name);

  constructor(private readonly prisma: PrismaService) {}

  private inTransaction = false;

  // The same lock is used by Next's letter renderer. It serializes numbering,
  // group changes and medical synchronization without changing existing tables.
  private async atomic<T>(work: (service: KetidakhadiranService) => Promise<T>, user: any, action: string, entityId?: string): Promise<T> {
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(424201)`;
      const service = new KetidakhadiranService(tx as unknown as PrismaService);
      service.inTransaction = true;
      const result = await work(service);
      await tx.audit_logs.create({ data: {
        user_id: String(user?.authId || user?.id || ''), user_nip: user?.nip || null,
        user_name: String(user?.nama_lengkap || user?.nama || '').slice(0, 100),
        user_role: (user?.roles || []).join(',').slice(0, 100), action,
        entity: action.includes('MEDICAL') ? 'rekam_medis_siswa' : action.includes('LETTER') ? 'acca_letters' : 'ketidakhadiran',
        entity_id: entityId || (result as any)?.data?.id || null,
        details: { outcome: (result as any)?.ok === false ? 'rejected' : 'success' },
      } });
      return result;
    }, { timeout: 20000, maxWait: 10000 });
  }

  private isUks(user: any): boolean {
    return !!user?.isAdmin || user?.roles?.some((r: string) => ['ADMIN', 'ADMINISTRATOR', 'OP_UKS'].includes(r)) === true;
  }

  private safeAbsence(row: any, user: any): any {
    if (this.isUks(user)) return row;
    const { rekam_medis_siswa, acca_letters, ...safe } = row;
    if (row.jenis === 'SAKIT') {
      Object.assign(safe, { keterangan: 'Sakit', tindakan: null, tindak_lanjut: null, file_url: null,
        rekam_medis_id: null, rekom_kontrol_barcode: null, letter_barcode: null, letter_file_url: null });
    }
    return safe;
  }

  private async readScope(user: any): Promise<any> {
    if (!user) throw new ForbiddenException('Sesi tidak dikenali');
    const roles = user.roles || [];
    if (user.isAdmin || roles.some((r: string) => ['ADMIN', 'ADMINISTRATOR', 'OP_IZIN', 'OP_UKS'].includes(r))) return {};
    if (roles.includes('SISWA')) return { nisn: await resolveStudentNisn(this.prisma, user) || '__none__' };
    if (roles.some((r: string) => ['ORANG_TUA', 'ORANGTUA'].includes(r))) {
      const links = await this.prisma.orangtua_siswa.findMany({ where: { user_id: BigInt(user.id) }, select: { nisn: true } });
      return { nisn: { in: links.map(x => x.nisn) } };
    }
    if (!roles.some((r: string) => ['GURU', 'WALI_KELAS', 'GURU_ASUH'].includes(r))) throw new ForbiddenException('Akses ditolak');
    const nip = user.nip || user.username;
    if (!nip) throw new ForbiddenException('Identitas pegawai tidak tersedia');
    const [asuh, wali, jadwal] = await Promise.all([
      this.prisma.guru_asuh.findMany({ where: { nip, aktif: true }, select: { nisn_siswa: true } }),
      this.prisma.wali_kelas.findMany({ where: { nip, aktif: true }, select: { nama_kelas: true } }),
      this.prisma.jadwal_guru.findMany({ where: { nip, aktif: true }, select: { kelas: true } }),
    ]);
    return { OR: [{ nisn: { in: asuh.map(x => x.nisn_siswa) } }, { kelas: { in: [...wali.map(x => x.nama_kelas), ...jadwal.map(x => x.kelas)] } }] };
  }

  private async statusFor(followup: string): Promise<string> {
    return medicalStatus(followup, (await this.getPresets()).data);
  }

  private async getSchoolToday(): Promise<string> {
    const setting = await this.prisma.site_settings.findUnique({ where: { key: 'timezone' }, select: { value: true } });
    const zone = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'].includes(setting?.value || '')
      ? setting!.value! : 'Asia/Makassar';
    return new Date().toLocaleDateString('en-CA', { timeZone: zone });
  }

  /**
   * Mengambil seluruh nama kelas reguler yang terdaftar dan aktif di master_kelas.
   */
  async getRegulerKelasNames(): Promise<string[]> {
    const rows = await this.prisma.master_kelas.findMany({
      where: { program: 'Reguler', aktif: true },
      select: { nama: true },
      orderBy: { nama: 'asc' },
    });
    return rows.map((r) => r.nama);
  }

  /**
   * Menentukan kelas reguler siswa secara ketat:
   * 1. Jika ada fallbackKelas dan terdaftar sebagai kelas reguler, gunakan itu.
   * 2. Cari di siswa_kelas dengan whitelist nama kelas reguler, diurutkan tahun ajaran terbaru.
   */
  async resolveSiswaKelasReguler(
    nisn: string,
    fallbackKelas?: string | null,
    regulerNamesCache?: string[],
  ): Promise<{ kelas: string; nama?: string }> {
    const regulerNames = regulerNamesCache || (await this.getRegulerKelasNames());
    if (fallbackKelas && regulerNames.includes(fallbackKelas)) {
      return { kelas: fallbackKelas };
    }
    const sk = await this.prisma.siswa_kelas.findFirst({
      where: {
        nisn,
        aktif: true,
        kelas: { in: regulerNames },
      },
      select: { kelas: true, nama_siswa: true },
      orderBy: [{ tahun_ajaran: 'desc' }, { created_at: 'desc' }],
    });
    return { kelas: sk?.kelas || fallbackKelas || '', nama: sk?.nama_siswa };
  }

  async findAll(apiUser: any, filter: KetidakhadiranFilter) {
    validateQuery(filter);
    const scope = await this.readScope(apiUser);
    const { kelas, jenis, status, from, to, q, page, limit, asramaQueue } = filter;

    const where: any = {
      aktif: true,
    };

    if (kelas) {
      where.kelas = kelas;
    }

    if (asramaQueue) {
      where.jenis = 'SAKIT';
      if (status && ASRAMA_STATUS.includes(status)) {
        where.status = status;
      } else {
        where.status = { in: ASRAMA_STATUS };
      }
    } else {
      if (jenis) where.jenis = jenis;
      if (status) where.status = status;
    }

    if (from || to) {
      const fromStr = String(from || to).split('T')[0];
      const toStr = String(to || from).split('T')[0];
      const fromDate = validDate(fromStr);
      const toDate = validDate(toStr);
      if (toDate < fromDate) throw new BadRequestException('Rentang tanggal tidak valid');

      where.tgl_mulai = { lte: toDate };
      where.tgl_selesai = { gte: fromDate };
    }

    if (q) {
      where.OR = [
        { nisn: { contains: q, mode: 'insensitive' } },
        { nama: { contains: q, mode: 'insensitive' } },
        { kelas: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Role-based visibility: allow viewing when kelas parameter is present (e.g. attendance taking) or for allowed roles
    if (!apiUser.isAdmin && !asramaQueue && !kelas) {
      const roles: string[] = Array.isArray(apiUser.roles) ? apiUser.roles : [];
      const canViewIzin = roles.includes('OP_IZIN') || roles.includes('ADMIN') || roles.includes('GURU') || roles.includes('WALI_KELAS');
      const canViewSakit = roles.includes('OP_UKS') || roles.includes('ADMIN') || roles.includes('GURU') || roles.includes('WALI_KELAS');

      if (canViewIzin && !canViewSakit) {
        where.jenis = 'IZIN';
      } else if (canViewSakit && !canViewIzin) {
        where.jenis = 'SAKIT';
      }
    }


    where.AND = [scope];
    const isPaginated = !!(page || limit);
    const take = boundedInt(limit, 20, 100);
    const skip = (boundedInt(page, 1, 100000) - 1) * take;

    const [total, items] = await Promise.all([
      this.prisma.ketidakhadiran.count({ where }),
      this.prisma.ketidakhadiran.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip, take: isPaginated ? take : 5000,
        include: {
          rekam_medis_siswa: {
            select: {
              id: true,
              no_rekam_medis: true,
            },
          },
          acca_letters: true,
        },
      }),
    ]);

    const nisnList = Array.from(new Set(items.map((i) => i.nisn).filter(Boolean)));
    let matchingLetters: any[] = [];
    let userProfiles: any[] = [];
    if (nisnList.length > 0) {
      [matchingLetters, userProfiles] = await Promise.all([
        this.prisma.acca_letters.findMany({
          where: {
            OR: [
              { siswa_nisn: { in: nisnList } },
              ...nisnList.map((n) => ({ siswa_nisn: { contains: n } })),
            ],
          },
          select: {
            id: true,
            nomor_surat: true,
            barcode: true,
            file_url: true,
            jenis_izin: true,
            siswa_nisn: true,
            tgl_mulai: true,
            tgl_selesai: true,
            ketidakhadiran_id: true,
          },
        }),
        this.prisma.public_users.findMany({
          where: {
            OR: [
              { username: { in: nisnList } },
              { nip: { in: nisnList } },
            ],
            foto_profil: { not: null },
          },
          select: { username: true, nip: true, foto_profil: true },
        }),
      ]);
    }

    const photoMap = new Map<string, string>();
    for (const up of userProfiles) {
      if (up.foto_profil) {
        if (up.username) photoMap.set(up.username, up.foto_profil);
        if (up.nip) photoMap.set(up.nip, up.foto_profil);
      }
    }

    // Overlap detection
    const byNisn: Record<string, any[]> = {};
    items.forEach((r) => {
      if (!byNisn[r.nisn]) byNisn[r.nisn] = [];
      byNisn[r.nisn].push(r);
    });

    const enriched = items.map((r) => {
      const hasOverlap = (byNisn[r.nisn] || []).some((other) => {
        if (other.id === r.id || other.jenis === r.jenis) return false;
        const startA = new Date(r.tgl_mulai);
        const endA = new Date(r.tgl_selesai || r.tgl_mulai);
        const startB = new Date(other.tgl_mulai);
        const endB = new Date(other.tgl_selesai || other.tgl_mulai);
        return startA <= endB && endA >= startB;
      });

      const tglMulaiStr = toDateString(r.tgl_mulai);
      const tglSelesaiStr = toDateString(r.tgl_selesai);

      const linkedLetters = r.acca_letters || [];
      const nisnLetters = matchingLetters.filter(
        (l: any) =>
          l.siswa_nisn === r.nisn ||
          (l.siswa_nisn && l.siswa_nisn.split(',').map((s: string) => s.trim()).includes(r.nisn)),
      );

      const asramaLetter =
        linkedLetters.find((l: any) =>
          ['MENINGGALKAN_ASRAMA', 'AKHIR_PEKAN'].includes(l.jenis_izin),
        ) ||
        nisnLetters.find(
          (l: any) =>
            (l.ketidakhadiran_id === r.id ||
              (l.tgl_mulai === tglMulaiStr && l.tgl_selesai === tglSelesaiStr)) &&
            ['MENINGGALKAN_ASRAMA', 'AKHIR_PEKAN'].includes(l.jenis_izin),
        );

      const rekomLetter =
        linkedLetters.find(
          (l: any) =>
            ['REKOMENDASI_KONTROL', 'REKAPAN_SAKIT'].includes(l.jenis_izin) ||
            l.nomor_surat?.includes('/UKS/'),
        ) ||
        nisnLetters.find(
          (l: any) =>
            (l.ketidakhadiran_id === r.id ||
              (l.tgl_mulai === tglMulaiStr && l.tgl_selesai === tglSelesaiStr)) &&
            (['REKOMENDASI_KONTROL', 'REKAPAN_SAKIT'].includes(l.jenis_izin) ||
              l.nomor_surat?.includes('/UKS/')),
        );

      return {
        ...r,
        file_size: r.file_size ? Number(r.file_size) : null,
        tgl_mulai: tglMulaiStr,
        tgl_selesai: tglSelesaiStr,
        waktu_mulai_real: toTimeString(r.waktu_mulai_real),
        waktu_selesai_real: toTimeString(r.waktu_selesai_real),
        has_overlap: hasOverlap,
        letter_issued: !!asramaLetter,
        letter_nomor: asramaLetter?.nomor_surat || null,
        letter_barcode: asramaLetter?.barcode || null,
        letter_file_url: asramaLetter?.file_url || null,
        rekom_kontrol_issued: !!rekomLetter,
        rekom_kontrol_nomor: rekomLetter?.nomor_surat || null,
        rekom_kontrol_barcode: rekomLetter?.barcode || null,
        foto_profil: photoMap.get(r.nisn) || null,
      };
    });

    return {
      data: enriched.map(row => this.safeAbsence(row, apiUser)),
      total,
      ...(isPaginated
        ? {
            pagination: {
              page: page || 1,
              limit: take,
              total,
              totalPages: Math.ceil(total / take),
            },
          }
        : {}),
    };
  }

  async findById(id: string, apiUser: any) {
    const scope = await this.readScope(apiUser);
    const item = await this.prisma.ketidakhadiran.findFirst({
      where: { id, AND: [scope] },
      include: {
        rekam_medis_siswa: this.isUks(apiUser),
        acca_letters: true,
      },
    });
    if (!item || !item.aktif) {
      throw new NotFoundException(`Data ketidakhadiran dengan ID ${id} tidak ditemukan`);
    }
    return {
      ...this.safeAbsence(item, apiUser),
      file_size: item.file_size ? Number(item.file_size) : null,
      tgl_mulai: toDateString(item.tgl_mulai),
      tgl_selesai: toDateString(item.tgl_selesai),
      waktu_mulai_real: toTimeString(item.waktu_mulai_real),
      waktu_selesai_real: toTimeString(item.waktu_selesai_real),
    };
  }

  async createBulk(apiUser: any, payload: any): Promise<any> {
    if (!this.inTransaction) return this.atomic(s => s.createBulk(apiUser, payload), apiUser, 'CREATE');
    const roles: string[] = Array.isArray(apiUser?.roles)
      ? apiUser.roles.map((r: string) => String(r).toUpperCase().replace(/\s+/g, '_'))
      : [];
    const isAdmin = apiUser?.isAdmin || roles.includes('ADMIN') || roles.includes('ADMINISTRATOR');

    validateText(payload);
    if ((payload.rows?.length || payload.nisList?.length || 0) > 500) throw new BadRequestException('Maksimal 500 siswa per permintaan');
    // 1. Dukungan Import Excel (payload.rows)
    if (Array.isArray(payload?.rows) && payload.rows.length > 0) {
      const rows = payload.rows;
      const results = [];
      const skippedDetails = [];
      let skippedCount = 0;
      const failedList: Array<{ nisn: string; nama?: string; error: string }> = [];
      const regulerNames = await this.getRegulerKelasNames();

      for (const r of rows) {
        if (!r || !r.nisn || !r.jenis || !r.tgl_mulai) continue;
        const nisnStr = String(r.nisn).trim();
        const rJenis = String(r.jenis).toUpperCase().trim() as 'IZIN' | 'SAKIT';

        if (rJenis !== 'IZIN' && rJenis !== 'SAKIT') {
          failedList.push({
            nisn: nisnStr,
            nama: r.nama || nisnStr,
            error: `Jenis ketidakhadiran tidak valid: ${r.jenis}. Harus IZIN atau SAKIT`,
          });
          continue;
        }

        if (!isAdmin) {
          if (rJenis === 'IZIN' && !roles.includes('OP_IZIN')) {
            failedList.push({
              nisn: nisnStr,
              nama: r.nama || nisnStr,
              error: 'Tidak memiliki hak akses untuk menambah data IZIN',
            });
            continue;
          }
          if (rJenis === 'SAKIT' && !roles.includes('OP_UKS')) {
            failedList.push({
              nisn: nisnStr,
              nama: r.nama || nisnStr,
              error: 'Tidak memiliki hak akses untuk menambah data SAKIT',
            });
            continue;
          }
        }

        try {
          validateText(r);
          validatePeriod(r);
          validateStatus(rJenis, r.status || (rJenis === 'IZIN' ? 'MADRASAH' : 'Ringan'));
          const [siswa, resolved] = await Promise.all([
            this.prisma.master_siswa.findFirst({
              where: { nisn: nisnStr },
              select: { nama_lengkap: true, nisn: true },
            }),
            this.resolveSiswaKelasReguler(nisnStr, r.kelas, regulerNames),
          ]);

          if (!siswa) throw new BadRequestException('Siswa tidak ditemukan pada master');
          const tglMulai = r.tgl_mulai;
          const tglSelesai = r.tgl_selesai || tglMulai;
          const parsedStart = new Date(tglMulai);
          const parsedEnd = new Date(tglSelesai);

          if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
            failedList.push({
              nisn: nisnStr,
              nama: siswa?.nama_lengkap || resolved?.nama || r.nama || nisnStr,
              error: `Format tanggal tidak valid (Mulai: ${tglMulai}, Selesai: ${tglSelesai})`,
            });
            continue;
          }

          // Check overlap
          const existingOverlap = await this.prisma.ketidakhadiran.findFirst({
            where: {
              nisn: nisnStr,
              aktif: true,
              jenis: rJenis,
              tgl_mulai: { lte: parsedEnd },
              tgl_selesai: { gte: parsedStart },
            },
          });
          if (existingOverlap) {
            skippedCount++;
            skippedDetails.push({
              nisn: nisnStr,
              nama: siswa?.nama_lengkap || resolved?.nama || nisnStr,
              jenis: rJenis,
              tgl_mulai: toDateString(parsedStart),
              tgl_selesai: toDateString(parsedEnd),
              reason: 'Sudah ada data ketidakhadiran aktif pada tanggal tersebut',
            });
            continue;
          }

          const wMulai = parseTimeToDate(r.waktu_mulai_real);
          const wSelesai = parseTimeToDate(r.waktu_selesai_real);

          const entry = await this.prisma.ketidakhadiran.create({
            data: {
              jenis: rJenis,
              nisn: nisnStr,
              nama: siswa?.nama_lengkap || resolved?.nama || r.nama || 'Siswa',
              kelas: resolved?.kelas || r.kelas || '',
              tgl_mulai: parsedStart,
              tgl_selesai: parsedEnd,
              status: r.status || (rJenis === 'IZIN' ? 'MADRASAH' : 'Ringan'),
              keterangan: r.keterangan || '-',
              file_url: r.file_url || null,
              tindakan: r.tindakan || null,
              tindak_lanjut: r.tindak_lanjut || null,
              waktu_mulai_real: wMulai,
              waktu_selesai_real: wSelesai,
              is_kontinu: Boolean(r.is_kontinu),
              petugas_nama: apiUser?.nama_lengkap || apiUser?.nama || 'Petugas',
              petugas_nip: apiUser?.nip || null,
              petugas_role: rJenis === 'SAKIT' ? 'OP_UKS' : 'OP_IZIN',
              aktif: true,
            },
          });

          results.push({
            ...entry,
            file_size: entry.file_size ? Number(entry.file_size) : null,
            tgl_mulai: toDateString(entry.tgl_mulai),
            tgl_selesai: toDateString(entry.tgl_selesai),
            waktu_mulai_real: toTimeString(entry.waktu_mulai_real),
            waktu_selesai_real: toTimeString(entry.waktu_selesai_real),
          });
        } catch (err: any) {
          failedList.push({
            nisn: nisnStr,
            nama: r.nama || nisnStr,
            error: err.message || 'Gagal menyimpan data',
          });
        }
      }

      return {
        ok: true,
        added: results.length,
        skipped: skippedCount,
        skipped_details: skippedDetails,
        failed: failedList,
        failed_count: failedList.length,
        total_requested: rows.length,
        data: results,
      };
    }

    // 2. Input Manual Tambah Data (payload.nisList)
    const {
      jenis,
      nisList,
      tgl_mulai,
      tgl_selesai,
      status,
      keterangan,
      file_url,
      tindakan,
      tindak_lanjut,
      waktu_mulai_real,
      waktu_selesai_real,
    } = payload;

    if (!isAdmin) {
      if (jenis === 'IZIN' && !roles.includes('OP_IZIN')) {
        throw new ForbiddenException('Anda tidak memiliki hak akses untuk menambah data IZIN');
      }
      if (jenis === 'SAKIT' && !roles.includes('OP_UKS')) {
        throw new ForbiddenException('Anda tidak memiliki hak akses untuk menambah data SAKIT');
      }
    }

    canManageJenis(apiUser, jenis);
    validatePeriod(payload);
    validateStatus(jenis, status);
    if (!Array.isArray(nisList) || !nisList.length) throw new BadRequestException('Pilih siswa terlebih dahulu');
    const results = [];
    const failedList: Array<{ nisn: string; nama?: string; error: string }> = [];
    const list = Array.isArray(nisList) ? nisList : [];
    const regulerNames = await this.getRegulerKelasNames();
    const groupSeriId = randomUUID();

    for (const nisn of list) {
      const nisnStr = String(nisn).trim();
      const studentClassHint = payload.studentClasses?.[nisnStr] || payload.kelas;
      const [siswa, resolved] = await Promise.all([
        this.prisma.master_siswa.findFirst({
          where: { nisn: nisnStr },
          select: { nama_lengkap: true, nisn: true },
        }),
        this.resolveSiswaKelasReguler(nisnStr, studentClassHint, regulerNames),
      ]);

      if (!siswa) { failedList.push({ nisn: nisnStr, error: 'Siswa tidak ditemukan pada master' }); continue; }
      let wMulai = null;
      if (waktu_mulai_real) {
        const t = String(waktu_mulai_real).slice(0, 8);
        wMulai = new Date(`1970-01-01T${t.length === 5 ? t + ':00' : t}Z`);
      }
      let wSelesai = null;
      if (waktu_selesai_real) {
        const t = String(waktu_selesai_real).slice(0, 8);
        wSelesai = new Date(`1970-01-01T${t.length === 5 ? t + ':00' : t}Z`);
      }

      try {
        const entry = await this.prisma.ketidakhadiran.create({
          data: {
            jenis,
            nisn: nisnStr,
            nama: siswa?.nama_lengkap || resolved?.nama || 'Siswa',
            kelas: resolved?.kelas || '',
            tgl_mulai: new Date(tgl_mulai),
            tgl_selesai: new Date(tgl_selesai || tgl_mulai),
            status,
            keterangan,
            file_url: file_url || null,
            tindakan: tindakan || null,
            tindak_lanjut: tindak_lanjut || null,
            waktu_mulai_real: wMulai,
            waktu_selesai_real: wSelesai,
            is_kontinu: Boolean(payload.is_kontinu),
            petugas_nama: apiUser?.nama_lengkap || apiUser?.nama || 'Petugas',
            petugas_nip: apiUser?.nip || null,
            petugas_role: jenis === 'SAKIT' ? 'OP_UKS' : 'OP_IZIN',
            seri_id: groupSeriId,
            aktif: true,
          },
        });

        results.push({
          ...entry,
          file_size: entry.file_size ? Number(entry.file_size) : null,
          tgl_mulai: toDateString(entry.tgl_mulai),
          tgl_selesai: toDateString(entry.tgl_selesai),
          waktu_mulai_real: toTimeString(entry.waktu_mulai_real),
          waktu_selesai_real: toTimeString(entry.waktu_selesai_real),
        });
      } catch (err: any) {
        failedList.push({
          nisn: nisnStr,
          nama: siswa?.nama_lengkap || resolved?.nama || nisnStr,
          error: err.message || 'Gagal menyimpan data',
        });
      }
    }

    return {
      ok: true,
      added: results.length,
      failed: failedList,
      total_requested: list.length,
      data: results,
    };
  }

  async update(id: string, payload: any, apiUser?: any): Promise<any> {
    if (!this.inTransaction) return this.atomic(s => s.update(id, payload, apiUser), apiUser, 'UPDATE', id);
    const existing = await this.prisma.ketidakhadiran.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Data tidak ditemukan');
    }

    if (apiUser && !apiUser.isAdmin) {
      const roles: string[] = Array.isArray(apiUser.roles)
        ? apiUser.roles.map((r: string) => String(r).toUpperCase().replace(/\s+/g, '_'))
        : [];
      if (existing.jenis === 'SAKIT' && !roles.includes('OP_UKS')) {
        throw new ForbiddenException('Anda tidak memiliki hak untuk mengubah data SAKIT');
      }
      if (existing.jenis === 'IZIN' && !roles.includes('OP_IZIN')) {
        throw new ForbiddenException('Anda tidak memiliki hak untuk mengubah data IZIN');
      }
    }

    if (!existing.aktif) throw new NotFoundException('Data tidak aktif');
    canManageJenis(apiUser, existing.jenis);
    canManageJenis(apiUser, payload.jenis !== undefined ? payload.jenis : existing.jenis);
    if (payload.jenis !== undefined && payload.jenis !== existing.jenis) throw new BadRequestException('Jenis data tidak dapat diubah; buat record baru dengan jenis yang sesuai');
    validateText(payload);
    validatePeriod({ ...existing, ...payload, tgl_mulai: payload.tgl_mulai || toDateString(existing.tgl_mulai), tgl_selesai: payload.tgl_selesai || toDateString(existing.tgl_selesai), waktu_mulai_real: payload.waktu_mulai_real ?? toTimeString(existing.waktu_mulai_real), waktu_selesai_real: payload.waktu_selesai_real ?? toTimeString(existing.waktu_selesai_real) });
    validateStatus(payload.jenis !== undefined ? payload.jenis : existing.jenis, payload.status !== undefined ? payload.status : existing.status);
    const updateData: any = {
      updated_at: new Date(),
    };
    if (payload.jenis !== undefined) updateData.jenis = payload.jenis;
    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.keterangan !== undefined) updateData.keterangan = payload.keterangan;
    if (payload.file_url !== undefined) updateData.file_url = payload.file_url;
    if (payload.tindakan !== undefined) updateData.tindakan = payload.tindakan;
    if (payload.tindak_lanjut !== undefined) updateData.tindak_lanjut = payload.tindak_lanjut;
    if (payload.tgl_mulai) updateData.tgl_mulai = new Date(payload.tgl_mulai);
    if (payload.tgl_selesai) updateData.tgl_selesai = new Date(payload.tgl_selesai);
    if (payload.is_kontinu !== undefined) updateData.is_kontinu = Boolean(payload.is_kontinu);

    if (payload.waktu_mulai_real !== undefined) {
      updateData.waktu_mulai_real = parseTimeToDate(payload.waktu_mulai_real);
    }
    if (payload.waktu_selesai_real !== undefined) {
      updateData.waktu_selesai_real = parseTimeToDate(payload.waktu_selesai_real);
    }

    if (payload.scope === 'ALL') {
      const siblingWhere: any = { ...(existing.seri_id ? { seri_id: existing.seri_id } : { id }), aktif: true };
      const siblings = await this.prisma.ketidakhadiran.findMany({ where: siblingWhere });
      for (const sibling of siblings) canManageJenis(apiUser, sibling.jenis);
      for (const sibling of siblings) {
        if (sibling.id !== id) await this.update(sibling.id, { ...payload, scope: 'ONE' }, apiUser);
      }
      await this.prisma.ketidakhadiran.updateMany({
        where: siblingWhere,
        data: updateData,
      });
    }

    const updated = await this.prisma.ketidakhadiran.update({
      where: { id },
      data: updateData,
    });

    if (existing.rekam_medis_id) {
      const rmUpdateData: any = { updated_at: new Date() };
      if (payload.keterangan !== undefined) rmUpdateData.keluhan = payload.keterangan;
      if (payload.tindakan !== undefined) {
        rmUpdateData.tindakan = Array.isArray(payload.tindakan) ? payload.tindakan : [payload.tindakan].filter(Boolean);
      }
      if (payload.tindak_lanjut !== undefined) rmUpdateData.tindak_lanjut = payload.tindak_lanjut;
      await this.prisma.rekam_medis_siswa.updateMany({
        where: { id: existing.rekam_medis_id, aktif: true },
        data: rmUpdateData,
      });
    }

    return {
      ok: true,
      data: {
        ...updated,
        file_size: updated.file_size ? Number(updated.file_size) : null,
        tgl_mulai: toDateString(updated.tgl_mulai),
        tgl_selesai: toDateString(updated.tgl_selesai),
        waktu_mulai_real: toTimeString(updated.waktu_mulai_real),
        waktu_selesai_real: toTimeString(updated.waktu_selesai_real),
      },
    };
  }

  async remove(id: string, apiUser?: any, scope?: string): Promise<any> {
    if (!this.inTransaction) return this.atomic(s => s.remove(id, apiUser, scope), apiUser, 'DELETE', id);
    const existing = await this.prisma.ketidakhadiran.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Data tidak ditemukan');
    }

    if (apiUser && !apiUser.isAdmin) {
      const roles: string[] = Array.isArray(apiUser.roles)
        ? apiUser.roles.map((r: string) => String(r).toUpperCase().replace(/\s+/g, '_'))
        : [];
      if (existing.jenis === 'SAKIT' && !roles.includes('OP_UKS')) {
        throw new ForbiddenException('Anda tidak memiliki hak untuk menghapus data SAKIT');
      }
      if (existing.jenis === 'IZIN' && !roles.includes('OP_IZIN')) {
        throw new ForbiddenException('Anda tidak memiliki hak untuk menghapus data IZIN');
      }
    }

    canManageJenis(apiUser, existing.jenis);
    if (!existing.aktif) throw new NotFoundException('Data tidak aktif');
    if (scope === 'ALL') {
      const whereSiblings: any = { ...(existing.seri_id ? { seri_id: existing.seri_id } : { id }), aktif: true };
      const siblings = await this.prisma.ketidakhadiran.findMany({
        where: whereSiblings,
        select: { id: true, rekam_medis_id: true, jenis: true },
      });

      for (const sibling of siblings) canManageJenis(apiUser, sibling.jenis);
      const ids = siblings.map((s) => s.id);
      const rmIds = siblings.map((s) => s.rekam_medis_id).filter(Boolean) as string[];

      await this.prisma.ketidakhadiran.updateMany({
        where: { id: { in: ids } },
        data: { aktif: false, updated_at: new Date() },
      });

      if (rmIds.length > 0) {
        await this.prisma.rekam_medis_siswa.updateMany({
          where: { id: { in: rmIds }, aktif: true },
          data: { aktif: false, updated_at: new Date() },
        });
      }

      return { ok: true, count: ids.length };
    }

    const result = await this.prisma.ketidakhadiran.update({
      where: { id },
      data: {
        aktif: false,
        updated_at: new Date(),
      },
    });

    if (existing.rekam_medis_id) {
      await this.prisma.rekam_medis_siswa.updateMany({
        where: { id: existing.rekam_medis_id, aktif: true },
        data: { aktif: false, updated_at: new Date() },
      });
    }

    return { ok: true };
  }

  // ----------------------------------------------------
  // LOG KETIDAKHADIRAN (Today & History with Statistics)
  // ----------------------------------------------------
  async getLog(query: any, apiUser: any) {
    validateQuery(query);
    const mode = query.mode || 'today';
    const tanggal = query.tanggal || await this.getSchoolToday();
    if (!['today', 'history'].includes(mode)) throw new BadRequestException('Mode log tidak valid');
    const scope = await this.readScope(apiUser);
    const { kelas, jenis, q, from, to } = query;
    const page = boundedInt(query.page, 1, 100000);
    const limit = boundedInt(query.limit, 20, 100);

    const targetDate = validDate(tanggal);

    const where: any = {
      aktif: true,
    };

    if (mode === 'today') {
      where.tgl_mulai = { lte: targetDate };
      where.tgl_selesai = { gte: targetDate };
    } else {
      if (to) where.tgl_mulai = { lte: validDate(to) };
      if (from) where.tgl_selesai = { gte: validDate(from) };
      if (from && to && validDate(to) < validDate(from)) throw new BadRequestException('Rentang tanggal tidak valid');
    }

    if (kelas) where.kelas = kelas;
    if (jenis) where.jenis = jenis.toUpperCase();

    if (q) {
      const safeQ = q.replace(/[^a-zA-Z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
      if (safeQ) {
        const searchCond = [
          { nama: { contains: safeQ, mode: 'insensitive' } },
          { nisn: { contains: safeQ, mode: 'insensitive' } },
        ];
        if (where.OR) {
          where.AND = [{ OR: where.OR }, { OR: searchCond }];
          delete where.OR;
        } else {
          where.OR = searchCond;
        }
      }
    }

    where.AND = [...(where.AND || []), scope];
    const skip = (page - 1) * limit;

    const [count, rawRows] = await Promise.all([
      this.prisma.ketidakhadiran.count({ where }),
      this.prisma.ketidakhadiran.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: mode === 'history' ? skip : 0, take: mode === 'history' ? limit : 5000,
      }),
    ]);

    const logNisnList = Array.from(new Set(rawRows.map((i: any) => i.nisn).filter(Boolean)));
    const logUserProfiles =
      logNisnList.length > 0
        ? await this.prisma.public_users.findMany({
            where: {
              OR: [
                { username: { in: logNisnList } },
                { nip: { in: logNisnList } },
              ],
              foto_profil: { not: null },
            },
            select: { username: true, nip: true, foto_profil: true },
          })
        : [];
    const logPhotoMap = new Map<string, string>();
    for (const up of logUserProfiles) {
      if (up.foto_profil) {
        if (up.username) logPhotoMap.set(up.username, up.foto_profil);
        if (up.nip) logPhotoMap.set(up.nip, up.foto_profil);
      }
    }

    const rows = rawRows.map((r: any) => {
      const tglMulaiStr = toDateString(r.tgl_mulai) || '';
      const tglSelesaiStr = toDateString(r.tgl_selesai) || '';
      const hari = calcHariKalender(r.tgl_mulai, r.tgl_selesai);
      const jp = absenceJp(r);

      return {
        ...r,
        file_size: r.file_size ? Number(r.file_size) : null,
        tgl_mulai: tglMulaiStr,
        tgl_selesai: tglSelesaiStr,
        waktu_mulai_real: toTimeString(r.waktu_mulai_real),
        waktu_selesai_real: toTimeString(r.waktu_selesai_real),
        jumlah_hari: hari,
        jumlah_jp: jp,
        display_hari: `${hari} Hari`,
        is_time_specific: !!(r.waktu_mulai_real && r.waktu_selesai_real),
        periode: tglMulaiStr === tglSelesaiStr ? tglMulaiStr : `${tglMulaiStr} — ${tglSelesaiStr}`,
        kelas_chip: r.kelas,
        foto_profil: logPhotoMap.get(r.nisn) || null,
      };
    });

    // Calculate daily statistics for stats cards
    const statsWhere: any = {
      aktif: true,
      tgl_mulai: { lte: targetDate },
      tgl_selesai: { gte: targetDate },
    };
    if (kelas) statsWhere.kelas = kelas;
    statsWhere.AND = [scope];

    const allTodayRaw = await this.prisma.ketidakhadiran.findMany({
      where: statsWhere,
      select: {
        jenis: true,
        status: true,
        tgl_mulai: true,
        tgl_selesai: true,
      },
    });

    const stats = {
      total_today: allTodayRaw.length,
      izin_today: allTodayRaw.filter((r) => r.jenis === 'IZIN').length,
      sakit_today: allTodayRaw.filter((r) => r.jenis === 'SAKIT').length,
      pending_today: allTodayRaw.filter((r) => (r.status || '').toLowerCase() === 'pending').length,
      izin_madrasah_today: allTodayRaw.filter(
        (r) => r.jenis === 'IZIN' && (r.status || '').toUpperCase().trim() === 'MADRASAH',
      ).length,
      izin_personal_today: allTodayRaw.filter(
        (r) => r.jenis === 'IZIN' && (r.status || '').toUpperCase().trim() === 'PERSONAL',
      ).length,
      izin_lain_today: allTodayRaw.filter(
        (r) =>
          r.jenis === 'IZIN' &&
          !['MADRASAH', 'PERSONAL'].includes((r.status || '').toUpperCase().trim()),
      ).length,
      sakit_ringan_today: allTodayRaw.filter(
        (r) => r.jenis === 'SAKIT' && (r.status || '').toUpperCase().trim() === 'RINGAN',
      ).length,
      sakit_sedang_today: allTodayRaw.filter(
        (r) => r.jenis === 'SAKIT' && (r.status || '').toUpperCase().trim() === 'SEDANG',
      ).length,
      sakit_berat_today: allTodayRaw.filter(
        (r) => r.jenis === 'SAKIT' && (r.status || '').toUpperCase().trim() === 'BERAT',
      ).length,
      sakit_kontrol_today: allTodayRaw.filter(
        (r) => r.jenis === 'SAKIT' && (r.status || '').toUpperCase().trim() === 'KONTROL',
      ).length,
      total_hari_all: allTodayRaw.reduce((acc, r) => acc + calcHariKalender(r.tgl_mulai, r.tgl_selesai), 0),
      izin_hari: allTodayRaw
        .filter((r) => r.jenis === 'IZIN')
        .reduce((acc, r) => acc + calcHariKalender(r.tgl_mulai, r.tgl_selesai), 0),
      sakit_hari: allTodayRaw
        .filter((r) => r.jenis === 'SAKIT')
        .reduce((acc, r) => acc + calcHariKalender(r.tgl_mulai, r.tgl_selesai), 0),
    };

    return {
      success: true,
      mode,
      rows: rows.map(row => this.safeAbsence(row, apiUser)),
      total: mode === 'today' ? rows.length : count,
      page,
      limit,
      stats,
    };
  }

  // ----------------------------------------------------
  // LOG GURU ASUH
  // ----------------------------------------------------
  async getLogGuruAsuh(nip: string, tahunAjaran?: string) {
    if (!nip) {
      throw new NotFoundException('NIP wajib diisi');
    }

    const allYearsForGuru = await this.prisma.guru_asuh.findMany({
      where: { nip, aktif: true },
      distinct: ['tahun_ajaran'],
      select: { tahun_ajaran: true },
      orderBy: { tahun_ajaran: 'desc' },
    });
    const availableTahunAjaran = allYearsForGuru
      .map((y) => y.tahun_ajaran)
      .filter(Boolean) as string[];

    const whereAsuh: any = {
      nip,
      aktif: true,
    };
    if (tahunAjaran && tahunAjaran !== 'Semua') {
      whereAsuh.tahun_ajaran = tahunAjaran;
    }

    const rawSiswaAsuh = await this.prisma.guru_asuh.findMany({
      where: whereAsuh,
      select: {
        nisn_siswa: true,
        nama_siswa: true,
        kelas: true,
        nip: true,
        nama_guru: true,
        tahun_ajaran: true,
      },
      orderBy: [{ tahun_ajaran: 'desc' }, { nama_siswa: 'asc' }],
    });

    const todayStr = await this.getSchoolToday();
    const todayDate = new Date(todayStr);

    if (!rawSiswaAsuh || rawSiswaAsuh.length === 0) {
      return {
        success: true,
        has_asuhan: false,
        has_any_asuhan: availableTahunAjaran.length > 0,
        available_tahun_ajaran: availableTahunAjaran,
        guru_info: null,
        siswa_list: [],
        ketidakhadiran: [],
        summary: {
          total_siswa_asuh: 0,
          total_tidak_hadir: 0,
          total_izin: 0,
          total_sakit: 0,
          total_pending: 0,
          hadir: 0,
          total_asuhan: 0,
          izin_hari_ini: 0,
          sakit_hari_ini: 0,
        },
        today: todayStr,
      };
    }

    // Jika 'Semua' TA, deduplikasi siswa berdasarkan nisn (ambil tahun_ajaran terbaru)
    const siswaAsuh: typeof rawSiswaAsuh = [];
    const seenNisn = new Set<string>();
    for (const s of rawSiswaAsuh) {
      if (!s.nisn_siswa) continue;
      if (!whereAsuh.tahun_ajaran) {
        if (!seenNisn.has(s.nisn_siswa)) {
          seenNisn.add(s.nisn_siswa);
          siswaAsuh.push(s);
        }
      } else {
        siswaAsuh.push(s);
      }
    }

    const nisnList = Array.from(new Set(siswaAsuh.map((s) => s.nisn_siswa).filter(Boolean))) as string[];
    const actualTa = siswaAsuh[0]?.tahun_ajaran || tahunAjaran || '';
    const guruNama = siswaAsuh[0]?.nama_guru || '';

    const [activeKetidakhadiran, userProfiles] = await Promise.all([
      this.prisma.ketidakhadiran.findMany({
        where: {
          nisn: { in: nisnList },
          aktif: true,
          tgl_mulai: { lte: todayDate },
          tgl_selesai: { gte: todayDate },
        },
        orderBy: { tgl_mulai: 'desc' },
      }),
      this.prisma.public_users.findMany({
        where: {
          OR: [
            { username: { in: nisnList } },
            { nip: { in: nisnList } },
          ],
          foto_profil: { not: null },
        },
        select: { username: true, nip: true, foto_profil: true },
      }),
    ]);

    const photoMap = new Map<string, string>();
    for (const up of userProfiles) {
      if (up.foto_profil) {
        if (up.username) photoMap.set(up.username, up.foto_profil);
        if (up.nip) photoMap.set(up.nip, up.foto_profil);
      }
    }

    const formattedKetidakhadiran = activeKetidakhadiran.map((r: any) => ({
      ...this.safeAbsence(r, { roles: [] }),
      file_size: r.file_size ? Number(r.file_size) : null,
      tgl_mulai: toDateString(r.tgl_mulai),
      tgl_selesai: toDateString(r.tgl_selesai),
      waktu_mulai_real: toTimeString(r.waktu_mulai_real),
      waktu_selesai_real: toTimeString(r.waktu_selesai_real),
      display_hari: `${calcHariKalender(r.tgl_mulai, r.tgl_selesai)} Hari`,
    }));

    const khByNisn = new Map<string, any[]>();
    for (const kh of formattedKetidakhadiran) {
      if (!kh.nisn) continue;
      const list = khByNisn.get(kh.nisn) || [];
      list.push(kh);
      khByNisn.set(kh.nisn, list);
    }

    const formattedSiswaList = siswaAsuh.map((s) => {
      const studentKh = khByNisn.get(s.nisn_siswa) || [];
      const totalIzin = studentKh.filter((r: any) => (r.jenis || '').toUpperCase() === 'IZIN').length;
      const totalSakit = studentKh.filter((r: any) => (r.jenis || '').toUpperCase() === 'SAKIT').length;
      const status: 'hadir' | 'tidak_hadir' = studentKh.length > 0 ? 'tidak_hadir' : 'hadir';

      return {
        nisn: s.nisn_siswa,
        nisn_siswa: s.nisn_siswa,
        nama: s.nama_siswa,
        nama_siswa: s.nama_siswa,
        kelas: s.kelas,
        nip: s.nip,
        nama_guru: s.nama_guru,
        tahun_ajaran: s.tahun_ajaran,
        status,
        foto_profil: photoMap.get(s.nisn_siswa) || null,
        ketidakhadiran: studentKh,
        active_ketidakhadiran: studentKh,
        total_izin: totalIzin,
        total_sakit: totalSakit,
        total_entries: studentKh.length,
      };
    });

    const totalSiswaAsuh = formattedSiswaList.length;
    const tidakHadirCount = formattedSiswaList.filter((s) => s.status === 'tidak_hadir').length;
    const hadirCount = Math.max(0, totalSiswaAsuh - tidakHadirCount);
    const totalIzin = formattedKetidakhadiran.filter((r: any) => (r.jenis || '').toUpperCase() === 'IZIN').length;
    const totalSakit = formattedKetidakhadiran.filter((r: any) => (r.jenis || '').toUpperCase() === 'SAKIT').length;

    const summary = {
      total_siswa_asuh: totalSiswaAsuh,
      total_tidak_hadir: tidakHadirCount,
      total_izin: totalIzin,
      total_sakit: totalSakit,
      total_pending: 0,
      hadir: hadirCount,
      total_asuhan: totalSiswaAsuh,
      izin_hari_ini: totalIzin,
      sakit_hari_ini: totalSakit,
    };

    return {
      success: true,
      has_asuhan: true,
      has_any_asuhan: availableTahunAjaran.length > 0,
      available_tahun_ajaran: availableTahunAjaran,
      guru_info: {
        nip,
        nama: guruNama,
        tahun_ajaran: actualTa,
      },
      siswa_list: formattedSiswaList,
      ketidakhadiran: formattedKetidakhadiran,
      summary,
      today: todayStr,
    };
  }

  // ----------------------------------------------------
  // LOG WALI KELAS
  // ----------------------------------------------------
  async getLogWaliKelas(nip: string, tahunAjaran?: string, isAdmin = false, pilihKelas?: string) {
    let kelasList: string[] = [];
    const todayStr = await this.getSchoolToday();
    const todayDate = new Date(todayStr);

    if (isAdmin) {
      const allKelas = await this.prisma.master_kelas.findMany({
        where: { aktif: true, program: 'Reguler' },
        select: { nama: true },
        orderBy: { nama: 'asc' },
      });
      kelasList = allKelas.map((k) => k.nama);
    } else {
      const whereWali: any = {
        nip,
        aktif: true,
      };
      if (tahunAjaran && tahunAjaran !== 'Semua') {
        whereWali.tahun_ajaran = tahunAjaran;
      }
      const waliRows = await this.prisma.wali_kelas.findMany({
        where: whereWali,
        select: { nama_kelas: true, nip: true, nama_guru: true, tahun_ajaran: true },
      });

      if (!waliRows || waliRows.length === 0) {
        return {
          success: true,
          is_wali: false,
          message: 'Anda bukan wali kelas manapun',
          kelas_list: [] as any[],
          ketidakhadiran_by_kelas: [] as any[],
          summary: null as any,
          today: todayStr,
        };
      }
      kelasList = Array.from(new Set(waliRows.map((w) => w.nama_kelas)));
    }

    if (pilihKelas && kelasList.includes(pilihKelas)) {
      kelasList = [pilihKelas];
    }

    const records = await this.prisma.ketidakhadiran.findMany({
      where: {
        kelas: { in: kelasList },
        aktif: true,
        tgl_mulai: { lte: todayDate },
        tgl_selesai: { gte: todayDate },
      },
      orderBy: { created_at: 'desc' },
    });

    const byKelas: Record<string, any[]> = {};
    kelasList.forEach((k) => { byKelas[k] = []; });

    records.forEach((r: any) => {
      if (byKelas[r.kelas]) {
        byKelas[r.kelas].push({
          ...this.safeAbsence(r, { roles: [] }),
          file_size: r.file_size ? Number(r.file_size) : null,
          tgl_mulai: toDateString(r.tgl_mulai),
          tgl_selesai: toDateString(r.tgl_selesai),
          waktu_mulai_real: toTimeString(r.waktu_mulai_real),
          waktu_selesai_real: toTimeString(r.waktu_selesai_real),
          display_hari: `${calcHariKalender(r.tgl_mulai, r.tgl_selesai)} Hari`,
        });
      }
    });

    const summary = {
      total_kelas: kelasList.length,
      total_tidak_hadir: records.length,
      izin_hari_ini: records.filter((r) => r.jenis === 'IZIN').length,
      sakit_hari_ini: records.filter((r) => r.jenis === 'SAKIT').length,
    };

    return {
      success: true,
      is_wali: true,
      kelas_list: kelasList,
      ketidakhadiran_by_kelas: byKelas,
      summary,
      today: todayStr,
    };
  }

  // ----------------------------------------------------
  // LOG SISWA SPESIFIK (by NISN)
  // ----------------------------------------------------
  async getLogSiswa(nisn: string, tahunAjaran?: string, apiUser?: any) {
    const scope = await this.readScope(apiUser);
    if (!nisn) {
      throw new BadRequestException('NISN wajib diisi');
    }

    // IDOR Protection
    if (apiUser && !apiUser.isAdmin) {
      const roles: string[] = Array.isArray(apiUser.roles)
        ? apiUser.roles.map((r: string) => String(r).toUpperCase().replace(/\s+/g, '_'))
        : [];
      const isStaff = roles.some((r) =>
        ['ADMIN', 'ADMINISTRATOR', 'GURU', 'WALI_KELAS', 'GURU_ASUH', 'OP_IZIN', 'OP_UKS'].includes(r),
      );

      if (!isStaff) {
        if (roles.includes('ORANG_TUA')) {
          const anakLink = await this.prisma.orangtua_siswa.findFirst({
            where: { user_id: BigInt(apiUser.id), nisn },
          });
          if (!anakLink) {
            throw new ForbiddenException('Anda tidak memiliki akses ke data kehadiran siswa ini');
          }
        } else if (roles.includes('SISWA')) {
          if (scope.nisn !== nisn) {
            throw new ForbiddenException('Anda hanya dapat melihat data kehadiran Anda sendiri');
          }
        } else {
          throw new ForbiddenException('Akses ditolak');
        }
      }
    }

    const where: any = {
      nisn, AND: [scope],
      aktif: true,
    };

    if (tahunAjaran && tahunAjaran !== 'Semua') {
      const [startYear, endYear] = tahunAjaran.split('/');
      if (startYear && endYear) {
        where.tgl_mulai = {
          gte: new Date(`${startYear}-07-01`),
          lte: new Date(`${endYear}-06-30`),
        };
      }
    }

    const [data, siswa, resolvedKelas] = await Promise.all([
      this.prisma.ketidakhadiran.findMany({
        where,
        orderBy: { tgl_mulai: 'desc' },
      }),
      this.prisma.master_siswa.findFirst({
        where: { nisn },
        select: { nama_lengkap: true, nisn: true },
      }),
      this.resolveSiswaKelasReguler(nisn),
    ]);

    if (scope.OR && !scope.OR.some((condition: any) => condition.nisn?.in?.includes(nisn) || condition.kelas?.in?.includes(resolvedKelas.kelas))) throw new ForbiddenException('Siswa di luar penugasan Anda');

    const riwayat = data.map((r: any) => {
      const hari = calcHariKalender(r.tgl_mulai, r.tgl_selesai);
      return {
        ...r,
        file_size: r.file_size ? Number(r.file_size) : null,
        tgl_mulai: toDateString(r.tgl_mulai),
        tgl_selesai: toDateString(r.tgl_selesai),
        waktu_mulai_real: toTimeString(r.waktu_mulai_real),
        waktu_selesai_real: toTimeString(r.waktu_selesai_real),
        jumlah_hari: hari,
        jumlah_jp: absenceJp(r),
        hari_kalender: hari,
        display_durasi: `${hari} Hari`,
      };
    });

    const visibleRiwayat = riwayat.map(row => this.safeAbsence(row, apiUser));
    const izinItems = riwayat.filter((r) => r.jenis === 'IZIN');
    const sakitItems = riwayat.filter((r) => r.jenis === 'SAKIT');
    const totalHariIzin = izinItems.reduce((sum, r) => sum + r.jumlah_hari, 0);
    const totalHariSakit = sakitItems.reduce((sum, r) => sum + r.jumlah_hari, 0);
    const totalIzinJp = izinItems.reduce((sum, r) => sum + r.jumlah_jp, 0);
    const totalSakitJp = sakitItems.reduce((sum, r) => sum + r.jumlah_jp, 0);

    const summary = {
      total_izin: izinItems.length,
      total_sakit: sakitItems.length,
      total_hari_izin: totalHariIzin,
      total_hari_sakit: totalHariSakit,
    };

    const stat = {
      total_izin_hari_kalender: totalHariIzin,
      total_sakit_hari_kalender: totalHariSakit,
      total_izin_hari: Math.round((totalIzinJp / 24) * 10) / 10,
      total_sakit_hari: Math.round((totalSakitJp / 24) * 10) / 10,
      total_izin_jp: totalIzinJp,
      total_sakit_jp: totalSakitJp,
      total_hari: Math.round(((totalIzinJp + totalSakitJp) / 24) * 10) / 10,
      total_jp: totalIzinJp + totalSakitJp,
    };

    const studentData = {
      nama: siswa?.nama_lengkap || resolvedKelas?.nama || riwayat[0]?.nama || 'Siswa',
      nisn,
      kelas: resolvedKelas?.kelas || riwayat[0]?.kelas || '-',
    };

    return {
      ok: true,
      success: true,
      nisn,
      data: {
        siswa: studentData,
        stat,
        riwayat: visibleRiwayat,
      },
      riwayat: visibleRiwayat,
      summary,
    };
  }

  // ----------------------------------------------------
  // ABSENSI KELAS (Today absent students check)
  // ----------------------------------------------------
  async getAbsensi(kelas: string, tanggal: string, jamKe: number | undefined, apiUser: any) {
    const scope = await this.readScope(apiUser);
    if (!kelas || !tanggal) {
      throw new NotFoundException('Kelas dan tanggal wajib diisi');
    }

    const targetDate = validDate(tanggal);

    const items = await this.prisma.ketidakhadiran.findMany({
      where: {
        kelas, AND: [scope],
        aktif: true,
        tgl_mulai: { lte: targetDate },
        tgl_selesai: { gte: targetDate },
      },
    });

    let visible = items;
    if (jamKe !== undefined) {
      boundedInt(jamKe, 1, 24);
      const hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][targetDate.getUTCDay()];
      const slot = await this.prisma.master_waktu.findFirst({ where: { jam_ke: jamKe, hari, program: 'Reguler', aktif: true, is_istirahat: false } });
      if (!slot) throw new BadRequestException('Jadwal jam tidak ditemukan');
      const mins = (v: Date) => v.getUTCHours() * 60 + v.getUTCMinutes();
      visible = items.filter(r => {
        const day = targetDate.toISOString().slice(0,10);
        const startDay = toDateString(r.tgl_mulai), endDay = toDateString(r.tgl_selesai);
        const start = r.is_kontinu && day !== startDay ? 0 : r.waktu_mulai_real ? mins(r.waktu_mulai_real) : 0;
        const end = r.is_kontinu && day !== endDay ? 1440 : r.waktu_selesai_real ? mins(r.waktu_selesai_real) : 1440;
        return start < mins(slot.selesai) && end > mins(slot.mulai);
      });
    }
    const mapped = visible.map((r: any) => ({
      id: r.id,
      jenis: r.jenis,
      nisn: r.nisn,
      nama: r.nama,
      kelas: r.kelas,
      status: r.status,
      keterangan: this.safeAbsence(r, apiUser).keterangan,
      tgl_mulai: toDateString(r.tgl_mulai),
      tgl_selesai: toDateString(r.tgl_selesai),
      waktu_mulai_real: toTimeString(r.waktu_mulai_real),
      waktu_selesai_real: toTimeString(r.waktu_selesai_real),
    }));

    return {
      ok: true,
      data: mapped,
      count: mapped.length,
    };
  }

  // ----------------------------------------------------
  // REKAP KETIDAKHADIRAN (Periodic Aggregates)
  // ----------------------------------------------------
  async getRekap(query: any, apiUser: any) {
    validateQuery(query);
    const scope = await this.readScope(apiUser);
    const { filter_type, tahun_ajaran, semester, tahun, bulan, from, to } = query;

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (from && to) {
      startDate = new Date(from);
      endDate = new Date(to);
    } else if (filter_type === 'bulan' && tahun && bulan) {
      const y = parseInt(tahun);
      const m = parseInt(bulan);
      startDate = new Date(y, m - 1, 1);
      endDate = new Date(y, m, 0);
    } else if (tahun_ajaran) {
      const [y1, y2] = tahun_ajaran.split('/').map(Number);
      if (semester === '1') {
        startDate = new Date(`${y1}-07-01`);
        endDate = new Date(`${y1}-12-31`);
      } else if (semester === '2') {
        startDate = new Date(`${y2}-01-01`);
        endDate = new Date(`${y2}-06-30`);
      } else {
        startDate = new Date(`${y1}-07-01`);
        endDate = new Date(`${y2}-06-30`);
      }
    }

    const where: any = {
      aktif: true,
    };
    where.AND = [scope];
    if (startDate) validDate(startDate);
    if (endDate) validDate(endDate);
    if (startDate && endDate && endDate < startDate) throw new BadRequestException('Rentang tanggal tidak valid');
    if (startDate && endDate) {
      where.tgl_mulai = { lte: endDate };
      where.tgl_selesai = { gte: startDate };
    }

    const records = await this.prisma.ketidakhadiran.findMany({
      where,
      orderBy: { tgl_mulai: 'asc' }, take: 5000,
    });

    const clippedRecord = (r: any) => ({
      ...r,
      tgl_mulai: startDate && r.tgl_mulai < startDate ? startDate : r.tgl_mulai,
      tgl_selesai: endDate && r.tgl_selesai > endDate ? endDate : r.tgl_selesai,
      waktu_mulai_real: r.is_kontinu && startDate && r.tgl_mulai < startDate ? null : r.waktu_mulai_real,
      waktu_selesai_real: r.is_kontinu && endDate && r.tgl_selesai > endDate ? null : r.waktu_selesai_real,
    });
    const calcRecordMinutes = (r: any): number => absenceJp(clippedRecord(r)) * 60;

    const byStudent: Record<string, any> = {};
    records.forEach((r: any) => {
      if (!byStudent[r.nisn]) {
        byStudent[r.nisn] = {
          nisn: r.nisn,
          nama: r.nama,
          kelas: r.kelas,
          total_sakit: 0,
          total_izin: 0,
          total_hari_sakit: 0,
          total_hari_izin: 0,
          izin_menit: 0,
          sakit_menit: 0,
          izin_madrasah: 0,
          izin_personal: 0,
          sakit_ringan: 0,
          sakit_sedang: 0,
          sakit_berat: 0,
          sakit_kontrol: 0,
          izin_entries: [],
          sakit_entries: [],
          records: [],
        };
      }
      const hari = calcHariKalender(r.tgl_mulai, r.tgl_selesai);
      const menit = calcRecordMinutes(r);
      const statusUpper = (r.status || '').toUpperCase().trim();

      const entryObj = {
        id: r.id,
        jenis: r.jenis,
        status: r.status,
        keterangan: this.safeAbsence(r, apiUser).keterangan || '',
        tgl_mulai: toDateString(r.tgl_mulai),
        tgl_selesai: toDateString(r.tgl_selesai),
        waktu_mulai_real: toTimeString(r.waktu_mulai_real),
        waktu_selesai_real: toTimeString(r.waktu_selesai_real),
        is_kontinu: Boolean(r.is_kontinu),
        hari,
        menit,
      };

      if (r.jenis === 'SAKIT') {
        byStudent[r.nisn].total_sakit++;
        byStudent[r.nisn].total_hari_sakit += hari;
        byStudent[r.nisn].sakit_menit += menit;
        if (statusUpper === 'RINGAN') byStudent[r.nisn].sakit_ringan += menit;
        else if (statusUpper === 'SEDANG') byStudent[r.nisn].sakit_sedang += menit;
        else if (statusUpper === 'BERAT') byStudent[r.nisn].sakit_berat += menit;
        else if (statusUpper === 'KONTROL') byStudent[r.nisn].sakit_kontrol += menit;
        byStudent[r.nisn].sakit_entries.push(entryObj);
      } else if (r.jenis === 'IZIN') {
        byStudent[r.nisn].total_izin++;
        byStudent[r.nisn].total_hari_izin += hari;
        byStudent[r.nisn].izin_menit += menit;
        if (statusUpper === 'MADRASAH') byStudent[r.nisn].izin_madrasah += menit;
        else if (statusUpper === 'PERSONAL') byStudent[r.nisn].izin_personal += menit;
        byStudent[r.nisn].izin_entries.push(entryObj);
      }
      byStudent[r.nisn].records.push(entryObj);
    });

    const students = Object.values(byStudent);

    const makeRanked = (key: string) => {
      return [...students]
        .filter((s: any) => (s[key] || 0) > 0)
        .sort((a: any, b: any) => (b[key] || 0) - (a[key] || 0))
        .map((s: any, idx: number) => ({ ...s, rank: idx + 1 }));
    };

    return {
      success: true,
      filter: {
        filter_type,
        tahun_ajaran,
        semester,
        start_date: startDate ? toDateString(startDate) : null,
        end_date: endDate ? toDateString(endDate) : null,
      },
      total_records: records.length,
      total_students: students.length,
      students,
      izin: makeRanked('izin_menit'),
      izin_madrasah: makeRanked('izin_madrasah'),
      izin_personal: makeRanked('izin_personal'),
      sakit: makeRanked('sakit_menit'),
      sakit_ringan: makeRanked('sakit_ringan'),
      sakit_sedang: makeRanked('sakit_sedang'),
      sakit_berat: makeRanked('sakit_berat'),
      sakit_kontrol: makeRanked('sakit_kontrol'),
    };
  }

  // ----------------------------------------------------
  // REKAM MEDIS SISWA (UKS)
  async getPresets() {
    const DEFAULT_PRESET_TATA_LAKSANA = [
      'Observasi di UKS',
      'Pemberian Obat Oral',
      'Kompres Hangat/Dingin',
      'Perawatan Luka',
      'Pemeriksaan Tanda Vital',
      'Istirahat Cukup',
      'Edukasi Hidrasi',
    ];
    const DEFAULT_PRESETS = {
      penyakit: ['Demam', 'Flu / Batuk', 'Maag / Dispepsia', 'Pusing / Cephalgia', 'Diare', 'Alergi', 'Luka Ringan', 'Dismenore', 'Asma'],
      alergi: ['Antibiotik Penicillin', 'Paracetamol', 'Seafood', 'Debu', 'Cuaca Dingin', 'Kacang'],
      keluhan: ['Demam tinggi sejak malam', 'Mual dan muntah', 'Sakit kepala berdenyut', 'Nyeri perut melilit', 'Batuk berdahak dan pilek', 'Lemas dan pusing saat upacara'],
      tataLaksana: DEFAULT_PRESET_TATA_LAKSANA,
      tindakan: ['Istirahat di tempat tidur UKS', 'Pemberian Paracetamol 500mg', 'Pemberian Antasida', 'Kompres dahi', 'Pembersihan luka dengan antiseptik', 'Pengukuran tensi dan suhu'],
      tindakLanjut: ['Kembali ke Kelas', 'Istirahat di UKS', 'Pulang ke Rumah / Asrama', 'Rujuk ke RS / Klinik', 'Kontrol'],
      tindakLanjutMapping: [
        { name: 'Kembali ke Kelas', status: 'NONE' },
        { name: 'Istirahat di UKS', status: 'Ringan' },
        { name: 'Pulang ke Rumah / Asrama', status: 'Sedang' },
        { name: 'Rujuk ke RS / Klinik', status: 'Sedang' },
        { name: 'Kontrol', status: 'Kontrol' },
      ],
    };

    try {
      const row = await this.prisma.site_settings.findFirst({
        where: { key: 'rekam_medis_presets' },
      });
      if (row?.value) {
        const parsed = JSON.parse(row.value);
        return { ok: true, data: { ...DEFAULT_PRESETS, ...parsed } };
      }
    } catch (err) {
      console.error('[getPresets] Error:', err);
    }
    return { ok: true, data: DEFAULT_PRESETS };
  }

  private checkIsUksStaff(apiUser: any) {
    const roles: string[] = (apiUser?.roles || []).map((r: string) => String(r).toUpperCase());
    const isStaff = apiUser?.isAdmin || roles.includes('ADMIN') || roles.includes('ADMINISTRATOR') || roles.includes('OP_UKS');
    if (!isStaff) {
      throw new ForbiddenException('Akses ditolak: Hanya Operator UKS (OP_UKS) atau Admin yang berhak melakukan operasi ini.');
    }
  }

  async savePresets(presets: any, apiUser?: any): Promise<any> {
    if (!this.inTransaction) return this.atomic(s => s.savePresets(presets, apiUser), apiUser, 'PRESETS');
    this.checkIsUksStaff(apiUser);
    if (!presets || Object.values(presets).some(value => !Array.isArray(value))) throw new BadRequestException('Preset tidak valid');
    const presetKeys = ['penyakit', 'alergi', 'keluhan', 'tataLaksana', 'tindakan', 'tindakLanjut', 'tindakLanjutMapping'];
    if (Object.keys(presets).some(key => !presetKeys.includes(key)) || Object.entries(presets).some(([key, value]) => (value as any[]).length > 500 || (key !== 'tindakLanjutMapping' && (value as any[]).some(item => typeof item !== 'string' || item.length > 1000)))) throw new BadRequestException('Daftar preset tidak valid');
    if (presets.tindakLanjutMapping?.some((m: any) => typeof m.name !== 'string' || m.name.length > 100 || !['NONE', 'Ringan', 'Sedang', 'Berat', 'Kontrol'].includes(m.status))) throw new BadRequestException('Mapping tindak lanjut tidak valid');
    try {
      await this.prisma.site_settings.upsert({
        where: { key: 'rekam_medis_presets' },
        update: {
          value: JSON.stringify(presets),
          updated_at: new Date(),
        },
        create: {
          key: 'rekam_medis_presets',
          label: 'Preset Rekam Medis UKS',
          value: JSON.stringify(presets),
        },
      });
      return { ok: true, message: 'Preset berhasil disimpan' };
    } catch (err: any) {
      console.error('[savePresets] Error:', err);
      return { ok: false, error: err.message };
    }
  }

  async syncKetidakhadiran(id: string, mappedStatus?: string, apiUser?: any): Promise<any> {
    if (!this.inTransaction) return this.atomic(s => s.syncKetidakhadiran(id, mappedStatus, apiUser), apiUser, 'SYNC', id);
    this.checkIsUksStaff(apiUser);
    if (!id) {
      return { ok: false, error: 'ID rekam medis wajib disertakan' };
    }
    const rm = await this.prisma.rekam_medis_siswa.findUnique({
      where: { id },
    });
    if (!rm || !rm.aktif) {
      return { ok: false, error: 'Data rekam medis tidak ditemukan atau tidak aktif' };
    }

    const status = mappedStatus || await this.statusFor(rm.tindak_lanjut);
    if (status === 'NONE') {
      await this.prisma.ketidakhadiran.updateMany({ where: { rekam_medis_id: id, aktif: true }, data: { aktif: false, updated_at: new Date() } });
      return { ok: true, result: { ok: true, skipped: true, reason: 'Tidak memerlukan absensi', mappedStatus: 'NONE' } };
    }
    validateStatus('SAKIT', status);

    // Check if already synced
    const existing = await this.prisma.ketidakhadiran.findFirst({
      where: { rekam_medis_id: id, aktif: true },
    });

    if (existing) {
      await this.prisma.ketidakhadiran.update({
        where: { id: existing.id },
        data: {
          status,
          keterangan: rm.keluhan || existing.keterangan,
          tindak_lanjut: rm.tindak_lanjut,
          tindakan: Array.isArray(rm.tindakan) ? rm.tindakan.join(', ') : (rm.tindakan || null),
          updated_at: new Date(),
        },
      });
      return { ok: true, result: { ok: true, mappedStatus: status, id: existing.id } };
    }

    // Resolve class if missing or if non-regular
    const resolvedKelas = await this.resolveSiswaKelasReguler(rm.nisn, rm.kelas);
    const kelas = resolvedKelas.kelas || rm.kelas || '';

    const created = await this.prisma.ketidakhadiran.create({
      data: {
        jenis: 'SAKIT',
        nisn: rm.nisn,
        nama: rm.nama_siswa,
        kelas,
        tgl_mulai: rm.tanggal,
        tgl_selesai: rm.tanggal,
        waktu_mulai_real: rm.waktu,
        status,
        keterangan: rm.keluhan || 'Pemeriksaan UKS',
        tindakan: Array.isArray(rm.tindakan) ? rm.tindakan.join(', ') : (rm.tindakan || null),
        tindak_lanjut: rm.tindak_lanjut || null,
        petugas_nama: rm.petugas_nama,
        petugas_nip: rm.petugas_nip,
        petugas_role: 'OP_UKS',
        rekam_medis_id: rm.id,
        aktif: true,
      },
    });

    return { ok: true, result: { ok: true, mappedStatus: status, id: created.id } };
  }

  // ----------------------------------------------------
  // REKAM MEDIS SISWA (UKS)
  // ----------------------------------------------------
  async getRekamMedisSiswa(query: any, apiUser: any) {
    this.checkIsUksStaff(apiUser);
    validateQuery(query);
    const action = query.action;

    if (action === 'get_presets') {
      return this.getPresets();
    }

    // Search students for auto-fill
    if (action === 'search_siswa') {
      const q = (query.q || '').trim();
      const masterStudents = await this.prisma.master_siswa.findMany({
        where: q
          ? {
              OR: [
                { nama_lengkap: { contains: q, mode: 'insensitive' } },
                { nisn: { contains: q, mode: 'insensitive' } },
              ],
            }
          : undefined,
        take: 50,
        orderBy: { nama_lengkap: 'asc' },
      });

      const nisnList = masterStudents.map((s) => s.nisn).filter(Boolean) as string[];
      const regulerNames = await this.getRegulerKelasNames();

      const [classData, asuhData] = await Promise.all([
        nisnList.length > 0
          ? this.prisma.siswa_kelas.findMany({
              where: { nisn: { in: nisnList }, aktif: true, kelas: { in: regulerNames } },
              select: { nisn: true, kelas: true, tahun_ajaran: true },
              orderBy: [{ tahun_ajaran: 'desc' }, { created_at: 'desc' }],
            })
          : [],
        nisnList.length > 0
          ? this.prisma.guru_asuh.findMany({
              where: { nisn_siswa: { in: nisnList }, aktif: true },
              select: { nisn_siswa: true, nama_guru: true },
            })
          : [],
      ]);

      const classMap: Record<string, string> = {};
      (classData as any[]).forEach((c: any) => {
        if (c.nisn && !classMap[c.nisn]) classMap[c.nisn] = c.kelas;
      });

      const asuhMap: Record<string, string> = {};
      (asuhData as any[]).forEach((a: any) => {
        if (a.nisn_siswa && !asuhMap[a.nisn_siswa]) asuhMap[a.nisn_siswa] = a.nama_guru;
      });

      const enriched = masterStudents.map((s) => ({
        nisn: s.nisn,
        nama_siswa: s.nama_lengkap,
        kelas: s.nisn ? classMap[s.nisn] || '-' : '-',
        guru_asuh: s.nisn ? asuhMap[s.nisn] || '-' : '-',
        gender: s.gender || 'L',
        tempat_lahir: s.tempat_lahir || '-',
        tanggal_lahir: toDateString(s.tanggal_lahir),
        alamat: s.alamat || '-',
      }));

      return { ok: true, data: enriched };
    }

    // Listing medical records
    const q = (query.q || '').trim();
    const kelas = (query.kelas || '').trim();
    const nisn = (query.nisn || '').trim();
    const page = boundedInt(query.page, 1, 100000);
    const limit = boundedInt(query.limit, 50, 5000);
    const skip = (page - 1) * limit;

    const where: any = {
      aktif: true,
    };

    if (nisn) where.nisn = nisn;
    if (kelas) where.kelas = kelas;
    if (q) {
      where.OR = [
        { nama_siswa: { contains: q, mode: 'insensitive' } },
        { nisn: { contains: q, mode: 'insensitive' } },
        { no_rekam_medis: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.rekam_medis_siswa.count({ where }),
      this.prisma.rekam_medis_siswa.findMany({
        where,
        include: {
          ketidakhadiran: {
            where: { aktif: true },
            select: { id: true, status: true },
            take: 1,
          },
        },
        orderBy: { tanggal: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const data = records.map((r: any) => {
      const synced = r.ketidakhadiran?.[0];
      return {
        ...r,
        tanggal: toDateString(r.tanggal),
        tanggal_lahir: toDateString(r.tanggal_lahir),
        waktu: toTimeString(r.waktu),
        is_synced: Boolean(synced),
        synced_status: synced?.status || null,
      };
    });

    return {
      ok: true,
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createRekamMedisSiswa(body: any, apiUser: any): Promise<any> {
    if (!this.inTransaction) return this.atomic(s => s.createRekamMedisSiswa(body, apiUser), apiUser, 'CREATE_MEDICAL');
    this.checkIsUksStaff(apiUser);

    if (body?.action === 'save_presets') {
      return this.savePresets(body.presets || body, apiUser);
    }
    if (body?.action === 'sync_ketidakhadiran') {
      return this.syncKetidakhadiran(body.id, body.mappedStatus, apiUser);
    }

    validateText(body);
    const fingerprint = createHash('sha256').update(JSON.stringify(body)).digest('hex');
    let requestKey: string | undefined;
    if (body.idempotencyKey) {
      if (!/^[a-f0-9-]{36}$/i.test(body.idempotencyKey)) throw new BadRequestException('ID permintaan tidak valid');
      requestKey = 'rm-request-' + createHash('sha256').update(`${apiUser.id || apiUser.nip}:${body.idempotencyKey}`).digest('hex');
      const receipt = await this.prisma.system_config.findUnique({ where: { key: requestKey } });
      if (receipt?.value) {
        const saved = JSON.parse(receipt.value);
        if (saved.fingerprint !== fingerprint) throw new BadRequestException('ID permintaan sudah digunakan untuk data berbeda');
        const prior = await this.prisma.rekam_medis_siswa.findUnique({ where: { id: saved.id } });
        if (!prior?.aktif) throw new BadRequestException('Permintaan ini telah dihapus; gunakan permintaan baru');
        return { ok: true, data: { ...prior, tanggal: toDateString(prior.tanggal), tanggal_lahir: toDateString(prior.tanggal_lahir), waktu: toTimeString(prior.waktu) }, syncResult: saved.syncResult };
      }
    }
    if (!body.nisn || !body.keluhan?.trim()) throw new BadRequestException('Siswa dan keluhan wajib diisi');
    validatePeriod({ ...body, tanggal: body.tanggal || await this.getSchoolToday() });
    const siswa = await this.prisma.master_siswa.findFirst({ where: { nisn: String(body.nisn) } });
    if (!siswa) throw new BadRequestException('Siswa tidak ditemukan pada master');
    const resolved = await this.resolveSiswaKelasReguler(String(body.nisn));
    const asuh = await this.prisma.guru_asuh.findFirst({ where: { nisn_siswa: String(body.nisn), aktif: true }, select: { nama_guru: true } });
    body = { ...body, nama_siswa: siswa.nama_lengkap, kelas: resolved.kelas, guru_asuh: asuh?.nama_guru || null, gender: siswa.gender, tempat_lahir: siswa.tempat_lahir, tanggal_lahir: toDateString(siswa.tanggal_lahir), alamat: siswa.alamat };
    const todayStr = (await this.getSchoolToday()).replace(/-/g, '');
    const prefix = `RM-${todayStr}-`;

    const latest = await this.prisma.rekam_medis_siswa.findFirst({
      where: { no_rekam_medis: { startsWith: prefix } },
      orderBy: { no_rekam_medis: 'desc' },
    });

    let seq = 1;
    if (latest && latest.no_rekam_medis) {
      const parts = latest.no_rekam_medis.split('-');
      const lastNum = parseInt(parts[parts.length - 1] || '0', 10);
      if (!isNaN(lastNum)) seq = lastNum + 1;
    }
    const no_rekam_medis = `${prefix}${seq.toString().padStart(4, '0')}`;

    const created = await this.prisma.rekam_medis_siswa.create({
      data: {
        no_rekam_medis,
        nisn: body.nisn,
        nama_siswa: body.nama_siswa,
        kelas: body.kelas,
        guru_asuh: body.guru_asuh,
        gender: body.gender,
        tempat_lahir: body.tempat_lahir,
        tanggal_lahir: body.tanggal_lahir ? new Date(body.tanggal_lahir) : null,
        alamat: body.alamat,
        tanggal: validDate(body.tanggal || await this.getSchoolToday()),
        waktu: body.waktu ? new Date(`1970-01-01T${body.waktu}Z`) : new Date(),
        riwayat_penyakit: Array.isArray(body.riwayat_penyakit) ? body.riwayat_penyakit : [],
        riwayat_alergi_obat: Array.isArray(body.riwayat_alergi_obat) ? body.riwayat_alergi_obat : [],
        keluhan: body.keluhan || '-',
        tata_laksana: body.tata_laksana,
        tindakan: Array.isArray(body.tindakan) ? body.tindakan : [],
        tindak_lanjut: body.tindak_lanjut || 'Kembali ke Kelas',
        petugas_nama: apiUser?.nama || apiUser?.nama_lengkap || 'Petugas UKS',
        petugas_nip: apiUser?.nip || null,
        aktif: true,
      },
    });

    // Auto-sync to ketidakhadiran
    let syncResult: any = null;
    const selectedStatus = body.mapped_status || body.mappedStatus || await this.statusFor(created.tindak_lanjut);
    if (selectedStatus !== 'NONE') validateStatus('SAKIT', selectedStatus);
    const shouldSync = Boolean(body.auto_sync || body.auto_sync_ketidakhadiran || body.sync_ketidakhadiran) && selectedStatus !== 'NONE';

    if (shouldSync) {
      const status = selectedStatus;

      const tglMulai = created.tanggal;
      const tglSelesaiRaw = body.tgl_selesai_sakit || body.tgl_selesai;
      const tglSelesai = tglSelesaiRaw ? new Date(tglSelesaiRaw) : created.tanggal;

      const waktuMulai = created.waktu;
      const waktuSelesaiRaw = body.waktu_selesai_uks || body.waktu_selesai;
      const waktuSelesai = waktuSelesaiRaw ? new Date(`1970-01-01T${waktuSelesaiRaw}Z`) : null;

      const resolvedKelas = await this.resolveSiswaKelasReguler(created.nisn, created.kelas);
      const kelas = resolvedKelas.kelas || created.kelas || '';

      const syncedKetidakhadiran = await this.prisma.ketidakhadiran.create({
        data: {
          jenis: 'SAKIT',
          nisn: created.nisn,
          nama: created.nama_siswa,
          kelas,
          tgl_mulai: tglMulai,
          tgl_selesai: tglSelesai,
          waktu_mulai_real: waktuMulai,
          waktu_selesai_real: waktuSelesai,
          status,
          keterangan: created.keluhan || 'Pemeriksaan UKS',
          tindakan: Array.isArray(created.tindakan) ? created.tindakan.join(', ') : (created.tindakan || null),
          tindak_lanjut: created.tindak_lanjut || null,
          petugas_nama: created.petugas_nama,
          petugas_nip: created.petugas_nip,
          petugas_role: 'OP_UKS',
          rekam_medis_id: created.id,
          aktif: true,
        },
      });

      syncResult = { ok: true, mappedStatus: status, id: syncedKetidakhadiran.id };
    }

    if (requestKey) await this.prisma.system_config.create({ data: { key: requestKey, description: 'Idempotensi input UKS', value: JSON.stringify({ id: created.id, fingerprint, syncResult }) } });
    return {
      ok: true,
      data: {
        ...created,
        tanggal: toDateString(created.tanggal),
        tanggal_lahir: toDateString(created.tanggal_lahir),
        waktu: toTimeString(created.waktu),
      },
      syncResult,
    };
  }

  async updateRekamMedisSiswa(id: string, body: any, apiUser: any): Promise<any> {
    if (!this.inTransaction) return this.atomic(s => s.updateRekamMedisSiswa(id, body, apiUser), apiUser, 'UPDATE_MEDICAL', id);
    this.checkIsUksStaff(apiUser);

    const existing = await this.prisma.rekam_medis_siswa.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Data rekam medis tidak ditemukan');
    }

    if (!existing.aktif) throw new NotFoundException('Data tidak aktif');
    validateText(body);
    const updated = await this.prisma.rekam_medis_siswa.update({
      where: { id },
      data: {
        keluhan: body.keluhan !== undefined ? body.keluhan : existing.keluhan,
        tata_laksana: body.tata_laksana !== undefined ? body.tata_laksana : existing.tata_laksana,
        tindak_lanjut: body.tindak_lanjut !== undefined ? body.tindak_lanjut : existing.tindak_lanjut,
        riwayat_penyakit: Array.isArray(body.riwayat_penyakit) ? body.riwayat_penyakit : existing.riwayat_penyakit,
        riwayat_alergi_obat: Array.isArray(body.riwayat_alergi_obat) ? body.riwayat_alergi_obat : existing.riwayat_alergi_obat,
        tindakan: Array.isArray(body.tindakan) ? body.tindakan : existing.tindakan,
        updated_at: new Date(),
      },
    });

    // Apply the same follow-up mapping to every linked active absence.
    const newStatus = await this.statusFor(updated.tindak_lanjut);
    await this.prisma.ketidakhadiran.updateMany({
      where: { rekam_medis_id: id, aktif: true },
      data: {
        ...(newStatus === 'NONE' ? { aktif: false } : { status: newStatus }),
        keterangan: updated.keluhan,
        tindak_lanjut: updated.tindak_lanjut,
        tindakan: Array.isArray(updated.tindakan) ? updated.tindakan.join(', ') : (updated.tindakan || null),
        updated_at: new Date(),
      },
    });

    return {
      ok: true,
      data: {
        ...updated,
        tanggal: toDateString(updated.tanggal),
        tanggal_lahir: toDateString(updated.tanggal_lahir),
        waktu: toTimeString(updated.waktu),
      },
    };
  }

  async deleteRekamMedisSiswa(id: string, apiUser?: any): Promise<any> {
    if (!this.inTransaction) return this.atomic(s => s.deleteRekamMedisSiswa(id, apiUser), apiUser, 'DELETE_MEDICAL', id);
    this.checkIsUksStaff(apiUser);

    const existing = await this.prisma.rekam_medis_siswa.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Data rekam medis tidak ditemukan');
    }

    // Soft delete
    await this.prisma.rekam_medis_siswa.update({
      where: { id },
      data: { aktif: false, updated_at: new Date() },
    });

    // Soft delete linked ketidakhadiran
    await this.prisma.ketidakhadiran.updateMany({
      where: { rekam_medis_id: id },
      data: { aktif: false, updated_at: new Date() },
    });

    return { ok: true };
  }

  async saveAccaLetter(body: any, apiUser: any): Promise<any> {
    if (!this.inTransaction) return this.atomic(s => s.saveAccaLetter(body, apiUser), apiUser, 'SAVE_LETTER', body.id);
    const { id, fileName, file_url, fileUrl } = body;
    if (!id) throw new BadRequestException('ID surat wajib diisi');

    const letter = await this.prisma.acca_letters.findUnique({ where: { id } });
    if (!letter) throw new NotFoundException('Surat tidak ditemukan');
    canManageJenis(apiUser, letter.nomor_surat.includes('/UKS/') || ['UKS','SAKIT','REKAM_MEDIK','REKOMENDASI_KONTROL','REKAPAN_SAKIT'].includes(letter.jenis_izin) ? 'SAKIT' : 'IZIN');
    validateText(body);
    const url = file_url || fileUrl;
    if (url) {
      let parsed: URL;
      try { parsed = new URL(url); } catch { throw new BadRequestException('URL arsip tidak valid'); }
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !parsed.pathname.toLowerCase().endsWith('.pdf')) throw new BadRequestException('Arsip harus berupa PDF HTTPS');
      const registered = await this.prisma.file_uploads.findUnique({ where: { file_url: url } });
      if (!registered) throw new BadRequestException('Berkas arsip tidak terdaftar');
    }
    const updateData: any = { is_printed: true };
    if (fileName) {
      updateData.file_name = fileName;
    }
    if (file_url || fileUrl) {
      updateData.file_url = file_url || fileUrl;
    }
    const updated = await this.prisma.acca_letters.update({
      where: { id },
      data: updateData,
      select: { id: true, nomor_surat: true, file_url: true },
    });
    return { ok: true, data: updated };
  }

  async getAccaLetters(query: any, apiUser: any) {
    validateQuery(query);
    const barcode = query.barcode;
    const type = query.type;

    // `limit` datang mentah dari query. Sebelumnya hasil `parseInt` dipakai
    // langsung, sehingga `?limit=abc` menjadi `take: NaN` (Prisma menolak, 500)
    // dan `?limit=999999` menarik seluruh tabel dalam satu permintaan. Dibatasi
    // ke rentang yang wajar, dengan cadangan 50 untuk nilai yang tidak masuk akal.
    const MAKS_BARIS = 500;
    const limitDiminta = Number.parseInt(query.limit, 10);
    const limit = Number.isFinite(limitDiminta) && limitDiminta > 0
      ? Math.min(limitDiminta, MAKS_BARIS)
      : 50;

    const where: any = {};
    if (!apiUser?.isAdmin) {
      const medicalTypes = ['UKS', 'SAKIT', 'REKAM_MEDIK', 'REKOMENDASI_KONTROL', 'REKAPAN_SAKIT'];
      if (apiUser?.roles?.includes('OP_UKS') && apiUser.roles.includes('OP_IZIN')) {
        // A dual operator retains both categories.
      } else if (apiUser?.roles?.includes('OP_UKS')) {
        where.AND = [{ OR: [{ nomor_surat: { contains: '/UKS/' } }, { jenis_izin: { in: medicalTypes } }, { jenis_izin: { in: ['MENINGGALKAN_ASRAMA','AKHIR_PEKAN'] }, ketidakhadiran: { jenis: 'SAKIT' } }] }];
      } else if (apiUser?.roles?.includes('OP_IZIN')) {
        where.AND = [{ NOT: { OR: [{ nomor_surat: { contains: '/UKS/' } }, { jenis_izin: { in: medicalTypes } }] } }];
      } else throw new ForbiddenException('Daftar surat hanya untuk operator');
    }
    if (barcode) {
      where.barcode = barcode;
    }
    if (type === 'UKS') {
      where.nomor_surat = { contains: '/UKS/' };
    } else if (type === 'REKOMENDASI_KONTROL') {
      where.OR = [
        { jenis_izin: 'REKOMENDASI_KONTROL' },
        {
          AND: [
            { nomor_surat: { contains: '/UKS/' } },
            { jenis_izin: { notIn: ['REKAPAN_SAKIT', 'REKAM_MEDIK'] } },
          ],
        },
      ];
    } else if (type === 'REKAPAN') {
      where.jenis_izin = { in: ['REKAPAN_IZIN', 'REKAPAN_SAKIT'] };
    } else if (type === 'MENINGGALKAN_ASRAMA') {
      where.OR = [
        { jenis_izin: 'MENINGGALKAN_ASRAMA' },
        {
          AND: [
            { jenis_izin: { in: ['P', 'M'] } },
            { NOT: { nomor_surat: { contains: '/UKS/' } } },
          ],
        },
      ];
    } else if (type === 'IZIN') {
      where.NOT = [
        { nomor_surat: { contains: '/UKS/' } },
        { jenis_izin: { in: ['REKAPAN_IZIN', 'REKAPAN_SAKIT', 'REKOMENDASI_KONTROL', 'MENINGGALKAN_ASRAMA'] } },
      ];
    }

    const data = await this.prisma.acca_letters.findMany({
      where,
      include: {
        ketidakhadiran: {
          select: { jenis: true, status: true },
        },
      },
      orderBy: { generated_at: 'desc' },
      take: limit,
    });

    const rows = data.map((row: any) => {
      const { ketidakhadiran, ...letter } = row;
      return {
        ...letter,
        file_size: letter.file_size ? Number(letter.file_size) : null,
        kategori: ketidakhadiran?.status || null,
        kategori_jenis: ketidakhadiran?.jenis || null,
      };
    });

    return { ok: true, data: rows };
  }

  async verifyAccaLetter(barcode: string) {
    if (!barcode) {
      return { ok: false, error: 'Barcode wajib diisi', verified: false };
    }
    const letter = await this.prisma.acca_letters.findFirst({
      where: { barcode },
    });
    if (!letter) {
      return { ok: false, error: 'Surat tidak ditemukan', verified: false };
    }

    const sensitive = letter.nomor_surat.includes('/UKS/') || ['REKAPAN_IZIN','REKAPAN_SAKIT','REKAM_MEDIK','REKOMENDASI_KONTROL','UKS','SAKIT'].includes(letter.jenis_izin);
    let backgroundUrl = '/images/Surat ACCA A4.png';
    try {
      const configData = await this.prisma.config_surat.findFirst({
        where: { is_default: true },
        select: { background_url: true },
      });
      if (configData?.background_url) {
        backgroundUrl = configData.background_url;
      } else {
        const profilData = await this.prisma.profil_sekolah.findFirst({
          select: { background_surat_url: true },
        });
        if (profilData?.background_surat_url) {
          backgroundUrl = profilData.background_surat_url;
        }
      }
    } catch (e) {}

    return {
      ok: true,
      verified: true,
      data: {
        id: letter.id,
        nomor_surat: letter.nomor_surat,
        barcode: letter.barcode,
        jenis_izin: letter.jenis_izin,
        siswa_nama: letter.siswa_nama,
        siswa_nisn: sensitive ? null : letter.siswa_nisn,
        siswa_kelas: letter.siswa_kelas,
        tgl_mulai: letter.tgl_mulai,
        tgl_selesai: letter.tgl_selesai,
        keterangan: sensitive ? 'Isi dokumen memerlukan akses petugas' : letter.keterangan,
        file_url: sensitive ? null : letter.file_url,
        generated_by: letter.generated_by,
        generated_at: letter.generated_at,
        penjabat_nama: letter.penjabat_nama || null,
        penjabat_jabatan: letter.penjabat_jabatan || null,
        background_url: backgroundUrl,
      },
    };
  }

  async deleteAccaLetter(id: string, user: any): Promise<any> {
    if (!this.inTransaction) return this.atomic(s => s.deleteAccaLetter(id, user), user, 'DELETE_LETTER', id);
    if (!id) {
      return { ok: false, error: 'ID surat wajib diisi' };
    }
    const letter = await this.prisma.acca_letters.findUnique({
      where: { id },
    });
    if (!letter) {
      return { ok: false, error: 'Surat tidak ditemukan' };
    }

    const roles = user.roles || [];
    const isAdmin = user.isAdmin || roles.includes('ADMIN') || roles.includes('ADMINISTRATOR');

    const IZIN_LETTER_TYPES = ['MENINGGALKAN_ASRAMA', 'M', 'P', 'REKAPAN_IZIN', 'IZIN'];
    const SAKIT_LETTER_TYPES = ['REKOMENDASI_KONTROL', 'REKAM_MEDIK', 'REKAPAN_SAKIT', 'UKS', 'SAKIT'];

    if (!isAdmin) {
      const canManageThis =
        (roles.includes('OP_IZIN') && (IZIN_LETTER_TYPES.includes(letter.jenis_izin) && !letter.nomor_surat.includes('/UKS/'))) ||
        (roles.includes('OP_UKS') && (SAKIT_LETTER_TYPES.includes(letter.jenis_izin) || letter.nomor_surat.includes('/UKS/')));

      if (!canManageThis) {
        return { ok: false, error: 'Anda tidak memiliki izin untuk menghapus surat ini' };
      }
    }

    await this.prisma.acca_letters.delete({
      where: { id },
    });
    await this.prisma.system_config.deleteMany({ where: { key: `acca-snapshot-${id}` } });

    return { ok: true, message: 'Surat ACCA berhasil dihapus' };
  }

  async createAccaLetter(body: any, appOrigin: string, apiUser: any): Promise<any> {
    if (!this.inTransaction) return this.atomic(s => s.createAccaLetter(body, appOrigin, apiUser), apiUser, 'CREATE_LETTER');
    validateText(body);
    const record = body.row?.id ? await this.prisma.ketidakhadiran.findUnique({ where: { id: String(body.row.id) }, include: { rekam_medis_siswa: { select: { petugas_nama: true, petugas_nip: true } } } }) : null;
    if (!record?.aktif) throw new BadRequestException('Data ketidakhadiran tidak ditemukan');
    if (['UKS', 'SAKIT', 'REKOMENDASI_KONTROL'].includes(body.letterType) && record.jenis !== 'SAKIT') throw new BadRequestException('Surat rekomendasi UKS memerlukan data sakit');
    canManageJenis(apiUser, record.jenis);
    if (body.letterType === 'UKS') canManageJenis(apiUser, 'SAKIT');
    let authoritativeRows = [record];
    if (body.rows) {
      if (!Array.isArray(body.rows) || !body.rows.length || body.rows.length > 500) throw new BadRequestException('Daftar siswa tidak valid');
      authoritativeRows = await this.prisma.ketidakhadiran.findMany({ where: { id: { in: body.rows.map((r: any) => String(r.id)) }, aktif: true }, include: { rekam_medis_siswa: { select: { petugas_nama: true, petugas_nip: true } } } });
      if (authoritativeRows.length !== body.rows.length) throw new BadRequestException('Data kolektif tidak ditemukan');
      for (const r of authoritativeRows) { canManageJenis(apiUser, r.jenis); if (r.jenis !== record.jenis || toDateString(r.tgl_mulai) !== toDateString(record.tgl_mulai) || toDateString(r.tgl_selesai) !== toDateString(record.tgl_selesai)) throw new BadRequestException('Periode dan jenis surat kolektif berbeda'); }
    }
    body = { ...body, row: { ...record, nama: authoritativeRows.length > 1 ? `${authoritativeRows.length} Siswa (Kolektif)` : record.nama, nisn: authoritativeRows.map(r => r.nisn).join(','), tgl_mulai: toDateString(record.tgl_mulai), tgl_selesai: toDateString(record.tgl_selesai) } };
    const { row, pejabatId, pejabatJabatan: bodyPejabatJabatan, letterType: reqType } = body;
    if (!row) {
      throw new BadRequestException('Data siswa wajib diisi');
    }

    if (body.forceReprint) {
      if (!body.oldLetterId) throw new BadRequestException('ID surat lama wajib diisi');
      const old = await this.prisma.acca_letters.findUnique({ where: { id: String(body.oldLetterId) } });
      if (!old) throw new NotFoundException('Surat lama tidak ditemukan');
      const oldJenis = old.nomor_surat.includes('/UKS/') ? 'SAKIT' : 'IZIN';
      canManageJenis(apiUser, oldJenis);
      if (oldJenis !== record.jenis || old.siswa_nisn !== row.nisn || old.tgl_mulai !== row.tgl_mulai || old.tgl_selesai !== row.tgl_selesai) throw new BadRequestException('Surat lama tidak sesuai data cetak ulang');
      await this.prisma.acca_letters.delete({ where: { id: old.id } });
      await this.prisma.system_config.deleteMany({ where: { key: `acca-snapshot-${old.id}` } });
    }
    const existingRecord = await this.prisma.acca_letters.findFirst({
      where: {
        siswa_nisn: row.nisn,
        tgl_mulai: row.tgl_mulai,
        tgl_selesai: row.tgl_selesai,
      },
      select: { id: true, nomor_surat: true, barcode: true }
    });

    if (existingRecord) {
      return {
        ok: false,
        error: `Surat ACCA untuk siswa ini pada periode tersebut sudah pernah dicetak dengan nomor: ${existingRecord.nomor_surat}. Silakan hapus data surat lama terlebih dahulu untuk mencetak ulang.`,
        isDuplicate: true,
        existingNomor: existingRecord.nomor_surat,
        data: existingRecord
      };
    }

    const tahun = new Date().getFullYear().toString();
    const isUks = reqType === 'UKS' || row.jenis === 'SAKIT';
    const jenisIzin = isUks ? 'UKS' : (row.status === 'MADRASAH' ? 'M' : 'P');
    const monthRoman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][new Date().getMonth()] || 'I';

    let nextNumber = 1;
    const tahunNum = parseInt(String(tahun), 10) || new Date().getFullYear();
    if (isUks) {
      const lastLetter = await this.prisma.acca_letters.findFirst({
        where: {
          nomor_surat: { contains: '/UKS/' },
          AND: { nomor_surat: { contains: `/${tahun}` } }
        },
        orderBy: { nomor_urut: 'desc' },
        select: { nomor_urut: true }
      });
      nextNumber = (lastLetter?.nomor_urut || 0) + 1;
    } else {
      const seq = await this.prisma.acca_letter_sequence.findUnique({
        where: { tahun: tahunNum }
      });
      if (seq) {
        nextNumber = (seq.last_number || 0) + 1;
      }
    }

    const nomorSurat = isUks
      ? `${String(nextNumber).padStart(3, '0')}/UKS/ACCA/${monthRoman}/${tahun}`
      : `${String(nextNumber).padStart(3, '0')}/IZIN/${jenisIzin}/ACCA/${monthRoman}/${tahun}`;

    const barcode = 'ACCA-' + randomUUID();

    let pejabatNama = 'Imran, S.Si.';
    let pejabatNip = '-';
    let pejabatJabatan = bodyPejabatJabatan || '';

    if (isUks) {
      const signers = authoritativeRows.map(uksRecommendationSigner);
      const signer = signers[0];
      if (!signer || signers.some(item => !item)) throw new BadRequestException('Nama petugas UKS pada catatan pemeriksaan belum tersedia');
      if (signers.some(item => item!.nama !== signer.nama)) throw new BadRequestException('Cetak rekomendasi secara terpisah untuk petugas UKS yang berbeda');
      pejabatNama = signer.nama; pejabatNip = signer.nip; pejabatJabatan = signer.jabatan;
    } else if (pejabatId) {
      const numericId = parseInt(pejabatId, 10);
      let guruData: any = null;
      if (!isNaN(numericId)) {
        guruData = await this.prisma.master_guru.findUnique({ where: { id: numericId } });
      }
      if (!guruData && typeof pejabatId === 'string' && pejabatId.length > 5) {
        guruData = await this.prisma.master_guru.findFirst({ where: { nip: pejabatId } });
      }
      if (!guruData) {
        guruData = await this.prisma.master_guru.findFirst({
          where: { nama_lengkap: { contains: pejabatId, mode: 'insensitive' } }
        });
      }
      if (guruData) {
        pejabatNama = guruData.nama_lengkap || pejabatNama;
        pejabatNip = guruData.nip || pejabatNip;
      }
    }

    if (!isUks) {
      await this.prisma.acca_letter_sequence.upsert({
        where: { tahun: tahunNum },
        update: { last_number: nextNumber },
        create: { tahun: tahunNum, last_number: nextNumber },
      });
    }

    const created = await this.prisma.acca_letters.create({
      data: {
        nomor_surat: nomorSurat,
        nomor_urut: nextNumber,
        barcode,
        jenis_izin: isUks ? 'UKS' : jenisIzin,
        ketidakhadiran_id: record.id,
        penjabat_nama: pejabatNama, penjabat_jabatan: pejabatJabatan,
        siswa_nama: row.nama,
        siswa_nisn: row.nisn,
        siswa_kelas: row.kelas,
        tgl_mulai: row.tgl_mulai,
        tgl_selesai: row.tgl_selesai,
        keterangan: row.keterangan || '',
        generated_by: apiUser.nama_lengkap || apiUser.nama || apiUser.nip,
      },
      select: { id: true, nomor_surat: true, barcode: true, file_url: true }
    });

    return {
      ok: true,
      data: {
        id: created.id,
        nomor_surat: created.nomor_surat,
        barcode: created.barcode,
        file_url: created.file_url,
        pejabat: { nama: pejabatNama, jabatan: pejabatJabatan, nip: pejabatNip },
      }
    };
  }
}


