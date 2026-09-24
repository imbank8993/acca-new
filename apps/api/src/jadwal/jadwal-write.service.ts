import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export function jadwalDate(value: unknown): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('Tanggal harus berformat YYYY-MM-DD');
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('Tanggal tidak valid');
  }
  return date;
}

export function jadwalRows(rows: any, date: Date) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 20000) {
    throw new BadRequestException('Isi jadwal harus berisi 1–20000 baris');
  }
  const slots = new Set<string>();
  return rows.map((row: any, index: number) => {
    const data = {
      nip: String(row?.nip ?? '').trim(),
      nama_guru: String(row?.nama_guru ?? '').trim(),
      hari: String(row?.hari ?? '').trim(),
      jam_ke: String(row?.jam_ke ?? '').trim(),
      kelas: String(row?.kelas ?? '').trim(),
      mata_pelajaran: String(row?.mata_pelajaran ?? row?.mapel ?? '').trim(),
      ruang: row?.ruang ? String(row.ruang).trim() : null,
      aktif: true,
      berlaku_mulai: date,
    };
    if (!data.nip || !data.nama_guru || !data.kelas || !data.mata_pelajaran ||
        !['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].includes(data.hari) ||
        !/^\d+$/.test(data.jam_ke) || Number(data.jam_ke) < 1) {
      throw new BadRequestException(`Data jadwal baris ${index + 1} tidak lengkap atau tidak valid`);
    }
    data.jam_ke = String(Number(data.jam_ke));
    const slot = JSON.stringify([data.kelas, data.hari, data.jam_ke]);
    if (slots.has(slot)) throw new BadRequestException(`Slot ganda: ${data.kelas}, ${data.hari}, jam ${data.jam_ke}`);
    slots.add(slot);
    return data;
  });
}

@Injectable()
export class JadwalWriteService {
  constructor(private readonly prisma: PrismaService) {}

  // Every operation either commits completely or leaves the original schedule intact.
  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 60000,
      });
    } catch (error: any) {
      if (error.code === 'P2002') throw new ConflictException('Slot atau tanggal versi sudah digunakan. Jadwal lama tetap tersimpan.');
      if (error.code === 'P2034') throw new ConflictException('Jadwal sedang diubah pengguna lain. Muat ulang lalu coba lagi.');
      throw error;
    }
  }

  async generate(body: any, user: any) {
    const date = jadwalDate(body?.berlaku_mulai);
    if (!['penuh', 'parsial'].includes(body?.jenis)) throw new BadRequestException('Jenis versi harus penuh atau parsial');
    const rows = jadwalRows(body?.rows, date);
    return this.transaction(async tx => {
      const version = await tx.jadwal_versi.upsert({
        where: { berlaku_mulai: date },
        create: { berlaku_mulai: date, jenis: body.jenis, catatan: String(body.catatan || ''), dibuat_oleh: String(user?.nama || user?.nip || user?.username || '') },
        update: { jenis: body.jenis, catatan: String(body.catatan || '') },
      });
      const replaced = await tx.jadwal_guru.updateMany({
        where: { berlaku_mulai: date, aktif: true }, data: { aktif: false },
      });
      const inserted = await tx.jadwal_guru.createMany({ data: rows.map(row => ({ ...row, versi_id: version.id })) });
      return { ok: true, data: { versi_id: String(version.id), inserted: inserted.count, replaced: replaced.count } };
    });
  }

  async save(body: any) {
    const date = jadwalDate(body?.berlaku_mulai);
    const rows = jadwalRows(body?.rows, date);
    const rawIds = body?.replace_ids ?? [];
    if (!Array.isArray(rawIds) || rawIds.some(id => !/^[1-9]\d*$/.test(String(id)))) throw new BadRequestException('ID jadwal tidak valid');
    const ids = [...new Set(rawIds.map(id => BigInt(id)))];
    return this.transaction(async tx => {
      if (ids.length) {
        const changed = await tx.jadwal_guru.updateMany({ where: { id: { in: ids }, aktif: true }, data: { aktif: false } });
        if (changed.count !== ids.length) throw new ConflictException('Jadwal telah berubah. Muat ulang sebelum menyimpan.');
      }
      const version = await tx.jadwal_versi.upsert({
        where: { berlaku_mulai: date }, update: {},
        create: { berlaku_mulai: date, jenis: 'parsial', catatan: 'Perubahan manual' },
      });
      const inserted = await tx.jadwal_guru.createMany({ data: rows.map(row => ({ ...row, versi_id: version.id })) });
      return { ok: true, data: { inserted: inserted.count } };
    });
  }

  async deleteDates(body: any) {
    if (!Array.isArray(body?.dates) || !body.dates.length) throw new BadRequestException('Pilih tanggal yang akan dihapus');
    const dates = body.dates.map(jadwalDate);
    return this.transaction(async tx => {
      const result = await tx.jadwal_guru.updateMany({ where: { berlaku_mulai: { in: dates }, aktif: true }, data: { aktif: false } });
      // Keep version boundaries and references for historical attendance records.
      return { ok: true, data: { deleted: result.count } };
    });
  }

  async deleteRows(body: any) {
    if (!Array.isArray(body?.ids) || !body.ids.length || body.ids.some((id: unknown) => !/^[1-9]\d*$/.test(String(id)))) {
      throw new BadRequestException('Pilih ID jadwal yang valid');
    }
    const ids = body.ids.map((id: string) => BigInt(id));
    return this.transaction(async tx => {
      const result = await tx.jadwal_guru.updateMany({ where: { id: { in: ids }, aktif: true }, data: { aktif: false } });
      return { ok: true, data: { deleted: result.count } };
    });
  }

  async moveDate(body: any) {
    const oldDate = jadwalDate(body?.old_date);
    const newDate = jadwalDate(body?.new_date);
    if (+oldDate === +newDate) throw new BadRequestException('Tanggal baru harus berbeda');
    return this.transaction(async tx => {
      const version = await tx.jadwal_versi.findUnique({ where: { berlaku_mulai: oldDate } });
      if (!version) throw new NotFoundException('Versi jadwal tidak ditemukan');
      if (await tx.jadwal_versi.findUnique({ where: { berlaku_mulai: newDate } })) throw new ConflictException('Tanggal tujuan sudah memiliki versi jadwal');
      // Update the version first so the database trigger preserves its ID and kind.
      await tx.jadwal_versi.update({ where: { id: version.id }, data: { berlaku_mulai: newDate } });
      const result = await tx.jadwal_guru.updateMany({ where: { versi_id: version.id }, data: { berlaku_mulai: newDate } });
      return { ok: true, data: { updated: result.count } };
    });
  }
}
