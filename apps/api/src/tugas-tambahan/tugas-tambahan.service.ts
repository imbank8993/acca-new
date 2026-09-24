import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const APPROVER_ROLES = ['WKM_AKADEMIK', 'WKM_KESISWAAN', 'SEMUA_WKM', 'KEPALA_MADRASAH'];

function resolveApproverRole(jabatan: string, requested?: string) {
  if (/^wali kelas/i.test(jabatan)) return 'WKM_AKADEMIK';
  if (/^pembina ekstrakurikuler/i.test(jabatan)) return 'WKM_KESISWAAN';
  return APPROVER_ROLES.includes(requested || '') ? requested! : 'SEMUA_WKM';
}

function resolveGrantedRole(jabatan: string): string | null {
  if (/^wali kelas/i.test(jabatan)) return 'WALI_KELAS';
  if (/^pembina ekstrakurikuler/i.test(jabatan)) return 'PEMBINA_EKSKUL';
  return null;
}

@Injectable()
export class TugasTambahanService {
  constructor(private readonly prisma: PrismaService) {}

  async getTugasTambahan(query: { nip?: string; nama_guru?: string; tahun_ajaran?: string; semester?: string }) {
    const whereClause: any = {};

    if (query.nip && query.nama_guru) {
      whereClause.OR = [
        { nip: query.nip },
        { nama_guru: { contains: query.nama_guru, mode: 'insensitive' } },
      ];
    } else if (query.nip) {
      whereClause.nip = query.nip;
    } else if (query.nama_guru) {
      whereClause.nama_guru = { contains: query.nama_guru, mode: 'insensitive' };
    }

    if (query.tahun_ajaran) {
      whereClause.tahun_ajaran = query.tahun_ajaran;
    } else {
      const activePeriods = await this.prisma.master_tahun_ajaran.findMany({
        where: { is_active: true },
        select: { tahun_ajaran: true },
      });
      if (activePeriods.length > 0) {
        const activeYears = Array.from(new Set(activePeriods.map(p => p.tahun_ajaran)));
        whereClause.tahun_ajaran = { in: activeYears };
      }
    }

    if (query.semester) {
      whereClause.semester = parseInt(query.semester, 10);
    }

    return await this.prisma.tugas_tambahan.findMany({
      where: whereClause,
      orderBy: { jabatan: 'asc' },
    });
  }

  async upsertTugasTambahan(data: any) {
    const { nip, nama_guru, jabatan, keterangan, tahun_ajaran, semester, id } = data;

    if (!nip || !jabatan || !tahun_ajaran || semester === undefined) {
      throw new BadRequestException('Missing required fields');
    }

    const approver_role = resolveApproverRole(jabatan, data.approver_role);
    const granted_role = resolveGrantedRole(jabatan);
    const semesterInt = parseInt(semester, 10);

    if (id) {
      return await this.prisma.tugas_tambahan.update({
        where: { id },
        data: {
          nip,
          nama_guru,
          jabatan,
          keterangan,
          tahun_ajaran,
          semester: semesterInt,
          approver_role,
          granted_role,
          updated_at: new Date(),
        },
      });
    }

    const existing = await this.prisma.tugas_tambahan.findFirst({
      where: {
        nip,
        jabatan,
        tahun_ajaran,
        semester: semesterInt,
      },
      select: { id: true },
    });

    if (existing) {
      return await this.prisma.tugas_tambahan.update({
        where: { id: existing.id },
        data: {
          nama_guru,
          keterangan,
          approver_role,
          granted_role,
          updated_at: new Date(),
        },
      });
    }

    return await this.prisma.tugas_tambahan.create({
      data: {
        nip,
        nama_guru,
        jabatan,
        keterangan,
        tahun_ajaran,
        semester: semesterInt,
        approver_role,
        granted_role,
      },
    });
  }

  async deleteTugasTambahan(id: string) {
    if (!id) throw new BadRequestException('ID is required');
    await this.prisma.tugas_tambahan.delete({
      where: { id },
    });
    return { ok: true };
  }

  // --- Jurnal Tugas Tambahan ---

  async getJurnalTugas(query: { tugas_id?: string; nip?: string; startDate?: string; endDate?: string }) {
    const activePeriods = await this.prisma.master_tahun_ajaran.findMany({
      where: { is_active: true },
      select: { tahun_ajaran: true },
    });
    const activeYears = activePeriods.map((p) => p.tahun_ajaran);

    const where: any = {};
    if (query.tugas_id) where.tugas_id = query.tugas_id;
    if (query.nip) where.nip = query.nip;
    if (activeYears.length > 0) {
      where.tugas_tambahan = { tahun_ajaran: { in: activeYears } };
    }
    if (query.startDate || query.endDate) {
      where.tanggal = {};
      if (query.startDate) where.tanggal.gte = new Date(query.startDate);
      if (query.endDate) where.tanggal.lte = new Date(query.endDate);
    }

    const data = await this.prisma.jurnal_tugas_tambahan.findMany({
      where,
      include: { tugas_tambahan: true },
      orderBy: { tanggal: 'desc' },
    });

    return data.map((item) => ({
      ...item,
      tanggal: item.tanggal ? item.tanggal.toISOString().split('T')[0] : null,
      tugas: item.tugas_tambahan,
    }));
  }

  /**
   * `nipPemanggil` menggantikan `nip` dari badan permintaan bagi pemakai biasa.
   *
   * Sebelumnya `nip` dipakai apa adanya, jadi siapa pun yang lolos gerbang bisa
   * menulis jurnal ATAS NAMA guru lain — dan gerbangnya waktu itu `role_pages`,
   * yang dipegang GURU dan TAMU. Pengelola tab tetap boleh menulis untuk NIP lain,
   * karena itu memang tugasnya.
   */
  async upsertJurnalTugas(data: any, nipPemanggil = '', bolehKelola = false) {
    const { id, tugas_id, tanggal, kegiatan, hasil, foto_url } = data;
    const nip = bolehKelola ? String(data.nip ?? '').trim() : nipPemanggil;

    if (!tugas_id || !nip || !kegiatan) {
      throw new BadRequestException('Missing required fields');
    }
    if (!bolehKelola && !nipPemanggil) {
      throw new ForbiddenException('Akun Anda tidak memiliki NIP, jadi tidak bisa menulis jurnal.');
    }

    const tanggalDate = tanggal ? new Date(tanggal) : new Date();
    if (Number.isNaN(tanggalDate.getTime())) {
      throw new BadRequestException('Tanggal jurnal tidak valid');
    }

    // Menyunting jurnal milik orang lain tidak boleh lewat hanya karena id-nya
    // diketahui; kepemilikan diperiksa terhadap baris yang tersimpan.
    if (id && !bolehKelola) {
      const sebelum = await this.prisma.jurnal_tugas_tambahan.findUnique({
        where: { id },
        select: { nip: true },
      });
      if (!sebelum) throw new BadRequestException('Jurnal tidak ditemukan');
      if (sebelum.nip !== nipPemanggil) {
        throw new ForbiddenException('Anda hanya bisa mengubah jurnal milik Anda sendiri.');
      }
    }

    if (id) {
      return await this.prisma.jurnal_tugas_tambahan.update({
        where: { id },
        data: {
          tugas_id,
          nip,
          tanggal: tanggalDate,
          kegiatan,
          hasil,
          foto_url,
          updated_at: new Date(),
        },
      });
    }

    return await this.prisma.jurnal_tugas_tambahan.create({
      data: {
        tugas_id,
        nip,
        tanggal: tanggalDate,
        kegiatan,
        hasil,
        foto_url,
      },
    });
  }

  async deleteJurnalTugas(id: string, nipPemanggil = '', bolehKelola = false) {
    if (!id) throw new BadRequestException('ID is required');

    if (!bolehKelola) {
      const baris = await this.prisma.jurnal_tugas_tambahan.findUnique({
        where: { id },
        select: { nip: true },
      });
      if (!baris) throw new BadRequestException('Jurnal tidak ditemukan');
      if (!nipPemanggil || baris.nip !== nipPemanggil) {
        throw new ForbiddenException('Anda hanya bisa menghapus jurnal milik Anda sendiri.');
      }
    }

    await this.prisma.jurnal_tugas_tambahan.delete({
      where: { id },
    });
    return { ok: true };
  }
}

