import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage.service';
import { AuditService } from '../common/audit.service';
import {
  FeatureAccessGuard,
  INFORMASI_KELOLA_KEY,
  INFORMASI_AKADEMIK_KEY,
  INFORMASI_KEASRAMAAN_KEY,
  INFORMASI_KESISWAAN_KEY,
  INFORMASI_UMUM_KEY,
  PENGUMUMAN_KELOLA_KEY,
  ROLE_ADMIN,
  WKM_INFORMASI,
  aksesDiizinkan,
  rolesUser,
} from '../auth/feature-access.guard';

/** Role aplikasi → nilai `audience` yang dipakai kolom dokumen. */
const ROLE_KE_AUDIENCE: Record<string, string> = {
  GURU: 'guru',
  SISWA: 'siswa',
  ORANG_TUA: 'orangtua',
  ORANGTUA: 'orangtua',
};

@Injectable()
export class InformasiService {
  private readonly logger = new Logger(InformasiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly featureAccess: FeatureAccessGuard,
    private readonly audit?: AuditService,
  ) {}

  /** Mengambil riwayat aktivitas audit */
  async getAuditLogs(limit = 50, offset = 0, entity?: string) {
    if (!this.audit) {
      return { ok: true, total: 0, data: [] };
    }
    return this.audit.getRecentLogs(limit, offset, entity);
  }

  /** Ekstrak nama divisi dari string kategori, e.g. "[Akademik] Kurikulum" -> "Akademik" */
  parseDivision(rawCategory?: string): string {
    if (!rawCategory) return 'Akademik';
    const match = rawCategory.match(/^\[([^\]]+)\]\s*(.+)$/);
    const divMap: Record<string, string> = {
      'AKADEMIK': 'Akademik',
      'KESISWAAN': 'Kesiswaan',
      'KEASRAMAAN': 'Keasramaan',
      'HUMAS': 'Umum',
      'SARPRAS': 'Umum',
      'UMUM': 'Umum',
      'WKM_AKADEMIK': 'Akademik',
      'WKM_KESISWAAN': 'Kesiswaan',
      'WKM_KEASRAMAAN': 'Keasramaan',
      'WKM_HUMAS': 'Umum',
      'UNGGAHAN': 'Dokumen Unggahan',
      'DOKUMEN UNGGAHAN': 'Dokumen Unggahan',
    };
    if (match) {
      const rawDiv = match[1].trim().toUpperCase();
      return divMap[rawDiv] || match[1].trim();
    }
    for (const [key, mapped] of Object.entries(divMap)) {
      if (rawCategory.toUpperCase().startsWith(key + ' - ')) {
        return mapped;
      }
    }
    return 'Akademik';
  }

  isVisibleTo(audience: string | null | undefined, roleSet: Set<string>): boolean {
    const aud = (audience || 'umum').toLowerCase();
    if (aud === 'none') return false;
    if (roleSet.has('all')) return true;
    if (aud === 'umum') return true;
    return roleSet.has(aud);
  }

  /** Apakah user berhak mengelola divisi tertentu. */
  async bolehKelolaDivisi(user: any, division: string): Promise<boolean> {
    const roles = rolesUser(user);
    if (roles.some((r) => ROLE_ADMIN.includes(r))) return true;

    // Pengelola umum informasi memiliki akses ke semua divisi
    const generalKonfig = await this.featureAccess.bacaKonfigurasi(INFORMASI_KELOLA_KEY);
    if (aksesDiizinkan(user, generalKonfig)) return true;

    const div = (division || '').toLowerCase().trim();
    if (div === 'akademik' || div === 'dokumen unggahan' || div === 'unggahan') {
      const konfig = await this.featureAccess.bacaKonfigurasi(INFORMASI_AKADEMIK_KEY);
      return aksesDiizinkan(user, konfig, ['WKM_AKADEMIK']);
    }
    if (div === 'keasramaan') {
      const konfig = await this.featureAccess.bacaKonfigurasi(INFORMASI_KEASRAMAAN_KEY);
      return aksesDiizinkan(user, konfig, ['WKM_KEASRAMAAN']);
    }
    if (div === 'kesiswaan') {
      const konfig = await this.featureAccess.bacaKonfigurasi(INFORMASI_KESISWAAN_KEY);
      return aksesDiizinkan(user, konfig, ['WKM_KESISWAAN']);
    }
    if (div === 'umum') {
      const konfig = await this.featureAccess.bacaKonfigurasi(INFORMASI_UMUM_KEY);
      return aksesDiizinkan(user, konfig, ['WKM_HUMAS']);
    }
    return false;
  }

  /** Mengembalikan daftar nama divisi yang boleh dikelola oleh user. */
  async getDivisiDiizinkan(user: any): Promise<string[]> {
    const roles = rolesUser(user);
    if (roles.some((r) => ROLE_ADMIN.includes(r))) {
      return ['Akademik', 'Kesiswaan', 'Keasramaan', 'Umum', 'Dokumen Unggahan'];
    }
    const generalKonfig = await this.featureAccess.bacaKonfigurasi(INFORMASI_KELOLA_KEY);
    if (aksesDiizinkan(user, generalKonfig)) {
      return ['Akademik', 'Kesiswaan', 'Keasramaan', 'Umum', 'Dokumen Unggahan'];
    }

    const result: string[] = [];
    if (await this.bolehKelolaDivisi(user, 'Akademik')) {
      result.push('Akademik');
      result.push('Dokumen Unggahan');
    }
    if (await this.bolehKelolaDivisi(user, 'Kesiswaan')) {
      result.push('Kesiswaan');
    }
    if (await this.bolehKelolaDivisi(user, 'Keasramaan')) {
      result.push('Keasramaan');
    }
    if (await this.bolehKelolaDivisi(user, 'Umum')) {
      result.push('Umum');
    }
    return result;
  }

  /** Apakah user boleh mengelola minimal satu kategori informasi. */
  async bolehKelola(user: any): Promise<boolean> {
    const divisi = await this.getDivisiDiizinkan(user);
    return divisi.length > 0;
  }

  async getIzinInformasi(user: any) {
    const divisi = await this.getDivisiDiizinkan(user);
    const pengumumanKonfig = await this.featureAccess.bacaKonfigurasi(PENGUMUMAN_KELOLA_KEY);
    const bolehPengumuman = aksesDiizinkan(user, pengumumanKonfig, ['OP_PENGUMUMAN']);

    return {
      ok: true,
      data: {
        bolehKelola: divisi.length > 0,
        bolehPengumuman,
        divisi,
        kategori: {
          akademik: divisi.includes('Akademik'),
          kesiswaan: divisi.includes('Kesiswaan'),
          keasramaan: divisi.includes('Keasramaan'),
          umum: divisi.includes('Umum'),
          pengumuman: bolehPengumuman,
        },
      },
    };
  }

  /**
   * Cakupan baca milik `user`. Pengelola melihat semuanya; selain itu hanya
   * dokumen `umum` plus yang audience-nya cocok dengan salah satu rolenya.
   */
  private cakupanBaca(user: any, bolehKelola: boolean): Set<string> {
    if (bolehKelola) return new Set(['all']);
    const set = new Set<string>();
    for (const r of rolesUser(user)) {
      const aud = ROLE_KE_AUDIENCE[r];
      if (aud) set.add(aud);
    }
    return set;
  }

  async getInformasiUntuk(
    user: any,
    opts: { category?: string; mintaAdminView?: boolean },
  ) {
    const bolehKelola = await this.bolehKelola(user);
    return this.getInformasi({
      category: opts.category,
      roleSet: this.cakupanBaca(user, bolehKelola),
      // Tampilan admin (ikut menampilkan yang disembunyikan) hanya untuk
      // pengelola — permintaannya dari klien, izinnya dari server.
      isAdminView: bolehKelola && !!opts.mintaAdminView,
    });
  }

  async getInformasi(opts: { category?: string; roleSet: Set<string>; isAdminView: boolean }) {
    const { category, roleSet, isAdminView } = opts;

    let where: any = {};
    if (category) where.category = category;
    if (!isAdminView) {
      where.OR = [
        { show_on_landing: true },
        { show_on_landing: null }
      ];
    }

    let allData: any[] = await this.prisma.informasi_akademik.findMany({
      where,
      orderBy: { sort_order: 'asc' } // Prisma handles nulls differently, but asc is close enough
    });

    if (!isAdminView) {
      allData = allData.filter(d => this.isVisibleTo(d.audience, roleSet));
    }

    // Dokumen unggahan selalu ikut diproses, lalu disaring `isVisibleTo` seperti
    // dokumen biasa. Dulu blok ini dilewati saat `roleSet` kosong, sehingga
    // pengguna yang rolenya tidak memetakan ke audience mana pun (mis. TU, TAMU)
    // kehilangan dokumen unggahan ber-audience `umum` yang seharusnya publik.
    {
      const categories = await this.prisma.upload_categories.findMany({
        select: { id: true, name: true, audience: true }
      });

      if (categories.length > 0) {
        const catIds = categories.map(c => c.id);
        const uploads = await this.prisma.uploaded_documents.findMany({
          where: { category_id: { in: catIds } }
        });

        const catMap = categories.reduce((acc: any, c: any) => {
          acc[c.id] = c;
          return acc;
        }, {});

        let mappedUploads = uploads.map((u: any) => {
          const catAudience = catMap[u.category_id]?.audience || 'none';
          const fileAudience = catAudience === 'none' ? 'none' : (u.audience || catAudience);
          return {
            id: `upload_${u.id}`,
            real_id: u.id,
            title: u.file_name,
            category: `[Unggahan] ${u.category_name}`,
            file_url: u.file_url,
            file_name: u.file_name,
            file_size: u.file_size ? Number(u.file_size) : null,
            show_on_landing: String(fileAudience).toLowerCase() === 'umum',
            sort_order: 9999,
            created_at: u.created_at,
            is_upload_doc: true,
            audience: fileAudience,
            folder_audience: catAudience,
          };
        });

        if (!isAdminView) {
          mappedUploads = mappedUploads.filter(u => this.isVisibleTo(u.audience, roleSet));
        }
        if (category) {
          mappedUploads = mappedUploads.filter(u => u.category === category);
        }

        allData = [...allData, ...mappedUploads];
      }
    }

    // Convert bigints to strings/numbers to avoid JSON stringify error
    const formatData = (data: any) => {
      return JSON.parse(JSON.stringify(data, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ));
    };

    return { ok: true, data: formatData(allData) };
  }

  async createInformasi(body: any, user?: any) {
    const { title, category, file_url, file_name, file_type, file_size, show_on_landing = true, sort_order = 999 } = body;

    if (!title || !category || !file_url) {
      throw new BadRequestException('Data tidak lengkap');
    }

    const division = this.parseDivision(category);
    if (!(await this.bolehKelolaDivisi(user, division))) {
      throw new ForbiddenException(`Akses ditolak. Anda tidak memiliki izin untuk mengelola kategori ${division}.`);
    }

    // Pembuat diambil dari sesi, bukan dari body. Sebelumnya `user_id` dikirim
    // klien sehingga jejak unggahan bisa diatasnamakan orang lain.
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const authId = String(user?.auth_id || '');
    const validUserId = uuidRegex.test(authId) ? authId : null;

    const data = await this.prisma.informasi_akademik.create({
      data: {
        title,
        category,
        file_url,
        file_name,
        file_type,
        file_size,
        show_on_landing,
        sort_order,
        created_by: validUserId
      }
    });

    // Jika ini berkas nyata (bukan placeholder), bersihkan placeholder kosong di folder tersebut
    if (file_url && file_url !== '#' && title !== 'Folder placeholder') {
      await this.prisma.informasi_akademik.deleteMany({
        where: {
          category,
          file_url: '#',
          title: 'Folder placeholder'
        }
      }).catch(() => null);
    }

    return { ok: true, data: JSON.parse(JSON.stringify(data, (_, v) => typeof v === 'bigint' ? v.toString() : v)) };
  }

  async updateInformasi(body: any, user?: any) {
    const { id, show_on_landing, sort_order, category, new_category, updates, audience, is_category } = body;

    if (is_category && category && audience !== undefined) {
      const division = this.parseDivision(category);
      if (!(await this.bolehKelolaDivisi(user, division))) {
        throw new ForbiddenException(`Akses ditolak. Anda tidak memiliki izin untuk mengelola kategori ${division}.`);
      }
      await this.prisma.upload_categories.updateMany({
        where: { name: category },
        data: { audience }
      });
      return { ok: true };
    }

    if (Array.isArray(updates)) {
      for (const u of updates) {
        let cat = u.category;
        if (!cat) {
          const isUpload = typeof u.id === 'string' && u.id.startsWith('upload_');
          if (isUpload) {
            cat = 'Dokumen Unggahan';
          } else {
            const row = await this.prisma.informasi_akademik.findUnique({
              where: { id: u.id },
              select: { category: true }
            });
            cat = row?.category;
          }
        }
        const div = this.parseDivision(cat);
        if (!(await this.bolehKelolaDivisi(user, div))) {
          throw new ForbiddenException(`Akses ditolak. Anda tidak memiliki izin untuk mengelola kategori ${div}.`);
        }
      }

      // Satu transaksi: penataan ulang drag-and-drop mengirim banyak baris
      // sekaligus, dan dengan Promise.all satu id tidak valid membuat sebagian
      // urutan tersimpan sementara sisanya gagal.
      await this.prisma.$transaction(
        updates.map((u: any) => {
          const isUpload = typeof u.id === 'string' && u.id.startsWith('upload_');
          const realId = isUpload ? u.id.replace('upload_', '') : u.id;

          const updateObj: any = {};
          if (u.sort_order !== undefined) updateObj.sort_order = u.sort_order;
          if (u.show_on_landing !== undefined) updateObj.show_on_landing = u.show_on_landing;
          if (u.category !== undefined) updateObj.category = u.category;
          if (u.audience !== undefined) updateObj.audience = u.audience;

          return isUpload
            ? this.prisma.uploaded_documents.update({ where: { id: realId }, data: updateObj })
            : this.prisma.informasi_akademik.update({ where: { id: realId }, data: updateObj });
        }),
      );
      return { ok: true };
    }

    if (category && new_category) {
      const oldDiv = this.parseDivision(category);
      const newDiv = this.parseDivision(new_category);
      if (!(await this.bolehKelolaDivisi(user, oldDiv)) || !(await this.bolehKelolaDivisi(user, newDiv))) {
        throw new ForbiddenException(`Akses ditolak. Anda tidak memiliki izin untuk mengubah kategori ${oldDiv} / ${newDiv}.`);
      }

      const baru = String(new_category).trim();
      if (!baru) throw new BadRequestException('Nama folder baru tidak boleh kosong');

      const existing = await this.prisma.informasi_akademik.findFirst({
        where: { category: baru }
      });
      if (existing) throw new BadRequestException('Nama folder sudah ada');

      // Dokumen unggahan menyimpan nama folder tanpa awalan divisi (`[Akademik] X`
      // di informasi_akademik vs `X` di upload_categories). Tanpa ikut diganti,
      // folder terbelah jadi dua setelah operasi ini.
      const tanpaDivisi = (s: string) => s.replace(/^\[[^\]]+\]\s*/, '').trim();
      const lamaPolos = tanpaDivisi(category);
      const baruPolos = tanpaDivisi(baru);

      await this.prisma.$transaction([
        this.prisma.informasi_akademik.updateMany({
          where: { category },
          data: { category: baru }
        }),
        this.prisma.upload_categories.updateMany({
          where: { name: lamaPolos },
          data: { name: baruPolos }
        }),
        this.prisma.uploaded_documents.updateMany({
          where: { category_name: lamaPolos },
          data: { category_name: baruPolos }
        }),
        this.prisma.informasi_share_links.updateMany({
          where: { scope: 'folder', folder: lamaPolos, division: oldDiv },
          data: { folder: baruPolos, division: newDiv }
        }),
      ]);

      if (this.audit) {
        await this.audit.record({
          user,
          action: 'RENAME_INFORMASI_FOLDER',
          entity: 'informasi_akademik',
          entityId: baru,
          details: {
            old_category: category,
            new_category: baru,
            old_folder: lamaPolos,
            new_folder: baruPolos,
            old_division: oldDiv,
            new_division: newDiv,
          },
        });
      }

      return { ok: true };
    }

    if (!id) throw new BadRequestException('ID is required');

    if (typeof id === 'string' && id.startsWith('upload_')) {
      if (!(await this.bolehKelolaDivisi(user, 'Dokumen Unggahan'))) {
        throw new ForbiddenException('Akses ditolak. Anda tidak memiliki izin mengelola Dokumen Unggahan.');
      }

      const realId = id.replace('upload_', '');
      const updateObj: any = {};
      if (audience !== undefined) updateObj.audience = audience;
      if (Object.keys(updateObj).length === 0) throw new BadRequestException('No valid fields to update');
      
      await this.prisma.uploaded_documents.update({
        where: { id: realId },
        data: updateObj
      });
      return { ok: true };
    }

    const existing = await this.prisma.informasi_akademik.findUnique({
      where: { id },
      select: { category: true }
    });
    if (!existing) throw new BadRequestException('Dokumen tidak ditemukan');

    const currentDiv = this.parseDivision(existing.category);
    if (!(await this.bolehKelolaDivisi(user, currentDiv))) {
      throw new ForbiddenException(`Akses ditolak. Anda tidak memiliki izin untuk mengelola kategori ${currentDiv}.`);
    }

    if (category) {
      const targetDiv = this.parseDivision(category);
      if (!(await this.bolehKelolaDivisi(user, targetDiv))) {
        throw new ForbiddenException(`Akses ditolak. Anda tidak memiliki izin untuk memindahkan ke kategori ${targetDiv}.`);
      }
    }

    const updateData: any = {};
    if (show_on_landing !== undefined) updateData.show_on_landing = show_on_landing;
    if (sort_order !== undefined) updateData.sort_order = sort_order;
    if (audience !== undefined) updateData.audience = audience;
    if (category !== undefined) updateData.category = category;

    if (Object.keys(updateData).length === 0) throw new BadRequestException('No valid fields to update');

    const data = await this.prisma.informasi_akademik.update({
      where: { id },
      data: updateData
    });
    
    return { ok: true, data: JSON.parse(JSON.stringify(data, (_, v) => typeof v === 'bigint' ? v.toString() : v)) };
  }

  async deleteInformasi(id: string, user?: any, options?: { keepFolder?: boolean }, req?: any) {
    if (!id) throw new BadRequestException('ID is required');

    // Id dokumen unggahan berawalan `upload_` dan tinggal di tabel lain;
    // sebelumnya selalu jatuh ke "Record not found".
    if (id.startsWith('upload_')) {
      if (!(await this.bolehKelolaDivisi(user, 'Dokumen Unggahan'))) {
        throw new ForbiddenException('Akses ditolak. Anda tidak memiliki izin mengelola Dokumen Unggahan.');
      }

      const realId = id.replace('upload_', '');
      const upload = await this.prisma.uploaded_documents.findUnique({
        where: { id: realId },
        select: { id: true, file_name: true, file_url: true, category_name: true },
      });
      if (!upload) throw new BadRequestException('Dokumen unggahan tidak ditemukan');

      if (upload.file_url && upload.file_url !== '#') {
        const { error } = await this.storage.removeByUrl(upload.file_url);
        if (error) {
          this.logger.warn(`Gagal menghapus berkas fisik uploaded_documents ${upload.file_url}: ${error.message}`);
        }
      }

      await this.prisma.uploaded_documents.delete({ where: { id: realId } });
      await this.prisma.informasi_share_links.deleteMany({
        where: { scope: 'file', doc_id: id }
      }).catch(() => null);

      if (this.audit) {
        await this.audit.record({
          user,
          req,
          action: 'DELETE_INFORMASI_DOC',
          entity: 'uploaded_documents',
          entityId: realId,
          details: {
            title: upload.file_name,
            file_name: upload.file_name,
            file_url: upload.file_url,
            category: upload.category_name,
            division: 'Dokumen Unggahan',
          },
        });
      }

      return { ok: true };
    }

    const record = await this.prisma.informasi_akademik.findUnique({
      where: { id },
      select: { title: true, file_name: true, file_url: true, category: true }
    });

    if (!record) throw new BadRequestException('Record not found');

    const div = this.parseDivision(record.category);
    if (!(await this.bolehKelolaDivisi(user, div))) {
      throw new ForbiddenException(`Akses ditolak. Anda tidak memiliki izin untuk menghapus dokumen kategori ${div}.`);
    }

    if (record.file_url && record.file_url !== '#') {
      // Diarahkan berdasarkan bentuk URL-nya. Versi lama mencocokkan regex
      // khas Supabase (`storage/v1/object/public/...`), sehingga begitu driver
      // pindah ke R2 berkasnya tidak pernah terhapus — tanpa error apa pun.
      const { error } = await this.storage.removeByUrl(record.file_url);
      if (error) {
        this.logger.warn(`Gagal menghapus berkas informasi ${record.file_url}: ${error.message}`);
      }
    }

    const shouldKeepFolder = options?.keepFolder !== false;
    let remainingCount = 0;
    if (shouldKeepFolder) {
      remainingCount = await this.prisma.informasi_akademik.count({
        where: {
          category: record.category,
          id: { not: id }
        }
      });
    }

    await this.prisma.informasi_akademik.delete({
      where: { id }
    });

    await this.prisma.informasi_share_links.deleteMany({
      where: { scope: 'file', doc_id: id }
    }).catch(() => null);

    if (this.audit) {
      await this.audit.record({
        user,
        req,
        action: 'DELETE_INFORMASI_DOC',
        entity: 'informasi_akademik',
        entityId: id,
        details: {
          title: record.title,
          file_name: record.file_name,
          file_url: record.file_url,
          category: record.category,
          division: div,
        },
      });
    }

    // Jika file yang dihapus adalah file terakhir dalam folder ini, buat placeholder agar folder tidak hilang
    if (shouldKeepFolder && remainingCount === 0) {
      await this.prisma.informasi_akademik.create({
        data: {
          title: 'Folder placeholder',
          category: record.category,
          file_url: '#',
          file_name: '',
          file_type: '',
          file_size: 0,
          sort_order: 999
        }
      });
    }

    return { ok: true };
  }

  async deleteFolder(category: string, user?: any, req?: any) {
    if (!category) throw new BadRequestException('Category wajib diisi');
    const div = this.parseDivision(category);
    if (!(await this.bolehKelolaDivisi(user, div))) {
      throw new ForbiddenException(`Akses ditolak. Anda tidak memiliki izin untuk menghapus folder ${div}.`);
    }

    const records = await this.prisma.informasi_akademik.findMany({
      where: { category },
      select: { id: true, file_url: true }
    });

    for (const record of records) {
      if (record.file_url && record.file_url !== '#') {
        await this.storage.removeByUrl(record.file_url).catch(() => null);
      }
    }

    await this.prisma.informasi_akademik.deleteMany({
      where: { category }
    });

    const tanpaDivisi = (s: string) => s.replace(/^\[[^\]]+\]\s*/, '').trim();
    const folderPolos = tanpaDivisi(category);

    const legacyUploads = await this.prisma.uploaded_documents.findMany({
      where: { category_name: folderPolos },
      select: { file_url: true }
    }).catch(() => []);

    for (const up of legacyUploads) {
      if (up.file_url && up.file_url !== '#') {
        await this.storage.removeByUrl(up.file_url).catch(() => null);
      }
    }

    await this.prisma.uploaded_documents.deleteMany({
      where: { category_name: folderPolos }
    }).catch(() => null);
    await this.prisma.upload_categories.deleteMany({
      where: { name: folderPolos }
    }).catch(() => null);

    // Hapus juga tautan publik terkait folder ini agar tidak ada broken/orphaned links
    await this.prisma.informasi_share_links.deleteMany({
      where: { scope: 'folder', folder: folderPolos, division: div }
    }).catch(() => null);

    if (this.audit) {
      await this.audit.record({
        user,
        req,
        action: 'DELETE_INFORMASI_FOLDER',
        entity: 'informasi_akademik',
        entityId: category,
        details: {
          category,
          division: div,
          deleted_doc_count: records.length,
        },
      });
    }

    return { ok: true };
  }

  async getShareLink(query: any, user?: any) {
    const { token, scope, doc_id, folder, division } = query;
    if (token) {
      const link = await this.prisma.informasi_share_links.findUnique({
        where: { token },
      });
      // Masa berlaku ikut diperiksa di sini. Sebelumnya hanya `revoked`, padahal
      // resolveShareToken di sisi web memeriksa keduanya — jadi tautan yang
      // sudah kedaluwarsa masih membocorkan nama folder & pembuatnya ke anonim.
      const kedaluwarsa = !!link?.expires_at && link.expires_at.getTime() < Date.now();
      if (!link || link.revoked || kedaluwarsa) {
        return { ok: false, error: 'Link tidak ditemukan atau sudah tidak berlaku' };
      }
      return { ok: true, data: link };
    }

    // Daftar tautan memuat `token`, yaitu kredensial akses publiknya. Tanpa
    // pembatasan ini pengguna mana pun bisa memanen token folder orang lain.
    if (!user) {
      throw new ForbiddenException('Akses ditolak: Autentikasi diperlukan');
    }

    let targetDivision = division;
    if (!targetDivision && scope === 'file' && doc_id) {
      const doc = await this.prisma.informasi_akademik.findUnique({
        where: { id: doc_id },
        select: { category: true },
      });
      if (doc) targetDivision = this.parseDivision(doc.category);
    }

    if (targetDivision) {
      if (!(await this.bolehKelolaDivisi(user, targetDivision))) {
        throw new ForbiddenException(`Akses ditolak: Anda tidak memiliki izin untuk melihat tautan publik divisi ${targetDivision}`);
      }
    } else if (!(await this.bolehKelola(user))) {
      throw new ForbiddenException('Hanya pengelola informasi yang dapat melihat daftar tautan publik');
    }

    const where: any = { scope: scope || 'folder' };
    if (scope === 'file' && doc_id) where.doc_id = doc_id;
    if (folder) where.folder = folder;
    if (division) where.division = division;

    const data = await this.prisma.informasi_share_links.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    return { ok: true, data };
  }

  async createShareLink(body: any, user: any, req?: any) {
    const { scope, division, folder, doc_id, label } = body || {};

    let targetDivision = division;
    if (scope === 'file' && doc_id) {
      const doc = await this.prisma.informasi_akademik.findUnique({
        where: { id: doc_id },
        select: { category: true },
      });
      if (!doc) throw new NotFoundException('Dokumen tidak ditemukan');
      targetDivision = this.parseDivision(doc.category);
    }

    if (!targetDivision && folder) {
      const sample = await this.prisma.informasi_akademik.findFirst({
        where: { category: { contains: folder } },
        select: { category: true },
      });
      if (sample) targetDivision = this.parseDivision(sample.category);
    }

    if (!targetDivision) targetDivision = 'Akademik';

    // Cek wewenang divisi secara spesifik
    if (!(await this.bolehKelolaDivisi(user, targetDivision))) {
      throw new ForbiddenException(`Akses ditolak: Anda tidak memiliki wewenang untuk membuat link publik pada divisi ${targetDivision}`);
    }

    // Token ini adalah satu-satunya pelindung dokumen yang dibagikan, jadi harus
    // dari sumber acak kriptografis.
    const token = randomBytes(12).toString('base64url');

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const authId = String(user?.auth_id || user?.sub || '');
    const validUserId = uuidRegex.test(authId) ? authId : null;
    const authorName = user?.nama || user?.nama_lengkap || user?.username || null;

    const data = await this.prisma.informasi_share_links.create({
      data: {
        token,
        scope: scope || 'folder',
        division: targetDivision,
        folder: scope === 'folder' ? folder : null,
        doc_id: scope === 'file' ? doc_id : null,
        label: label || null,
        created_by: validUserId,
        created_by_name: authorName,
        expires_at: null,
        revoked: false,
      },
    });

    if (this.audit) {
      await this.audit.record({
        user,
        req,
        action: 'CREATE_SHARE_LINK',
        entity: 'informasi_share_links',
        entityId: data.id,
        details: {
          token: data.token,
          scope: data.scope,
          division: data.division,
          folder: data.folder,
          doc_id: data.doc_id,
          label: data.label,
        },
      });
    }

    return { ok: true, data };
  }

  async toggleShareLink(id: string, revoked?: boolean, user?: any, req?: any) {
    const existing = await this.prisma.informasi_share_links.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Link publik tidak ditemukan');
    }

    if (user) {
      let targetDivision = existing.division;
      if (!targetDivision && existing.doc_id) {
        const doc = await this.prisma.informasi_akademik.findUnique({
          where: { id: existing.doc_id },
          select: { category: true },
        });
        if (doc) targetDivision = this.parseDivision(doc.category);
      }
      if (targetDivision && !(await this.bolehKelolaDivisi(user, targetDivision))) {
        throw new ForbiddenException(`Akses ditolak: Anda tidak memiliki wewenang untuk mengubah status link divisi ${targetDivision}`);
      }
    }

    const newRevoked = typeof revoked === 'boolean' ? revoked : !existing.revoked;
    const data = await this.prisma.informasi_share_links.update({
      where: { id },
      data: { revoked: newRevoked },
    });

    if (this.audit) {
      await this.audit.record({
        user,
        req,
        action: newRevoked ? 'REVOKE_SHARE_LINK' : 'RESTORE_SHARE_LINK',
        entity: 'informasi_share_links',
        entityId: id,
        details: {
          token: existing.token,
          division: existing.division,
          folder: existing.folder,
          doc_id: existing.doc_id,
          revoked: newRevoked,
        },
      });
    }

    return { ok: true, data };
  }

  async deleteShareLink(id: string, user?: any, req?: any) {
    const existing = await this.prisma.informasi_share_links.findUnique({
      where: { id },
    });
    if (existing && user) {
      let targetDivision = existing.division;
      if (!targetDivision && existing.doc_id) {
        const doc = await this.prisma.informasi_akademik.findUnique({
          where: { id: existing.doc_id },
          select: { category: true },
        });
        if (doc) targetDivision = this.parseDivision(doc.category);
      }
      if (targetDivision && !(await this.bolehKelolaDivisi(user, targetDivision))) {
        throw new ForbiddenException(`Akses ditolak: Anda tidak memiliki wewenang untuk menghapus link divisi ${targetDivision}`);
      }
    }

    await this.prisma.informasi_share_links.delete({
      where: { id },
    }).catch(() => null);

    if (existing && this.audit) {
      await this.audit.record({
        user,
        req,
        action: 'DELETE_SHARE_LINK',
        entity: 'informasi_share_links',
        entityId: id,
        details: {
          token: existing.token,
          division: existing.division,
          folder: existing.folder,
          doc_id: existing.doc_id,
          label: existing.label,
        },
      });
    }

    return { ok: true };
  }
}

