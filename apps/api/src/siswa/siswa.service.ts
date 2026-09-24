import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MASTER_ENTITIES } from '../master/master.config';

/**
 * Kolom pribadi siswa (NIK, tanggal lahir, nama & nomor HP orang tua, alamat).
 * Sengaja dibaca dari konfigurasi master supaya definisi "data pribadi siswa"
 * cuma ada di satu tempat: route ini dan `/master/siswa` menyentuh tabel yang
 * sama, jadi dua daftar terpisah pasti akan berbeda cepat atau lambat.
 */
const SENSITIVE_SISWA = MASTER_ENTITIES.siswa.sensitiveFields ?? [];

@Injectable()
export class SiswaService {
  private readonly logger = new Logger(SiswaService.name);

  constructor(private prismaService: PrismaService) {}

  private stripSensitive<T extends Record<string, any>>(row: T): T {
    const copy: Record<string, any> = { ...row };
    for (const f of SENSITIVE_SISWA) delete copy[f];
    return copy as T;
  }

  async findAll(search?: string, page = 1, limit = 20, includeSensitive = false) {
    const skip = (page - 1) * limit;

    /* Pencarian lewat NIK hanya untuk yang boleh melihat NIK. Kalau tidak,
       kolomnya memang tidak ikut terkirim, tapi `?search=<NIK>` tetap memberi
       tahu apakah tebakannya benar — dan nama yang ikut terkirim langsung
       menunjuk pemiliknya. Sama persis dengan celah filter di MasterService. */
    const orTerms: any[] = search
      ? [
          { nama_lengkap: { contains: search, mode: 'insensitive' as const } },
          { nisn: { contains: search, mode: 'insensitive' as const } },
        ]
      : [];
    if (search && includeSensitive) {
      orTerms.push({ nik: { contains: search, mode: 'insensitive' as const } });
    }
    const where = orTerms.length > 0 ? { OR: orTerms } : {};

    const [items, total] = await Promise.all([
      this.prismaService.master_siswa.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nama_lengkap: 'asc' },
      }),
      this.prismaService.master_siswa.count({ where }),
    ]);

    // Convert BigInt IDs to string for JSON serialization
    const formattedItems = items.map((siswa) => {
      const row = { ...siswa, id: siswa.id.toString() };
      return includeSensitive ? row : this.stripSensitive(row);
    });

    return {
      data: formattedItems,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByNisn(nisn: string, includeSensitive = false) {
    const siswa = await this.prismaService.master_siswa.findFirst({
      where: { nisn },
    });

    if (!siswa) {
      throw new NotFoundException(`Siswa dengan NISN ${nisn} tidak ditemukan`);
    }

    const row = { ...siswa, id: siswa.id.toString() };
    return includeSensitive ? row : this.stripSensitive(row);
  }

  async getStudentClasses(nisn: string) {
    const rows = await this.prismaService.siswa_kelas.findMany({
      where: { nisn, aktif: true },
      select: { kelas: true, tahun_ajaran: true, semester: true },
    });
    return { ok: true, data: rows };
  }

  async getSiswaByKelas(kelas: string, tahunAjaran?: string, semesterParam?: string) {
    let tahunAjaranList: string[] = [];
    if (tahunAjaran) {
      tahunAjaranList = [tahunAjaran];
    } else {
      const activeYears = await this.prismaService.master_tahun_ajaran.findMany({
        where: { is_active: true },
        select: { tahun_ajaran: true },
      });
      tahunAjaranList = [...new Set(activeYears.map((t) => t.tahun_ajaran))];
    }

    let semester: string | undefined = undefined;
    if (semesterParam) {
      const s = semesterParam.toLowerCase();
      if (s === '1' || s === 'ganjil') semester = 'Ganjil';
      else if (s === '2' || s === 'genap') semester = 'Genap';
    }

    const where: any = {
      kelas,
      aktif: true,
    };
    if (tahunAjaranList.length > 0) {
      where.tahun_ajaran = { in: tahunAjaranList };
    }
    if (semester) {
      where.semester = semester;
    }

    const data = await this.prismaService.siswa_kelas.findMany({
      where,
      select: { nama_siswa: true, nisn: true, kelas: true, aktif: true },
      orderBy: { nama_siswa: 'asc' },
    });

    const uniqueSiswa = new Map<string, any>();
    data.forEach((s) => {
      if (!uniqueSiswa.has(s.nisn)) {
        uniqueSiswa.set(s.nisn, {
          siswa_id: s.nisn,
          nama_siswa: s.nama_siswa,
          nisn: s.nisn,
          kelas: s.kelas,
          aktif: s.aktif,
        });
      }
    });

    return {
      ok: true,
      data: Array.from(uniqueSiswa.values()),
    };
  }
}

