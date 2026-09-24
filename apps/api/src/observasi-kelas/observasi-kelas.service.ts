import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
export class ObservasiKelasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: any) {
    const { search, kelas, nama_guru } = query || {};
    const where: any = {};

    if (kelas) where.kelas = String(kelas);
    if (nama_guru) where.nama_guru = { contains: String(nama_guru), mode: 'insensitive' };

    if (search) {
      where.OR = [
        { nama_guru: { contains: String(search), mode: 'insensitive' } },
        { nama_observer: { contains: String(search), mode: 'insensitive' } },
        { kelas: { contains: String(search), mode: 'insensitive' } },
        { mapel: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const data = await this.prisma.observasi_kelas.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    return { ok: true, data: serializeBigInt(data) };
  }

  async findOne(id: string | number) {
    const idBig = BigInt(id);
    const item = await this.prisma.observasi_kelas.findUnique({
      where: { id: idBig },
    });
    if (!item) throw new NotFoundException('Data observasi tidak ditemukan');
    return { ok: true, data: serializeBigInt(item) };
  }

  async create(payload: any) {
    const {
      nama_observer,
      jabatan_observer,
      kelas,
      nama_guru,
      mapel,
      praktik_baik,
      catatan_perbaikan,
    } = payload;

    if (!nama_observer || !jabatan_observer || !kelas || !nama_guru || !mapel || !praktik_baik || !catatan_perbaikan) {
      throw new BadRequestException('Semua field wajib diisi');
    }

    const item = await this.prisma.observasi_kelas.create({
      data: {
        nama_observer: String(nama_observer),
        jabatan_observer: String(jabatan_observer),
        kelas: String(kelas),
        nama_guru: String(nama_guru),
        mapel: String(mapel),
        praktik_baik: String(praktik_baik),
        catatan_perbaikan: String(catatan_perbaikan),
      },
    });

    return { ok: true, data: serializeBigInt(item) };
  }

  async update(id: string | number, payload: any) {
    const idBig = BigInt(id);
    const existing = await this.prisma.observasi_kelas.findUnique({ where: { id: idBig } });
    if (!existing) throw new NotFoundException('Data observasi tidak ditemukan');

    const updateData: any = {};
    if (payload.nama_observer !== undefined) updateData.nama_observer = String(payload.nama_observer);
    if (payload.jabatan_observer !== undefined) updateData.jabatan_observer = String(payload.jabatan_observer);
    if (payload.kelas !== undefined) updateData.kelas = String(payload.kelas);
    if (payload.nama_guru !== undefined) updateData.nama_guru = String(payload.nama_guru);
    if (payload.mapel !== undefined) updateData.mapel = String(payload.mapel);
    if (payload.praktik_baik !== undefined) updateData.praktik_baik = String(payload.praktik_baik);
    if (payload.catatan_perbaikan !== undefined) updateData.catatan_perbaikan = String(payload.catatan_perbaikan);

    const updated = await this.prisma.observasi_kelas.update({
      where: { id: idBig },
      data: updateData,
    });

    return { ok: true, data: serializeBigInt(updated) };
  }

  async delete(id: string | number) {
    const idBig = BigInt(id);
    const existing = await this.prisma.observasi_kelas.findUnique({ where: { id: idBig } });
    if (!existing) throw new NotFoundException('Data observasi tidak ditemukan');

    await this.prisma.observasi_kelas.delete({ where: { id: idBig } });
    return { ok: true, message: 'Data observasi berhasil dihapus' };
  }
}
