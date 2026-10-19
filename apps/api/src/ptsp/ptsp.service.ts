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

const DEFAULT_CONFIG = {
  enabledServices: ['buku-tamu', 'sosialisasi', 'izin-siswa', 'peminjaman-sarana', 'izin-penelitian', 'legalisir', 'ganti-ijazah', 'izin-magang', 'mutasi-siswa', 'pengaduan'],
  waEnabled: true,
  waMessageTemplate: 'Halo {nama}, permohonan {layanan} Anda berhasil diterima. Kode lacak: {kode_lacak}. Gunakan kode tersebut untuk memantau status permohonan.',
  waNotificationsEnabled: true,
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

  async getConfig() {
    const [row, notificationsRow] = await Promise.all([
      this.prisma.site_settings.findUnique({ where: { key: 'ptsp_service_config' } }),
      this.prisma.site_settings.findUnique({ where: { key: 'notif_wa_ptsp' } }),
    ]);
    let legacy: any = {};
    try { if (row?.value) legacy = JSON.parse(row.value); } catch { /* Use safe defaults for malformed saved config. */ }
    try {
      return {
        enabledServices: Array.isArray(legacy.enabledServices) ? legacy.enabledServices.filter((id: string) => DEFAULT_CONFIG.enabledServices.includes(id)) : DEFAULT_CONFIG.enabledServices,
        waEnabled: legacy.waEnabled !== false,
        waMessageTemplate: typeof legacy.waMessageTemplate === 'string' ? legacy.waMessageTemplate.slice(0, 1000) : DEFAULT_CONFIG.waMessageTemplate,
        waNotificationsEnabled: notificationsRow?.value !== 'false',
      };
    } catch { return DEFAULT_CONFIG; }
  }

  async saveConfig(user: any, input: any) {
    if (!this.canManage(user?.roles || [])) throw new ForbiddenException('Akses ditolak. Peran tidak memiliki izin PTSP.');
    const enabledServices = Array.isArray(input?.enabledServices)
      ? [...new Set(input.enabledServices.filter((id: string) => DEFAULT_CONFIG.enabledServices.includes(id)))]
      : DEFAULT_CONFIG.enabledServices;
    if (enabledServices.length === 0) throw new BadRequestException('Pilih minimal satu menu layanan.');
    const value = JSON.stringify({
      enabledServices,
      waEnabled: input?.waEnabled === true,
      waMessageTemplate: typeof input?.waMessageTemplate === 'string' ? input.waMessageTemplate.trim().slice(0, 1000) : DEFAULT_CONFIG.waMessageTemplate,
    });
    await this.prisma.site_settings.upsert({
      where: { key: 'ptsp_service_config' },
      create: { key: 'ptsp_service_config', label: 'Konfigurasi Layanan PTSP', description: 'Pengaturan menu dan pesan WhatsApp PTSP', value, is_active: true },
      update: { value, label: 'Konfigurasi Layanan PTSP', description: 'Pengaturan menu dan pesan WhatsApp PTSP' },
    });
    await this.prisma.site_settings.upsert({
      where: { key: 'notif_wa_ptsp' },
      create: { key: 'notif_wa_ptsp', label: 'Notifikasi WhatsApp PTSP', description: 'Aktif/nonaktif notifikasi perubahan status PTSP', value: String(input?.waNotificationsEnabled === true), is_active: true },
      update: { value: String(input?.waNotificationsEnabled === true), label: 'Notifikasi WhatsApp PTSP' },
    });
    return this.getConfig();
  }

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
      updated_at: new Date(),
    };
    if ('is_edited' in existing) updatePayload.is_edited = true;
    if ('edit_count' in existing) updatePayload.edit_count = (existing.edit_count || 0) + 1;

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

    // Keep the related row in the dedicated PTSP database in sync.
    const statusVal = updatePayload.status !== undefined ? updatePayload.status : null;
    const catatanVal = updatePayload.catatan_admin !== undefined ? updatePayload.catatan_admin : null;

    try {
      if (!isTracking) {
        if (existing.tracking_token) {
          const master = await this.prisma.ptsp_master_tracking.findFirst({
            where: {
              OR: [
                { id: existing.tracking_token },
                { tracking_token: existing.tracking_token },
              ],
            },
          });
          if (master) {
            await this.prisma.ptsp_master_tracking.update({
              where: { id: master.id },
              data: {
                ...(statusVal !== null ? { status: Number(statusVal) } : {}),
                ...(catatanVal !== null ? { catatan_admin: catatanVal } : {}),
                updated_at: new Date(),
              },
            });
          }
        }
      } else {
        const childName = String(existing.table_name || '').replace(/^ptsp_/, '');
        const childTable = Object.keys(PTSP_TABLES).find(
          (candidate) => candidate !== 'ptsp_master_tracking'
            && (candidate === existing.table_name || candidate === `ptsp_${childName}`),
        );
        if (childTable && childTable !== 'ptsp_master_tracking') {
          const childDelegate = (this.prisma as any)[childTable];
          const trackingTokens = [String(existing.id), String(existing.tracking_token)].filter(Boolean);
          const child = await childDelegate.findFirst({
            where: { tracking_token: { in: trackingTokens } },
          });
          if (child) {
            await childDelegate.update({
              where: { id: child.id },
              data: {
                ...(statusVal !== null ? { status: Number(statusVal) } : {}),
                ...(catatanVal !== null ? { catatan_admin: catatanVal } : {}),
                updated_at: new Date(),
              },
            });
          }
        }
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

