import { Injectable, NotFoundException, UnauthorizedException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Validate before writing so an invalid policy cannot lock the admin editor. */
export function normalizeFeatureAccessSetting(key: string, value: unknown): string {
  if (!key.endsWith('_access_config')) return String(value);
  let config: any = value;
  if (typeof config === 'string') {
    try { config = JSON.parse(config); } catch { throw new BadRequestException('Format hak akses harus berupa JSON yang valid'); }
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)
    || !Array.isArray(config.allowedRoles) || !Array.isArray(config.allowedUsers)
    || config.allowedRoles.some((r: unknown) => typeof r !== 'string' || !r.trim())
    || config.allowedUsers.some((u: any) => !u || typeof u !== 'object' || Array.isArray(u)
      || ![u.id, u.nip].some(v => (typeof v === 'string' || typeof v === 'number') && String(v).trim()))) {
    throw new BadRequestException('Hak akses harus berisi daftar role dan pengguna yang valid');
  }
  return JSON.stringify({ ...config, allowedRoles: [...new Set(config.allowedRoles.map((r: string) => r.trim().toUpperCase()))] });
}

@Injectable()
export class SiteSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSetting(key: string, isPublic: boolean, authenticated = false) {
    // `*_access_config` boleh dibaca pemakai yang SUDAH login supaya UI tahu
    // tombol mana yang perlu ditampilkan. Isinya hanya daftar role/pengguna yang
    // ditunjuk — bukan data pribadi — dan penegakannya tetap di server.
    if (isPublic && !key.startsWith('maintenance_') && !(authenticated && (key.endsWith('_access_config') || ['timezone','sanggar_config','informasi_access_config'].includes(key)))) {
      throw new UnauthorizedException('Unauthorized');
    }

    const data = await this.prisma.site_settings.findUnique({
      where: { key },
    });

    if (!data) {
      return null;
    }

    return data;
  }

  async getApiLogs() {
    // @ts-ignore
    return this.prisma.api_logs.findMany({
      take: 10,
      orderBy: { created_at: 'desc' }
    });
  }

  async getAllSettings(isPublic: boolean) {
    let whereClause = {};
    if (isPublic) {
      whereClause = { key: { startsWith: 'maintenance_' } };
    }

    const data = await this.prisma.site_settings.findMany({
      where: whereClause,
      orderBy: { id: 'asc' },
    });

    return data;
  }

  async updateSetting(key: string, body: any) {
    if (key.endsWith('_access_config') && body.value === undefined) {
      throw new BadRequestException('Nilai konfigurasi hak akses wajib diisi');
    }
    const { message, label, description } = body;
    const value = body.value === undefined ? undefined : normalizeFeatureAccessSetting(key, body.value);

    const existing = await this.prisma.site_settings.findUnique({
      where: { key },
    });

    let resultData;

    if (existing) {
      const updateData: any = {};
      if (value !== undefined) updateData.value = String(value);
      if (message !== undefined) updateData.message = message || null;
      if (label !== undefined) updateData.label = label;
      if (description !== undefined) updateData.description = description;

      resultData = await this.prisma.site_settings.update({
        where: { key },
        data: updateData,
      });
    } else {
      const autoLabel = key.replace(/^maintenance_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      resultData = await this.prisma.site_settings.create({
        data: {
          key,
          value: value !== undefined ? String(value) : 'false',
          label: label || autoLabel,
          description: description || '',
          message: message || null,
          is_active: true,
        },
      });
    }

    return resultData;
  }

  async updateSettingsBatch(items: Array<{ key: string; value: unknown }>) {
    items = items.map(item => item.key.endsWith('_access_config')
      ? { ...item, value: normalizeFeatureAccessSetting(item.key, item.value) } : item);
    return this.prisma.$transaction(async (tx) => {
      const results = [];
      for (const { key, value } of items) {
        const autoLabel = key.replace(/^maintenance_/, '').replace(/_/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase());
        results.push(await tx.site_settings.upsert({
          where: { key },
          update: { value: String(value ?? '') },
          create: { key, value: String(value ?? ''), label: autoLabel, description: '', is_active: true },
        }));
      }
      return results;
    });
  }

  // Profil Sekolah
  async getProfilSekolah(id?: number | string) {
    if (id) {
      const parsedId = String(id);
      return this.prisma.profil_sekolah.findUnique({ where: { id: parsedId } });
    }
    return this.prisma.profil_sekolah.findFirst({
      orderBy: { updated_at: 'desc' },
    });
  }

  async createProfilSekolah(data: any) {
    return this.prisma.profil_sekolah.create({
      data: {
        ...data,
      },
    });
  }

  async updateProfilSekolah(id: number | string, data: any) {
    const parsedId = String(id);
    return this.prisma.profil_sekolah.update({
      where: { id: parsedId },
      data: {
        ...data,
        status_terakhir_update: new Date(),
      },
    });
  }

  // Fitur Akademik
  async getFiturAkademik() {
    return this.prisma.fitur_akademik.findMany({
      orderBy: { id: 'asc' }
    });
  }

  async createFiturAkademik(data: any) {
    return this.prisma.fitur_akademik.create({
      data,
    });
  }

  async updateFiturAkademik(id: number | string, data: any) {
    const parsedId = String(id);
    return this.prisma.fitur_akademik.update({
      where: { id: parsedId },
      data,
    });
  }

  async deleteFiturAkademik(id: number | string) {
    const parsedId = String(id);
    return this.prisma.fitur_akademik.delete({
      where: { id: parsedId },
    });
  }

  /**
   * Nilai mentah satu baris `site_settings`, tanpa pemeriksaan publik/privat.
   *
   * Dipakai untuk membaca konfigurasi "Hak Akses Fitur" dari dalam server, di mana
   * pemanggilnya justru sedang MEMUTUSKAN izin — jadi `getSetting()` dengan
   * gerbang publiknya tidak cocok di sini.
   */
  async getRawSetting(key: string): Promise<unknown> {
    const row = await this.prisma.site_settings.findUnique({
      where: { key },
      select: { value: true },
    });
    return row?.value ?? null;
  }

  // Master Dropdown
  async getMasterDropdown() {
    return this.prisma.master_dropdown.findMany({
      orderBy: { id: 'asc' }
    });
  }

  /**
   * Kolom yang boleh diisi dari body permintaan.
   *
   * Sebelumnya body diteruskan apa adanya ke Prisma. Dua akibatnya: satu field
   * asing (mis. nama kolom di frontend berubah) membuat Prisma menolak seluruh
   * permintaan dan Admin hanya melihat "Terjadi kesalahan pada server" tanpa
   * petunjuk apa pun; dan `id` pun ikut bisa ditentukan pemanggil, padahal
   * penghitung autoincrement tidak ikut maju — barisnya tersimpan di nomor
   * pilihan sendiri, lalu berbulan-bulan kemudian penyimpanan normal menabrak
   * nomor itu dan gagal sebagai duplikat, dengan penyebab yang nyaris tak bisa
   * dilacak balik. `id` sengaja TIDAK ada di daftar ini.
   */
  private static readonly MASTER_DROPDOWN_WRITABLE = [
    'kategori_kehadiran',
    // CATATAN: `keterangan_terlambat` SENGAJA tidak ada di sini.
    //
    // Kolom itu ada di migrasi awal tabel ini (legacy/supabase/migrations/
    // 20260129_create_master_dropdown.sql) dan masih dipakai frontend, tetapi
    // TIDAK ada di model `master_dropdown` pada schema.prisma. Selama Prisma tidak
    // mengenalnya, setiap upaya menulis ke kolom itu ditolak sebagai field asing
    // dan keluar sebagai 500 yang tidak menjelaskan apa pun. Dibiarkan di luar
    // daftar ini supaya pesannya jelas, bukan supaya masalahnya dianggap beres —
    // perbaikan sebenarnya ada di schema.prisma. Lihat catatan di bawah.
    'jenis_ketidakhadiran',
    'status_ketidakhadiran',
    'golongan',
    'pangkat',
    'tugas_tambahan',
    'jenis_surat',
    'urutan',
    'aktif',
  ];

  private pickMasterDropdownFields(data: any) {
    const out: Record<string, any> = {};
    for (const field of SiteSettingsService.MASTER_DROPDOWN_WRITABLE) {
      if (data?.[field] !== undefined) out[field] = data[field];
    }
    return out;
  }

  async createMasterDropdown(data: any) {
    const payload = this.pickMasterDropdownFields(data);
    if (Object.keys(payload).length === 0) {
      throw new BadRequestException('Tidak ada kolom dropdown yang dapat disimpan');
    }
    return this.prisma.master_dropdown.create({
      data: payload,
    });
  }

  async updateMasterDropdown(id: number | string, data: any) {
    const parsedId = BigInt(id);
    const payload = this.pickMasterDropdownFields(data);
    if (Object.keys(payload).length === 0) {
      throw new BadRequestException('Tidak ada kolom dropdown yang diperbarui');
    }
    return this.prisma.master_dropdown.update({
      where: { id: parsedId },
      data: payload,
    });
  }

  async deleteMasterDropdown(id: number | string) {
    const parsedId = BigInt(id);
    return this.prisma.master_dropdown.delete({
      where: { id: parsedId },
    });
  }

  async getMasterDropdownByColumnNull(columnKey: string) {
    // `columnKey` datang langsung dari query string. Kolom yang tidak dikenal
    // membuat Prisma menolak query dan keluar sebagai 500 yang membingungkan,
    // jadi dicocokkan dulu ke daftar kolom yang memang ada.
    if (!SiteSettingsService.MASTER_DROPDOWN_WRITABLE.includes(columnKey)) {
      throw new BadRequestException(`Kolom dropdown '${columnKey}' tidak dikenal`);
    }
    return this.prisma.master_dropdown.findFirst({
      where: { [columnKey]: null },
      orderBy: { id: 'asc' }
    });
  }

  async getFileStorageConfig(isFullAccess = false, all = false) {
    const sanitize = (config: any) => {
      if (!config) return config;
      const {
        cloudflare_secret_access_key,
        cloudflare_access_key_id,
        supabase_service_role_key,
        ...safeConfig
      } = config;
      return safeConfig;
    };

    if (all) {
      const data = await this.prisma.file_storage_config.findMany({
        orderBy: { created_at: 'desc' },
      });
      return isFullAccess ? data : data.map(sanitize);
    }
    const data = await this.prisma.file_storage_config.findFirst({
      where: { is_active: true },
      orderBy: { created_at: 'desc' },
    });
    return isFullAccess ? data : sanitize(data);
  }

  async switchFileStorageConfig(id: string) {
    return this.prisma.$transaction(async tx => {
      await tx.file_storage_config.findUniqueOrThrow({ where: { id } });
      await tx.file_storage_config.updateMany({ where: { is_active: true }, data: { is_active: false } });
      const result = await tx.file_storage_config.update({ where: { id }, data: { is_active: true, updated_at: new Date() } });
      const { cloudflare_secret_access_key, cloudflare_access_key_id, ...safe } = result;
      return safe;
    }, { isolationLevel: 'Serializable' });
  }

  async updateFileStorageConfig(id: string, data: any) {
    const allowed = ['hosting_url','php_upload_path','php_delete_path','supabase_bucket','google_drive_folder_id','cloudflare_account_id','cloudflare_access_key_id','cloudflare_secret_access_key','cloudflare_bucket_name','cloudflare_public_url','cloudflare_cdn_domain','max_file_size_mb','allowed_extensions'];
    const patch: any = Object.fromEntries(allowed.filter(k => data[k] !== undefined).map(k => [k,data[k]]));
    for (const key of ['cloudflare_access_key_id','cloudflare_secret_access_key']) if (!patch[key]) delete patch[key];
    const result = await this.prisma.file_storage_config.update({ where: { id }, data: { ...patch, updated_at: new Date() } });
    const { cloudflare_access_key_id, cloudflare_secret_access_key, ...safe } = result;
    return safe;
  }

  /**
   * Baca satu pengaturan sistem.
   *
   * Dulu ada cabang `all` yang mengembalikan seluruh tabel `system_config` dalam
   * satu objek. Cabang itu dibuang bersama parameter `?all=true` di controller:
   * tidak ada pemanggil yang memakainya, sedangkan keberadaannya berarti fungsi
   * "tumpahkan semua pengaturan" tetap tersedia untuk dirangkai ulang di endpoint
   * yang mungkin tidak segera terlihat siapa yang boleh memanggilnya. Penyaringan
   * kunci publik ada di controller (`KUNCI_CONFIG_PUBLIK`).
   */
  async getSystemConfig(key?: string) {
    if (!key) throw new BadRequestException('key parameter required');
    const data = await this.prisma.system_config.findUnique({
      where: { key },
      select: { key: true, value: true },
    });
    return { ok: true, data: data?.value || '' };
  }

  async updateSystemConfig(key: string, value: string) {
    if (!key) throw new BadRequestException('key required');
    await this.prisma.system_config.upsert({
      where: { key },
      update: { value: value || '' },
      create: { key, value: value || '' },
    });
    return { ok: true };
  }

  async getTestimonials() {
    const data = await this.prisma.testimonials.findMany({
      orderBy: { created_at: 'desc' },
    });
    return { ok: true, data };
  }

  async createTestimonial(name?: string, quote?: string) {
    if (!quote) throw new BadRequestException('Quote is required');
    const data = await this.prisma.testimonials.create({
      data: { name: name || 'Anonim', quote, is_active: true },
    });
    return { ok: true, data };
  }

  async getStorageUsage() {
    const SUPABASE_LIMIT = parseInt(process.env.SUPABASE_STORAGE_LIMIT || '', 10) || 1073741824;
    const TABLE_LABELS: Record<string, string> = {
      personal_documents: 'Dokumen Personal',
      informasi_akademik: 'Informasi Akademik',
      ketidakhadiran: 'Ketidakhadiran',
      dokumen_siswa: 'Dokumen Siswa',
      uploaded_documents: 'Dokumen Unggah',
      tugas_siswa: 'Tugas Siswa',
      acca_letters: 'Surat AC',
      surat: 'Surat',
      ptsp_peminjaman_sarana: 'PTSP Pinjam Sarana',
      ptsp_izin_penelitian: 'PTSP Izin Penelitian',
      ptsp_pengaduan: 'PTSP Pengaduan',
      ptsp_sosialisasi: 'PTSP Sosialisasi',
    };

    const configs = await this.prisma.file_storage_config.findMany({
      orderBy: { created_at: 'desc' },
    });

    const results = [];

    const uploads = await this.prisma.file_uploads.findMany({
      select: { storage_type: true, folder: true, size_bytes: true },
    });

    const formatBytes = (bytes: number): string => {
      if (!bytes || bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    for (const cfg of configs) {
      const storageType = cfg.storage_type as 'supabase' | 'cloudflare';
      const limitBytes = storageType === 'supabase' ? SUPABASE_LIMIT : null;
      const bucketName = storageType === 'supabase' ? cfg.supabase_bucket : cfg.cloudflare_bucket_name;

      const providerUploads = uploads.filter((u) => u.storage_type === storageType);
      const breakdown: Record<string, { count: number; sizeBytes: number }> = {};
      let totalBytes = 0;

      for (const row of providerUploads) {
        const folder = (row.folder || 'general').replace(/^owner:[^:]+:/, '');
        if (!breakdown[folder]) breakdown[folder] = { count: 0, sizeBytes: 0 };
        const size = Number(row.size_bytes) || 0;
        breakdown[folder].count++;
        breakdown[folder].sizeBytes += size;
        totalBytes += size;
      }

      const percentUsed = limitBytes ? Math.min((totalBytes / limitBytes) * 100, 100) : null;

      const usage = {
        provider: storageType,
        bucket: bucketName,
        fileCount: providerUploads.length,
        usedBytes: totalBytes,
        totalBytes: limitBytes,
        remainingBytes: limitBytes != null ? Math.max(0, limitBytes - totalBytes) : null,
        usedFormatted: formatBytes(totalBytes),
        totalFormatted: limitBytes != null ? formatBytes(limitBytes) : 'Unlimited',
        remainingFormatted: limitBytes != null ? formatBytes(Math.max(0, limitBytes - totalBytes)) : '-',
        percentUsed,
        message: providerUploads.length > 0 ? `${providerUploads.length} file tercatat (${formatBytes(totalBytes)})` : 'Belum ada file tercatat',
        breakdown,
        isActive: cfg.is_active,
      };

      const { cloudflare_secret_access_key, cloudflare_access_key_id, ...safe } = cfg;
      results.push({ ...safe, usage, tableLabels: TABLE_LABELS });
    }

    return { ok: true, data: results };
  }

  async canDeleteFile(url: string, user: any) {
    if (!user?.id || !url) return false;
    const roles = user.roles || String(user.role || '').split(/[,|]/).map((r: string) => r.trim().toUpperCase());
    if (roles.some((r: string) => ['ADMIN','ADMINISTRATOR'].includes(r))) return true;
    const entry = await this.prisma.file_uploads.findUnique({ where: { file_url: url } });
    return !!user.auth_id && !!entry?.folder?.startsWith(`owner:${user.auth_id}:`);
  }

  async registerUpload(entry: { file_url: string; file_name?: string; folder?: string; size_bytes?: number; storage_type?: string; owner_auth_id?: string }) {
    if (!entry.file_url) return null;
    const existing = await this.prisma.file_uploads.findUnique({ where: { file_url: entry.file_url } });
    const folder = existing?.folder?.startsWith('owner:') ? existing.folder : entry.owner_auth_id ? `owner:${entry.owner_auth_id}:${entry.folder || 'general'}` : entry.folder || 'general';
    return this.prisma.file_uploads.upsert({
      where: { file_url: entry.file_url },
      create: {
        file_url: entry.file_url,
        file_name: entry.file_name || null,
        folder,
        size_bytes: BigInt(entry.size_bytes || 0),
        storage_type: entry.storage_type || null,
      },
      update: {
        file_name: entry.file_name || null,
        folder,
        size_bytes: BigInt(entry.size_bytes || 0),
        storage_type: entry.storage_type || null,
      }
    });
  }

  async unregisterUpload(fileUrl?: string) {
    if (!fileUrl) return null;
    return this.prisma.file_uploads.deleteMany({
      where: { file_url: fileUrl }
    });
  }
}


