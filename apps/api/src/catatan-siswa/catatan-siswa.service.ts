import { Injectable, ForbiddenException, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class CatatanSiswaService {
  constructor(private readonly prisma: PrismaService) {}

  private formatDate(date: Date | null | undefined): string | null {
    if (!date) return null;
    return date.toISOString().substring(0, 10);
  }

  private formatDateTime(date: Date | null | undefined): string | null {
    if (!date) return null;
    return date.toISOString(); // Or local timestamp if preferred, using ISO string is standard
  }

  private serializeRecord(record: any): any {
    if (!record) return record;
    return {
      ...record,
      id: typeof record.id === 'bigint' ? record.id.toString() : record.id,
      jadwal_id: typeof record.jadwal_id === 'bigint' ? record.jadwal_id.toString() : record.jadwal_id,
      jurnal_id: typeof record.jurnal_id === 'bigint' ? record.jurnal_id.toString() : record.jurnal_id,
      jadwal_versi_id: typeof record.jadwal_versi_id === 'bigint' ? record.jadwal_versi_id.toString() : record.jadwal_versi_id,
      tanggal: this.formatDate(record.tanggal),
      created_at: this.formatDateTime(record.created_at),
      updated_at: this.formatDateTime(record.updated_at),
      catatan_siswa_tindak_lanjut: record.catatan_siswa_tindak_lanjut?.map((t: any) => ({
        ...t,
        id: typeof t.id === 'bigint' ? t.id.toString() : t.id,
        created_at: this.formatDateTime(t.created_at),
      })),
    };
  }

  async getCatatan(apiUser: any, query: any) {
    const isAdminOrBk = apiUser.isAdmin || apiUser.roles.includes('BK');

    let whereClause: Prisma.catatan_siswaWhereInput = {};

    if (query.sesi_id) {
      if (!apiUser.isPrivileged) {
        const sesi = await this.prisma.absensi_sesi.findUnique({
          where: { sesi_id: query.sesi_id },
          select: { nip: true, guru_pengganti_nip: true }
        });
        if (!sesi) {
          throw new NotFoundException('Sesi tidak ditemukan');
        }
        const isOwner = sesi.nip === apiUser.nip;
        const isSubstitute = sesi.guru_pengganti_nip === apiUser.nip;
        if (!isOwner && !isSubstitute) {
          throw new ForbiddenException('Anda tidak memiliki izin melihat catatan sesi ini.');
        }
      }
      whereClause.sesi_id = query.sesi_id;
          } else if (query.kelas || query.tanggal_from || query.tanggal_to) {
      if (!isAdminOrBk) {
        if (apiUser.roles.includes('WALI_KELAS') && query.kelas) {
          const waliRows = await this.prisma.wali_kelas.findMany({
            where: { nip: apiUser.nip, aktif: true },
            select: { nama_kelas: true }
          });
          const allowedKelas = waliRows.map(w => w.nama_kelas);
          if (!allowedKelas.includes(query.kelas)) {
            throw new ForbiddenException('Kelas tersebut bukan kelas Anda.');
          }
        } else {
          whereClause.nip = apiUser.nip;
        }
      }
      
      if (query.kelas) {
        whereClause.kelas = query.kelas;
      }
      
      if (query.tanggal_from || query.tanggal_to) {
        whereClause.tanggal = {};
        if (query.tanggal_from) {
          whereClause.tanggal.gte = new Date(query.tanggal_from);
        }
        if (query.tanggal_to) {
          whereClause.tanggal.lte = new Date(query.tanggal_to);
        }
      }
    } else {
      throw new BadRequestException('sesi_id atau kelas/tanggal_from/tanggal_to wajib diisi');
    }

    if (query.jenis) {
      whereClause.jenis = query.jenis;
    }
    if (query.status) {
      whereClause.status = query.status;
    }
    if (query.nisn) {
      whereClause.nisn = query.nisn;
    }
    if (query.q) {
      whereClause.nama_snapshot = {
        contains: query.q,
        mode: 'insensitive'
      };
    }

    if (query.pelapor) {
      whereClause.nama_guru = {
        contains: query.pelapor,
        mode: 'insensitive'
      };
    }
    if (query.semester) {
      whereClause.semester = parseInt(query.semester, 10);
    }
    if (query.tahun_ajaran) {
      whereClause.tahun_ajaran = query.tahun_ajaran;
    }
    
    // Check if pagination is requested (if not, fallback to fetching all or limit to 1000)
    let paginationOpts: any = {};
    if (query.page || query.limit) {
      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit ? parseInt(query.limit, 10) : 50;
      paginationOpts.skip = (page - 1) * limit;
      paginationOpts.take = limit;
      
      const [total, data] = await this.prisma.$transaction([
        this.prisma.catatan_siswa.count({ where: whereClause }),
        this.prisma.catatan_siswa.findMany({
          where: whereClause,
          include: { catatan_siswa_tindak_lanjut: true },
          orderBy: { created_at: 'desc' },
          ...paginationOpts
        })
      ]);
      
      return {
        data: data.map(d => this.serializeRecord(d)),
        meta: { total, page, limit, total_pages: Math.ceil(total / limit) }
      };
    }

    const data = await this.prisma.catatan_siswa.findMany({
      where: whereClause,
      include: {
        catatan_siswa_tindak_lanjut: true
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    return { data: data.map(d => this.serializeRecord(d)) };
  }

  async createCatatan(apiUser: any, body: any) {
    const sesi = await this.prisma.absensi_sesi.findUnique({
      where: { sesi_id: body.sesi_id },
      select: { nip: true, nama_guru: true, guru_pengganti_nip: true, guru_pengganti_nama: true, kelas: true, mapel: true, tanggal: true, jam_ke: true, tahun_ajaran: true, semester: true }
    });

    if (!sesi) {
      throw new NotFoundException('Sesi tidak ditemukan');
    }

    const isOwner = sesi.nip === apiUser.nip;
    const isSubstitute = sesi.guru_pengganti_nip === apiUser.nip;
    
    if (!apiUser.isPrivileged && !isOwner && !isSubstitute) {
      throw new ForbiddenException('Anda tidak memiliki izin menambah catatan pada sesi ini.');
    }

    const nama_guru = isSubstitute ? (sesi.guru_pengganti_nama || apiUser.nip) : (sesi.nama_guru || apiUser.nip);

    const data = await this.prisma.catatan_siswa.create({
      data: {
        sesi_id: body.sesi_id,
        nisn: body.nisn,
        nama_snapshot: body.nama_snapshot,
        kelas: sesi.kelas,
        tanggal: sesi.tanggal,
        jam_ke: sesi.jam_ke,
        mapel: sesi.mapel,
        nip: apiUser.nip,
        nama_guru,
        jenis: body.jenis,
        catatan: body.catatan.trim(),
        tahun_ajaran: sesi.tahun_ajaran,
        semester: sesi.semester,
      },
      include: {
        catatan_siswa_tindak_lanjut: true
      }
    });

    return this.serializeRecord(data);
  }

  async updateCatatan(apiUser: any, id: string, body: any) {
    const existing = await this.prisma.catatan_siswa.findUnique({
      where: { id },
      select: { nip: true, status: true }
    });

    if (!existing) {
      throw new NotFoundException('Catatan tidak ditemukan');
    }
    if (!apiUser.isPrivileged && existing.nip !== apiUser.nip) {
      throw new ForbiddenException('Anda tidak memiliki izin mengubah catatan ini.');
    }
    if (existing.status !== 'BARU') {
      throw new ForbiddenException('Catatan sudah ditindaklanjuti BK dan tidak bisa diubah lagi.');
    }

    const updates: any = { updated_at: new Date() };
    if (body.jenis !== undefined) updates.jenis = body.jenis;
    if (body.catatan !== undefined) updates.catatan = body.catatan.trim();

    const data = await this.prisma.catatan_siswa.update({
      where: { id },
      data: updates,
      include: {
        catatan_siswa_tindak_lanjut: true
      }
    });

    return this.serializeRecord(data);
  }

  async deleteCatatan(apiUser: any, id: string) {
    const existing = await this.prisma.catatan_siswa.findUnique({
      where: { id },
      select: { nip: true, status: true }
    });

    if (!existing) {
      throw new NotFoundException('Catatan tidak ditemukan');
    }
    if (!apiUser.isPrivileged && existing.nip !== apiUser.nip) {
      throw new ForbiddenException('Anda tidak memiliki izin menghapus catatan ini.');
    }
    if (existing.status !== 'BARU') {
      throw new ForbiddenException('Catatan sudah ditindaklanjuti BK dan tidak bisa dihapus.');
    }

    await this.prisma.catatan_siswa.delete({
      where: { id }
    });
    
    return true;
  }

  async tindakLanjut(apiUser: any, id: string, body: any) {
    if (!apiUser.isAdmin && !apiUser.roles.includes('BK')) {
      throw new ForbiddenException('Hanya Bimbingan Konseling atau Admin yang dapat menindaklanjuti catatan siswa.');
    }

    const existing = await this.prisma.catatan_siswa.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!existing) {
      throw new NotFoundException('Catatan tidak ditemukan');
    }

    const staff = await this.prisma.public_users.findUnique({
      where: { id: BigInt(apiUser.id) },
      select: { nama: true, nama_lengkap: true }
    });
    
    const namaStaff = staff?.nama_lengkap || staff?.nama || apiUser.nip;

    await this.prisma.$transaction([
      this.prisma.catatan_siswa_tindak_lanjut.create({
        data: {
          catatan_id: id,
          nip: apiUser.nip,
          nama: namaStaff,
          catatan: body.catatan.trim(),
          status_baru: body.status_baru,
        }
      }),
      this.prisma.catatan_siswa.update({
        where: { id },
        data: { status: body.status_baru, updated_at: new Date() }
      })
    ]);

    const updated = await this.prisma.catatan_siswa.findUnique({
      where: { id },
      include: {
        catatan_siswa_tindak_lanjut: true
      }
    });

    return this.serializeRecord(updated);
  }
}

