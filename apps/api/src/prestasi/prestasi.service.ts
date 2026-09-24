import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

@Injectable()
export class PrestasiService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: any) {
    const { nisn, status_validasi, tingkat, kategori, search } = query || {};
    const where: any = {};

    if (nisn) where.nisn = String(nisn);
    if (status_validasi) where.status_validasi = String(status_validasi);
    if (tingkat) where.tingkat = String(tingkat);
    if (kategori) where.kategori = String(kategori);

    if (search) {
      where.OR = [
        { nama_lomba: { contains: String(search), mode: 'insensitive' } },
        { penyelenggara: { contains: String(search), mode: 'insensitive' } },
        { prestasi_diraih: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const data = await this.prisma.prestasi_lomba.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    return { ok: true, data: serializeBigInt(data) };
  }

  async findOne(id: string) {
    const item = await this.prisma.prestasi_lomba.findUnique({
      where: { id },
    });
    if (!item) throw new NotFoundException('Prestasi tidak ditemukan');
    return { ok: true, data: serializeBigInt(item) };
  }

  async create(payload: any, currentUser?: any) {
    const {
      nisn,
      nama_lomba,
      kategori,
      tingkat,
      penyelenggara,
      tanggal_pelaksanaan,
      prestasi_diraih,
      bukti_sertifikat,
      foto_kegiatan,
      catatan_validator,
    } = payload;
    // KEAMANAN: status_validasi, validated_by, validated_at dari klien DIABAIKAN pada CREATE.
    // Status awal selalu 'Menunggu'. Validator hanya dapat diatur oleh server.

    if (!nisn || !nama_lomba || !kategori || !tingkat || !penyelenggara || !tanggal_pelaksanaan || !prestasi_diraih || !bukti_sertifikat) {
      throw new BadRequestException('Field wajib harus diisi');
    }

    const item = await this.prisma.prestasi_lomba.create({
      data: {
        nisn: String(nisn),
        nama_lomba: String(nama_lomba),
        kategori: String(kategori),
        tingkat: String(tingkat),
        penyelenggara: String(penyelenggara),
        tanggal_pelaksanaan: new Date(tanggal_pelaksanaan),
        prestasi_diraih: String(prestasi_diraih),
        bukti_sertifikat: String(bukti_sertifikat),
        foto_kegiatan: foto_kegiatan ? String(foto_kegiatan) : null,
        // Status selalu 'Menunggu' pada pembuatan — tidak boleh diubah oleh klien
        status_validasi: 'Menunggu',
        catatan_validator: catatan_validator ? String(catatan_validator) : null,
        // Metadata validator selalu null pada pembuatan
        validated_by: null,
        validated_at: null,
      },
    });

    return { ok: true, data: serializeBigInt(item) };
  }

  async update(id: string, payload: any, currentUser?: any) {
    const existing = await this.prisma.prestasi_lomba.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Prestasi tidak ditemukan');

    if (existing.status_validasi === 'Disetujui') {
      throw new ConflictException('Prestasi sudah disetujui dan tidak dapat diubah');
    }

    const updateData: any = {};
    if (payload.nisn !== undefined) updateData.nisn = String(payload.nisn);
    if (payload.nama_lomba !== undefined) updateData.nama_lomba = String(payload.nama_lomba);
    if (payload.kategori !== undefined) updateData.kategori = String(payload.kategori);
    if (payload.tingkat !== undefined) updateData.tingkat = String(payload.tingkat);
    if (payload.penyelenggara !== undefined) updateData.penyelenggara = String(payload.penyelenggara);
    if (payload.tanggal_pelaksanaan !== undefined) updateData.tanggal_pelaksanaan = new Date(payload.tanggal_pelaksanaan);
    if (payload.prestasi_diraih !== undefined) updateData.prestasi_diraih = String(payload.prestasi_diraih);
    if (payload.bukti_sertifikat !== undefined) updateData.bukti_sertifikat = String(payload.bukti_sertifikat);
    if (payload.foto_kegiatan !== undefined) updateData.foto_kegiatan = payload.foto_kegiatan ? String(payload.foto_kegiatan) : null;
    if (payload.status_validasi !== undefined) updateData.status_validasi = String(payload.status_validasi);
    if (payload.catatan_validator !== undefined) updateData.catatan_validator = payload.catatan_validator ? String(payload.catatan_validator) : null;

    // Identitas validator: HANYA boleh diatur oleh server saat status_validasi diubah
    // Metadata validator TIDAK BOLEH diisi atau dimanipulasi dari payload klien
    if (payload.status_validasi !== undefined) {
      updateData.validated_by = currentUser?.nama || currentUser?.username || currentUser?.nip || 'SYSTEM';
      updateData.validated_at = new Date();
    }
    updateData.updated_at = new Date();

    // Atomic conditional update: kunci di level database agar request bersamaan (race condition) tidak dapat menimpa status
    const result = await this.prisma.prestasi_lomba.updateMany({
      where: {
        id,
        status_validasi: { not: 'Disetujui' },
      },
      data: updateData,
    });

    if (result.count === 0) {
      const check = await this.prisma.prestasi_lomba.findUnique({ where: { id } });
      if (!check) throw new NotFoundException('Prestasi tidak ditemukan');
      if (check.status_validasi === 'Disetujui') {
        throw new ConflictException('Prestasi sudah disetujui oleh validator lain dan tidak dapat diubah lagi');
      }
      throw new ConflictException('Gagal memperbarui status prestasi');
    }

    const updated = await this.prisma.prestasi_lomba.findUnique({ where: { id } });
    return { ok: true, data: serializeBigInt(updated) };
  }

  async delete(id: string) {
    const existing = await this.prisma.prestasi_lomba.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Prestasi tidak ditemukan');

    await this.prisma.prestasi_lomba.delete({ where: { id } });
    return { ok: true, message: 'Prestasi berhasil dihapus' };
  }
}
