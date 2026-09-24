import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const PTSP_TABLES: Record<string, string> = {
  ptsp_buku_tamu: 'Buku Tamu',
  ptsp_izin_magang: 'Izin Magang',
  ptsp_izin_siswa: 'Izin Siswa Asrama',
  ptsp_legalisir: 'Legalisir Dokumen',
  ptsp_mutasi_siswa: 'Mutasi Siswa',
  ptsp_pengganti_ijazah: 'Pengganti Ijazah',
  ptsp_sosialisasi: 'Sosialisasi',
  ptsp_master_tracking: 'Tracking',
  ptsp_peminjaman_sarana: 'Peminjaman Sarana',
  ptsp_izin_penelitian: 'Izin Penelitian',
  ptsp_pengaduan: 'Pengaduan',
};

const TRACKING_COLS = [
  'id',
  'tracking_token',
  'short_code',
  'no_wa',
  'service_type',
  'table_name',
  'status',
  'catatan_admin',
  'created_at',
  'updated_at',
];

const SEARCH_COLS: Record<string, string[]> = {
  ptsp_buku_tamu: ['nama', 'instansi', 'tujuan', 'bertemu_dengan', 'catatan_admin'],
  ptsp_izin_magang: ['nama', 'wa', 'sekolah_kampus', 'jurusan', 'catatan_admin'],
  ptsp_izin_penelitian: ['nama', 'wa', 'instansi', 'judul_penelitian', 'catatan_admin'],
  ptsp_izin_siswa: ['nama', 'kelas', 'keterangan', 'catatan_admin'],
  ptsp_legalisir: ['nama', 'wa', 'jenis_dokumen', 'catatan_admin'],
  ptsp_master_tracking: ['short_code', 'no_wa', 'service_type', 'table_name', 'catatan_admin'],
  ptsp_mutasi_siswa: ['nama_siswa', 'nisn', 'kelas', 'nama_ibu', 'alasan_pindah', 'catatan_admin'],
  ptsp_peminjaman_sarana: ['nama', 'wa', 'alamat', 'catatan_admin'],
  ptsp_pengaduan: ['nama', 'wa', 'jenis_laporan', 'isi_laporan', 'catatan_admin'],
  ptsp_pengganti_ijazah: ['nama_siswa', 'tempat_lahir', 'alamat', 'nisn', 'catatan_admin'],
  ptsp_sosialisasi: ['nama', 'wa', 'instansi', 'jenis', 'tujuan', 'target', 'jumlah_tim', 'catatan_admin'],
};

@Injectable()
export class PtspService {
  constructor(private readonly prisma: PrismaService) {}

  private canManage(roles: string[] = []): boolean {
    const upper = roles.map((r) => r.toUpperCase());
    return upper.some((r) => ['ADMIN', 'ADMINISTRATOR', 'PTSP', 'OP_LAYANAN'].includes(r));
  }

  private getDisplayCols(table: string): string[] {
    if (table === 'ptsp_master_tracking') return TRACKING_COLS;
    return ['id', 'tracking_token', 'status', 'catatan_admin', 'is_edited', 'edit_count', 'created_at', 'updated_at'];
  }

  private buildRow(row: Record<string, any>, table: string) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v === null || v === undefined) continue;
      if (typeof v === 'bigint') {
        out[k] = Number(v);
      } else if (['created_at', 'updated_at'].includes(k) && v instanceof Date) {
        out[k] = v.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
      } else if (['tanggal_mulai', 'tanggal_selesai', 'tanggal_lahir'].includes(k) && v instanceof Date) {
        out[k] = v.toISOString().split('T')[0];
      } else if (k === 'is_edited') {
        out[k] = v ? 'Ya' : 'Tidak';
      } else if (k === 'edit_count') {
        out[k] = Number(v);
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  async getTableData(table: string, page = 1, pageSize = 20, search = '') {
    if (!table || !PTSP_TABLES[table]) {
      throw new BadRequestException('Tabel tidak valid');
    }

    const delegate = (this.prisma as any)[table];
    if (!delegate) {
      throw new BadRequestException(`Delegate untuk tabel ${table} tidak ditemukan`);
    }

    const where: any = {};
    if (search.trim()) {
      const searchTargets = SEARCH_COLS[table] || ['nama', 'catatan_admin'];
      where.OR = searchTargets.map((col) => ({
        [col]: { contains: search.trim(), mode: 'insensitive' },
      }));
    }

    const offset = (page - 1) * pageSize;

    const [data, count] = await Promise.all([
      delegate.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: pageSize,
      }),
      delegate.count({ where }),
    ]);

    const displayCols = this.getDisplayCols(table);
    const rows = (data || []).map((r: any) => this.buildRow(r, table));

    return {
      ok: true,
      table,
      label: PTSP_TABLES[table],
      data: rows,
      total: count || 0,
      page,
      pageSize,
      displayCols,
    };
  }

  async updateTableData(user: any, table: string, id: any, data: any) {
    if (!this.canManage(user.roles)) {
      throw new ForbiddenException('Akses ditolak. Peran tidak memiliki izin PTSP.');
    }

    if (!table || !PTSP_TABLES[table]) {
      throw new BadRequestException('Tabel tidak valid');
    }
    if (!id) {
      throw new BadRequestException('ID diperlukan');
    }
    if (!data || typeof data !== 'object') {
      throw new BadRequestException('data object diperlukan');
    }

    const delegate = (this.prisma as any)[table];
    if (!delegate) {
      throw new BadRequestException(`Delegate untuk tabel ${table} tidak ditemukan`);
    }

    const isTracking = table === 'ptsp_master_tracking';
    const whereId = isTracking ? { id: String(id) } : { id: BigInt(id) };

    const existing = await delegate.findUnique({ where: whereId });
    if (!existing) {
      throw new NotFoundException(`Row dengan id=${id} tidak ditemukan di tabel ${table}`);
    }

    const updatePayload: any = {
      is_edited: true,
      edit_count: (existing.edit_count || 0) + 1,
      updated_at: new Date(),
    };

    if ('status' in data && data.status !== undefined) {
      updatePayload.status = Number(data.status);
    }
    if ('catatan_admin' in data) {
      updatePayload.catatan_admin = data.catatan_admin !== null ? String(data.catatan_admin) : null;
    }

    const updated = await delegate.update({
      where: whereId,
      data: updatePayload,
    });

    // Bidirectional sync
    const statusVal = updatePayload.status !== undefined ? updatePayload.status : null;
    const catatanVal = updatePayload.catatan_admin !== undefined ? updatePayload.catatan_admin : null;

    try {
      if (!isTracking) {
        if (existing.tracking_token) {
          await this.prisma.$executeRaw`SELECT ptsp_sync_child_to_master(
            ${table}::text,
            ${BigInt(id)}::bigint,
            ${statusVal !== null ? Number(statusVal) : null}::integer,
            ${catatanVal}::text
          )`;
        }
      } else {
        await this.prisma.$executeRaw`SELECT ptsp_sync_master_to_child(
          ${String(id)}::uuid,
          ${statusVal !== null ? Number(statusVal) : null}::integer,
          ${catatanVal}::text
        )`;
      }
    } catch (syncErr) {
      console.error('[PTSP sync error]', syncErr);
    }

    return {
      ok: true,
      message: 'Data berhasil diperbarui',
      data: this.buildRow(updated, table),
    };
  }

  async deleteTableData(user: any, table: string, id: any) {
    if (!this.canManage(user.roles)) {
      throw new ForbiddenException('Akses ditolak. Peran tidak memiliki izin PTSP.');
    }

    if (!table || !PTSP_TABLES[table]) {
      throw new BadRequestException('Tabel tidak valid');
    }
    if (!id) {
      throw new BadRequestException('id diperlukan');
    }

    const delegate = (this.prisma as any)[table];
    if (!delegate) {
      throw new BadRequestException(`Delegate untuk tabel ${table} tidak ditemukan`);
    }

    const isTracking = table === 'ptsp_master_tracking';
    const whereId = isTracking ? { id: String(id) } : { id: BigInt(id) };

    const existing = await delegate.findUnique({ where: whereId });
    if (!existing) {
      throw new NotFoundException(`Row dengan id=${id} tidak ditemukan`);
    }

    await delegate.delete({ where: whereId });

    return {
      ok: true,
      message: 'Data berhasil dihapus',
      row: this.buildRow(existing, table),
    };
  }

  async notifyWa(limit = 50) {
    const pending = await this.prisma.ptsp_wa_log.findMany({
      where: {
        wa_sent: false,
        retry_count: { lt: 3 },
      },
      orderBy: { created_at: 'asc' },
      take: limit,
    });

    if (!pending || pending.length === 0) {
      return { ok: true, message: 'No pending notifications', processed: 0 };
    }

    return {
      ok: true,
      processed: pending.length,
      success: 0,
      failed: 0,
    };
  }
}

